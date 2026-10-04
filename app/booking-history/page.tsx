"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BookingTimeline from "@/components/dashboard/BookingTimeline";
import AccountOverview from "@/components/dashboard/AccountOverview";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import { useEffect, useMemo, useState } from "react";
import { getStoredUser, isAuthenticated } from "@/lib/api/auth";
import { BookingFilters, type Booking } from "@/lib/api/bookings";
import { formatTimeTo12h } from "@/lib/utils/time";
import { useRouter } from "next/navigation";
import { useBookings, useMe, useMySubscriptionHistory } from "@/lib/hooks";

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [filter, setFilter] = useState("all");

  const hasAuth = isAuthenticated();
  const stored = useMemo(() => getStoredUser(), []);
  const meQuery = useMe({ enabled: hasAuth });
  const bookingFilters = useMemo<BookingFilters | undefined>(() => {
    const userId = meQuery.data?.phoneNumber || stored?.phoneNumber;
    if (!userId) return undefined;
    return { userId };
  }, [meQuery.data?.phoneNumber, stored?.phoneNumber]);

  const bookingsQuery = useBookings(bookingFilters, {
    enabled: hasAuth && Boolean(bookingFilters?.userId),
    refetchIntervalMs: 30000,
  });

  const membershipHistoryQuery = useMySubscriptionHistory({
    enabled: hasAuth,
  });

  const formatBookingDate = (date: string, startTime: string): string => {
    const bookingDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (bookingDate.toDateString() === today.toDateString()) {
      return `Today, ${formatTimeTo12h(startTime)}`;
    } else if (bookingDate.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${formatTimeTo12h(startTime)}`;
    } else {
      return `${bookingDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} • ${formatTimeTo12h(startTime)}`;
    }
  };

  const [userProfile, setUserProfile] = useState(() => ({
    name: stored?.name || "",
    email: stored?.email || "",
    phoneNumber: stored?.phoneNumber || "",
    avatar: stored?.avatar || "",
    freeMatchesAvailable: stored?.freeMatchesAvailable || 0,
  }));

  useEffect(() => {
    if (!hasAuth) return;

    setUserProfile((prev) => ({
      ...prev,
      name: meQuery.data?.name || stored?.name || prev.name,
      email: meQuery.data?.email || stored?.email || prev.email,
      phoneNumber: meQuery.data?.phoneNumber || stored?.phoneNumber || prev.phoneNumber,
      avatar: meQuery.data?.avatar || prev.avatar,
      freeMatchesAvailable: meQuery.data?.freeMatchesAvailable ?? prev.freeMatchesAvailable,
    }));
  }, [hasAuth, meQuery.data?.name, meQuery.data?.email, meQuery.data?.phoneNumber, meQuery.data?.avatar, meQuery.data?.freeMatchesAvailable, stored?.name, stored?.email, stored?.phoneNumber]);

  const rawBookings: Booking[] = bookingsQuery.data || [];
  const displayBookings = useMemo(() => {
    return rawBookings.map((b: Booking) => ({
      id: b.id,
      status: b.status,
      date: formatBookingDate(b.date, b.startTime),
      rawDate: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      duration: b.duration,
      totalPrice: b.totalPrice,
      paymentStatus: b.paymentStatus,
      paymentMethod: b.paymentMethod,
      notes: b.notes,
    }));
  }, [rawBookings]);

  const membershipHistory = membershipHistoryQuery.data || [];

  const isLoading = hasAuth && (meQuery.isLoading || bookingsQuery.isLoading || membershipHistoryQuery.isLoading);
  const error =
    (meQuery.error instanceof Error ? meQuery.error.message : null) ||
    (bookingsQuery.error instanceof Error ? bookingsQuery.error.message : null) ||
    (membershipHistoryQuery.error instanceof Error ? membershipHistoryQuery.error.message : null);

  useEffect(() => {
    if (hasAuth) return;
    router.push("/login");
  }, [hasAuth, router]);

  // Sum durations (1hr = 1 match) for non-cancelled, non-membership bookings
  const activeGameCount = rawBookings
    .filter((b) => b.status !== "cancelled" && !b.notes?.includes("MEMBERSHIP_PAYMENT") && b.paymentMethod !== "membership")
    .reduce((s, b) => s + (b.duration || 1), 0);

  if (isLoading) {
    return (
      <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col pt-[85px]">
        <Navbar />
        <main className="relative z-10 flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-16 py-8 md:py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0c0b5d] mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Loading your dashboard...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col pt-[85px]">
        <Navbar />
        <main className="relative z-10 flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-16 py-8 md:py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => router.push("/login")}
                className="px-4 py-2 bg-[#0c0b5d] text-white rounded-lg hover:bg-[#FA6400] transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </main>
        <Footer />
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
            gameCount={activeGameCount.toString()}
          />

          <div className="flex-1">
            {/* Account Overview: receives raw Booking[] for real stats */}
            {activeTab === "overview" && (
              <AccountOverview 
                bookings={rawBookings} 
                freeMatches={userProfile?.freeMatchesAvailable ?? 0}
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
