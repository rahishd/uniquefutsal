// Placeholder profile data. Replace with real API data once login and the
// customer, bookings, loyalty, membership and gameplay endpoints exist (FRD sections 12, 19-27).

export interface ProfileData {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  position: string;
  registered: string;
  status: "Active" | "Suspended";
}

export const sampleProfile: ProfileData = {
  customerId: "UF-C-10291",
  name: "Player",
  phone: "9811940018",
  email: "player@example.com",
  location: "Tilottama, Rupandehi",
  position: "Midfielder",
  registered: "12 Jan 2026",
  status: "Active",
};

export const sampleMembership = {
  plan: "Premium Membership",
  id: "MEM-10291",
  validFrom: "1 Oct 2026",
  validUntil: "30 Sep 2027",
  status: "Active" as "Active" | "Expiring soon" | "Expired",
  benefits: ["Member pricing", "Priority booking", "Loyalty bonus"],
};

export const sampleLoyalty = { points: 850, nextReward: 1000, rewardLabel: "Free game voucher" };

export interface BookingItem {
  id: string;
  date: string;
  time: string;
  court: string;
  amount: number;
  payment: "Paid" | "Pay at venue" | "Refunded";
  status: "Confirmed" | "Completed" | "Cancelled";
  upcoming: boolean;
}

export const sampleBookings: BookingItem[] = [
  { id: "UF-20261010-00125", date: "Sat, 10 Oct 2026", time: "7:00 PM – 8:00 PM", court: "Court 1", amount: 1215, payment: "Paid", status: "Confirmed", upcoming: true },
  { id: "UF-20261013-00311", date: "Tue, 13 Oct 2026", time: "6:00 AM – 7:00 AM", court: "Court 2", amount: 1000, payment: "Pay at venue", status: "Confirmed", upcoming: true },
  { id: "UF-20260926-00098", date: "Sat, 26 Sep 2026", time: "7:00 PM – 8:00 PM", court: "Court 1", amount: 1500, payment: "Paid", status: "Completed", upcoming: false },
  { id: "UF-20260919-00044", date: "Sat, 19 Sep 2026", time: "5:00 PM – 6:00 PM", court: "Court 2", amount: 1200, payment: "Paid", status: "Completed", upcoming: false },
  { id: "UF-20260912-00017", date: "Sat, 12 Sep 2026", time: "8:00 PM – 9:00 PM", court: "Court 1", amount: 1500, payment: "Refunded", status: "Cancelled", upcoming: false },
];

export const sampleStats = { played: 42, wins: 27, losses: 10, draws: 5, goals: 58, assists: 31 };

export const sampleMatches = [
  { id: "m1", date: "3 Oct", you: "Team A", opp: "Team B", yourScore: 6, oppScore: 4 },
  { id: "m2", date: "26 Sep", you: "Team A", opp: "Team C", yourScore: 3, oppScore: 5 },
  { id: "m3", date: "19 Sep", you: "Team A", opp: "Team D", yourScore: 2, oppScore: 2 },
];

// Past bookings used by Quick Rebook to detect the customer's usual slot.
// Replace with the real booking history from the API.
export const sampleBookingHistory = [
  { dateKey: "2026-10-02", hour: 19 }, // Fri
  { dateKey: "2026-09-25", hour: 19 }, // Fri
  { dateKey: "2026-09-18", hour: 19 }, // Fri
  { dateKey: "2026-09-12", hour: 16 }, // Sat
  { dateKey: "2026-09-11", hour: 19 }, // Fri
  { dateKey: "2026-09-05", hour: 17 }, // Sat
];
