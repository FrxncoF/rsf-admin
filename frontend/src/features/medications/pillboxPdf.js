// Sin dependencias de React ni alias: así el PDF también se puede generar/probar fuera del navegador
const isAM = (time) => time < '12:00';
const roomLabel = ({ room, bed }) => (bed ? `Hab. ${room} · Cama ${bed}` : `Hab. ${room}`);

/**
 * PDF del pastillero (A4) generado en el navegador con pdfmake.
 * Es un PDF real: en el celular se comparte con el menú nativo (Imprimir, Guardar en Archivos,
 * WhatsApp…), algo que window.print() no logra dentro de la app instalada en iOS.
 * pdfmake (~1 MB) se carga solo cuando se necesita.
 */
async function loadPdfMake() {
  const [{ default: pdfMake }, fonts] = await Promise.all([import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js')]);
  // vfs_fonts exporta directamente el objeto { 'Roboto-Regular.ttf': … } (según versión puede venir envuelto)
  const mod = fonts.default ?? fonts;
  const vfs = mod['Roboto-Regular.ttf'] ? mod : (mod.pdfMake?.vfs ?? mod.vfs);
  if (!vfs) throw new Error('no se cargaron las fuentes del PDF');
  if (pdfMake.addVirtualFileSystem) pdfMake.addVirtualFileSystem(vfs);
  else pdfMake.vfs = vfs;
  return pdfMake;
}

async function logoDataUrl() {
  try {
    const blob = await fetch('/icons/logo.png').then((r) => (r.ok ? r.blob() : Promise.reject()));
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // sin logo igual se genera
  }
}

const BRAND = '#215d97';
const GRAY = '#64748b';
const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const box = { canvas: [{ type: 'rect', x: 0, y: 0, w: 8, h: 8, r: 1, lineColor: '#94a3b8', lineWidth: 0.6 }], width: 8 };

function timesCell(list, sos) {
  if (list.length === 0) return { text: '—', color: '#cbd5e1' };
  return { text: list.join(' · '), color: sos ? GRAY : '#0f172a', bold: !sos };
}

function residentTable(r) {
  const header = ['Medicamento', 'Dosis', 'Mañana · AM', 'Tarde/noche · PM', 'Indicaciones', WEEK.join('   ')].map((t, i) => ({
    text: t,
    style: 'th',
    color: i === 2 ? '#b45309' : i === 3 ? '#4338ca' : GRAY,
    alignment: i === 5 ? 'center' : 'left',
  }));
  const rows = r.medications.map((m) => {
    const am = m.times.filter(isAM);
    const pm = m.times.filter((t) => !isAM(t));
    const notes = [m.is_sos ? 'SOS' : null, m.schedule, m.instructions].filter(Boolean).join(' · ') || (m.is_sos ? 'Solo si se necesita' : '');
    return [
      { text: m.name, bold: true, sos: m.is_sos },
      m.dose,
      timesCell(am, m.is_sos),
      timesCell(pm, m.is_sos),
      { text: !m.is_sos && m.times.length === 0 ? [notes, notes ? ' · ' : '', { text: 'Sin horario', color: '#b45309' }] : notes, color: '#334155' },
      { columns: WEEK.map(() => box), columnGap: 3.5, width: 'auto' },
    ].map((cell) => (typeof cell === 'string' ? { text: cell } : cell));
  });

  return {
    unbreakable: r.medications.length <= 14, // un residente no se corta entre páginas (si cabe)
    margin: [0, 0, 0, 8],
    stack: [
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                columns: [
                  { text: `${r.first_name} ${r.last_name}`, bold: true, fontSize: 9 },
                  { text: [roomLabel(r), r.show_site ? ` · ${r.site_name}` : ''].join(''), alignment: 'right', color: GRAY, fontSize: 8 },
                ],
                fillColor: '#f1f5f9',
                margin: [3, 2, 3, 2],
              },
            ],
          ],
        },
        layout: { hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1', hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
      },
      {
        table: { headerRows: 1, widths: [92, 52, 62, 62, '*', 'auto'], body: [header, ...rows] },
        layout: {
          hLineColor: (i) => (i <= 1 ? '#cbd5e1' : '#e2e8f0'),
          vLineColor: () => '#cbd5e1',
          hLineWidth: () => 0.6,
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.6 : 0),
          paddingTop: () => 2.5,
          paddingBottom: () => 2.5,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          fillColor: (i, node) => (i > 0 && node.table.body[i]?.[0]?.sos ? '#fef2f2' : null),
        },
      },
    ],
  };
}

/** Devuelve { blob, filename } del pastillero de los residentes con medicamentos. */
export async function buildPillboxPdf({ residents, siteName, allSites, today }) {
  const [pdfMake, logo] = await Promise.all([loadPdfMake(), logoDataUrl()]);
  const list = residents.filter((r) => r.medications.length > 0).map((r) => ({ ...r, show_site: allSites }));
  const printedOn = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${today}T12:00:00`));

  const doc = {
    pageSize: 'A4',
    pageMargins: [28, 28, 28, 40],
    info: { title: `Pastillero · ${siteName}`, author: 'Residencia San Francisco' },
    defaultStyle: { fontSize: 7.5, lineHeight: 1.1 },
    styles: { th: { fontSize: 7, bold: true } },
    content: [
      {
        columns: [
          ...(logo ? [{ image: logo, width: 92 }] : []),
          {
            stack: [
              { text: 'Pastillero semanal', fontSize: 14, bold: true, color: BRAND },
              { text: siteName, fontSize: 9, color: GRAY },
            ],
            margin: [logo ? 10 : 0, 6, 0, 0],
          },
          { stack: [`Impreso el ${printedOn}`, 'Semana del ____ al ____'], alignment: 'right', color: GRAY, fontSize: 8, margin: [0, 8, 0, 0] },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 539, y2: 4, lineWidth: 1.5, lineColor: BRAND }], margin: [0, 2, 0, 10] },
      ...(list.length ? list.map(residentTable) : [{ text: 'No hay residentes con medicamentos registrados.', color: GRAY }]),
    ],
    footer: (page, pages) => ({
      margin: [28, 10, 28, 0],
      columns: [
        { text: 'AM = 00:00–11:59 · PM = 12:00–23:59 · SOS = solo si se necesita', fontSize: 7, color: GRAY },
        { text: 'Preparó: ______________________', fontSize: 7, color: GRAY, alignment: 'center' },
        { text: `Página ${page} de ${pages}`, fontSize: 7, color: GRAY, alignment: 'right' },
      ],
    }),
  };

  // Con tope de tiempo: si pdfmake falla por dentro no debe quedar "Preparando…" para siempre
  const blob = await Promise.race([
    new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(doc).getBlob(resolve);
      } catch (err) {
        reject(err);
      }
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('se demoró demasiado')), 30_000)),
  ]);
  const slug = siteName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase();
  return { blob, filename: `pastillero-${slug}-${today}.pdf` };
}

/** ¿Conviene el PDF + menú de compartir? (celulares y app instalada; en el computador se usa la vista de impresión) */
export function preferPdfShare() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return standalone || mobile;
}

/**
 * Abre el menú nativo para compartir/imprimir el PDF. Si el navegador no puede compartir archivos,
 * lo descarga. Debe llamarse directo desde el toque del usuario (iOS lo exige).
 * Devuelve 'shared' | 'cancelled' | 'retry' (iOS perdió el toque: hay que tocar de nuevo) | 'downloaded'.
 */
export async function sharePdf({ blob, filename }) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Pastillero semanal' });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      if (err.name === 'NotAllowedError') return 'retry';
      throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
