"use client";

import React, { useState } from "react";
import { Calendar, Clock, CreditCard, CheckCircle2, Timer, XCircle } from "lucide-react";
import { formatTimeTo12h } from "@/lib/utils/time";
import { useRouter } from "next/navigation";
import { useCancelBooking } from "@/lib/hooks";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BookingDisplay {
  id: string;
  status: string;
  date: string;
  rawDate?: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  paymentStatus: string;
  paymentMethod: string;
}

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-[#0c0b5d] text-white",
  confirmed: "bg-[#0c0b5d] text-white",
  pending: "bg-amber-500/20 text-amber-700",
  completed: "bg-[#334155] text-[#CBD5E1]",
  cancelled: "bg-red-100 text-red-500",
  rescheduled: "bg-[#FA6400]/20 text-[#FA6400]",
};

function statusLabel(s: string) {
  if (s === "confirmed" || s === "pending") return "Upcoming";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function BookingCard({ booking }: { booking: BookingDisplay }) {
  const isUpcoming =
    booking.status === "upcoming" ||
    booking.status === "confirmed" ||
    booking.status === "pending";

  // Player can cancel only upcoming-ish bookings (not completed/cancelled).
  const isCancelable =
    booking.status === "upcoming" ||
    booking.status === "confirmed" ||
    booking.status === "pending";

  const router = useRouter();
  const cancelBookingMutation = useCancelBooking();

  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const handleConfirmCancel = () => {
    if (!isCancelable) return;

    cancelBookingMutation.mutate(booking.id, {
      onSuccess: () => {
        toast.success("Booking cancelled.");
        setIsCancelOpen(false);
        // BookingHistory is not react-query backed, so refresh to re-fetch bookings.
        router.refresh();
      },
      onError: () => {
        toast.error("Failed to cancel booking. Try again.");
      },
    });
  };

  return (
    <div
      className={`rounded-xl border p-5 md:p-6 transition-all hover:border-[#0c0b5d]/40 backdrop-blur-sm ${
        isUpcoming
          ? "ring-1 ring-[#0c0b5d]/10 shadow-xl shadow-[#0c0b5d]/5"
          : "opacity-95"
      }`}
      style={{
        background: isUpcoming
          ? "rgba(255, 255, 255, 0.8)"
          : "rgba(255, 255, 255, 0.4)",
        borderColor: isUpcoming
          ? "rgba(12, 11, 93, 0.2)"
          : "rgba(12, 11, 93, 0.1)",
      }}
    >
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        {/* Left: Status + Info */}
        <div className="flex flex-col gap-2 flex-1">
          {/* Badge + Date */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-500"
              }`}
            >
              {statusLabel(booking.status)}
            </span>
            <span className={`text-sm font-semibold ${isUpcoming ? "text-slate-900" : "text-slate-500"}`}>
              {booking.date}
            </span>
          </div>

          {/* Session details row */}
          <div className="flex flex-wrap gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Clock size={13} className="text-slate-400" />
              <span className="font-semibold">
                {formatTimeTo12h(booking.startTime)} – {formatTimeTo12h(booking.endTime)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Timer size={13} className="text-slate-400" />
              <span className="font-semibold">
                {booking.duration} {booking.duration === 1 ? "hr" : "hrs"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <CreditCard size={13} className="text-slate-400" />
              <span className="font-semibold">Rs. {booking.totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right: View Details */}
        <div className="shrink-0 flex flex-col gap-2 items-end">
          <Dialog>
            <DialogTrigger asChild>
              <button className="h-9 px-5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer">
                View Details
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">Session Details</DialogTitle>
                <DialogDescription>
                  Full information about this court booking.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4 py-2 mt-2">
                {/* Status Banner */}
                <div
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-white ${
                    isUpcoming
                      ? "bg-gradient-to-r from-[#0c0b5d] to-[#FA6400]"
                      : "bg-gradient-to-r from-slate-600 to-slate-800"
                  }`}
                >
                  <span className="font-black text-sm uppercase tracking-wider">
                    {statusLabel(booking.status)}
                  </span>
                  {booking.status === "completed" && (
                    <CheckCircle2 size={18} className="text-white/70" />
                  )}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <Calendar size={12} /> Date
                    </span>
                    <span className="text-sm font-bold text-slate-800">{booking.rawDate || booking.date}</span>
                  </div>
                  <div className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <Clock size={12} /> Time
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {formatTimeTo12h(booking.startTime)} – {formatTimeTo12h(booking.endTime)}
                    </span>
                  </div>
                  <div className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <Timer size={12} /> Duration
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {booking.duration} {booking.duration === 1 ? "hour" : "hours"}
                    </span>
                  </div>
                  <div className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <CreditCard size={12} /> Total
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      Rs. {booking.totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Payment</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 capitalize">
                      {booking.paymentMethod === "venue" ? "Cash at Venue" : booking.paymentMethod}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        booking.paymentStatus === "completed"
                          ? "bg-green-100 text-green-600"
                          : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      {booking.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    Close
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isCancelable && (
            <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  disabled={cancelBookingMutation.isPending}
                  className="h-9 px-5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-600 hover:text-white transition-all border border-red-100 cursor-pointer disabled:opacity-50"
                  aria-label="Cancel booking"
                >
                  <span className="inline-flex items-center gap-2">
                    <XCircle size={14} />
                    Cancel
                  </span>
                </button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">Cancel this booking?</DialogTitle>
                  <DialogDescription>
                    The slot will become available for others. Even if admin accepts, this cancellation will reset the booking.
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-2">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      No
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={cancelBookingMutation.isPending}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {cancelBookingMutation.isPending ? "Cancelling..." : "Yes, cancel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
