'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from './Navigation';
import { loadState, saveState, AppState, addAuditLog, getInitialState } from '@/lib/store';
import { UserRole, Invoice } from '@/financial-engine/types';
import { fetchFullStateFromSupabase, syncStateToSupabase } from '@/lib/supabase-adapter';

interface AppLayoutProps {
  children: (props: {
    state: AppState;
    updateState: (newState: AppState) => void;
    currentRole: UserRole;
  }) => React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  // Inizializzato con getInitialState() — mai null, evita blocco infinito "Caricamento..."
  const [state, setState] = useState<AppState>(() => getInitialState());
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'offline_fallback'>('connecting');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const syncExecutedRef = useRef(false);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      const remotePartial = await fetchFullStateFromSupabase();
      if (remotePartial && (remotePartial.bankAccounts?.length || remotePartial.invoices?.length)) {
        console.log('✅ Supabase ricaricato: dati aggiornati con successo.');
        setDbStatus('connected');
        setState(prev => {
          if (!prev) return prev;
          const merged: AppState = {
            ...prev,
            bankAccounts: remotePartial.bankAccounts || prev.bankAccounts,
            entities: remotePartial.entities || prev.entities,
            invoices: remotePartial.invoices || prev.invoices,
            bankTransactions: remotePartial.bankTransactions || prev.bankTransactions,
            contracts: remotePartial.contracts || prev.contracts,
            employees: remotePartial.employees && remotePartial.employees.length > 0 ? remotePartial.employees : prev.employees,
            payrollRecords: remotePartial.payrollRecords && remotePartial.payrollRecords.length > 0 ? remotePartial.payrollRecords : prev.payrollRecords,
            taxRules: remotePartial.taxRules || prev.taxRules,
            forecastItems: remotePartial.forecastItems || prev.forecastItems,
            auditLogs: remotePartial.auditLogs || prev.auditLogs,
            arubaConfig: remotePartial.arubaConfig || prev.arubaConfig
          };
          saveState(merged);
          return merged;
        });
      }
    } catch (err) {
      console.error('Errore ricaricando dati da Supabase:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // 1. Carica prima lo stato locale per reattività immediata
    const local = loadState();
    setState(local);

    // 2. Fetch da Supabase per idratare i dati da DB remoto
    fetchFullStateFromSupabase().then(remotePartial => {
      if (remotePartial && (remotePartial.bankAccounts?.length || remotePartial.invoices?.length)) {
        console.log('✅ Supabase connesso: caricamento dati remoti completato.');
        setDbStatus('connected');
        setState(prev => {
          if (!prev) return local;

          const merged: AppState = {
            ...prev,
            bankAccounts: remotePartial.bankAccounts || prev.bankAccounts,
            entities: remotePartial.entities || prev.entities,
            invoices: remotePartial.invoices || prev.invoices,
            bankTransactions: remotePartial.bankTransactions || prev.bankTransactions,
            contracts: remotePartial.contracts || prev.contracts,
            employees: remotePartial.employees && remotePartial.employees.length > 0 ? remotePartial.employees : prev.employees,
            payrollRecords: remotePartial.payrollRecords && remotePartial.payrollRecords.length > 0 ? remotePartial.payrollRecords : prev.payrollRecords,
            taxRules: remotePartial.taxRules || prev.taxRules,
            forecastItems: remotePartial.forecastItems || prev.forecastItems,
            auditLogs: remotePartial.auditLogs || prev.auditLogs,
            arubaConfig: remotePartial.arubaConfig || prev.arubaConfig
          };

          saveState(merged);
          return merged;
        });
      } else {
        // Se su Supabase le tabelle sono vuote o non ancora create, usa i dati locali e prova a fare un primo sync di inizializzazione
        console.log('ℹ️ Supabase tabelle vuote o in fase di setup. Uso archivio locale.');
        setDbStatus('offline_fallback');
        // Se le tabelle esistono ma sono vuote, popola con i dati correnti
        if (remotePartial && (!remotePartial.bankAccounts || remotePartial.bankAccounts.length === 0)) {
          syncStateToSupabase(local).then(success => {
            if (success) {
              setDbStatus('connected');
              console.log('✅ Dati iniziali sincronizzati su Supabase con successo!');
            }
          });
        }
      }
    }).catch(err => {
      console.warn('⚠️ Impossibile sincronizzare con Supabase, uso memoria locale:', err);
      setDbStatus('offline_fallback');
    });
  }, []);

  // Controllo e sincronizzazione automatica giornaliera in background
  useEffect(() => {
    if (!state || syncExecutedRef.current) return;

    const cfg = state.arubaConfig;
    if (!cfg || !cfg.username || !cfg.password || !cfg.autoSyncDaily) {
      return;
    }

    const now = new Date();
    const lastSyncDate = cfg.lastSyncTimestamp ? new Date(cfg.lastSyncTimestamp) : null;
    const hoursSinceLast = lastSyncDate ? (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60) : 999;

    // Se sono trascorse più di 24 ore (o primo avvio con credenziali salvate)
    if (hoursSinceLast >= 24) {
      syncExecutedRef.current = true;
      console.log('Avvio sincronizzazione automatica giornaliera con Aruba...');

      fetch('/api/aruba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cfg.username,
          password: cfg.password,
          environment: cfg.environment || 'production',
          maxPages: 50
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.invoices) {
          const invoices: Invoice[] = data.invoices;
          const existingKeys = new Set(
            state.invoices.map(i => `${i.type}_${i.number.trim().toLowerCase()}_${i.issueDate}`)
          );

          const newInvoices: Invoice[] = [];
          invoices.forEach(inv => {
            const key = `${inv.type}_${inv.number.trim().toLowerCase()}_${inv.issueDate}`;
            if (!existingKeys.has(key)) {
              newInvoices.push(inv);
              existingKeys.add(key);
            }
          });

          let updatedState: AppState = {
            ...state,
            invoices: [...newInvoices, ...state.invoices],
            arubaConfig: {
              ...cfg,
              lastSyncTimestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
              lastSyncStatus: `Sincronizzazione automatica giornaliera completata con successo (${newInvoices.length} nuove fatture acquisite)`,
              lastActiveCount: data.totalActiveCount || 0,
              lastPassiveCount: data.totalPassiveCount || 0
            }
          };

          if (newInvoices.length > 0) {
            updatedState = addAuditLog(updatedState, {
              entityType: 'ARUBA_API',
              entityId: cfg.username,
              action: 'UPDATE',
              details: `Sincronizzazione automatica giornaliera: aggiunte ${newInvoices.length} nuove fatture.`
            });
          }

          setState(updatedState);
          saveState(updatedState);
          syncStateToSupabase(updatedState);
        }
      })
      .catch(err => {
        console.error('Errore durante la sincronizzazione automatica Aruba:', err);
      });
    }
  }, [state]);

  const handleUpdateState = (newState: AppState) => {
    setState(newState);
    saveState(newState);
    // Sincronizza in background su Supabase
    syncStateToSupabase(newState).catch(err => console.error('Errore sincronizzazione Supabase:', err));
  };


  const handleRoleChange = (newRole: UserRole) => {
    const updated: AppState = {
      ...state,
      currentUser: {
        ...state.currentUser,
        role: newRole,
        name: newRole === 'amministrazione' 
          ? 'Amministrazione Elacus' 
          : 'Socio Elacus'
      }
    };
    handleUpdateState(updated);
  };

  return (
    <div className="flex w-full min-h-screen overflow-x-hidden">
      <Navigation
        currentRole={state.currentUser.role}
        onRoleChange={handleRoleChange}
        userName={state.currentUser.name}
        dbStatus={dbStatus}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
      />
      <main className="flex-1 bg-slate-50 min-h-screen overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {children({
            state,
            updateState: handleUpdateState,
            currentRole: state.currentUser.role
          })}
        </div>
      </main>
    </div>
  );
};
