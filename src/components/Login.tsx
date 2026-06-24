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
  const [companyId, setCompanyId] = useState("");
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
    setCompanyId("");
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
      setErrorMsg("Email address is required.");
      return;
    }
    if (!password.trim()) {
      setErrorMsg("Password is required.");
      return;
    }
    if (!isSuperAdminEmail && !companyId.trim()) {
      setErrorMsg("Company ID is required for brand logins.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // If Super Admin, companyId is ignored by verifyLogin
      const user = await store.verifyLogin(isSuperAdminEmail ? "" : companyId, email, password);
      if (user) {
        const hasChangedPwd = localStorage.getItem(`horae_pwd_changed_${email.toLowerCase().trim()}`);
        if (!hasChangedPwd) {
          setTempLoggedInUser(user);
          setShowFirstLoginPrompt(true);
        } else {
          onLoginSuccess(user);
        }
      } else {
        setErrorMsg("Invalid credentials. Please verify your Email, Password, and Company ID.");
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
      await store.updateUserPassword(tempLoggedInUser!.email, newPassword.trim());
      localStorage.setItem(`horae_pwd_changed_${tempLoggedInUser!.email.toLowerCase().trim()}`, "true");
      onLoginSuccess(tempLoggedInUser!);
    } catch (err) {
      console.error("Password update failed:", err);
      setPwdError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPasswordChange = () => {
    if (tempLoggedInUser) {
      localStorage.setItem(`horae_pwd_changed_${tempLoggedInUser.email.toLowerCase().trim()}`, "true");
      onLoginSuccess(tempLoggedInUser);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B1528] relative flex items-center justify-center font-sans overflow-hidden p-4">
      {/* Decorative premium gradient orbs */}
      <div 
        className={`absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
          isSuperAdminEmail ? "bg-amber-600/10" : "bg-[#1E3A8A]/30"
        }`} 
      />
      <div 
        className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${
          isSuperAdminEmail ? "bg-amber-600/10" : "bg-[#854D0E]/20"
        }`} 
      />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full max-w-md bg-slate-900/60 backdrop-blur-xl border rounded-3xl p-8 shadow-2xl flex flex-col relative z-10 transition-colors duration-550 ${
          isSuperAdminEmail ? "border-amber-500/30" : "border-slate-800/80"
        }`}
      >
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-8 select-none flex flex-col items-center">
          <img 
            src="/horae-logo.jpg" 
            alt="Horae Logo" 
            onDoubleClick={handleLogoDoubleClick}
            title="Double-click to activate administrative mode"
            className="h-14 max-w-full object-contain mb-2 cursor-pointer active:scale-95 transition-all bg-white p-2.5 rounded-2xl border border-slate-800/40 shadow-inner" 
          />
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
            Horae Operations Portal
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Standard Operating Compliance & Operations Platform
          </p>
        </div>

        {showFirstLoginPrompt && tempLoggedInUser ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-4">
              <KeyRound className="w-10 h-10 text-amber-550 mx-auto" />
              <h3 className="text-lg font-bold text-slate-105">Optional: Change Password</h3>
              <p className="text-xs text-slate-400 leading-normal">
                This appears to be your first login. You can set a new secure password now, or continue with your current password.
              </p>
            </div>

            <form onSubmit={handleFirstLoginPasswordChange} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    placeholder="Enter new password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs pl-4 pr-10 py-3 bg-slate-955/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-950/80 transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer flex items-center h-5"
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Confirm new password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-xs pl-4 pr-10 py-3 bg-slate-955/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-950/80 transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer flex items-center h-5"
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
                <div className="p-3 bg-red-955/40 border border-red-900/60 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-medium text-red-300 leading-snug">{pwdError}</span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#F59E0B] text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  Update & Enter Portal
                </button>
                
                <button
                  type="button"
                  onClick={handleSkipPasswordChange}
                  disabled={loading}
                  className="w-full py-3 px-4 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-98 cursor-pointer"
                >
                  Continue with Current Password
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
                  className="bg-amber-950/30 border border-amber-900/40 p-2.5 rounded-xl text-center mb-5 overflow-hidden flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    Super Admin Session Detected
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Company ID Input (Smoothly hides when Super Admin email is typed) */}
              <AnimatePresence initial={false}>
                {!isSuperAdminEmail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="space-y-1.5 overflow-hidden text-left"
                  >
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                      Company ID
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required={!isSuperAdminEmail}
                        placeholder="e.g. cakewala"
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                        className="w-full text-xs pl-10 pr-4 py-3 bg-slate-955/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-950/80 transition-all font-mono"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                  Registered Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. karan@cakewala.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full text-xs pl-10 pr-4 py-3 bg-slate-955/60 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-slate-950/80 transition-all ${
                      isSuperAdminEmail 
                        ? "border-amber-500/40 focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                        : "border-slate-800 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                  Secure Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full text-xs pl-10 pr-10 py-3 bg-slate-955/60 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-slate-950/80 transition-all ${
                      isSuperAdminEmail 
                        ? "border-amber-500/40 focus:border-amber-500 focus:ring-1 focus:ring-amber-500" 
                        : "border-slate-800 focus:border-indigo-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer flex items-center h-5"
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
                <div className="p-3 bg-red-955/40 border border-red-900/60 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-medium text-red-300 leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer ${
                  loading
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : isSuperAdminEmail
                    ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-amber-950/30"
                    : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-950/30"
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
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
