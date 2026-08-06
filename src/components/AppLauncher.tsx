/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AppLauncher.tsx — the landing "home" screen: a grid of large app tiles, one
 * per module the user can access. Each tile opens that module full-screen.
 * This is a pure presentation of the same navigation state (activeTab) — the
 * underlying app architecture is unchanged; it just feels like a phone home
 * screen of focused mini-apps instead of one dense sidebar.
 */
import React from 'react';
import { motion } from 'motion/react';
import type { User as AppUser } from '../types';
import type { AppModule } from '../services/appModules';

interface AppLauncherProps {
  activeUser: AppUser;
  clientName?: string;
  modules: AppModule[];
  onNavigate: (tabId: string) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function AppLauncher({ activeUser, clientName, modules, onNavigate }: AppLauncherProps) {
  const firstName = (activeUser.name || '').split(' ')[0] || activeUser.name;

  return (
    <div className="max-w-4xl mx-auto w-full" id="app-launcher">
      {/* Greeting hero */}
      <div className="mb-6 md:mb-8">
        <p className="text-[13px] font-semibold text-[#C5A880] uppercase tracking-wider">
          {clientName || 'Your Workspace'}
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#162D4E] mt-1 tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Pick where you want to go.</p>
      </div>

      {/* App tile grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {modules.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => onNavigate(m.id)}
              className="group relative flex flex-col items-center justify-center gap-2.5 bg-white border border-slate-200/80 rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all cursor-pointer text-center"
              id={`launcher-tile-${m.id}`}
            >
              <div className={`relative w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center ${m.accent}`}>
                <Icon className="w-7 h-7 md:w-8 md:h-8" />
                {m.badge != null && m.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none ring-2 ring-white">
                    {m.badge > 99 ? '99+' : m.badge}
                  </span>
                )}
              </div>
              <span className="text-[13px] md:text-sm font-bold text-slate-700 leading-tight">
                {m.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
