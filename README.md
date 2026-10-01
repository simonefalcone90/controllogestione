# Gestionale Controllo di Gestione & Finanza - Elacus SRL

Gestionale web interno progettato e realizzato su misura per **Elacus SRL**, società italiana del settore termoidraulico e impiantistico civile/industriale.

Lo scopo primario dell'applicazione è il **controllo economico e finanziario mensile**: chiarire tempestivamente quanto l'azienda fattura, incassa, spende, i margini operativi effettivi (con distinzione tra competenza economica e movimenti di cassa) e la liquidità prevista a **30, 60 e 90 giorni**.

---

## 1. Caratteristiche Principali & Architettura

- **Controllo Direzionale & Bilancio Gestionale Provvisorio**:
  - Conto Economico a Valore Aggiunto: Valore della produzione, consumi materie prime, margine industriale primo, costo del personale e MOL/EBITDA gestionale.
  - Segnalazione trasparente dello stato dei dati ("Costo Incompleto" e dati provvisori se mancano prospetti con oneri riflessi).
- **Tesoreria Dinamica & Previsione Cassa (30, 60, 90 gg)**:
  - Partenza dal saldo reale disponibile dei conti attivi.
  - Voci analitiche dettagliate (scadenze clienti con probabilità di incasso, fornitori, F24, rate finanziamenti, stipendi).
  - Rettifica manuale tracciata di date e importi con motivazione in audit trail.
- **Specificità Bonifico Parlante & Ritenuta d'Acconto 8%**:
  - Distinzione netta tra totale fattura, importo versato dal cliente, accredito netto della banca e ritenuta bancaria alla fonte.
  - **La ritenuta d'acconto bancaria non genera insoluto**: la fattura risulta regolarmente saldata e la ritenuta viene contabilizzata come credito d'imposta aziendale.
- **Modulo Personale & Compatibilità JOB Sistemi (Sistemi S.p.A.)**:
  - Gestione dipendenti subordinati e contratti Co.Co.Co.
  - Acquisizione dati da cedolini individuali (lordo, trattenute INPS/IRPEF, netto da pagare) e prospetti riepilogativi (oneri c/azienda, rateo TFR, cassa edile).
  - Verifica e conferma prima del salvataggio.
- **Finanziamenti, Mutui & Noleggio Operativo**:
  - Separazione tra impatto su Cassa (uscita complessiva della rata) e costo a Conto Economico (quota interessi nei finanziamenti; intero canone nel noleggio operativo).
  - Chiusura anticipata con conservazione inalterata dello storico.
- **Regole Fiscali Versionate & Governance**:
  - Detraibilità IVA e deducibilità IRES configurabili e versionate.
  - Workflow con stato "Bozza" e "Approvata": nessuna percentuale arbitraria codificata rigidamente.
- **Sicurezza e Ruoli**:
  - Ruoli: `amministrazione` (gestione completa) e `socio` (consultazione direzionale).
  - Registro immutabile di Audit Trail per tutte le modifiche ai dati sensibili.

---

## 2. Requisiti & Avvio Locale

### Prerequisiti
- **Node.js** (v20 o superiore consigliata)
- **NPM**

### Avvio
Nella cartella principale del progetto:

```bash
# Se usi il runtime portatile configurato nel progetto:
export PATH=$(pwd)/.bin/node-v20.18.0-darwin-arm64/bin:$PATH

# Avvio del server di sviluppo
npm run dev
```

L'applicazione sarà accessibile all'indirizzo: `http://localhost:3000`

### Build di Produzione
```bash
npm run build
npm start
```

### Esecuzione Test di Calcolo Finanziario
Tutti i 7 criteri di completamento obbligatori sono coperti da test automatici:

```bash
npm test
```

---

## 3. Stato Integrazioni Esterne

1. **Fatturazione Elettronica (Aruba)**:
   - È predisposto il tracciato per importazione manuale e inserimento strutturato con deduplicazione automatica basata su numero documento, data e tipo. La sincronizzazione API diretta potrà essere abilitata solo previa verifica e disponibilità delle credenziali API Aruba Business.
2. **Conti Bancari & Estratti Conto (CBI / Open Banking PSD2)**:
   - Monitoraggio dei 4 conti correnti attivi di Elacus con gestione del fido/castelletto e salvaguardia storica per conti chiusi. Supporto alla deduplicazione delle transazioni tramite hash univoco `(conto_data_importo_causale)`.
3. **Consulente del Lavoro (JOB di Sistemi S.p.A.)**:
   - Predisposto flusso di caricamento assistito con maschera di verifica prima del consolidamento contabile per garantire che il costo aziendale comprenda oneri e TFR.
