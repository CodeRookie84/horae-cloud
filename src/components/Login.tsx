/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Building, AlertCircle, RefreshCw, Sparkles, KeyRound, Eye, EyeOff } from "lucide-react";
import { store } from "../services/store";
import { User } from "../types";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cleanEmail = email.toLowerCase().trim();
  const isSuperAdminEmail = cleanEmail === "coderookie84@gmail.com";

  // Secret developer shortcut: double clicking the logo icon auto-fills superadmin
  const handleLogoDoubleClick = () => {
    setEmail("coderookie84@gmail.com");
    setCompanyName("");
    setPassword("!Horae@2026");
    setErrorMsg("");
  };

  const [tempLoggedInUser, setTempLoggedInUser] = useState<User | null>(null);
  const [showFirstLoginPrompt, setShowFirstLoginPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Email address or mobile number is required.");
      return;
    }
    if (!password.trim()) {
      setErrorMsg("Password is required.");
      return;
    }
    if (!isSuperAdminEmail && !companyName.trim()) {
      setErrorMsg("Company name is required for brand logins.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // If Super Admin, companyName is ignored by verifyLogin
      const user = await store.verifyLogin(isSuperAdminEmail ? "" : companyName, email, password);
      if (user) {
        const loginKey = store.loginKeyFor(user);
        const hasChangedPwd = localStorage.getItem(`horae_pwd_changed_${loginKey}`);
        if (!hasChangedPwd) {
          setTempLoggedInUser(user);
          setShowFirstLoginPrompt(true);
        } else {
          onLoginSuccess(user);
        }
      } else {
        setErrorMsg("Invalid credentials. Please verify your Email, Password, and Company Name.");
      }
    } catch (err: any) {
      console.error("Login verification failed:", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFirstLoginPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setPwdError("New password cannot be empty.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      setPwdError("Password must be at least 4 characters long.");
      return;
    }

    setLoading(true);
    setPwdError("");
    try {
      const loginKey = store.loginKeyFor(tempLoggedInUser!);
      await store.updateUserPassword(loginKey, newPassword.trim());
      localStorage.setItem(`horae_pwd_changed_${loginKey}`, "true");
      onLoginSuccess(tempLoggedInUser!);
    } catch (err) {
      console.error("Password update failed:", err);
      setPwdError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Shared light-glass input classes (violet focus). Super Admin gets an amber focus.
  const inputBase =
    "w-full text-xs py-3 bg-white/70 border rounded-xl text-[#241D4B] placeholder-[#9E97BE] focus:outline-none focus:bg-white transition-all";
  const inputBrand = "border-[#E7E3F5] focus:border-[#8B7CF6] focus:ring-1 focus:ring-[#8B7CF6]/40";
  const inputAdmin = "border-amber-300/60 focus:border-amber-500 focus:ring-1 focus:ring-amber-400/50";

  return (
    <div className="min-h-screen w-full bg-[#FBFAFF] relative flex items-center justify-center font-sans overflow-hidden p-4">
      {/* Decorative pastel gradient orbs */}
      <div
        className={`absolute top-[-20%] left-[-10%] w-[55%] h-[60%] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
          isSuperAdminEmail ? "bg-amber-400/20" : "bg-[#8B7CF6]/30"
        }`}
      />
      <div
        className={`absolute bottom-[-20%] right-[-12%] w-[55%] h-[62%] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
          isSuperAdminEmail ? "bg-amber-300/15" : "bg-[#4FD6B0]/25"
        }`}
      />
      <div className="absolute top-[30%] right-[20%] w-[32%] h-[40%] rounded-full blur-[120px] pointer-events-none bg-[#F49AD1]/18" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full max-w-md bg-white/75 backdrop-blur-2xl border rounded-3xl p-8 shadow-[0_24px_70px_-20px_rgba(123,110,240,0.35)] flex flex-col relative z-10 transition-colors duration-550 ${
          isSuperAdminEmail ? "border-amber-300/50" : "border-white/70"
        }`}
      >
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-8 select-none flex flex-col items-center">
          <img
            src="/horae-logo.jpg"
            alt="Horae Logo"
            onDoubleClick={handleLogoDoubleClick}
            title="Double-click to activate administrative mode"
            className="h-14 max-w-full object-contain mb-2 cursor-pointer active:scale-95 transition-all bg-white p-2.5 rounded-2xl border border-[#E7E3F5] shadow-sm"
          />
          <h2 className="text-2xl font-display font-semibold text-[#241D4B] tracking-tight">
            Horae Operations Portal
          </h2>
          <p className="text-xs text-[#6A6390] font-medium">
            Standard Operating Compliance & Operations Platform
          </p>
        </div>

        {showFirstLoginPrompt && tempLoggedInUser ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-4">
              <KeyRound className="w-10 h-10 text-[#8B7CF6] mx-auto" />
              <h3 className="text-lg font-display font-semibold text-[#241D4B]">Set a New Password</h3>
              <p className="text-xs text-[#6A6390] leading-normal">
                This is your first login. For security, please set a new password before continuing.
              </p>
            </div>

            <form onSubmit={handleFirstLoginPasswordChange} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-[#6A6390] uppercase tracking-widest block px-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    placeholder="Enter new password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputBase} ${inputBrand} pl-4 pr-10 font-semibold`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-[#9E97BE] hover:text-[#8B7CF6] focus:outline-none cursor-pointer flex items-center h-5"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-[#6A6390] uppercase tracking-widest block px-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Confirm new password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputBase} ${inputBrand} pl-4 pr-10 font-semibold`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-[#9E97BE] hover:text-[#8B7CF6] focus:outline-none cursor-pointer flex items-center h-5"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {pwdError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-medium text-rose-600 leading-snug">{pwdError}</span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#8B7CF6] via-[#6FB7F7] to-[#4FD6B0] hover:brightness-105 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#8B7CF6]/25"
                >
                  Update & Enter Portal
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Dynamic Super Admin notification banner */}
            <AnimatePresence>
              {isSuperAdminEmail && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center mb-5 overflow-hidden flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                    Super Admin Session Detected
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Company Name Input (Smoothly hides when Super Admin email is typed) */}
              <AnimatePresence initial={false}>
                {!isSuperAdminEmail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="space-y-1.5 overflow-hidden text-left"
                  >
                    <label className="text-[10px] font-bold text-[#6A6390] uppercase tracking-widest block px-1">
                      Company Name
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-4 h-4 text-[#8B7CF6]" />
                      <input
                        type="text"
                        required={!isSuperAdminEmail}
                        placeholder="e.g. cakewala"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value.toLowerCase())}
                        className={`${inputBase} ${inputBrand} pl-10 pr-4 font-mono`}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email or Mobile Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-[#6A6390] uppercase tracking-widest block px-1">
                  {isSuperAdminEmail ? "Registered Email" : "Email or Mobile Number"}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[#8B7CF6]" />
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    required
                    placeholder="e.g. karan@cakewala.com or +91 98…"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputBase} ${isSuperAdminEmail ? inputAdmin : inputBrand} pl-10 pr-4`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-[#6A6390] uppercase tracking-widest block px-1">
                  Secure Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-[#8B7CF6]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputBase} ${isSuperAdminEmail ? inputAdmin : inputBrand} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#9E97BE] hover:text-[#8B7CF6] focus:outline-none cursor-pointer flex items-center h-5"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-medium text-rose-600 leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : isSuperAdminEmail
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white shadow-amber-500/30"
                    : "bg-gradient-to-r from-[#8B7CF6] via-[#6FB7F7] to-[#4FD6B0] hover:brightness-105 text-white shadow-[#8B7CF6]/30"
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                    Authenticating...
                  </>
                ) : isSuperAdminEmail ? (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Access Admin Portal
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Secure Login
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
