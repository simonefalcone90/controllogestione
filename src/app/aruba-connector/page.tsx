'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { CloudLightning, KeyRound, CheckCircle2, AlertTriangle, RefreshCw, FileText, ArrowRight, ShieldCheck, Upload, Database, Layers, Check, Clock, Save, Info, Archive, FileCode, CheckCircle, Trash2 } from 'lucide-react';
import { addAuditLog, AppState } from '@/lib/store';
import { Invoice, ArubaConfig } from '@/financial-engine/types';
import { syncEntitiesFromInvoices } from '@/financial-engine/calculations';
import JSZip from 'jszip';

interface ArubaConnectorContentProps {
  state: AppState;
  updateState: (newState: AppState) => void;
  currentRole: string;
}

const ArubaConnectorContent: React.FC<ArubaConnectorContentProps> = ({ state, updateState, currentRole }) => {
  const [username, setUsername] = useState(state.arubaConfig?.username || '');
  const [password, setPassword] = useState(state.arubaConfig?.password || '');
  const [environment, setEnvironment] = useState<'production' | 'demo'>(state.arubaConfig?.environment || 'production');
  const [autoSyncDaily, setAutoSyncDaily] = useState(state.arubaConfig?.autoSyncDaily ?? true);
  const [saveCredentials, setSaveCredentials] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Importazione Massiva ZIP & XML Singoli
  const [zipLoading, setZipLoading] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [zipStats, setZipStats] = useState<{ total: number; active: number; passive: number } | null>(null);

  // Importazione XML Testo
  const [xmlContent, setXmlContent] = useState('');
  const [importPreview, setImportPreview] = useState<Partial<Invoice> | null>(null);

  const handleFullSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentRole !== 'amministrazione') {
      alert('Solo il ruolo Amministrazione può configurare o sincronizzare le API di Aruba.');
      return;
    }

    setIsLoading(true);
    setApiResult(null);
    setSyncStatus('Autenticazione in corso e scansione dello storico di tutti gli anni su Aruba...');

    try {
      const res = await fetch('/api/aruba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, environment, maxPages: 50 })
      });

      const data = await res.json();
      setApiResult(data);
      setIsLoading(false);

      if (data.success) {
        const invoices: Invoice[] = data.invoices || [];
        setSyncStatus(`Sincronizzazione completata: recuperate ${data.totalActiveCount || 0} fatture emesse e ${data.totalPassiveCount || 0} fatture ricevute.`);

        const existingKeys = new Set(
          state.invoices.map(i => `${i.type}_${i.number.trim().toLowerCase()}_${i.issueDate}`)
        );

        const newInvoices: Invoice[] = [];
        let duplicatesCount = 0;

        invoices.forEach(inv => {
          const key = `${inv.type}_${inv.number.trim().toLowerCase()}_${inv.issueDate}`;
          if (!existingKeys.has(key)) {
            newInvoices.push(inv);
            existingKeys.add(key);
          } else {
            duplicatesCount++;
          }
        });

        const updatedConfig: ArubaConfig = {
          username: saveCredentials ? username : '',
          password: saveCredentials ? password : '',
          environment,
          autoSyncDaily,
          lastSyncTimestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          lastSyncStatus: `Sincronizzazione riuscita: ${newInvoices.length} nuove fatture importate (${duplicatesCount} già presenti).`,
          lastActiveCount: data.totalActiveCount || 0,
          lastPassiveCount: data.totalPassiveCount || 0
        };

        const updatedInvoices = [...newInvoices, ...state.invoices];
        const entitySync = syncEntitiesFromInvoices(state.entities, updatedInvoices);

        let updatedState: AppState = {
          ...state,
          invoices: updatedInvoices,
          entities: entitySync.updatedEntities,
          arubaConfig: updatedConfig
        };

        updatedState = addAuditLog(updatedState, {
          entityType: 'ARUBA_API',
          entityId: username,
          action: 'UPDATE',
          details: `Sincronizzazione massiva completata e credenziali memorizzate. Importate ${newInvoices.length} nuove fatture. Censite ${entitySync.createdCount} nuove anagrafiche (${entitySync.newEntities.map(e => e.name).slice(0, 3).join(', ')}${entitySync.createdCount > 3 ? '...' : ''}). Auto-sincronizzazione giornaliera: ${autoSyncDaily ? 'Attiva' : 'Disattiva'}.`
        });

        updateState(updatedState);
      } else {
        setSyncStatus(`Errore connessione: ${data.error}`);
      }
    } catch (err: any) {
      setIsLoading(false);
      setSyncStatus(`Errore di rete durante la sincronizzazione: ${err.message}`);
    }
  };

  const handleSaveConfigOnly = (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentRole !== 'amministrazione') return;

    const updatedConfig: ArubaConfig = {
      username: saveCredentials ? username : '',
      password: saveCredentials ? password : '',
      environment,
      autoSyncDaily,
      lastSyncTimestamp: state.arubaConfig?.lastSyncTimestamp,
      lastSyncStatus: state.arubaConfig?.lastSyncStatus,
      lastActiveCount: state.arubaConfig?.lastActiveCount,
      lastPassiveCount: state.arubaConfig?.lastPassiveCount
    };

    const updatedState: AppState = {
      ...state,
      arubaConfig: updatedConfig
    };

    updateState(updatedState);
    alert('Credenziali e impostazioni memorizzate con successo!');
  };

  // Funzione parser XML SDI
  const parseSingleXml = (xmlStr: string, defaultName = 'doc.xml'): Partial<Invoice> | null => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, "application/xml");
      
      const numeroDoc = doc.querySelector("DatiGeneraliDocumento > Numero")?.textContent || defaultName.replace(/\.xml/i, '');
      const dataDoc = doc.querySelector("DatiGeneraliDocumento > Data")?.textContent || new Date().toISOString().split('T')[0];
      const importoTotale = parseFloat(doc.querySelector("DatiGeneraliDocumento > ImportoTotaleDocumento")?.textContent || "0");
      const denomCedente = doc.querySelector("CedentePrestatore Denominazione")?.textContent || 
                          doc.querySelector("CedentePrestatore Nome")?.textContent || "Fornitore";
      const denomCessionario = doc.querySelector("CessionarioCommittente Denominazione")?.textContent || 
                              doc.querySelector("CessionarioCommittente Nome")?.textContent || "Cliente";

      // Verifica se cessionario o committente è Elacus SRL
      const isPassive = denomCessionario.toLowerCase().includes("elacus");
      const counterpart = isPassive ? denomCedente : denomCessionario;

      return {
        number: numeroDoc,
        type: isPassive ? 'passive' : 'active',
        counterpartName: counterpart,
        issueDate: dataDoc,
        economicCompetenceMonth: dataDoc.substring(0, 7),
        dueDate: dataDoc,
        taxableAmount: Number((importoTotale / 1.22).toFixed(2)),
        vatAmount: Number((importoTotale - (importoTotale / 1.22)).toFixed(2)),
        totalAmount: importoTotale,
        category: isPassive ? 'Materiale Idraulico e Forniture' : 'Impianti Termoidraulici',
        status: 'issued',
        outstandingAmount: importoTotale,
        importedFrom: 'Aruba XML / SDI'
      };
    } catch {
      return null;
    }
  };

  // Caricamento Massivo di File ZIP scaricati da Aruba
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (currentRole !== 'amministrazione') {
      alert('Solo il ruolo Amministrazione può importare file massivi.');
      return;
    }

    setZipLoading(true);
    setZipMessage('Apertura ed estrazione del file ZIP scaricato da Aruba...');
    setZipStats(null);

    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);

      const parsedInvoices: Invoice[] = [];
      let totalXmls = 0;

      for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
        if (!zipEntry.dir && (relativePath.toLowerCase().endsWith('.xml') || relativePath.toLowerCase().endsWith('.xml.p7m'))) {
          totalXmls++;
          const content = await zipEntry.async('string');
          const parsed = parseSingleXml(content, relativePath);
          if (parsed && parsed.number) {
            const docIssueDate = parsed.issueDate || new Date().toISOString().split('T')[0];
            const compMonth = docIssueDate.substring(0, 7);
            const total = parsed.totalAmount || 0;
            const taxable = parsed.taxableAmount || Number((total / 1.22).toFixed(2));
            const vat = parsed.vatAmount || Number((total - taxable).toFixed(2));

            parsedInvoices.push({
              id: `aruba-zip-${parsed.number}-${docIssueDate}`,
              number: parsed.number,
              type: parsed.type || 'active',
              counterpartId: 'sdi-partner',
              counterpartName: parsed.counterpartName || 'Controparte SDI',
              issueDate: docIssueDate,
              economicCompetenceMonth: compMonth,
              dueDate: parsed.dueDate || docIssueDate,
              taxableAmount: taxable,
              vatAmount: vat,
              totalAmount: total,
              category: parsed.category || (parsed.type === 'passive' ? 'Materiale Idraulico e Forniture' : 'Impianti Termoidraulici'),
              status: 'paid', // Saldate come richiesto per partire dal punto 0
              amountPaidByClient: total,
              amountCreditedByBank: total,
              outstandingAmount: 0,
              isActive: true,
              importedFrom: 'Aruba Esportazione Massiva ZIP'
            });
          }
        }
      }

      // Deduplicazione automatica
      const existingKeys = new Set(
        state.invoices.map(i => `${i.type}_${i.number.trim().toLowerCase()}_${i.issueDate}`)
      );

      const newInvoices: Invoice[] = [];
      let duplicates = 0;
      let activeCount = 0;
      let passiveCount = 0;

      parsedInvoices.forEach(inv => {
        const key = `${inv.type}_${inv.number.trim().toLowerCase()}_${inv.issueDate}`;
        if (!existingKeys.has(key)) {
          newInvoices.push(inv);
          existingKeys.add(key);
          if (inv.type === 'active') activeCount++;
          else passiveCount++;
        } else {
          duplicates++;
        }
      });

      const allInvoices = [...newInvoices, ...state.invoices];
      const entitySync = syncEntitiesFromInvoices(state.entities, allInvoices);

      let updatedState: AppState = {
        ...state,
        invoices: allInvoices,
        entities: entitySync.updatedEntities
      };

      updatedState = addAuditLog(updatedState, {
        entityType: 'INVOICE',
        entityId: file.name,
        action: 'CREATE',
        details: `Importazione massiva completata da ZIP Aruba (${file.name}): ${newInvoices.length} nuove fatture caricate (${activeCount} attive, ${passiveCount} passive, ${duplicates} già esistenti). Censite ${entitySync.createdCount} nuove anagrafiche.`
      });

      updateState(updatedState);
      setZipLoading(false);
      setZipStats({ total: newInvoices.length, active: activeCount, passive: passiveCount });
      setZipMessage(`Successo! Importate ${newInvoices.length} fatture dallo ZIP (${duplicates} già presenti). Censite automaticamente ${entitySync.createdCount} nuove anagrafiche.`);

    } catch (err: any) {
      setZipLoading(false);
      setZipMessage(`Errore durante l'elaborazione del file ZIP: ${err.message}`);
    }
  };

  const handleClearInvoices = () => {
    if (currentRole !== 'amministrazione') return;
    if (!confirm(`Sei sicuro di voler eliminare tutte le ${state.invoices.length} fatture presenti a sistema?\nQuesta operazione rimuoverà i dati fittizi/di prova per accogliere in modo pulito le fatture reali da Aruba.`)) {
      return;
    }

    const previousCount = state.invoices.length;
    const updatedForecast = state.forecastItems.filter(
      item => item.sourceType !== 'invoice_client' && item.sourceType !== 'invoice_supplier'
    );

    let updatedState: AppState = {
      ...state,
      invoices: [] as Invoice[],
      forecastItems: updatedForecast
    };

    updatedState = addAuditLog(updatedState, {
      entityType: 'INVOICE',
      entityId: 'ALL',
      action: 'DELETE',
      details: `Azzeramento archivio fatture da connettore: eliminate ${previousCount} fatture fittizie/di prova.`
    });

    updateState(updatedState);
    setZipStats(null);
    setZipMessage('Archivio fatture svuotato con successo. Ora puoi caricare il file ZIP reale.');
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <CloudLightning className="w-7 h-7 text-sky-600" />
          Connettore Aruba Fatturazione Elettronica
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Sincronizzazione Web Service API Aruba & Importazione Massiva Pacchetti ZIP SDI
        </p>
      </div>

      {/* Riquadro Avviso Rate Limit 429 & Istruzioni Esportazione Massiva */}
      <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-xl text-xs text-amber-950 leading-relaxed space-y-2 shadow-sm">
        <div className="font-bold flex items-center gap-2 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Notifica Sistema Aruba: Errore HTTP 429 (Rate Limit Temporaneo)
        </div>
        <p>
          Aruba ha bloccato temporaneamente le chiamate di autenticazione API perché sono state effettuate troppe richieste consecutive. Per le policy di sicurezza Aruba, <strong>è necessario attendere 60 minuti di inattività</strong> prima che il blocco si sblocchi automaticamente.
        </p>
        <p className="font-semibold text-slate-900 pt-1">
          Soluzione Immediata (Consigliata per importare subito tutti gli anni senza attese):
        </p>
        <p>
          Puoi scaricare direttamente dal tuo pannello Aruba il file <strong>.ZIP massivo</strong> delle fatture (dal menu <em>Fatture Inviate / Ricevute &rarr; Seleziona tutte &rarr; Azioni &rarr; Scarica XML</em>) e caricarlo nel riquadro sottostante: il sistema leggerà e importerà istantaneamente centinaia di fatture in pochi secondi!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canale 1: Importatore Massivo ZIP Aruba (Istantaneo & Senza Limiti) */}
        <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500/50 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Archive className="w-5 h-5 text-emerald-600" />
              Caricamento Massivo ZIP Aruba (Consigliato)
            </h2>
            <div className="flex items-center gap-2">
              {state.invoices.length > 0 && currentRole === 'amministrazione' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Vuoi dichiarare SALDATE tutte le ${state.invoices.length} fatture presenti a sistema?\nQuesta azione imposterà lo stato a "Saldata" e azzererà i crediti/debiti residui per partire dal punto 0.`)) {
                        return;
                      }
                      const updatedInvoices = state.invoices.map(inv => ({
                        ...inv,
                        status: 'paid' as const,
                        outstandingAmount: 0,
                        amountPaidByClient: inv.totalAmount,
                        amountCreditedByBank: inv.totalAmount - (inv.withholdingAmount || 0)
                      }));
                      const updatedForecast = state.forecastItems.filter(
                        item => item.sourceType !== 'invoice_client' && item.sourceType !== 'invoice_supplier'
                      );
                      let updatedState: AppState = {
                        ...state,
                        invoices: updatedInvoices,
                        forecastItems: updatedForecast
                      };
                      updatedState = addAuditLog(updatedState, {
                        entityType: 'INVOICE',
                        entityId: 'ALL',
                        action: 'UPDATE',
                        details: `Allineamento punto 0 da connettore: dichiarate saldate tutte le ${updatedInvoices.length} fatture.`
                      });
                      updateState(updatedState);
                      alert(`Tutte le ${updatedInvoices.length} fatture sono state dichiarate saldate! Residui azzerati (Punto 0).`);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-semibold flex items-center gap-1 transition-all"
                    title="Dichiara saldate tutte le fatture presenti a sistema"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Dichiara Saldate (Punto 0)
                  </button>
                  <button
                    type="button"
                    onClick={handleClearInvoices}
                    className="text-xs px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold flex items-center gap-1 transition-all"
                    title="Elimina le fatture di prova prima di caricare il file ZIP reale"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Svuota ({state.invoices.length})
                  </button>
                </>
              )}
              <span className="text-2xs uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Zero Attese
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Seleziona il file <strong>.zip</strong> scaricato da Aruba contenente tutte le fatture (anche di più anni). Il motore estrarrà e registrerà tutte le fatture attive e passive nel gestionale in un unico passaggio.
          </p>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Seleziona file .ZIP esportato da Aruba:
            </label>
            <input
              type="file"
              accept=".zip"
              disabled={zipLoading || currentRole !== 'amministrazione'}
              onChange={handleZipUpload}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
            />

            {zipLoading && (
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 pt-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{zipMessage}</span>
              </div>
            )}

            {zipStats && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs text-emerald-900">
                <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-800">
                  <CheckCircle className="w-4 h-4" /> Importazione Massiva Riuscita!
                </div>
                <div className="flex justify-between pt-1">
                  <span>Nuove Fatture Attive (Clienti):</span>
                  <strong>{zipStats.active}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Nuove Fatture Passive (Fornitori):</span>
                  <strong>{zipStats.passive}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-emerald-200 font-bold">
                  <span>Totale Documenti nel Gestionale:</span>
                  <span>{state.invoices.length} fatture</span>
                </div>
              </div>
            )}

            {zipMessage && !zipStats && !zipLoading && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-800">
                {zipMessage}
              </div>
            )}
          </div>
        </div>

        {/* Canale 2: Connettore Web Service API Aruba */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-600" />
              Web Service API Aruba (Sincronizzazione Giornaliera)
            </h2>
            {state.arubaConfig?.username && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Memorizzate
              </span>
            )}
          </div>

          <form onSubmit={handleFullSync} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ambiente Operativo
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium"
              >
                <option value="production">Produzione Reale (Tutte le fatture aziendali reali)</option>
                <option value="demo">Ambiente Demo / Collaudo Aruba</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username / Login Aruba Fatturazione
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="es. 1234567@aruba.it oppure username ditta"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password / API Key Web Service
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="saveCreds"
                  checked={saveCredentials}
                  onChange={(e) => setSaveCredentials(e.target.checked)}
                  className="h-4 w-4 rounded text-sky-600"
                />
                <label htmlFor="saveCreds" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Memorizza credenziali nel gestionale
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={autoSyncDaily}
                  onChange={(e) => setAutoSyncDaily(e.target.checked)}
                  className="h-4 w-4 rounded text-sky-600"
                />
                <label htmlFor="autoSync" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Mantieni sincronizzato automaticamente almeno una volta al giorno
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isLoading || currentRole !== 'amministrazione'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-sm transition-all"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sincronizzazione in corso...
                  </>
                ) : (
                  <>
                    <CloudLightning className="w-4 h-4" />
                    Test Sincronizzazione API
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveConfigOnly}
                disabled={currentRole !== 'amministrazione' || !username}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs border border-slate-200 transition-all flex items-center gap-1.5"
                title="Salva le credenziali per la sincronizzazione automatica giornaliera senza fare chiamate adesso"
              >
                <Save className="w-4 h-4" />
                Salva
              </button>
            </div>
          </form>

          {syncStatus && (
            <div className={`p-3 rounded-xl text-xs font-medium ${
              apiResult?.success 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {syncStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ArubaConnectorPage() {
  return (
    <AppLayout>
      {({ state, updateState, currentRole }) => (
        <ArubaConnectorContent
          state={state}
          updateState={updateState}
          currentRole={currentRole}
        />
      )}
    </AppLayout>
  );
}
