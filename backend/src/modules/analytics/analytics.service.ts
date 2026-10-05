import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { uploadFileToR2 } from "../../utils/r2storage";
import fs from "fs";
import path from "path";
import logger from "../../config/logger";


class AnalyticsService {
  async recordPageVisit(page: string, userAgent?: string) {
    const dateStr = new Date().toISOString().split('T')[0];
    return prisma.pageVisit.create({
      data: {
        date: dateStr,
        page: page || "/",
        userAgent,
      }
    });
  }

  async getPageVisits(days: number = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const dateStr = start.toISOString().split('T')[0];
    
    // Group by date
    const visits = await prisma.pageVisit.groupBy({
      by: ['date'],
      where: {
        date: {
          gte: dateStr
        }
      },
      _count: {
        id: true
      }
    });

    const visitMap: Record<string, number> = {};
    visits.forEach((v: any) => {
      visitMap[v.date] = v._count.id;
    });

    return visitMap;
  }

  async uploadDailyReport(pdfBase64: string) {
    // Extract the base64 data
    const base64Data = pdfBase64.includes("base64,")
      ? pdfBase64.split("base64,")[1]
      : pdfBase64;
    
    const buffer = Buffer.from(base64Data, "base64");
    const dateStr = new Date().toISOString().split('T')[0];
    const relativePath = `reports/DAILY-${dateStr}_${Date.now()}.pdf`;

    // Check R2 Config
    const isR2Configured = 
      process.env.R2_ENDPOINT && 
      process.env.R2_ACCESS_KEY_ID && 
      process.env.R2_SECRET_ACCESS_KEY && 
      process.env.R2_BUCKET_NAME;

    if (isR2Configured) {
      try {
        const reportUrl = await uploadFileToR2(buffer, relativePath, "application/pdf");
        return { reportUrl };
      } catch (err) {
        logger.error("R2 Upload failed, falling back to local:", err);
      }
    }

    // Local Storage Fallback
    const uploadDir = path.join(process.cwd(), "uploads", "reports");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const absolutePath = path.join(process.cwd(), "uploads", relativePath);
    await fs.promises.writeFile(absolutePath, buffer);
    
    const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
    const reportUrl = `${baseUrl}/uploads/${relativePath}`;

    return { reportUrl };
  }

  async getDailyStats() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const dateStr = start.toISOString().split('T')[0];

    // 1. Futsal Bookings
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { date: dateStr },
          { createdAt: { gte: start, lte: end } },
          { updatedAt: { gte: start, lte: end } }
        ]
      }
    });
    
    const confirmedBookings = bookings.filter(b => b.paymentStatus === "completed" || b.paymentStatus === "partially_paid");

    // 2. Expenses
    const expenses = await prisma.expense.findMany({
      where: {
        date: dateStr
      }
    });

    // 3. Gamezone Records
    const gamezoneRecords = await prisma.gamezoneRecord.findMany({
      where: {
        date: dateStr
      }
    });

    // 4. Shop/Inventory Sales (Orders)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: "completed"
      }
    });

    // 5. Inventory Breakdown
    const products = await prisma.product.findMany({
      select: {
        name: true,
        inventory: true
      }
    });

    const mineralWaterStock = products
      .filter(p => p.name.toLowerCase().includes("mineral water") || p.name.toLowerCase().includes("water"))
      .reduce((sum, p) => sum + p.inventory, 0);
    
    const otherStock = products
      .filter(p => !p.name.toLowerCase().includes("mineral water") && !p.name.toLowerCase().includes("water"))
      .reduce((sum, p) => sum + p.inventory, 0);

    // 6. Tournaments
    const completedTournaments = await (prisma.tournament as any).findMany({
      where: {
        status: "completed",
        paymentStatus: "paid",
        completedAt: { gte: start, lte: end }
      }
    });

    const tournamentRevenue = completedTournaments.reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0);

    // 6. Revenue Split (Cash vs Online)
    // Distinguish between regular bookings and membership payments
    const regularBookings = bookings.filter(b => !b.notes?.includes("MEMBERSHIP_PAYMENT"));
    const membershipBookings = bookings.filter(b => b.notes?.includes("MEMBERSHIP_PAYMENT"));

    const bookingCash = regularBookings.reduce((sum, b) => sum + (b.cashAmount || 0), 0);
    const bookingOnline = regularBookings.reduce((sum, b) => sum + (b.onlineAmount || 0), 0);

    const membershipCash = membershipBookings.reduce((sum, b) => sum + (b.cashAmount || 0), 0);
    const membershipOnline = membershipBookings.reduce((sum, b) => sum + (b.onlineAmount || 0), 0);

    // For Shop (Orders) - Need to include payment info
    const ordersWithPayment = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: "completed"
      },
      include: {
        payment: true
      }
    });

    const shopCash = ordersWithPayment
      .filter(o => o.payment?.paymentMethod?.toLowerCase() === "cash")
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    
    const shopOnline = ordersWithPayment
      .filter(o => o.payment?.paymentMethod?.toLowerCase() !== "cash")
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // Gamezone - assuming cash as no method is recorded
    const gamezoneRevenue = gamezoneRecords.reduce((sum, r) => sum + (r.money || 0), 0);

    // Tournaments - assuming cash for now or we can split if needed, but usually large amounts are cash/cheque in this context
    const totalCash = bookingCash + shopCash + gamezoneRevenue + membershipCash + tournamentRevenue;
    const totalOnline = bookingOnline + shopOnline + membershipOnline;
    const totalRevenue = totalCash + totalOnline;
    
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.price || 0), 0);
    const bookingsCount = bookings.length;

    return {
      date: dateStr,
      bookingsCount,
      cash: totalCash,
      online: totalOnline,
      income: totalRevenue,
      expenses: totalExpenses,
      netProfit: Math.max(0, totalRevenue - totalExpenses),
      membershipRevenue: {
        cash: membershipCash,
        online: membershipOnline,
        total: membershipCash + membershipOnline
      },
      tournamentRevenue: {
        total: tournamentRevenue,
        items: completedTournaments.map((t: any) => ({
          name: t.name,
          amount: (t as any).totalAmount,
          organizer: (t as any).organizerName || "N/A"
        }))
      },
      mineralWaterStock,
      otherStock,
      totalInventory: mineralWaterStock + otherStock,
      // New Inventory Sales from Bookings
      inventorySales: {
        waterSold: confirmedBookings.reduce((sum, b) => sum + ((b as any).waterBottles || 0), 0) +
                  completedTournaments.reduce((sum: number, t: any) => sum + (t.waterQuantity || 0), 0),
        addOns: [
          ...confirmedBookings
            .filter(b => b.addOns)
            .map(b => ({
              name: b.addOns,
              price: b.addOnsPrice,
              customer: b.customerName || b.customerPhone || "Guest"
            })),
          ...completedTournaments
            .filter((t: any) => (t.waterCharge || 0) > 0)
            .map((t: any) => ({
              name: `Mineral Water (${t.waterQuantity} units)`,
              price: t.waterCharge,
              customer: `Tournament: ${t.name}`
            }))
        ]
      }
    };
  }
}


export default new AnalyticsService();
