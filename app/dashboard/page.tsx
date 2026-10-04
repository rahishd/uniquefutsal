"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BookingTimeline from "@/components/dashboard/BookingTimeline";
import AccountOverview from "@/components/dashboard/AccountOverview";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import { useEffect, useMemo, useState } from "react";
import { isAuthenticated, type MeResponse, getStoredUser } from "@/lib/api/auth";
import { type Booking } from "@/lib/api/bookings";
import { formatTimeTo12h } from "@/lib/utils/time";
import { Loader2 } from "lucide-react";
import { useBookings, useMe } from "@/lib/hooks";
import { useMySubscriptionHistory } from "@/lib/hooks/membership";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const hasAuth = isAuthenticated();
  const storedUser = useMemo(() => getStoredUser(), []);
  const meQuery = useMe({ enabled: hasAuth });
  const bookingsQuery = useBookings(undefined, {
    enabled: hasAuth,
    refetchIntervalMs: false,
  });
  const membershipHistoryQuery = useMySubscriptionHistory({ enabled: hasAuth });

  const user: MeResponse | null = meQuery.data || (storedUser as MeResponse) || null;
  const rawBookings: Booking[] = bookingsQuery.data || [];
  const membershipHistory = membershipHistoryQuery.data || [];
  const isLoading = hasAuth && (meQuery.isLoading || bookingsQuery.isLoading || membershipHistoryQuery.isLoading);

  const [userProfile, setUserProfile] = useState(() => ({
    name: user?.name || user?.email || "Player",
    tier: "Player",
    avatar: user?.avatar || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
  }));

  useEffect(() => {
    setUserProfile((prev) => ({
      ...prev,
      name: user?.name || user?.email || prev.name,
      avatar: user?.avatar || prev.avatar,
      email: user?.email || prev.email,
      phoneNumber: user?.phoneNumber || prev.phoneNumber,
    }));
  }, [user?.name, user?.email, user?.avatar, user?.phoneNumber]);

  // Map API bookings to Timeline display format
  const displayBookings = useMemo(() => {
    return rawBookings.map((b) => {
      const d = new Date(b.date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const bookingDate = new Date(b.date);
      bookingDate.setHours(0, 0, 0, 0);

      const diffDays = Math.round(
        (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      let dateLabel = "";
      if (diffDays === 0) dateLabel = "Today";
      else if (diffDays === 1) dateLabel = "Tomorrow";
      else if (diffDays === -1) dateLabel = "Yesterday";
      else
        dateLabel = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });

      return {
        id: b.id,
        status: b.status,
        date: `${dateLabel}, ${formatTimeTo12h(b.startTime)}`,
        rawDate: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        duration: b.duration,
        totalPrice: b.totalPrice,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
      };
    });
  }, [rawBookings]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0F4FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-[#0c0b5d] animate-spin" />
          <p className="text-slate-500 font-medium">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col pt-[85px]">
      <Navbar />

      <main className="relative z-10 flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-16 py-8 md:py-12">
        <div className="flex flex-col lg:flex-row gap-10 md:gap-24 relative">
          <DashboardSidebar
            userProfile={userProfile}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            gameCount={rawBookings
              .filter(b => b.status !== "cancelled" && !b.notes?.includes("MEMBERSHIP_PAYMENT") && b.paymentMethod !== "membership")
              .reduce((s, b) => s + (b.duration || 1), 0)
              .toString()}
          />

          <div className="flex-1">
            {activeTab === "overview" && (
              <AccountOverview 
                bookings={rawBookings} 
                freeMatches={user?.freeMatchesAvailable}
              />
            )}

            {activeTab === "booking_history" && (
              <BookingTimeline
                bookings={displayBookings}
                membershipHistory={membershipHistory}
                filter={filter}
                setFilter={setFilter}
              />
            )}

            {activeTab === "settings" && (
              <ProfileSettings
                userProfile={userProfile}
                onProfileUpdate={({ name, avatar }) =>
                  setUserProfile((prev) => ({ ...prev, name, avatar }))
                }
              />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
