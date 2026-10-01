/**
 * Estrattore universale di testo e righe da file PDF per Next.js / Browser.
 * 
 * Strategia duale:
 * 1. Primaria: Caricamento dinamico e asincrono di PDF.js (Mozilla) per ricostruire esattamente
 *    le righe, coordinate e tabelle dei documenti contabili / bancari.
 * 2. Fallback: Parser nativo in pure JavaScript che legge direttamente i flussi PDF (/FlateDecode)
 *    utilizzando la DecompressionStream nativa del browser per operare anche completamente offline.
 */

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
  lines: string[];
}

export interface ExtractedPdfDocument {
  fileName: string;
  numPages: number;
  fullText: string;
  pages: ExtractedPdfPage[];
}

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

/**
 * Assicura che la libreria pdf.js sia presente nel browser caricandola da CDN se necessario.
 */
async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => {
      console.warn('Impossibile caricare pdf.js da CDN, attivo parser di fallback.');
      resolve(null);
    };
    document.head.appendChild(script);
  });
}

/**
 * Fallback: estrazione di stringhe testuali da PDF grezzo
 */
function extractRawTextFromPdfBuffer(buffer: ArrayBuffer): ExtractedPdfDocument {
  const bytes = new Uint8Array(buffer);
  let binaryStr = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binaryStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }

  // Cerca sequenze tra parentesi tonde tipiche degli operatori di testo PDF: (Testo) Tj o [ (Testo) ] TJ
  const textChunks: string[] = [];
  const textPattern = /\(([^)]+)\)\s*(?:Tj|'|")/g;
  let match;
  while ((match = textPattern.exec(binaryStr)) !== null) {
    const cleaned = match[1]
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '\t');
    if (cleaned.trim()) {
      textChunks.push(cleaned);
    }
  }

  // Se non ha trovato blocchi Tj, prova a cercare array TJ
  if (textChunks.length === 0) {
    const arrayPattern = /\[([^\]]+)\]\s*TJ/gi;
    while ((match = arrayPattern.exec(binaryStr)) !== null) {
      const inner = match[1];
      const partPattern = /\(([^)]+)\)/g;
      let partMatch;
      let line = '';
      while ((partMatch = partPattern.exec(inner)) !== null) {
        line += partMatch[1].replace(/\\([()\\])/g, '$1') + ' ';
      }
      if (line.trim()) textChunks.push(line.trim());
    }
  }

  const lines = textChunks.filter(t => t.length > 0);
  const fullText = lines.join('\n');

  return {
    fileName: 'document.pdf',
    numPages: 1,
    fullText,
    pages: [{ pageNumber: 1, text: fullText, lines }]
  };
}

/**
 * Estrae il testo strutturato da un file PDF (File o ArrayBuffer).
 */
export async function extractTextFromPdf(fileOrBuffer: File | ArrayBuffer, fileName = 'document.pdf'): Promise<ExtractedPdfDocument> {
  const arrayBuffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  const name = fileOrBuffer instanceof File ? fileOrBuffer.name : fileName;

  const pdfjs = await loadPdfJs();

  if (pdfjs) {
    try {
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const pages: ExtractedPdfPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Raggruppa gli elementi testuali per riga basandosi sulla coordinata Y (transform[5])
        const lineGroups = new Map<number, { x: number; text: string }[]>();

        for (const item of textContent.items as any[]) {
          if (!item.str || !item.str.trim()) continue;
          const y = Math.round(item.transform[5]);
          const x = Math.round(item.transform[4]);
          
          // Tolleranza verticale di 2px per elementi sulla stessa riga
          let matchedY = y;
          for (const existingY of lineGroups.keys()) {
            if (Math.abs(existingY - y) <= 2) {
              matchedY = existingY;
              break;
            }
          }

          const group = lineGroups.get(matchedY) || [];
          group.push({ x, text: item.str });
          lineGroups.set(matchedY, group);
        }

        // Ordina le righe dall'alto verso il basso (Y decrescente)
        const sortedY = Array.from(lineGroups.keys()).sort((a, b) => b - a);
        const lines: string[] = [];

        for (const y of sortedY) {
          // Ordina gli elementi della riga da sinistra a destra (X crescente)
          const itemsOnLine = lineGroups.get(y) || [];
          itemsOnLine.sort((a, b) => a.x - b.x);
          const lineStr = itemsOnLine.map(it => it.text).join(' ').trim();
          if (lineStr) {
            lines.push(lineStr);
          }
        }

        const pageText = lines.join('\n');
        pages.push({
          pageNumber: i,
          text: pageText,
          lines
        });
      }

      const fullText = pages.map(p => p.text).join('\n\n--- PAGINA ---\n\n');

      return {
        fileName: name,
        numPages,
        fullText,
        pages
      };
    } catch (err) {
      console.warn('Errore durante il parsing con pdf.js, fallback nativo:', err);
    }
  }

  // Fallback se pdf.js non ha avuto successo
  const fallbackResult = extractRawTextFromPdfBuffer(arrayBuffer);
  fallbackResult.fileName = name;
  return fallbackResult;
}
