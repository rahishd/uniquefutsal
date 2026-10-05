import { PrismaClient } from "@prisma/client";
import { moveUserKey, cleanupUserForDelete } from "./userKey";
import bookingService from "../booking/booking.service";
import { calculateLoyaltyProgress } from "../../utils/loyalty";

const prisma = new PrismaClient();

export const userService = {
  async getAllPlayers(page: number = 1, limit: number = 7, search?: string) {
    const skip = (page - 1) * limit;

    // 1. Get all unique phone numbers from both registered users and bookings
    const [registeredUsers, bookingCustomers] = await Promise.all([
      prisma.user.findMany({
        where: { role: "user" },
        select: { phoneNumber: true, name: true, email: true, createdAt: true, freeMatchesAvailable: true, loyaltyProgress: true, loyaltyEligible: true }
      }),
      prisma.booking.findMany({
        where: { userId: null, customerPhone: { not: null } },
        select: { customerPhone: true, customerName: true, customerEmail: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // 2. Merge into a unique list of players by phone number
    const playerMap = new Map<string, any>();

    // Add registered users first (they take priority)
    registeredUsers.forEach(u => {
      playerMap.set(u.phoneNumber, {
        phoneNumber: u.phoneNumber,
        name: u.name || "Unknown",
        email: u.email,
        createdAt: u.createdAt,
        isRegistered: true,
        freeMatchesAvailable: u.freeMatchesAvailable,
        loyaltyProgress: u.loyaltyProgress,
        loyaltyEligible: u.loyaltyEligible
      });
    });

    // Add booking customers if not already present
    bookingCustomers.forEach(b => {
      const phone = b.customerPhone!;
      if (!playerMap.has(phone)) {
        playerMap.set(phone, {
          phoneNumber: phone,
          name: b.customerName || "Unknown",
          email: b.customerEmail || "N/A",
          createdAt: b.createdAt, // This might be their first booking
          isRegistered: false,
          freeMatchesAvailable: 0,
          loyaltyProgress: 0,
          loyaltyEligible: false
        });
      }
    });

    let allPlayers = Array.from(playerMap.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (search) {
      const q = search.toLowerCase();
      allPlayers = allPlayers.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.phoneNumber.includes(q) || 
        (p.email && p.email.toLowerCase().includes(q))
      );
    }

    const total = allPlayers.length;
    const paginatedPlayers = allPlayers.slice(skip, skip + limit);

    // 3. Get global stats for total matches and active players
    const [totalMatches, monthlyActiveCount] = await Promise.all([
      prisma.booking.aggregate({
        where: { status: "completed" },
        _sum: { duration: true }
      }).then(res => res._sum.duration || 0),
      prisma.booking.groupBy({
        by: ['customerPhone', 'userId'],
        where: {
          status: "completed",
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }).then(res => res.length)
    ]);

    // 4. Fetch stats for the paginated players
    const phoneNumbers = paginatedPlayers.map(p => p.phoneNumber);
    
    const [durationSums, spendResults, lastBookings] = await Promise.all([
      prisma.booking.groupBy({
        by: ['customerPhone'],
        where: { 
          status: "completed",
          customerPhone: { in: phoneNumbers }
        },
        _sum: { duration: true }
      }),
      prisma.booking.groupBy({
        by: ['customerPhone'],
        where: { 
          status: "completed",
          customerPhone: { in: phoneNumbers }
        },
        _sum: { totalPrice: true }
      }),
      prisma.booking.findMany({
        where: { 
          status: "completed",
          customerPhone: { in: phoneNumbers }
        },
        orderBy: { date: 'desc' },
        select: { customerPhone: true, date: true }
      })
    ]);

    // Sum of durations = total hours played = total matches (1hr = 1 match)
    const countsMap = new Map(durationSums.map(ds => [ds.customerPhone, ds._sum.duration || 0]));
    const spendMap = new Map(spendResults.map(sr => [sr.customerPhone, sr._sum.totalPrice || 0]));
    
    // Create a map for last booking dates
    const lastBookingMap = new Map();
    lastBookings.forEach(lb => {
      if (!lastBookingMap.has(lb.customerPhone)) {
        lastBookingMap.set(lb.customerPhone, lb.date);
      }
    });

    // Fetch all relevant matches for loyalty calculations
    const fetchedMatches = await prisma.booking.findMany({
      where: {
        customerPhone: { in: phoneNumbers },
        status: { in: ["completed", "confirmed", "pending"] },
        loyaltyEnabled: true,
        NOT: [
          { notes: { contains: "MEMBERSHIP_PAYMENT" } },
          { paymentMethod: "membership" }
        ]
      } as any,
      orderBy: { date: "desc" }
    });

    const now = new Date();
    const validMatches = fetchedMatches.filter(b => {
      if (b.status === "completed") return true;
      if (b.status === "confirmed") {
        // Parse date and time to accurately check if the match has ended
        const matchStart = new Date(`${b.date}T${b.startTime || '00:00'}:00`);
        // Add duration (in hours) to matchStart
        const matchEnd = new Date(matchStart.getTime() + (b.duration || 1) * 60 * 60 * 1000);
        return matchEnd < now;
      }
      return false;
    });

    const matchesByPhone = new Map<string, typeof validMatches>();
    validMatches.forEach(m => {
      const phone = m.customerPhone!;
      if (!matchesByPhone.has(phone)) {
        matchesByPhone.set(phone, []);
      }
      matchesByPhone.get(phone)!.push(m);
    });

    const allMatchesByPhone = new Map<string, typeof fetchedMatches>();
    fetchedMatches.forEach(m => {
      const phone = m.customerPhone!;
      if (!allMatchesByPhone.has(phone)) {
        allMatchesByPhone.set(phone, []);
      }
      allMatchesByPhone.get(phone)!.push(m);
    });

    const playersWithStats = paginatedPlayers.map(p => {
      const pMatches = matchesByPhone.get(p.phoneNumber) || [];
      const pAllMatches = allMatchesByPhone.get(p.phoneNumber) || [];

      const { loyaltyCount, isEligible } = calculateLoyaltyProgress(
        pMatches,
        p.freeMatchesAvailable || 0
      );

      return {
        ...p,
        lastBookedDate: lastBookingMap.get(p.phoneNumber) || "Never",
        totalMatches: countsMap.get(p.phoneNumber) || 0,
        totalSpend: spendMap.get(p.phoneNumber) || 0,
        loyaltyProgress: loyaltyCount,
        loyaltyEligible: isEligible
      };
    });

    return { 
      players: playersWithStats, 
      total,
      stats: {
        totalMatches,
        monthlyActiveCount
      }
    };
  },

  async getPlayerBookings(phoneNumber: string) {
    return await prisma.booking.findMany({
      where: {
         OR: [
           { userId: phoneNumber },
           { customerPhone: phoneNumber }
         ]
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        totalPrice: true,
        amountPaidNow: true,
        remainingAmount: true,
        paymentStatus: true,
        date: true,
        startTime: true,
        duration: true,
        status: true
      }
    });
  },

  async claimFreeMatch(phoneNumber: string) {
    const user = await prisma.user.findUnique({
      where: { phoneNumber }
    });

    if (!user) throw new Error("User not found");
    if (user.freeMatchesAvailable <= 0) throw new Error("No free matches available");

    return await prisma.user.update({
      where: { phoneNumber },
      data: {
        freeMatchesAvailable: {
          decrement: 1
        }
      }
    });
  },

  async awardFreeMatch(phoneNumber: string) {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) {
      // User doesn't exist yet (guest booking). Create a basic user account for them.
      const booking = await prisma.booking.findFirst({
        where: { customerPhone: phoneNumber },
        orderBy: { createdAt: 'desc' }
      });
      const name = booking?.customerName || "Unknown Player";
      const email = booking?.customerEmail || null;
      
      return await prisma.user.create({
        data: {
          phoneNumber,
          name,
          email,
          role: "user",
          isVerified: false,
          freeMatchesAvailable: 1,
          loyaltyProgress: 0,
          password: "guest_user_password"
        }
      });
    }

    return await prisma.user.update({
      where: { phoneNumber },
      data: {
        freeMatchesAvailable: {
          increment: 1
        },
        loyaltyProgress: 0
      }
    });
  },

  async searchPlayers(query: string, limit: number = 10) {
    const q = query.trim();
    if (!q) return [];

    const [users, bookingCustomers] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "user",
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phoneNumber: { contains: q } },
          ],
        },
        select: {
          phoneNumber: true,
          name: true,
        },
        take: Math.min(Math.max(limit, 1), 20),
        orderBy: {
          createdAt: "desc",
        },
      }),
      // Include manual-booking customers too (customerName/customerPhone)
      prisma.booking.findMany({
        where: {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q } },
          ],
          customerPhone: { not: null },
        },
        select: {
          customerName: true,
          customerPhone: true,
        },
        take: 20,
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    const merged: { name: string; phoneNumber: string }[] = [];
    const seen = new Set<string>();

    for (const u of users) {
      if (!u.phoneNumber) continue;
      const key = u.phoneNumber.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push({ phoneNumber: key, name: u.name || "" });
    }

    for (const b of bookingCustomers) {
      const phone = (b.customerPhone || "").trim();
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      merged.push({ phoneNumber: phone, name: (b.customerName || "").trim() });
    }

    return merged.slice(0, Math.min(Math.max(limit, 1), 20));
  },

  async deleteUser(phoneNumber: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Check if user exists
      const user = await tx.user.findUnique({
        where: { phoneNumber }
      });

      // Get count and revenue of bookings to preserve and log
      const userBookings = await tx.booking.findMany({
        where: { 
          OR: [
            { userId: phoneNumber },
            { customerPhone: phoneNumber }
          ]
        },
        select: {
          id: true,
          totalPrice: true
        }
      });
      const bookingsCount = userBookings.length;
      const bookingsTotalRevenue = userBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

      // Get count and revenue of orders/shop items to preserve and log
      const userOrders = await tx.order.findMany({
        where: { userId: phoneNumber },
        select: {
          id: true,
          totalPrice: true
        }
      });
      const ordersCount = userOrders.length;
      const ordersTotalRevenue = userOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      const dummyPhone = "deleted_player";

      if (user) {
        // Ensure dummy user exists to hold orphaned financial records
        await tx.user.upsert({
          where: { phoneNumber: dummyPhone },
          update: {},
          create: {
            phoneNumber: dummyPhone,
            name: "Deleted Player Profile",
            password: "deleted_player_placeholder_password",
            role: "user",
            isActive: false,
            isVerified: false
          }
        });

        // Customer-app data (points, team, preferences...): personal data goes, money records stay anonymised
        await cleanupUserForDelete(tx, phoneNumber);

        // Simple relations
        await tx.notification.deleteMany({ where: { userId: phoneNumber } });
        await tx.review.deleteMany({ where: { userId: phoneNumber } });
        await tx.userOTP.deleteMany({ where: { phoneNumber } });
        await tx.pendingSignup.deleteMany({ where: { phoneNumber } });

        // Re-associate orders to dummy user so financial reports are not broken
        await tx.order.updateMany({
          where: { userId: phoneNumber },
          data: { userId: dummyPhone }
        });

        // Re-associate transactions to dummy user so financial records are not broken
        await tx.transaction.updateMany({
          where: { userId: phoneNumber },
          data: { userId: dummyPhone }
        });

        // Re-associate membership subscriptions to dummy user so subscription history/revenue is not broken
        await tx.membershipSubscription.updateMany({
          where: { userId: phoneNumber },
          data: { userId: dummyPhone }
        });

        // Wallet
        try {
          // Use any to avoid type issues if table doesn't exist
          await (tx as any).wallet.delete({ where: { userId: phoneNumber } }).catch(() => {});
        } catch (e) {}

        // Finally delete the user
        await tx.user.delete({
          where: { phoneNumber },
        });
      }

      // 2. Clear bookings (completely delete player personal data from booking records while keeping financial values)
      await tx.booking.updateMany({
        where: { 
          OR: [
            { userId: phoneNumber },
            { customerPhone: phoneNumber }
          ]
        },
        data: {
          userId: null,
          customerPhone: null,
          customerName: "Deleted Player",
          customerEmail: null
        }
      });

      return {
        success: true,
        userName: user ? user.name : null,
        bookingsCount,
        bookingsTotalRevenue,
        ordersCount,
        ordersTotalRevenue
      };
    });
  },

  async updatePlayer(oldPhoneNumber: string, data: { name?: string, email?: string, phoneNumber?: string }) {
    const { name, email, phoneNumber: newPhoneNumber } = data;

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { phoneNumber: oldPhoneNumber }
      });

      if (user) {
        if (newPhoneNumber && newPhoneNumber !== oldPhoneNumber) {
          const existing = await tx.user.findUnique({ where: { phoneNumber: newPhoneNumber } });
          if (existing) throw new Error("The new phone number is already registered.");

          // Safer strategy for PK update: 
          // 1. Create a "shadow" user with the new number
          await tx.user.create({
            data: {
              ...user,
              phoneNumber: newPhoneNumber,
              name: name !== undefined ? name : user.name,
              email: email !== undefined ? email : user.email,
            }
          });

          // 2. Move all relations to the new number
          await tx.booking.updateMany({
            where: { userId: oldPhoneNumber },
            data: { userId: newPhoneNumber, customerPhone: newPhoneNumber }
          });

          await tx.membershipSubscription.updateMany({
            where: { userId: oldPhoneNumber },
            data: { userId: newPhoneNumber }
          });

          await tx.order.updateMany({
            where: { userId: oldPhoneNumber },
            data: { userId: newPhoneNumber }
          });

          await tx.transaction.updateMany({
            where: { userId: oldPhoneNumber },
            data: { userId: newPhoneNumber }
          });

          await tx.review.updateMany({
            where: { userId: oldPhoneNumber },
            data: { userId: newPhoneNumber }
          });

          await tx.notification.updateMany({
            where: { userId: oldPhoneNumber },
            data: { userId: newPhoneNumber }
          });

          await tx.userOTP.updateMany({
            where: { phoneNumber: oldPhoneNumber },
            data: { phoneNumber: newPhoneNumber }
          });

          // Customer-app tables hold the phone number as a plain value: move them too
          await moveUserKey(tx, oldPhoneNumber, newPhoneNumber);

          // 3. Delete the old user
          await tx.user.delete({ where: { phoneNumber: oldPhoneNumber } });
          
        } else {
          // Regular update
          await tx.user.update({
            where: { phoneNumber: oldPhoneNumber },
            data: { name, email }
          });
        }
      }

      // Update all bookings (for guest records too)
      const updateData: any = {};
      if (name) updateData.customerName = name;
      if (email) updateData.customerEmail = email;
      if (newPhoneNumber) updateData.customerPhone = newPhoneNumber;

      if (Object.keys(updateData).length > 0) {
        await tx.booking.updateMany({
          where: { 
            OR: [
              { userId: user ? (newPhoneNumber || oldPhoneNumber) : undefined },
              { customerPhone: oldPhoneNumber }
            ].filter(Boolean) as any
          },
          data: updateData
        });
      }

      return { success: true };
    });
  }
};
