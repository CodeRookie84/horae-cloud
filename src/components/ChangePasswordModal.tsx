/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChangePasswordModal — self-service "change my own password" for the currently
 * signed-in user. Works for any role (staff, client admin, super admin) because
 * it delegates to store.updateUserPassword, which calls supabase.auth.updateUser
 * on the ACTIVE session — it can only ever change the logged-in user's own
 * password, never someone else's. Passwords are one-way hashed in Supabase Auth.
 */
import React, { useState } from "react";
import { KeyRound, Eye, EyeOff, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { store } from "../services/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  const reset = () => {
    setNewPassword(""); setConfirm(""); setShow(false);
    setLoading(false); setError(""); setDone(false);
  };
  const close = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwd = newPassword.trim();
    if (pwd.length < 6) { setError("Password must be at least 6 characters long."); return; }
    if (pwd !== confirm.trim()) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    try {
      await store.updateUserPassword("", pwd);
      setDone(true);
    } catch (err: any) {
      console.error("Password change failed:", err);
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={close}>
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Change Your Password</h3>
              <p className="text-[11px] text-slate-500">Only you can set this — it's stored encrypted.</p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">Password updated</p>
            <p className="text-xs text-slate-500">Use your new password next time you sign in.</p>
            <button type="button" onClick={close} className="mt-2 w-full py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-800 cursor-pointer">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">New Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full text-xs pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Confirm Password</label>
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full text-xs pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-[11px] font-medium text-rose-600 leading-snug">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
