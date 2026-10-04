"use client";

import {
  User,
  Mail,
  Phone,
  Camera,
  Bell,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Save,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { updateMe, changePassword } from "@/lib/api/auth";
import { motion, AnimatePresence } from "framer-motion";

interface UserProfileProps {
  name: string;
  avatar: string;
  email?: string;
  phoneNumber?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfileSettings({
  userProfile,
  onProfileUpdate,
}: {
  userProfile: UserProfileProps;
  onProfileUpdate?: (updated: { name: string; avatar: string }) => void;
}) {
  /* ── local form state ── */
  const [name, setName] = useState(userProfile.name);
  const [avatarSrc, setAvatarSrc] = useState(userProfile.avatar || "");
  const [pendingBase64, setPendingBase64] = useState<string | null>(null); // base64 waiting to be saved
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveInFlightRef = useRef(false);

  /* refresh avatar if parent re-fetches after save */
  useEffect(() => {
    if (pendingBase64 === null) {
      setAvatarSrc(userProfile.avatar || "");
    }
  }, [pendingBase64, userProfile.avatar]);

  /* ── helpers ── */
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target?.result;
        if (typeof raw !== "string") {
          reject(new Error("Unable to read selected image."));
          return;
        }

        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          // Compression to max 800px width/height
          const max_size = 800;
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(raw);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7)); // compress
        };
        img.onerror = () =>
          reject(new Error("Selected file is not a valid image."));
        img.src = raw;
      };
      reader.onerror = () =>
        reject(new Error("Unable to read selected image."));
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Validate size (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Image must be under 2 MB.");
      setSaveState("error");
      return;
    }

    try {
      const base64 = await toBase64(file);
      setAvatarSrc(base64); // instant preview in this frame
      setPendingBase64(base64); // queue for save
      setIsDirty(true);
      setSaveState("idle");
      setErrorMsg("");
      // Instantly update sidebar & navbar with the preview
      onProfileUpdate?.({ name, avatar: base64 });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("userProfileUpdated", {
            detail: { name, avatar: base64 },
          }),
        );
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to process image.",
      );
      setSaveState("error");
    }
  };

  const handleRemovePhoto = () => {
    setAvatarSrc("");
    setPendingBase64(""); // empty string clears avatar in DB
    setIsDirty(true);
    setSaveState("idle");
    // Instantly clear avatar in sidebar & navbar
    onProfileUpdate?.({ name, avatar: "" });
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setIsDirty(val !== userProfile.name || pendingBase64 !== null);
    setSaveState("idle");
  };

  /* ── save to DB ── */
  const saveProfile = async ({ auto = false }: { auto?: boolean } = {}) => {
    if (auto && autoSaveInFlightRef.current) return;

    const payload: { name?: string; avatar?: string } = {};
    if (name !== userProfile.name) payload.name = name;
    if (pendingBase64 !== null) payload.avatar = pendingBase64;

    if (Object.keys(payload).length === 0) {
      return;
    }

    if (auto) {
      autoSaveInFlightRef.current = true;
    }

    setSaveState("saving");
    setErrorMsg("");
    try {
      const updated = await updateMe(payload);
      const nextName = updated.name || name;
      const nextAvatar =
        typeof updated.avatar === "string"
          ? updated.avatar
          : pendingBase64 === ""
            ? ""
            : avatarSrc || "";

      setName(nextName);
      setAvatarSrc(nextAvatar);

      setPendingBase64(null);
      setIsDirty(false);
      setSaveState("saved");

      // Notify parent so sidebar / navbar refresh immediately
      onProfileUpdate?.({
        name: nextName,
        avatar: nextAvatar,
      });

      setTimeout(() => setSaveState("idle"), auto ? 1500 : 3000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Save failed. Please try again.",
      );
      setSaveState("error");
    } finally {
      if (auto) {
        autoSaveInFlightRef.current = false;
      }
    }
  };

  const handleSave = async () => {
    await saveProfile();
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      setSaveState("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setSaveState("error");
      return;
    }

    setIsChangingPassword(true);
    setSaveState("idle");
    setErrorMsg("");

    try {
      await changePassword({ currentPassword, newPassword });
      setSaveState("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to change password.");
      setSaveState("error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Auto-save avatar-only changes so photo selection reliably persists to R2.
  useEffect(() => {
    if (pendingBase64 === null) return;
    if (saveState === "saving") return;
    if (name !== userProfile.name) return;

    const timer = window.setTimeout(() => {
      void saveProfile({ auto: true });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pendingBase64, saveState, name, userProfile.name]);

  /* ── display avatar ── */
  const avatarDisplay = avatarSrc || null;

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* ── Sticky Save Bar (top) ── */}
      <AnimatePresence>
        {(isDirty ||
          saveState === "saving" ||
          saveState === "saved" ||
          saveState === "error") && (
          <motion.div
            key="save-bar"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`sticky top-20 z-30 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-2xl border ${
              saveState === "saved"
                ? "bg-green-50 border-green-200"
                : saveState === "error"
                  ? "bg-red-50 border-red-200"
                  : "bg-gradient-to-r from-[#0c0b5d] to-[#FA6400] border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              {saveState === "saved" ? (
                <>
                  <CheckCircle2 className="text-green-600" size={20} />
                  <span className="font-black text-green-700 text-sm">
                    Profile saved successfully!
                  </span>
                </>
              ) : saveState === "error" ? (
                <>
                  <AlertCircle className="text-red-500" size={20} />
                  <span className="font-bold text-red-600 text-sm">
                    {errorMsg}
                  </span>
                </>
              ) : (
                <>
                  <Save className="text-white/80" size={18} />
                  <span className="font-bold text-white text-sm">
                    You have unsaved changes
                  </span>
                </>
              )}
            </div>

            {saveState !== "saved" && (
              <button
                onClick={handleSave}
                disabled={saveState === "saving" || !isDirty}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer ${
                  saveState === "error"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white text-[#0c0b5d] hover:bg-white/90 active:scale-95 shadow-lg"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saveState === "saving" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page title ── */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
          Profile Settings
        </h2>
        <p className="text-slate-500 font-medium">
          Manage your personal information and account preferences.
        </p>
      </div>

      {/* ── Avatar Section ── */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar circle */}
          <div className="relative group shrink-0">
            <div className="h-32 w-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-[#0c0b5d] to-[#FA6400] relative">
              {avatarDisplay ? (
                <Image
                  src={avatarDisplay}
                  alt="Profile"
                  fill
                  sizes="128px"
                  className="object-cover transition-transform group-hover:scale-110"
                  unoptimized={avatarDisplay.startsWith("data:")}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <span className="text-white font-black text-4xl">
                    {name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 h-10 w-10 bg-[#FA6400] text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg hover:scale-110 transition-all cursor-pointer"
            >
              <Camera size={16} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-black text-slate-900 mb-1">
              {name || "—"}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {pendingBase64 !== null
                ? saveState === "saving"
                  ? "Uploading photo to Cloudflare R2..."
                  : "Photo selected, starting upload..."
                : avatarDisplay
                  ? "Photo saved."
                  : "No photo uploaded yet"}
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 bg-[#0c0b5d] text-white text-xs font-bold rounded-full hover:brightness-110 transition-all cursor-pointer"
              >
                Change Photo
              </button>
              <button
                onClick={handleRemovePhoto}
                disabled={!avatarDisplay && pendingBase64 === null}
                className="px-5 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-full hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form Fields ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Name */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
            <User size={14} className="text-[#0c0b5d]" />
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all"
          />
        </div>

        {/* Email — read-only */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
            <Mail size={14} className="text-slate-400" />
            Email Address
            <span className="ml-auto text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Read-only
            </span>
          </label>
          <input
            type="email"
            value={userProfile.email || ""}
            readOnly
            className="w-full bg-slate-100/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-400 font-medium outline-none cursor-not-allowed"
          />
        </div>

        {/* Phone — read-only */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
            <Phone size={14} className="text-slate-400" />
            Phone Number
            <span className="ml-auto text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Read-only
            </span>
          </label>
          <input
            type="tel"
            value={userProfile.phoneNumber || "Not provided"}
            readOnly
            className="w-full bg-slate-100/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-400 font-medium outline-none cursor-not-allowed"
          />
        </div>
      </div>

      {/* ── Security Section (Password Change) ── */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-[#0c0b5d]" />
            Security
          </h3>
          <p className="text-sm text-slate-500 font-medium">
            Update your password to keep your account secure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Current Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700 ml-1">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Confirm New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword || !newPassword || !currentPassword}
            className="px-8 py-3 bg-[#0c0b5d] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isChangingPassword ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Updating…
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      </div>

      {/* ── Notifications Toggle ── */}
      <div className="bg-white/40 rounded-2xl p-6 border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
            <Bell size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">
              Booking Reminders
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Receive SMS notifications 1h before your games.
            </p>
          </div>
        </div>
        <div className="w-12 h-6 bg-[#FA6400] rounded-full relative cursor-pointer">
          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-all" />
        </div>
      </div>

      {/* ── Bottom Save Button (secondary / always visible) ── */}
      <div className="flex items-center justify-end pt-2 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saveState === "saving" || !isDirty}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#0c0b5d] to-[#FA6400] text-white font-black text-sm uppercase tracking-wide rounded-xl shadow-lg shadow-blue-900/10 hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveState === "saving" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving…
            </>
          ) : saveState === "saved" ? (
            <>
              <CheckCircle2 size={16} />
              Saved!
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </div>
  );
}
