"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  CheckCircle2,
  Calendar,
  Clock,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { getBookingById, Booking } from "@/lib/api/bookings";
import { formatTimeTo12h } from "@/lib/utils/time";
import { useQuery } from "@tanstack/react-query";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id");

  const bookingQuery = useQuery({
    queryKey: ["bookings", "detail", bookingId || ""] as const,
    queryFn: () => getBookingById(bookingId || ""),
    enabled: Boolean(bookingId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const booking: Booking | null = bookingQuery.data || null;
  const isLoading = bookingQuery.isLoading;
  const error =
    !bookingId
      ? "No booking ID provided"
      : bookingQuery.error instanceof Error
        ? bookingQuery.error.message
        : bookingQuery.isError
          ? "Failed to load booking details"
          : "";

  if (isLoading) {
    return (
      <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
        <Navbar />
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 pt-32 pb-20 flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-[#0c0b5d]/10 border-t-[#0c0b5d] rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
        <Navbar />
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 pt-32 pb-20">
          <div className="text-center">
            <h1 className="text-4xl font-black text-[#0c0b5d] mb-4">Error</h1>
            <p className="text-xl text-slate-500 mb-8">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="bg-[#0c0b5d] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-wider hover:bg-[#FA6400] transition-all"
            >
              Back to Home
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
      <Navbar />

      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-500/20 rounded-full mb-6">
            <CheckCircle2 size={48} className="text-green-500" />
          </div>
          <h1 className="text-5xl font-black text-[#0c0b5d] uppercase tracking-tighter mb-4">
            Booking <span className="text-[#FA6400]">Confirmed!</span>
          </h1>
          <p className="text-xl font-medium text-slate-500">
            Your futsal pitch has been successfully booked.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl rounded-[32px] p-8 border border-white shadow-sm mb-8"
        >
          <h2 className="text-2xl font-black text-[#0c0b5d] uppercase tracking-wide mb-6">
            Booking Details
          </h2>

          <div className="space-y-6">
            <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-[#0c0b5d]">
                <Calendar size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm uppercase font-black text-slate-400 tracking-widest mb-1">
                  Date & Time
                </h3>
                <p className="text-lg font-bold text-[#0c0b5d]">
                  {booking.date} @ {formatTimeTo12h(booking.startTime)} – {formatTimeTo12h(booking.endTime)}
                </p>
                <p className="text-sm text-slate-500">
                  {booking.duration} {booking.duration === 1 ? "hour" : "hours"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-[#FA6400]">
                <Clock size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm uppercase font-black text-slate-400 tracking-widest mb-1">
                  Booking ID
                </h3>
                <p className="text-lg font-bold text-[#0c0b5d] font-mono">
                  {booking.id}
                </p>
                <p className="text-sm text-slate-500">
                  Status:{" "}
                  <span className="text-green-600 font-bold">
                    {booking.status}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                <CreditCard size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm uppercase font-black text-slate-400 tracking-widest mb-1">
                  Payment Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Amount:</span>
                    <span className="font-bold text-[#0c0b5d]">
                      Rs. {booking.totalPrice}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Paid Now:</span>
                    <span className="font-bold text-green-600">
                      Rs. {booking.amountPaidNow}
                    </span>
                  </div>
                  {booking.remainingAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Due at Venue:</span>
                      <span className="font-bold text-orange-600">
                        Rs. {booking.remainingAmount}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-600">Payment Method:</span>
                    <span className="font-bold text-[#0c0b5d] capitalize">
                      {booking.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-blue-50 rounded-[32px] p-8 border border-blue-100 mb-8"
        >
          <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-wide mb-4">
            What&apos;s Next?
          </h3>
          <ul className="space-y-3 text-slate-700">
            <li className="flex items-start gap-3">
              <CheckCircle2
                size={20}
                className="text-green-500 mt-0.5 shrink-0"
              />
              <span>
                <strong>Show up on time:</strong> Arrive 10-15 minutes before
                your booking time.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2
                size={20}
                className="text-green-500 mt-0.5 shrink-0"
              />
              <span>
                <strong>Bring your gear:</strong> Don&apos;t forget your boots, shin
                guards, and water bottle.
              </span>
            </li>
            {booking.remainingAmount > 0 && (
              <li className="flex items-start gap-3">
                <CheckCircle2
                  size={20}
                  className="text-orange-500 mt-0.5 shrink-0"
                />
                <span>
                  <strong>Complete payment:</strong> Pay the remaining Rs.{" "}
                  {booking.remainingAmount} at the venue.
                </span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <CheckCircle2
                size={20}
                className="text-green-500 mt-0.5 shrink-0"
              />
              <span>
                <strong>Have fun:</strong> Enjoy your game at our premium futsal
                facility!
              </span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 bg-white text-[#0c0b5d] border-2 border-[#0c0b5d] hover:bg-[#0c0b5d] hover:text-white"
          >
            Back to Home
          </button>
          <button
            onClick={() => router.push("/booking")}
            className="flex-1 py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 bg-[#FA6400] text-white hover:bg-[#0c0b5d]"
          >
            Book Another Slot <ChevronRight size={18} />
          </button>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
          <div className="h-12 w-12 border-4 border-[#0c0b5d]/10 border-t-[#0c0b5d] rounded-full animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
