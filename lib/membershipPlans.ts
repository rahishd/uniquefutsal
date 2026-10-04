
export interface MembershipPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  numericPrice: number;
  perks: string[];
  featured: boolean;
  color: string;
}

const STORAGE_KEY = "uf_membership_plans";

export const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: "plan-pro",
    name: "Pro",
    description: "Perfect for casual players who want a consistent discount.",
    price: "2,500",
    numericPrice: 2500,
    perks: ["5% Off All Bookings", "Standard Support", "Access to Basic Drills", "Monthly Newsletter"],
    featured: false,
    color: "blue",
  },
  {
    id: "plan-elite",
    name: "Elite",
    description: "Our most popular plan for dedicated futsal enthusiasts.",
    price: "5,500",
    numericPrice: 5500,
    perks: ["15% Off All Bookings", "24h Priority Booking", "Free Monthly Guest Pass", "Unicoin 2x Multiplier", "Premium Locker Access"],
    featured: true,
    color: "orange",
  },
  {
    id: "plan-legend",
    name: "Legend",
    description: "The ultimate package for the most serious players and teams.",
    price: "9,900",
    numericPrice: 9900,
    perks: ["25% Off All Bookings", "48h Priority Booking", "VIP Lounge Access", "Dedicated Arena Coach", "Exclusive Tournament Entry", "Free Team Jersey"],
    featured: false,
    color: "slate",
  },
];

export function getPlans(): MembershipPlan[] {
  if (typeof window === "undefined") return DEFAULT_PLANS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {

  }
  return DEFAULT_PLANS;
}

export function savePlans(plans: MembershipPlan[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}
