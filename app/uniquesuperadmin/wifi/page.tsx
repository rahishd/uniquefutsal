"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi, Save, Trash2, Printer, Loader2, Eye, EyeOff, QrCode, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useUpdateSettings } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api/settings";

export default function WifiManagement() {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings", "detail"] as const,
    queryFn: () => getSettings(),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
  const updateSettingsMutation = useUpdateSettings();

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSsid(settingsQuery.data.settings.wifiSSID || "");
    setPassword(settingsQuery.data.settings.wifiPassword || "");
  }, [settingsQuery.data]);

  const handleSave = async () => {
    if (!ssid) {
      toast.error("Please enter a Wifi Name (SSID)");
      return;
    }

    try {
      await updateSettingsMutation.mutateAsync({ 
        wifiSSID: ssid, 
        wifiPassword: password 
      });
      toast.success("Wifi settings updated successfully!");
    } catch (err) {
      console.error("Error saving wifi settings:", err);
      toast.error("Failed to save wifi settings");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete the wifi settings? This will clear the QR code.")) {
      return;
    }

    try {
      await updateSettingsMutation.mutateAsync({ 
        wifiSSID: "", 
        wifiPassword: "" 
      });
      setSsid("");
      setPassword("");
      toast.success("Wifi settings cleared");
    } catch (err) {
      console.error("Error deleting wifi settings:", err);
      toast.error("Failed to clear wifi settings");
    }
  };

  const handlePrint = () => {
    const printContent = qrRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const svgData = printContent.querySelector("svg")?.outerHTML;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Wifi QR Code - Unique Futsal</title>
          <style>
            body { 
              font-family: 'Inter', sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              text-align: center;
            }
            .container {
              border: 4px solid #0c0b5d;
              padding: 40px;
              border-radius: 24px;
            }
            h1 { color: #0c0b5d; margin-bottom: 5px; font-weight: 900; text-transform: uppercase; }
            h2 { color: #FA6400; margin-top: 0; font-weight: 900; }
            .qr-wrapper { margin: 30px 0; }
            .info { font-size: 20px; font-weight: bold; color: #64748b; }
            .ssid { color: #0c0b5d; font-size: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Unique Futsal</h1>
            <h2>WIFI ACCESS</h2>
            <div class="qr-wrapper">${svgData}</div>
            <div class="info">
              Scan to Connect to:<br/>
              <span class="ssid">${ssid}</span>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const wifiQrValue = `WIFI:S:${ssid};T:WPA;P:${password};;`;

  if (settingsQuery.isLoading || settingsQuery.isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#0c0b5d] animate-spin" />
          <p className="text-slate-500 font-medium">Loading wifi settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Wifi <span className="text-[#FA6400]">Access</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Configure your venue&apos;s Wifi details and generate a QR code for players.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={updateSettingsMutation.isPending || !ssid}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-500 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={16} />
            Clear
          </button>
          
          <button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            className="flex items-center gap-2 bg-[#0c0b5d] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-70"
          >
            {updateSettingsMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Configuration Card */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 md:p-10 flex flex-col gap-8"
          >
            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0c0b5d]">
                <Wifi size={24} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-black text-[#0c0b5d] uppercase tracking-wide">Network Details</h3>
                <p className="text-xs font-bold text-slate-400">Set your SSID and Password</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Wifi Name (SSID)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    placeholder="Enter Wifi Name"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/5 outline-none transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                    <Wifi size={18} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Wifi Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/5 outline-none transition-all"
                  />
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0c0b5d] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-[9px] font-medium text-slate-400 mt-1 px-1 italic">
                  * Password is optional for open networks.
                </p>
              </div>
            </div>

            <div className="bg-orange-50/50 rounded-[32px] p-6 border border-orange-100 flex items-start gap-4">
              <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[#FA6400] shadow-sm shrink-0 mt-1">
                <QrCode size={16} />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-black text-[#0c0b5d] uppercase tracking-wide">Automatic QR Generation</h4>
                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                  As you type, the QR code on the right updates instantly. Players can scan it with their camera to join the network without typing.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* QR Display Card */}
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0c0b5d] rounded-[40px] shadow-2xl shadow-blue-900/30 p-10 flex flex-col items-center text-center gap-8 sticky top-24"
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                Unique <span className="text-[#FA6400]">Wifi</span>
              </h3>
              <p className="text-blue-200/60 text-[10px] font-black uppercase tracking-widest">Scan to Connect</p>
            </div>

            <AnimatePresence mode="wait">
              {ssid ? (
                <motion.div 
                  key="qr-active"
                  initial={{ opacity: 0, rotate: -5 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="bg-white p-6 rounded-[32px] shadow-xl relative group"
                  ref={qrRef}
                >
                  <QRCodeSVG 
                    value={wifiQrValue} 
                    size={200} 
                    level="H"
                    includeMargin={false}
                  />
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-[32px] flex items-center justify-center">
                    <button 
                      onClick={handlePrint}
                      className="bg-[#0c0b5d] text-white p-4 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all"
                    >
                      <Printer size={24} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="qr-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-[248px] h-[248px] rounded-[32px] border-2 border-dashed border-blue-400/30 flex flex-col items-center justify-center gap-3 text-blue-300/50"
                >
                  <Wifi size={48} className="opacity-20" />
                  <span className="text-[10px] font-black uppercase tracking-widest px-8">Enter network details to see QR</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2 w-full">
              <div className="bg-blue-900/30 rounded-2xl py-3 px-4 border border-blue-800/30">
                <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">SSID</p>
                <p className="text-sm font-bold text-white truncate">{ssid || "---"}</p>
              </div>
              
              <button
                onClick={handlePrint}
                disabled={!ssid}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-[#FA6400] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-orange-900/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
              >
                <Printer size={16} />
                Print Signage
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
