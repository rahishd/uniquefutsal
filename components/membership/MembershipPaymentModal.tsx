"use client";

import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import {
  MembershipSubscription,
  MembershipSettlementSummary,
} from "@/lib/api/membership";
import { useEffect, useState } from "react";
import { inventoryApi, Product } from "@/lib/api/inventory";

interface MembershipPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: MembershipSubscription | null;
  settlementSummary: MembershipSettlementSummary | null;
  isSummaryLoading?: boolean;
  isProcessing: boolean;
  onConfirm: (paymentData: PaymentData) => Promise<void>;
}

export interface PaymentData {
  method: "cash" | "online" | "partial";
  cashAmount: number;
  onlineAmount: number;
  waterBottles: number;
  addOns: string;
  addOnsPrice: number;
}

export default function MembershipPaymentModal({
  isOpen,
  onClose,
  subscription,
  settlementSummary,
  isSummaryLoading = false,
  isProcessing,
  onConfirm,
}: MembershipPaymentModalProps) {
  const [paymentData, setPaymentData] = useState<PaymentData>({
    cashAmount: 0,
    onlineAmount: 0,
    method: "cash",
    waterBottles: 0,
    addOns: "",
    addOnsPrice: 0,
  });

  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);

  useEffect(() => {
    inventoryApi.getProducts()
      .then(prods => {
        // filter out water/mineral water as they are handled separately by the dedicated water counter
        const filtered = prods.filter(p => {
          const name = p.name.toLowerCase();
          return p.inventory > 0 && !name.includes("water") && !name.includes("mineral");
        });
        setInventoryProducts(filtered);
      })
      .catch(err => console.error("Failed to fetch products:", err));
  }, []);

  const basePrice = subscription?.totalPrice || settlementSummary?.basePrice || 0;

  useEffect(() => {
    if (!isOpen || !subscription) return;

    const remaining = settlementSummary?.remainingAmount ??
      Math.max(0, (subscription.totalPrice || 0) - (settlementSummary?.amountPaidNow || 0));

    setPaymentData({
      method: "cash",
      cashAmount: remaining,
      onlineAmount: 0,
      waterBottles: settlementSummary?.waterBottles || 0,
      addOns: settlementSummary?.addOns || "",
      addOnsPrice: settlementSummary?.addOnsPrice || 0,
    });
  }, [isOpen, subscription, settlementSummary]);

  if (!subscription) return null;

  const currentTotal =
    basePrice +
    (paymentData.waterBottles - 2) * 25 +
    Number(paymentData.addOnsPrice);

  const alreadyPaid = settlementSummary?.amountPaidNow || 0;
  const dueBeforeThis = Math.max(0, currentTotal - alreadyPaid);
  const thisPayment = Number(paymentData.cashAmount) + Number(paymentData.onlineAmount);
  const remainingAfterThis = Math.max(0, dueBeforeThis - thisPayment);

  const handleConfirm = async () => {
    await onConfirm(paymentData);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0c0b5d]/40 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative bg-white rounded-[32px] p-6 max-w-[380px] w-full shadow-[0_32px_64px_-12px_rgba(12,11,93,0.2)] border border-slate-100 max-h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0c0b5d] to-[#FA6400]" />

            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                    Settle <span className="text-[#FA6400]">Payment</span>
                  </h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                    ID: #MB-{subscription.id.slice(-6).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {subscription.plan.name} Membership
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      Rs. {basePrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Already Paid
                    </span>
                    <span className="text-xs font-bold text-green-600">
                      Rs. {alreadyPaid.toLocaleString()}
                    </span>
                  </div>

                  {settlementSummary?.paidHistoryExpression && alreadyPaid > 0 && (
                    <div className="flex justify-end">
                      <span className="text-[9px] font-black text-green-700">
                        {settlementSummary.paidHistoryExpression}
                      </span>
                    </div>
                  )}

                  {(paymentData.waterBottles !== 2 || paymentData.waterBottles > 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Water Bottles ({paymentData.waterBottles})
                        {paymentData.waterBottles < 2 ? (
                          <span className="ml-1 text-[8px] text-red-500">(Deducted)</span>
                        ) : paymentData.waterBottles === 2 ? (
                          <span className="ml-1 text-[8px] text-green-500">(Comp)</span>
                        ) : null}
                      </span>
                      <span className={`text-xs font-bold ${paymentData.waterBottles < 2 ? "text-red-500" : "text-slate-500"}`}>
                        {paymentData.waterBottles < 2 ? "-" : ""} Rs. {Math.abs((paymentData.waterBottles - 2) * 25).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {paymentData.addOnsPrice > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {paymentData.addOns || "Add-ons"}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        Rs. {Number(paymentData.addOnsPrice).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="h-px bg-slate-200 w-full my-1" />

                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Total Bill
                    </span>
                    <span className="text-lg font-black text-[#0c0b5d]">
                      Rs. {currentTotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-dashed border-slate-200">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0c0b5d]">
                      Net Due
                    </span>
                    <span className="text-lg font-black text-[#FA6400]">
                      Rs. {dueBeforeThis.toLocaleString()}
                    </span>
                  </div>

                  {paymentData.method === "partial" && (
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-dashed border-slate-200">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#FA6400]">
                        Remaining After This
                      </span>
                      <span className="text-sm font-black text-[#FA6400]">
                        Rs. {remainingAfterThis.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="h-px bg-slate-200 w-full mb-3" />
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Member:{" "}
                    <span className="text-slate-700">
                      {subscription.user?.name || "Unknown"}
                    </span>
                  </span>
                </div>
              </div>

              {/* Water & Add-ons Controls */}
              <div className="flex flex-col gap-4 p-1">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0c0b5d]">
                      Water Bottles
                    </span>
                    <span className="text-[8px] text-slate-400">
                      2 Complementary, then Rs. 25/ea
                    </span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <button
                      onClick={() =>
                        setPaymentData((prev) => ({
                          ...prev,
                          waterBottles: Math.max(0, prev.waterBottles - 1),
                        }))
                      }
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 shadow-sm flex items-center justify-center hover:bg-slate-200 font-bold"
                    >
                      -
                    </button>
                    <span className="text-xs font-black min-w-[20px] text-center">
                      {paymentData.waterBottles}
                    </span>
                    <button
                      onClick={() =>
                        setPaymentData((prev) => ({
                          ...prev,
                          waterBottles: prev.waterBottles + 1,
                        }))
                      }
                      className="w-8 h-8 rounded-lg bg-[#0c0b5d] text-white shadow-sm flex items-center justify-center hover:bg-[#1a188a] font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-[#0c0b5d] ml-1">Select Inventory Item</label>
                    <select
                      value={
                        paymentData.addOns && !inventoryProducts.some(p => p.name === paymentData.addOns)
                          ? "custom"
                          : (inventoryProducts.find(p => p.name === paymentData.addOns)?.id || "")
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          // Keep as custom
                        } else if (!val) {
                          setPaymentData(prev => ({
                            ...prev,
                            addOns: "",
                            addOnsPrice: 0,
                          }));
                        } else {
                          const prod = inventoryProducts.find(p => p.id === val);
                          if (prod) {
                            setPaymentData(prev => ({
                              ...prev,
                              addOns: prod.name,
                              addOnsPrice: prod.price,
                            }));
                          }
                        }
                      }}
                      className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-[#0c0b5d] outline-none cursor-pointer"
                    >
                      <option value="">-- No Add-on Selected --</option>
                      {inventoryProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.inventory}) - Rs. {p.price}
                        </option>
                      ))}
                      <option value="custom">Custom Add-on (Write details below)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Name</label>
                      <input
                        type="text"
                        value={paymentData.addOns}
                        placeholder="Item Name"
                        onChange={(e) =>
                          setPaymentData((prev) => ({
                            ...prev,
                            addOns: e.target.value,
                          }))
                        }
                        className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-[#0c0b5d] outline-none placeholder:text-slate-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Add-on Price</label>
                      <input
                        type="number"
                        value={paymentData.addOnsPrice}
                        onChange={(e) =>
                          setPaymentData((prev) => ({
                            ...prev,
                            addOnsPrice: Number(e.target.value),
                          }))
                        }
                        className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-black text-[#0c0b5d] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#0c0b5d] ml-1">
                  Method
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "online", "partial"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setPaymentData((prev) => {
                          const due = dueBeforeThis;
                          return {
                            ...prev,
                            method: m,
                            cashAmount:
                              m === "cash"
                                ? due
                                : m === "online"
                                  ? 0
                                  : m === "partial"
                                    ? 0
                                    : prev.cashAmount,
                            onlineAmount:
                              m === "online"
                                ? due
                                : m === "cash"
                                  ? 0
                                  : m === "partial"
                                    ? 0
                                    : prev.onlineAmount,
                          };
                        });
                      }}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                        paymentData.method === m
                          ? "bg-[#0c0b5d] text-white border-[#0c0b5d] shadow-md scale-[1.02]"
                          : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentData.method === "partial" && (
                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Cash
                    </label>
                    <input
                      type="number"
                      value={paymentData.cashAmount}
                      onChange={(e) =>
                        setPaymentData((prev) => ({
                          ...prev,
                          cashAmount: Number(e.target.value),
                        }))
                      }
                      className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-black text-[#0c0b5d] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Online
                    </label>
                    <input
                      type="number"
                      value={paymentData.onlineAmount}
                      onChange={(e) =>
                        setPaymentData((prev) => ({
                          ...prev,
                          onlineAmount: Number(e.target.value),
                        }))
                      }
                      className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-black text-[#0c0b5d] outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={isProcessing || isSummaryLoading || dueBeforeThis <= 0}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#0c0b5d] to-[#1a188a] text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:brightness-110 active:scale-95 transition-all mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSummaryLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Loading details...
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : dueBeforeThis <= 0 ? (
                  "Payment Settled"
                ) : (
                  "Confirm Payment"
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-1 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-400 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
