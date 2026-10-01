'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Receipt, 
  Landmark, 
  Users, 
  FileSpreadsheet, 
  CalendarClock, 
  FileCheck2, 
  ShieldCheck, 
  Settings,
  Scale,
  CloudLightning,
  Database,
  RefreshCw,
  CheckCheck
} from 'lucide-react';
import { UserRole } from '@/financial-engine/types';

interface NavigationProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  userName: string;
  dbStatus?: 'connecting' | 'connected' | 'offline_fallback';
  onRefreshData?: () => Promise<void>;
  isRefreshing?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ 
  currentRole, 
  onRoleChange, 
  userName, 
  dbStatus = 'connecting',
  onRefreshData,
  isRefreshing = false
}) => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Dashboard Controllo', icon: LayoutDashboard },
    { href: '/bilancio', label: 'Bilancio Gestionale', icon: Scale },
    { href: '/tesoreria', label: 'Tesoreria & Banche', icon: Landmark },
    { href: '/fatture', label: 'Ciclo Attivo / Passivo', icon: Receipt },
    { href: '/allineamento', label: 'Allineamento & Riconciliazione', icon: CheckCheck },
    { href: '/previsione-cassa', label: 'Previsione cassa', icon: CalendarClock },
    { href: '/personale', label: 'Personale & Cedolini (JOB)', icon: Users },
    { href: '/contratti', label: 'Finanziamenti & Noleggi', icon: FileSpreadsheet },
    { href: '/aruba-connector', label: 'Connettore Aruba API', icon: CloudLightning },
    { href: '/regole-fiscali', label: 'Regole Fiscali Versionate', icon: ShieldCheck },
    { href: '/verifiche', label: 'Centro Verifiche & Audit', icon: FileCheck2 },
    { href: '/anagrafiche', label: 'Anagrafiche', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col min-h-screen border-r border-slate-800 shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-sky-500 flex items-center justify-center font-bold text-white text-lg shadow-md">
            E
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-wide text-white">ELACUS SRL</h1>
            <p className="text-xs text-sky-400 font-medium">Controllo di Gestione</p>
          </div>
        </div>
      </div>

      {/* Role Switcher */}
      <div className="p-3 mx-3 my-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
        <div className="text-xs uppercase font-semibold text-slate-400 mb-1 tracking-wider">
          Profilo di Accesso
        </div>
        <div className="text-xs font-semibold text-slate-200 truncate mb-2">
          {userName}
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/60 rounded-lg">
          <button
            onClick={() => onRoleChange('amministrazione')}
            className={`py-1 px-1.5 text-xs font-semibold rounded transition-all ${
              currentRole === 'amministrazione'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Amministrazione
          </button>
          <button
            onClick={() => onRoleChange('socio')}
            className={`py-1 px-1.5 text-xs font-semibold rounded transition-all ${
              currentRole === 'socio'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Socio
          </button>
        </div>
      </div>

      {/* Database Status Indicator & Refresh Action */}
      <div className="mx-3 px-3 py-2 bg-slate-950/50 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-300 font-medium">Supabase</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              dbStatus === 'connected' 
                ? 'bg-emerald-400 animate-pulse' 
                : dbStatus === 'connecting' 
                ? 'bg-amber-400 animate-pulse' 
                : 'bg-blue-400'
            }`} />
            <span className="text-2xs text-slate-400">
              {dbStatus === 'connected' ? 'Attivo' : dbStatus === 'connecting' ? 'Sync...' : 'Locale'}
            </span>
          </div>
          {onRefreshData && (
            <button
              onClick={() => onRefreshData()}
              disabled={isRefreshing}
              title="Ricarica dati aggiornati direttamente da Supabase"
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-sky-300 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Menu Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500">
        <p className="font-semibold text-slate-400">Elacus SRL - Sistema Interno</p>
        <p className="mt-0.5 text-2xs">Controllo economico e tesoreria</p>
      </div>
    </aside>
  );
};
