"use client";

import { User, Settings, ShieldCheck, History } from "lucide-react";
import Image from "next/image";

interface UserProfile {
  name: string;

  avatar: string;
}

interface DashboardSidebarProps {
  userProfile: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  gameCount: string;
}

export default function DashboardSidebar({
  userProfile,
  activeTab,
  setActiveTab,
  gameCount,
}: DashboardSidebarProps) {
  return (
    <aside className="w-full lg:w-[341px] flex flex-col gap-8 shrink-0">
      {/* Profile Card */}
      <div
        className="rounded-xl border p-6 flex flex-col gap-6"
        style={{
          background: "rgba(12, 11, 93, 0.05)",
          borderColor: "rgba(12, 11, 93, 0.2)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border-2 border-[#0c0b5d] p-0.5 overflow-hidden shadow-[0_0_15px_rgba(12,11,93,0.2)] shrink-0 relative">
            {userProfile.avatar ? (
              <Image
                src={userProfile.avatar}
                alt="Profile"
                fill
                sizes="64px"
                className="rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div className="h-full w-full rounded-full bg-gradient-to-br from-[#0c0b5d] to-[#FA6400] flex items-center justify-center">
                <span className="text-white font-black text-xl">
                  {userProfile.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
              {userProfile.name || "—"}
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-gradient-to-r from-[#0c0b5d] to-[#FA6400] text-white shadow-lg shadow-blue-900/20"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <User size={18} />
            <span className="font-semibold text-sm">Account Overview</span>
          </button>
          <button
            onClick={() => setActiveTab("booking_history")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer ${
              activeTab === "booking_history"
                ? "bg-gradient-to-r from-[#0c0b5d] to-[#FA6400] text-white shadow-lg shadow-blue-900/20"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <History size={18} />
            <span className="font-semibold text-sm">Booking History</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-gradient-to-r from-[#0c0b5d] to-[#FA6400] text-white shadow-lg shadow-blue-900/20"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Settings size={18} />
            <span className="font-semibold text-sm">Profile Settings</span>
          </button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-slate-900 px-1">
          Performance Stats
        </h3>
        <div
          className="rounded-xl border p-5 flex flex-col gap-1 backdrop-blur-sm"
          style={{
            background: "rgba(250, 100, 0, 0.05)",
            borderColor: "rgba(250, 100, 0, 0.15)",
          }}
        >
          <div className="flex flex-row justify-between items-start">
            <span className="text-sm font-medium text-slate-500">
              Total Games
            </span>
            <div className="bg-[#FA6400]/10 rounded px-2 py-0.5">
              <span className="text-[10px] font-bold text-[#FA6400] uppercase tracking-wider">
                Last 30d
              </span>
            </div>
          </div>
          <div className="text-4xl font-black text-slate-900 mt-1">
            {gameCount}
          </div>
        </div>
      </div>
    </aside>
  );
}
