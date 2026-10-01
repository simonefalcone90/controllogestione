import { NextResponse } from 'next/server';

function decodeJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, environment = 'production', maxPages = 50 } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Credenziali Aruba mancanti.' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim();
    const authUrl = environment === 'demo'
      ? 'https://demoauth.fatturazioneelettronica.aruba.it/auth/signin'
      : 'https://auth.fatturazioneelettronica.aruba.it/auth/signin';

    const serviceUrl = environment === 'demo'
      ? 'https://demows.fatturazioneelettronica.aruba.it'
      : 'https://ws.fatturazioneelettronica.aruba.it';

    // 1. Autenticazione OAuth 2.0
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: cleanUsername,
        password: password
      })
    });

    const rawAuthText = await authResponse.text();

    if (!authResponse.ok) {
      let errorMsg = `Errore HTTP ${authResponse.status}`;
      try {
        const errJson = JSON.parse(rawAuthText);
        if (errJson.error_description) errorMsg = errJson.error_description;
        else if (errJson.error) errorMsg = errJson.error;
      } catch {
        if (rawAuthText) errorMsg = rawAuthText.substring(0, 150);
      }

      return NextResponse.json({
        success: false,
        statusCode: authResponse.status,
        error: `Autenticazione Aruba non riuscita: ${errorMsg}`
      }, { status: authResponse.status });
    }

    const authData = JSON.parse(rawAuthText);
    const token = authData.access_token;
    const decodedToken = decodeJwt(token);

    // Identifichiamo i candidati per il parametro username (sub, user_name, client_id, piva, ecc.)
    const usernameCandidates: string[] = [cleanUsername];
    if (decodedToken) {
      if (decodedToken.user_name && !usernameCandidates.includes(decodedToken.user_name)) {
        usernameCandidates.push(decodedToken.user_name);
      }
      if (decodedToken.sub && !usernameCandidates.includes(decodedToken.sub)) {
        usernameCandidates.push(decodedToken.sub);
      }
      if (decodedToken.username && !usernameCandidates.includes(decodedToken.username)) {
        usernameCandidates.push(decodedToken.username);
      }
      if (decodedToken.fiscal_code && !usernameCandidates.includes(decodedToken.fiscal_code)) {
        usernameCandidates.push(decodedToken.fiscal_code);
      }
      if (decodedToken.vat_number && !usernameCandidates.includes(decodedToken.vat_number)) {
        usernameCandidates.push(decodedToken.vat_number);
      }
    }

    // Helper per estrarre qualsiasi array di fatture
    const extractList = (resJson: any): any[] => {
      if (!resJson) return [];
      if (Array.isArray(resJson)) return resJson;
      if (resJson.errorCode && resJson.errorCode !== '0000') return [];
      if (resJson.content && Array.isArray(resJson.content.invoices)) return resJson.content.invoices;
      if (resJson.content && Array.isArray(resJson.content)) return resJson.content;
      if (resJson.invoices && Array.isArray(resJson.invoices)) return resJson.invoices;
      if (resJson.data && Array.isArray(resJson.data)) return resJson.data;
      if (resJson.items && Array.isArray(resJson.items)) return resJson.items;
      return [];
    };

    const debugLogs: any[] = [];
    debugLogs.push({
      info: 'Token JWT claims decodificati',
      claims: decodedToken ? { sub: decodedToken.sub, user_name: decodedToken.user_name, scope: decodedToken.scope, client_id: decodedToken.client_id } : 'Nessun claim'
    });

    // Helper per interrogazione su tutti i candidati username
    const fetchAllInvoices = async (direction: 'out' | 'in') => {
      const allItems: any[] = [];
      let page = 1;
      const size = 50;
      let hasMore = true;

      let workingCandidate = '';

      while (hasMore && page <= maxPages) {
        let pageData: any = null;
        let success = false;

        const candidatesToTry = workingCandidate ? [workingCandidate] : usernameCandidates;

        for (const u of candidatesToTry) {
          const ep = `${serviceUrl}/services/invoice/${direction}/findByUsername?username=${encodeURIComponent(u)}&page=${page}&size=${size}`;
          try {
            const resp = await fetch(ep, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });

            const respText = await resp.text();
            debugLogs.push({
              testedUser: u,
              status: resp.status,
              preview: respText.substring(0, 160)
            });

            if (resp.ok) {
              try {
                const parsed = JSON.parse(respText);
                if (parsed.errorCode && parsed.errorCode !== '0000') {
                  // Errore delega per questo username, continua col prossimo candidato
                  continue;
                }
                pageData = parsed;
                workingCandidate = u;
                success = true;
                break;
              } catch (e) {
                // Not JSON
              }
            }
          } catch (err: any) {
            debugLogs.push({ testedUser: u, error: err.message });
          }
        }

        if (!success || !pageData) {
          break;
        }

        const list = extractList(pageData);
        if (list.length === 0) {
          hasMore = false;
        } else {
          allItems.push(...list);
          if (pageData.last === true || list.length < size) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      return allItems;
    };

    const rawOut = await fetchAllInvoices('out');
    const rawIn = await fetchAllInvoices('in');

    const normalizedInvoices: any[] = [];

    // Ciclo Attivo (Clienti)
    rawOut.forEach((item, index) => {
      const docNumber = item.number || item.docNumber || item.invoiceNumber || item.id || `ATT-${index + 1}`;
      const docDate = (item.invoiceDate || item.date || item.docDate || new Date().toISOString()).split('T')[0];
      const counterpart = item.receiverDescription || item.receiver || item.customer || item.denominazione || 'Cliente Fattura Elettronica';
      const total = parseFloat(item.totalAmount || item.total || item.amount || item.importoTotale || 0) || 0;
      const taxable = total > 0 ? Number((total / 1.22).toFixed(2)) : 0;
      const vat = Number((total - taxable).toFixed(2));
      const compMonth = docDate.substring(0, 7);

      normalizedInvoices.push({
        id: `aruba-out-${item.filename || docNumber}-${docDate}`,
        number: String(docNumber),
        type: 'active',
        counterpartId: 'aruba-client',
        counterpartName: String(counterpart),
        issueDate: docDate,
        economicCompetenceMonth: compMonth,
        dueDate: item.dueDate || docDate,
        taxableAmount: taxable,
        vatAmount: vat,
        totalAmount: total,
        category: 'Impianti Termoidraulici (Aruba SDI)',
        status: item.status === 'PAID' ? 'paid' : 'issued',
        outstandingAmount: total,
        isActive: true,
        importedFrom: 'Aruba API Sincronizzazione Completa',
        filename: item.filename
      });
    });

    // Ciclo Passivo (Fornitori)
    rawIn.forEach((item, index) => {
      const docNumber = item.number || item.docNumber || item.invoiceNumber || item.id || `PAS-${index + 1}`;
      const docDate = (item.invoiceDate || item.date || item.docDate || new Date().toISOString()).split('T')[0];
      const counterpart = item.senderDescription || item.sender || item.supplier || item.denominazione || 'Fornitore Fattura Elettronica';
      const total = parseFloat(item.totalAmount || item.total || item.amount || item.importoTotale || 0) || 0;
      const taxable = total > 0 ? Number((total / 1.22).toFixed(2)) : 0;
      const vat = Number((total - taxable).toFixed(2));
      const compMonth = docDate.substring(0, 7);

      normalizedInvoices.push({
        id: `aruba-in-${item.filename || docNumber}-${docDate}`,
        number: String(docNumber),
        type: 'passive',
        counterpartId: 'aruba-supplier',
        counterpartName: String(counterpart),
        issueDate: docDate,
        economicCompetenceMonth: compMonth,
        dueDate: item.dueDate || docDate,
        taxableAmount: taxable,
        vatAmount: vat,
        totalAmount: total,
        category: 'Materiali e Forniture (Aruba SDI)',
        status: item.status === 'PAID' ? 'paid' : 'issued',
        outstandingAmount: total,
        isActive: true,
        importedFrom: 'Aruba API Sincronizzazione Completa',
        filename: item.filename
      });
    });

    return NextResponse.json({
      success: true,
      authenticated: true,
      totalActiveCount: rawOut.length,
      totalPassiveCount: rawIn.length,
      totalNormalized: normalizedInvoices.length,
      invoices: normalizedInvoices,
      debugLogs: debugLogs.slice(0, 10),
      message: `Sincronizzazione completata: trovate ${rawOut.length} fatture emesse e ${rawIn.length} fatture ricevute.`
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: `Errore durante la sincronizzazione Aruba: ${error.message}`
    }, { status: 500 });
  }
}
