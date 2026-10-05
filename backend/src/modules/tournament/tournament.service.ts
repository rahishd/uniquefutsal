import { CreateTournamentDTO, UpdateTournamentDTO, CreateRegistrationDTO } from "./tournament.dto";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { uploadFileToR2 } from "../../utils/r2storage";
import fs from "fs";
import path from "path";
import logger from "../../config/logger";

type TournamentCalcInput = {
  bookedHours: number;
  hourlyRate?: number;
  groundTotal?: number;
  hasMineralWater: boolean;
  waterQuantity: number;
  waterUnitPrice: number;
  hasSkyRoofSpectator: boolean;
  skyRoofCharge: number;
  hasHealthInsurance: boolean;
  insurancePercent: number;
  advancePayment?: number;
};

type TournamentAgreementMeta = {
  firstPrize?: string;
  secondPrize?: string;
  thirdPrize?: string;
  organizerName?: string;
  startTime?: string;
  endTime?: string;
  bookedHours?: number;
  hourlyRate?: number;
  groundTotal?: number;
  advancePayment?: number;
  hasMineralWater?: boolean;
  waterQuantity?: number;
  waterUnitPrice?: number;
  waterCharge?: number;
  hasSkyRoofSpectator?: boolean;
  skyRoofCharge?: number;
  hasHealthInsurance?: boolean;
  insurancePercent?: number;
  insuranceCharge?: number;
  subTotal?: number;
  totalAmount?: number;
  registeredDate?: string;
  notes?: string;
  dailySchedules?: {
    date: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
  }[];
};

class TournamentService {
  private async getWaterProduct(dbClient: typeof prisma = prisma) {
    return dbClient.product.findFirst({
      where: {
        OR: [
          { name: { contains: "water", mode: "insensitive" } },
          { name: { contains: "mineral", mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private calculateAgreementTotals(input: TournamentCalcInput) {
    const baseHoursCharge = input.groundTotal !== undefined ? input.groundTotal : input.bookedHours * (input.hourlyRate || 0);
    const waterCharge = input.hasMineralWater
      ? input.waterQuantity * input.waterUnitPrice
      : 0;
    const skyRoofCharge = input.hasSkyRoofSpectator ? input.skyRoofCharge : 0;
    const subTotal = baseHoursCharge + waterCharge + skyRoofCharge;
    const insuranceCharge = input.hasHealthInsurance
      ? (subTotal * input.insurancePercent) / 100
      : 0;
    const totalAmount = subTotal + insuranceCharge;
    const advancePayment = input.advancePayment ?? 0;

    return {
      waterCharge,
      skyRoofCharge,
      insuranceCharge,
      subTotal,
      totalAmount,
      advancePayment,
    };
  }

  private parseAgreementMeta(description?: string | null): TournamentAgreementMeta {
    if (!description) return {};
    try {
      const parsed = JSON.parse(description) as { agreement?: TournamentAgreementMeta };
      return parsed?.agreement || {};
    } catch {
      return {};
    }
  }

  private buildDescription(notes: string | undefined, agreement: TournamentAgreementMeta): string {
    return JSON.stringify({
      notes: notes || "",
      agreement,
    });
  }

  async getAllTournaments() {
    return await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        registrations: true
      }
    });
  }

  async getTournamentById(id: string) {
    return await prisma.tournament.findUnique({
      where: { id },
      include: {
        registrations: true
      }
    });
  }

  async createTournament(data: CreateTournamentDTO) {
    const bookedHours = Math.max(0, data.bookedHours ?? 0);
    const hourlyRate = Math.max(0, data.hourlyRate ?? 0);
    const hasMineralWater = Boolean(data.hasMineralWater);
    const waterQuantity = Math.max(0, data.waterQuantity ?? 0);
    const hasSkyRoofSpectator = Boolean(data.hasSkyRoofSpectator);
    const hasHealthInsurance = Boolean(data.hasHealthInsurance);
    const insurancePercent = Math.max(0, data.insurancePercent ?? 5);

    return await prisma.$transaction(async (tx) => {
      const waterProduct = await this.getWaterProduct(tx as typeof prisma);
      const resolvedWaterPrice = hasMineralWater
        ? (waterProduct?.price ?? data.waterUnitPrice ?? 0)
        : 0;

      if (hasMineralWater && waterQuantity > 0) {
        if (!waterProduct) {
          throw new AppError(
            400,
            "Mineral water product is missing in inventory. Add it first."
          );
        }
        if (waterProduct.inventory < waterQuantity) {
          throw new AppError(
            400,
            `Insufficient water inventory. Available: ${waterProduct.inventory}`
          );
        }
        await tx.product.update({
          where: { id: waterProduct.id },
          data: { inventory: waterProduct.inventory - waterQuantity },
        });
      }

      const totals = this.calculateAgreementTotals({
        bookedHours,
        hourlyRate,
        hasMineralWater,
        waterQuantity,
        waterUnitPrice: resolvedWaterPrice,
        hasSkyRoofSpectator,
        skyRoofCharge: data.skyRoofCharge ?? 2000,
        hasHealthInsurance,
        insurancePercent,
        advancePayment: data.advancePayment,
        groundTotal: data.groundTotal,
      });

      return (tx.tournament as any).create({
        data: {
          name: data.name,
          prizePool: data.prizePool,
          minTeams: data.minTeams,
          maxTeams: data.maxTeams,
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: data.isActive ?? true,
          totalAmount: totals.totalAmount,
          paymentStatus: data.paymentStatus || "unpaid",
          description: this.buildDescription(data.description, {
            firstPrize: data.firstPrize,
            secondPrize: data.secondPrize,
            thirdPrize: data.thirdPrize,
            organizerName: data.organizerName,
            startTime: data.startTime,
            endTime: data.endTime,
            dailySchedules: data.dailySchedules 
              ? (typeof data.dailySchedules === 'string' ? JSON.parse(data.dailySchedules) : data.dailySchedules) 
              : undefined,
            bookedHours,
            hourlyRate,
            groundTotal: data.groundTotal,
            advancePayment: totals.advancePayment,
            hasMineralWater,
            waterQuantity,
            waterUnitPrice: resolvedWaterPrice,
            waterCharge: totals.waterCharge,
            hasSkyRoofSpectator,
            skyRoofCharge: totals.skyRoofCharge,
            hasHealthInsurance,
            insurancePercent,
            insuranceCharge: totals.insuranceCharge,
            subTotal: totals.subTotal,
            totalAmount: totals.totalAmount,
            registeredDate: data.registeredDate,
            notes: data.description,
          }),
        },
      });
    });
  }

  async updateTournament(id: string, data: UpdateTournamentDTO) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.tournament.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, "Tournament not found");
      }
      const existingAgreement = this.parseAgreementMeta(existing.description);

      const bookedHours = Math.max(0, data.bookedHours ?? existingAgreement.bookedHours ?? 0);
      const hourlyRate = Math.max(0, data.hourlyRate ?? existingAgreement.hourlyRate ?? 0);
      const hasMineralWater = data.hasMineralWater ?? existingAgreement.hasMineralWater ?? false;
      const waterQuantity = Math.max(0, data.waterQuantity ?? existingAgreement.waterQuantity ?? 0);
      const hasSkyRoofSpectator =
        data.hasSkyRoofSpectator ?? existingAgreement.hasSkyRoofSpectator ?? false;
      const hasHealthInsurance =
        data.hasHealthInsurance ?? existingAgreement.hasHealthInsurance ?? false;
      const insurancePercent = Math.max(
        0,
        data.insurancePercent ?? existingAgreement.insurancePercent ?? 5
      );

      const previousWaterUsed =
        existingAgreement.hasMineralWater && (existingAgreement.waterQuantity ?? 0) > 0
          ? existingAgreement.waterQuantity || 0
          : 0;
      const nextWaterUsed = hasMineralWater && waterQuantity > 0 ? waterQuantity : 0;
      const waterDelta = nextWaterUsed - previousWaterUsed;

      const waterProduct = await this.getWaterProduct(tx as typeof prisma);
      if (waterDelta > 0) {
        if (!waterProduct) {
          throw new AppError(
            400,
            "Mineral water product is missing in inventory. Add it first."
          );
        }
        if (waterProduct.inventory < waterDelta) {
          throw new AppError(
            400,
            `Insufficient water inventory. Available: ${waterProduct.inventory}`
          );
        }
        await tx.product.update({
          where: { id: waterProduct.id },
          data: { inventory: waterProduct.inventory - waterDelta },
        });
      }

      if (waterDelta < 0 && waterProduct) {
        await tx.product.update({
          where: { id: waterProduct.id },
          data: { inventory: waterProduct.inventory + Math.abs(waterDelta) },
        });
      }

      const resolvedWaterPrice = hasMineralWater
        ? data.waterUnitPrice ?? waterProduct?.price ?? existingAgreement.waterUnitPrice ?? 0
        : 0;

      const totals = this.calculateAgreementTotals({
        bookedHours,
        hourlyRate,
        hasMineralWater,
        waterQuantity,
        waterUnitPrice: resolvedWaterPrice,
        hasSkyRoofSpectator,
        skyRoofCharge: data.skyRoofCharge ?? existingAgreement.skyRoofCharge ?? 2000,
        hasHealthInsurance,
        insurancePercent,
        advancePayment: data.advancePayment,
        groundTotal: data.groundTotal,
      });

      return (tx.tournament as any).update({
        where: { id },
        data: {
          name: data.name,
          prizePool: data.prizePool,
          minTeams: data.minTeams,
          maxTeams: data.maxTeams,
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: data.isActive,
          paymentStatus: data.paymentStatus,
          totalAmount: totals.totalAmount,
          description: this.buildDescription(data.description, {
            firstPrize: data.firstPrize ?? existingAgreement.firstPrize,
            secondPrize: data.secondPrize ?? existingAgreement.secondPrize,
            thirdPrize: data.thirdPrize ?? existingAgreement.thirdPrize,
            organizerName: data.organizerName ?? existingAgreement.organizerName,
            startTime: data.startTime ?? existingAgreement.startTime,
            endTime: data.endTime ?? existingAgreement.endTime,
            dailySchedules: data.dailySchedules 
              ? (typeof data.dailySchedules === 'string' ? JSON.parse(data.dailySchedules) : data.dailySchedules) 
              : (existingAgreement.dailySchedules),
            bookedHours,
            hourlyRate,
            groundTotal: data.groundTotal ?? existingAgreement.groundTotal,
            advancePayment: totals.advancePayment,
            hasMineralWater,
            waterQuantity,
            waterUnitPrice: resolvedWaterPrice,
            waterCharge: totals.waterCharge,
            hasSkyRoofSpectator,
            skyRoofCharge: totals.skyRoofCharge,
            hasHealthInsurance,
            insurancePercent,
            insuranceCharge: totals.insuranceCharge,
            subTotal: totals.subTotal,
            totalAmount: totals.totalAmount,
            registeredDate: data.registeredDate ?? existingAgreement.registeredDate,
            notes: data.description ?? existingAgreement.notes,
          }),
        },
      });
    });
  }

  async deleteTournament(id: string) {
    return await prisma.tournament.delete({
      where: { id }
    });
  }

  async getAffectedItems(startDate: string, endDate: string, tournamentId?: string) {
    const affectedMemberships: any[] = [];
    // 1. Get all normal bookings in range
    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: { notIn: ["cancelled", "cancelled_due_to_tournament", "skipped_due_to_tournament"] }
      },
      include: { user: { select: { name: true, email: true } } }
    });

    // 2. Get all active memberships
    const subscriptions = await prisma.membershipSubscription.findMany({
      where: {
        status: { in: ["active", "pending"] },
        startDate: { lte: new Date(`${endDate}T23:59:59.999Z`) },
        endDate: { gte: new Date(`${startDate}T00:00:00.000Z`) }
      },
      include: { user: { select: { name: true, email: true, phoneNumber: true } }, plan: true }
    });

    // 3. Filter memberships that have slots on specific tournament days
    const tournamentsInRange = await prisma.tournament.findMany({
      where: {
        ...(tournamentId ? { id: tournamentId } : {
          isActive: true,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        })
      },
    });

    const filteredBookings = bookings.filter(b => {
      const tourneyOnDay = tournamentsInRange.find(t => t.startDate <= b.date && t.endDate >= b.date);
      if (!tourneyOnDay) return false;

      const meta = this.parseAgreementMeta(tourneyOnDay.description);
      const schedule = meta.dailySchedules?.find(s => s.date === b.date);

      if (!schedule || schedule.isOff) return false;

      const bStart = b.startTime;
      const bEnd = b.endTime;
      const tStart = schedule.startTime;
      const tEnd = schedule.endTime;

      // Overlap check
      return (bStart >= tStart && bStart < tEnd) || 
             (bEnd > tStart && bEnd <= tEnd) || 
             (bStart <= tStart && bEnd >= tEnd);
    });

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

      const tourneyOnDay = tournamentsInRange.find(t => t.startDate <= dateStr && t.endDate >= dateStr);
      if (!tourneyOnDay) continue;

      const meta = this.parseAgreementMeta(tourneyOnDay.description);
      const schedule = meta.dailySchedules?.find(s => s.date === dateStr);

      if (!schedule || schedule.isOff) continue;

      for (const sub of subscriptions) {
        const subStart = sub.startDate.toISOString().split('T')[0];
        const subEnd = sub.endDate.toISOString().split('T')[0];

        if (subStart <= dateStr && subEnd >= dateStr) {
          if (!sub.chosenDays || sub.chosenDays.length === 0 || sub.chosenDays.includes(weekday)) {
             const [subStartHour, subEndHour] = sub.timeSlot?.split('-') || [];
             if (!subStartHour || !subEndHour) continue;

             const tStart = schedule.startTime;
             const tEnd = schedule.endTime;

             // Overlap check for membership slot
             const isOverlapping = (subStartHour >= tStart && subStartHour < tEnd) || 
                                   (subEndHour > tStart && subEndHour <= tEnd) || 
                                   (subStartHour <= tStart && subEndHour >= tEnd);

             if (isOverlapping) {
               const alreadySkipped = await prisma.booking.findFirst({
                 where: {
                   userId: sub.userId,
                   date: dateStr,
                   startTime: subStartHour,
                   status: "skipped_due_to_tournament"
                 }
               });

               if (!alreadySkipped) {
                 affectedMemberships.push({
                   id: sub.id,
                   userId: sub.userId,
                   userName: sub.user?.name || sub.user?.email || sub.userId,
                   date: dateStr,
                   timeSlot: sub.timeSlot,
                   planName: sub.plan.name,
                   status: sub.status,
                   paymentStatus: sub.paymentStatus,
                   type: 'membership'
                 });
               }
             }
          }
        }
      }
    }

    return {
      bookings: filteredBookings.map(b => ({
        id: b.id,
        userId: b.userId,
        userName: b.customerName || b.user?.name || b.user?.email || b.userId,
        date: b.date,
        timeSlot: `${b.startTime}-${b.endTime}`,
        status: b.status,
        paymentStatus: b.paymentStatus,
        type: 'booking'
      })),
      memberships: affectedMemberships
    };
  }

  async applyTournamentActions(actions: any[]) {
    return await prisma.$transaction(async (tx) => {
      const results = [];
      const extendedSubscriptions = new Set<string>(); // subId_date to avoid multiple extensions for same day

      for (const action of actions) {
        if (action.type === 'booking') {
          const updated = await tx.booking.update({
            where: { id: action.id },
            data: { status: 'cancelled_due_to_tournament' }
          });
          results.push(updated);
        } else if (action.type === 'membership') {
          // 1. Create a "skipped" booking record
          const sub = await tx.membershipSubscription.findUnique({
            where: { id: action.id },
            include: { plan: true }
          });

          if (!sub) continue;

          const startHour = sub.timeSlot?.split('-')[0] || "00:00";
          const endHour = sub.timeSlot?.split('-')[1] || "01:00";

          // 2. Extend membership by 1 day if not already extended for this user on this day
          const extensionKey = `${sub.id}_${action.date}`;
          if (!extendedSubscriptions.has(extensionKey)) {
            const currentEndDate = new Date(sub.endDate);
            const newEndDate = new Date(currentEndDate);
            newEndDate.setDate(newEndDate.getDate() + 1);

            const existingNotes = (sub as any).notes;
            await (tx.membershipSubscription as any).update({
              where: { id: sub.id },
              data: {
                endDate: newEndDate,
                notes: existingNotes ? `${existingNotes}\n[SKIP] Extended by 1 day due to tournament on ${action.date}` : `[SKIP] Extended by 1 day due to tournament on ${action.date}`
              }
            });
            extendedSubscriptions.add(extensionKey);
          }

          // 1. Create a "skipped" booking record (after extension to ensure notes are clean)
          const skippedBooking = await tx.booking.create({
            data: {
              userId: sub.userId,
              date: action.date,
              startTime: startHour,
              endTime: endHour,
              duration: 1,
              basePrice: 0,
              subtotal: 0,
              totalPrice: 0,
              paymentMethod: 'membership',
              paymentStatus: 'completed',
              status: 'skipped_due_to_tournament',
              notes: `SUBSCRIPTION_ID: ${sub.id} | Skipped due to tournament on ${action.date}`,
              waterBottles: 0
            }
          });

          results.push(skippedBooking);
        }
      }
      return results;
    });
  }

  // Registrations
  async getRegistrations(tournamentId?: string) {
    if (tournamentId) {
      return await prisma.registration.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "desc" }
      });
    }
    return await prisma.registration.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  async createRegistration(data: CreateRegistrationDTO) {
    return await prisma.registration.create({
      data: {
        tournamentId: data.tournamentId,
        teamName: data.teamName,
        captainName: data.captainName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        players: JSON.stringify(data.players),
        status: "pending",
      }
    });
  }
  async completeTournament(id: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new AppError(404, "Tournament not found");
    }

    const meta = this.parseAgreementMeta(tournament.description);
    const totalAmount = meta.totalAmount || 0;

    return await (prisma.tournament as any).update({
      where: { id },
      data: {
        status: "completed",
        isActive: false,
        totalAmount: totalAmount,
        paymentStatus: "paid",
        completedAt: new Date(),
      }
    });
  }

  async uploadInvoice(id: string, pdfBase64: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      throw new AppError(404, "Tournament not found");
    }

    // Extract the base64 data (strip data URL prefix if present)
    const base64Data = pdfBase64.includes("base64,")
      ? pdfBase64.split("base64,")[1]
      : pdfBase64;
    
    const buffer = Buffer.from(base64Data, "base64");
    const relativePath = `invoices/TR-${id.slice(-6).toUpperCase()}_${Date.now()}.pdf`;

    // Fallback to local storage if R2 is not configured
    const isR2Configured = 
      process.env.R2_ENDPOINT && 
      process.env.R2_ACCESS_KEY_ID && 
      process.env.R2_SECRET_ACCESS_KEY && 
      process.env.R2_BUCKET_NAME;

    if (isR2Configured) {
      try {
        const invoiceUrl = await uploadFileToR2(buffer, relativePath, "application/pdf");
        return { invoiceUrl };
      } catch (err) {
        logger.error("R2 Upload failed, falling back to local:", err);
      }
    }

    // Local Storage Fallback
    const uploadDir = path.join(process.cwd(), "uploads", "invoices");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const absolutePath = path.join(process.cwd(), "uploads", relativePath);
    await fs.promises.writeFile(absolutePath, buffer);
    
    // Determine base URL (default to localhost if not specified)
    const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
    const invoiceUrl = `${baseUrl}/uploads/${relativePath}`;

    return { invoiceUrl };
  }
}

export default new TournamentService();
