"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Crown,
  TicketPercent, 
  Settings, 
  Bell, 
  Menu, 
  X,
  LogOut,
  UserCircle,
  DollarSign,
  LayoutList,
  CalendarCheck,
  CheckCheck,
  Trash2,
  Trophy,
  ReceiptText,
  PackageOpen,
  Gamepad2,
  Loader2,
  Wifi,
  Megaphone,
  Image,
  Activity
} from "lucide-react";
import { getNotifications, markAllRead, clearNotifications, relativeTime, AdminNotification, addNotification } from "@/lib/notifications";
import { Toaster, toast } from "sonner";
import { verifyAdminToken, adminLogout, getAdminInfo, isAdminAuthenticated, AdminInfo } from "@/lib/api/admin";
import { Booking } from "@/lib/api/bookings";
import { useAllSubscriptions, useBookings } from "@/lib/hooks";
import { formatTimeTo12h } from "@/lib/utils/time";

const NAV_ITEMS = [
  { name: "Overview", icon: LayoutDashboard, href: "/uniquesuperadmin?stay=true" },
  { name: "Bookings", icon: CalendarDays, href: "/uniquesuperadmin/bookings" },
  { name: "View Slots", icon: CalendarCheck, href: "/uniquesuperadmin/viewslots" },
  { name: "Players", icon: Users, href: "/uniquesuperadmin/players" },
  { name: "Memberships", icon: Crown, href: "/uniquesuperadmin/memberships" },
  { name: "Plans", icon: LayoutList, href: "/uniquesuperadmin/plans" },
  { name: "Promotions", icon: TicketPercent, href: "/uniquesuperadmin/promotions" },
  { name: "Tournaments", icon: Trophy, href: "/uniquesuperadmin/tournaments" },
  { name: "Handle Tournaments", icon: Trophy, href: "/uniquesuperadmin/handle-tournaments" },
  { name: "Expenses", icon: ReceiptText, href: "/uniquesuperadmin/expenses" },
  { name: "Gamezone Invoice", icon: Gamepad2, href: "/uniquesuperadmin/gamezone-invoice" },
  { name: "Inventory", icon: PackageOpen, href: "/uniquesuperadmin/inventory" },
  { name: "Pricing of Futsal", icon: DollarSign, href: "/uniquesuperadmin/pricing" },
  { name: "Wifi", icon: Wifi, href: "/uniquesuperadmin/wifi" },
  { name: "Ads", icon: Megaphone, href: "/uniquesuperadmin/ads" },
  { name: "Gallery", icon: Image, href: "/uniquesuperadmin/gallery" },
  { name: "Activity Log", icon: Activity, href: "/uniquesuperadmin/activities" },
  // { name: "Settings", icon: Settings, href: "/uniquesuperadmin/settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const seenBookingIds = useRef<Set<string>>(new Set());
  const seenMembershipIds = useRef<Set<string>>(new Set());
  const isFirstLoadBookings = useRef(true);
  const isFirstLoadMemberships = useRef(true);

  const playNotificationSound = () => {
    try {
      const audio = new Audio("/ring.wav");
      audio.volume = 0.5;
      audio.play();
    } catch (err) {
      console.error("Error playing notification sound:", err);
    }
  };

  const pendingBookingsQuery = useBookings(
    { status: "pending" },
    { enabled: pathname !== "/uniquesuperadmin/login", refetchIntervalMs: 30_000 },
  );
  const subscriptionsQuery = useAllSubscriptions({
    enabled: pathname !== "/uniquesuperadmin/login",
  });

  const checkForNewBookings = useCallback(() => {
    const pendingBookings = (pendingBookingsQuery.data || []).filter(
      (b) => b.status === "pending",
    );
    let hasNew = false;

    pendingBookings.forEach((b) => {
      if (seenBookingIds.current.has(b.id)) return;
      if (!isFirstLoadBookings.current) {
        hasNew = true;
        addNotification({
          type: "booking",
          title: "New Booking Request",
          body: `${b.customerName || "Player"} for ${b.date} at ${formatTimeTo12h(b.startTime)}`,
          link: `/uniquesuperadmin/viewslots?date=${b.date}&highlight=${b.id}`
        });

        toast.info(`New Booking Request!`, {
          description: `${b.customerName || "Player"} has requested a match for ${b.date} at ${formatTimeTo12h(b.startTime)}`,
          duration: 10000,
          icon: <CalendarCheck className="text-blue-600" />,
          action: {
            label: "View",
            onClick: () => router.push(`/uniquesuperadmin/viewslots?date=${b.date}&highlight=${b.id}`)
          }
        });

      }
      seenBookingIds.current.add(b.id);
    });

    if (hasNew) playNotificationSound();
    isFirstLoadBookings.current = false;
  }, [pendingBookingsQuery.data, router]);

  const checkForNewMemberships = useCallback(() => {
    const pendingSubscriptions = (subscriptionsQuery.data || []).filter(
      (s) => s.paymentStatus === "pending",
    );
    let hasNew = false;

    pendingSubscriptions.forEach((s) => {
      if (seenMembershipIds.current.has(s.id)) return;
      if (!isFirstLoadMemberships.current) {
        hasNew = true;
        addNotification({
          type: "membership",
          title: "New Membership Request",
          body: `${s.user?.name || "Member"} requested ${s.plan.name} Plan`,
          link: `/uniquesuperadmin/viewslots?date=${new Date(s.startDate).toISOString().split('T')[0]}&highlight=mem-${s.id}`
        });

        toast.success(`New Membership Request!`, {
          description: `${s.user?.name || "Member"} is waiting for membership verification (${s.plan.name}).`,
          duration: 10000,
          icon: <Crown className="text-orange-500" />,
          action: {
            label: "View",
            onClick: () => router.push(`/uniquesuperadmin/viewslots?date=${new Date(s.startDate).toISOString().split('T')[0]}&highlight=mem-${s.id}`)
          }
        });

      }
      seenMembershipIds.current.add(s.id);
    });

    if (hasNew) playNotificationSound();
    isFirstLoadMemberships.current = false;
  }, [subscriptionsQuery.data, router]);

  const refreshNotifs = useCallback(() => {
    setNotifications(getNotifications());
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const isLoginRoute =
        pathname === "/uniquesuperadmin/login" ||
        pathname === "/uniquesuperadmin/login/";

      // Skip auth check for login page
      if (isLoginRoute) {
        setIsAuthChecking(false);
        return;
      }

      // Check if authenticated
      if (!isAdminAuthenticated()) {
        // Avoid redirect loops
        if (!isLoginRoute) router.replace("/uniquesuperadmin/login");
        return;
      }

      // Verify token with backend
      const info = await verifyAdminToken();
      if (!info) {
        // Avoid redirect loops
        if (!isLoginRoute) router.replace("/uniquesuperadmin/login");
        return;
      }

      setAdminInfo(info);
      setIsAuthChecking(false);
    };

    checkAuth();
  }, [pathname, router]);

  useEffect(() => {
    if (isAuthChecking || pathname === '/uniquesuperadmin/login') return;

    setTimeout(refreshNotifs, 0);
    checkForNewBookings(); // Initial check
    checkForNewMemberships(); // Initial check

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "uf_admin_notifications" || !e.key) refreshNotifs();
    };
    window.addEventListener("storage", handleStorage);
    
    const interval = setInterval(() => {
      // Only poll if tab is visible to save battery and API hits
      if (document.visibilityState === 'visible') {
        refreshNotifs();
        checkForNewBookings();
        checkForNewMemberships();
      }
    }, 30000); // Increased to 30s to prevent 429 Rate Limiting

    return () => { 
      window.removeEventListener("storage", handleStorage); 
      clearInterval(interval); 
    };
  }, [refreshNotifs, checkForNewBookings, checkForNewMemberships, isAuthChecking, pathname]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Auto-collapse sidebar on smaller tablet screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    adminLogout();
    router.replace('/uniquesuperadmin/login');
  };

  const isLoginRoute =
    pathname === "/uniquesuperadmin/login" || pathname === "/uniquesuperadmin/login/";

  // Show login page without layout
  if (isLoginRoute) {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-[#0c0b5d] animate-spin" />
          <p className="text-slate-500 font-medium text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white md:bg-[#F8FAFC] flex text-slate-900 font-sans antialiased overflow-hidden relative z-10">
      {/* Sidebar - Desktop/Tablet */}
      <aside 
        className={`fixed inset-y-0 left-0 bg-white border-r border-slate-200 transition-all duration-300 z-50 flex flex-col ${
          isSidebarOpen ? "w-64" : "w-20"
        } hidden md:flex`}
      >
        {/* Sidebar Header */}
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen ? (
            <Link href="/uniquesuperadmin" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#0c0b5d] rounded-lg flex items-center justify-center text-white">
                <span className="font-black text-xs italic">U</span>
              </div>
              <span className="font-black italic text-[#0c0b5d] uppercase tracking-tighter text-lg leading-none">
                Unique<span className="text-[#FA6400]">Futsal</span>
              </span>
            </Link>
          ) : (
            <div className="w-8 h-8 bg-[#0c0b5d] rounded-lg flex items-center justify-center text-white mx-auto">
              <span className="font-black text-xs italic">U</span>
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 mt-4 space-y-1 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href.split("?")[0];
            return (
              <Link 
                key={item.name}
                href={item.href}
                className={`flex items-center gap-4 rounded-xl transition-all duration-200 group px-3 ${
                  isSidebarOpen ? "py-3" : "py-3 justify-center"
                } ${
                  isActive 
                    ? "bg-[#0c0b5d] text-white shadow-lg shadow-blue-900/10" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-[#0c0b5d]"
                }`}
              >
                <item.icon size={20} className={isActive ? "text-white" : "group-hover:scale-110 transition-transform"} />
                {isSidebarOpen && (
                  <span className="font-black uppercase tracking-widest text-[10px]">
                    {item.name}
                  </span>
                )}
                {isSidebarOpen && isActive && (
                  <div className="ml-auto">
                    <div className="w-1.5 h-1.5 bg-[#FA6400] rounded-full" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 mb-2">
          <button 
            onClick={handleLogout}
            className={`flex items-center gap-4 rounded-xl transition-all text-slate-500 hover:bg-red-50 hover:text-red-500 w-full px-3 cursor-pointer ${
            isSidebarOpen ? "py-3" : "py-3 justify-center"
          }`}>
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-black uppercase tracking-widest text-[10px]">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div 
        className={`flex-1 transition-all duration-300 min-w-0 ${
          isSidebarOpen ? "md:ml-64" : "md:ml-20"
        }`}
      >
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 items-center justify-center text-slate-600 hover:text-[#0c0b5d] hover:bg-white transition-all md:flex hidden cursor-pointer"
              >
                <Menu size={20} className={isSidebarOpen ? "rotate-90 transition-transform" : ""} />
              </button>

              <button 
                onClick={() => setIsMobileOpen(true)}
                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 md:hidden cursor-pointer"
              >
                <Menu size={20} />
              </button>
              
              {/* Breadcrumb / Title */}
              <div className="flex flex-col ml-2">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Control Panel</span>
                 <h2 className="text-xl font-black italic text-[#0c0b5d]">
                    {NAV_ITEMS.find(n => n.href.split("?")[0] === pathname)?.name || "Dashboard"}
                 </h2>
              </div>
           </div>

           <div className="flex items-center gap-6">
              {/* Search Bar - Hidden on small mobile */}
             
              {/* Notification & Actions */}
              <div className="flex items-center gap-3 border-l border-slate-100 pl-6 relative">

               {/* Notification Bell */}
               <div className="relative">
                 <button
                   onClick={() => { 
                     const willOpen = !isNotifOpen;
                     setIsNotifOpen(willOpen); 
                     setIsProfileMenuOpen(false); 
                     if (willOpen) {
                       markAllRead();
                       refreshNotifs();
                     }
                   }}
                   className="relative h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 text-slate-500 hover:bg-[#0c0b5d] hover:text-white hover:border-[#0c0b5d] transition-all cursor-pointer"
                 >
                   <Bell size={18} />
                   {unreadCount > 0 && (
                     <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FA6400] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                       {unreadCount > 9 ? "9+" : unreadCount}
                     </span>
                   )}
                 </button>

                 {isNotifOpen && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                     <div className="absolute top-14 right-0 w-96 bg-white rounded-[24px] border border-slate-100 shadow-2xl shadow-blue-900/10 z-50 flex flex-col overflow-hidden">
                       {/* Header */}
                       <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                         <div className="flex flex-col">
                           <span className="text-xs font-black uppercase tracking-widest text-[#0c0b5d]">Notifications</span>
                           <span className="text-[9px] font-medium text-slate-400">{unreadCount} unread</span>
                         </div>
                         <div className="flex items-center gap-2">
                           {unreadCount > 0 && (
                             <button onClick={() => { markAllRead(); refreshNotifs(); }} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 cursor-pointer">
                               <CheckCheck size={12} /> Mark all read
                             </button>
                           )}
                           <button onClick={() => { clearNotifications(); refreshNotifs(); }} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 cursor-pointer">
                             <Trash2 size={12} />
                           </button>
                         </div>
                       </div>

                       {/* List */}
                       <div className="max-h-96 overflow-y-auto flex flex-col">
                         {notifications.length === 0 ? (
                           <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                             <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300"><Bell size={24} /></div>
                             <span className="text-xs font-bold text-slate-400">No notifications yet</span>
                             <span className="text-[10px] text-slate-300 font-medium">Booking alerts will appear here</span>
                           </div>
                         ) : (
                           notifications.map((n) => (
                             <div 
                               key={n.id} 
                               onClick={() => {
                                 const targetLink = n.link || (
                                   n.type === "booking" ? "/uniquesuperadmin/bookings" :
                                   n.type === "membership" ? "/uniquesuperadmin/memberships" :
                                   undefined
                                 );
                                 if (targetLink) {
                                   router.push(targetLink);
                                   setIsNotifOpen(false);
                                 }
                               }}
                               className={`flex items-start gap-3 px-5 py-4 border-b border-slate-50 last:border-b-0 transition-colors cursor-pointer hover:bg-slate-50 ${n.read ? "" : "bg-blue-50/30"}`}
                             >
                               <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                                 n.type === "booking" ? "bg-[#0c0b5d]" :
                                 n.type === "membership" ? "bg-[#FA6400]" : "bg-red-400"
                               }`}>
                                 {n.type === "booking" ? <CalendarCheck size={16} /> : n.type === "membership" ? <Crown size={16} /> : <X size={16} />}
                               </div>
                               <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                 <div className="flex items-center justify-between gap-2">
                                   <span className="text-xs font-black text-[#0c0b5d] truncate">{n.title}</span>
                                   {!n.read && <div className="w-1.5 h-1.5 bg-[#FA6400] rounded-full shrink-0" />}
                                 </div>
                                 <span className="text-[10px] font-medium text-slate-500 leading-relaxed">{n.body}</span>
                                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{relativeTime(n.timestamp)}</span>
                               </div>
                             </div>
                           ))
                         )}
                       </div>
                     </div>
                   </>
                 )}
               </div>

                 <button 
                   onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsNotifOpen(false); }}
                   className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 text-[#0c0b5d] hover:bg-indigo-100 transition-colors cursor-pointer"
                 >
                    <Users size={20} />
                 </button>

                 {/* Dropdown Menu */}
                 {isProfileMenuOpen && (
                   <>
                     <div 
                       className="fixed inset-0 z-40" 
                       onClick={() => setIsProfileMenuOpen(false)} 
                     />
                     <div className="absolute top-14 right-0 w-48 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-blue-900/5 z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                           <p className="text-xs font-black uppercase tracking-widest text-[#0c0b5d]">Admin</p>
                           <p className="text-[10px] font-medium text-slate-400 truncate">{adminInfo?.email || "admin@uniquefutsal.com"}</p>
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                          
                           <div className="h-px w-full bg-slate-50 my-1" />
                           <button 
                             onClick={handleLogout}
                             className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                           >
                              <LogOut size={14} /> Log Out
                           </button>
                        </div>
                     </div>
                   </>
                 )}
              </div>
           </div>
        </header>

        {/* Main Content Area */}
        <main className="p-6 md:p-8 max-w-[1600px] mx-auto w-full">
           {children}
        </main>
      </div>

      {/* Mobile Sidebar Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-100 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-md transition-all duration-300"
            onClick={() => setIsMobileOpen(false)}
          />
          
          {/* Drawer Content */}
          <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 ease-out">
            {/* Drawer Header */}
            <div className="p-6 flex items-center justify-between border-b border-slate-100">
              <Link href="/uniquesuperadmin" className="flex items-center gap-3" onClick={() => setIsMobileOpen(false)}>
                <div className="w-8 h-8 bg-[#0c0b5d] rounded-lg flex items-center justify-center text-white">
                  <span className="font-black text-xs italic">U</span>
                </div>
                <span className="font-black italic text-[#0c0b5d] uppercase tracking-tighter text-lg leading-none">
                  Unique<span className="text-[#FA6400]">Futsal</span>
                </span>
              </Link>
              <button 
                onClick={() => setIsMobileOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-[#0c0b5d] rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Nav Items */}
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto no-scrollbar">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href.split("?")[0];
                return (
                  <Link 
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all group ${
                      isActive 
                        ? "bg-[#0c0b5d] text-white shadow-lg shadow-blue-900/20" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-[#0c0b5d]"
                    }`}
                  >
                    <item.icon size={20} className={isActive ? "text-white" : "group-hover:scale-110 transition-transform"} />
                    <span className="font-black uppercase tracking-widest text-[10px]">
                      {item.name}
                    </span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 bg-[#FA6400] rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100">
              <button 
                onClick={() => {
                  handleLogout();
                  setIsMobileOpen(false);
                }}
                className="flex items-center gap-4 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-500 w-full px-4 py-3.5 transition-all cursor-pointer"
              >
                <LogOut size={20} />
                <span className="font-black uppercase tracking-widest text-[10px]">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster richColors position="top-right" />
    </div>
  );
}
