export interface MembershipTier {
  name: string;
  price: string;
  numericPrice: number;
  features: string[];
  featured: boolean;
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    name: "Pro",
    price: "2,500",
    numericPrice: 2500,
    features: ["5% Off All Bookings", "Standard Support", "Access to Basic Drills", "Monthly Newsletter"],
    featured: false,
  },
  {
    name: "Elite",
    price: "5,500",
    numericPrice: 5500,
    features: ["15% Off All Bookings", "24h Priority Booking", "Free Monthly Guest Pass", "Unicoin 2x Multiplier", "Premium Locker Access"],
    featured: true,
  },
  {
    name: "Legend",
    price: "9,900",
    numericPrice: 9900,
    features: ["25% Off All Bookings", "48h Priority Booking", "VIP Lounge Access", "Dedicated Arena Coach", "Exclusive Tournament Entry", "Free Team Jersey"],
    featured: false,
  },
];
