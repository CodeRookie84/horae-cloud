/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MobileBottomNav.tsx — persistent bottom navigation bar (mobile only).
 * Always shows a Home button (returns to the launcher) plus the few most
 * operationally-relevant modules, mirroring the WeChat/Gojek "super-app"
 * pattern that low-literacy users are already trained on by consumer apps.
 * Desktop keeps the full sidebar; this is hidden there (md:hidden).
 */
import React from 'react';
import { Home } from 'lucide-react';
import type { AppModule } from '../services/appModules';

interface MobileBottomNavProps {
  items: AppModule[];
  activeTab: string;
  onNavigate: (tabId: string) => void;
}

export default function MobileBottomNav({ items, activeTab, onNavigate }: MobileBottomNavProps) {
  const entries: AppModule[] = [
    { id: 'home', label: 'Home', icon: Home, accent: '' },
    ...items,
  ];

  return (
    <nav
      className="md:hidden shrink-0 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]"
      id="mobile-bottom-nav"
    >
      {entries.map(m => {
        const Icon = m.icon;
        const isActive = activeTab === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onNavigate(m.id)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors cursor-pointer ${
              isActive ? 'text-[#162D4E]' : 'text-slate-400 hover:text-slate-600'
            }`}
            id={`bottomnav-${m.id}`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {m.badge != null && m.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 py-0 rounded-full min-w-[15px] text-center leading-tight ring-2 ring-white">
                  {m.badge > 99 ? '99+' : m.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-semibold leading-none ${isActive ? '' : 'font-medium'}`}>
              {m.label}
            </span>
            {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#C5A880]" />}
          </button>
        );
      })}
    </nav>
  );
}
