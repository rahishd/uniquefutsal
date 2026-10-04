"use client";

import React from "react";
import { MessageSquare, BellOff, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SmsConfirmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: (sendSms: boolean) => void;
}

export function SmsConfirmModal({
  isOpen,
  onOpenChange,
  title = "SMS Notification",
  description = "Do you want to send an SMS notification to the player?",
  onConfirm,
}: SmsConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] p-6 rounded-[32px] border-none shadow-2xl">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
          <DialogTitle className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            SMS <span className="text-blue-600">Notify</span>
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-6">
          <Button
            className="w-full cursor-pointer bg-[#0c0b5d] hover:bg-[#15137a] text-white font-black uppercase tracking-widest text-[10px] py-6 rounded-2xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            onClick={() => {
              onConfirm(true);
              onOpenChange(false);
            }}
          >
            <Send size={16} />
            Send SMS Notification
          </Button>
          
          <Button
            variant="outline"
            className="w-full cursor-pointer bg-slate-50 border-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px] py-6 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
            onClick={() => {
              onConfirm(false);
              onOpenChange(false);
            }}
          >
            <BellOff size={16} />
            Continue Without SMS
          </Button>

          <button 
            onClick={() => onOpenChange(false)}
            className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500 transition-colors mt-2"
          >
            Cancel Action
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
