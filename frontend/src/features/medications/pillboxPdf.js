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

// Mismos colores que en la pantalla: mañana ámbar, tarde/noche índigo, SOS gris
const CHIP = {
  AM: { background: '#fef3c7', color: '#92400e' },
  PM: { background: '#e0e7ff', color: '#3730a3' },
  SOS: { background: '#f1f5f9', color: GRAY },
};

/** Cada hora como "chip": fondo de color detrás del texto (resaltado, no un dibujo). */
function timesCell(list, sos, period) {
  if (list.length === 0) return { text: '—', color: '#cbd5e1' };
  const chip = CHIP[sos ? 'SOS' : period];
  return {
    text: list.flatMap((t, i) => [
      ...(i ? [{ text: '  ' }] : []),
      // \u00a0 = espacio que no se corta: margen del "chip" a cada lado
      { text: `\u00a0${t}\u00a0`, bold: true, ...chip },
      { text: `${period}\u00a0`, fontSize: 5.5, ...chip },
    ]),
    lineHeight: 1.35,
  };
}

const COLS = 5 + WEEK.length; // Medicamento, Dosis, AM, PM, Indicaciones + L…D
const LINE = '#cbd5e1';

/**
 * Un residente = UNA tabla simple (sin bloques "inseparables" ni dibujos: el visor de PDF de iOS
 * los dejaba en blanco). Fila 1: nombre; fila 2: encabezados (se repiten si la tabla sigue en la
 * página siguiente); las casillas L…D son celdas vacías con borde.
 */
function residentTable(r) {
  const nameRow = [
    {
      colSpan: COLS,
      fillColor: '#f1f5f9',
      columns: [
        { text: `${r.first_name} ${r.last_name}`, bold: true, fontSize: 9 },
        { text: [roomLabel(r), r.show_site ? ` · ${r.site_name}` : ''].join(''), alignment: 'right', color: GRAY, fontSize: 8 },
      ],
    },
    ...Array(COLS - 1).fill({}),
  ];
  const header = [
    { text: 'Medicamento', style: 'th' },
    { text: 'Dosis', style: 'th' },
    { text: 'Mañana · AM', style: 'th', color: '#b45309' },
    { text: 'Tarde/noche · PM', style: 'th', color: '#4338ca' },
    { text: 'Indicaciones', style: 'th' },
    ...WEEK.map((d) => ({ text: d, style: 'th', alignment: 'center' })),
  ];
  const rows = r.medications.map((m) => {
    const am = m.times.filter(isAM);
    const pm = m.times.filter((t) => !isAM(t));
    const notes = [m.is_sos ? 'SOS' : null, m.schedule, m.instructions].filter(Boolean).join(' · ') || (m.is_sos ? 'Solo si se necesita' : '');
    const fill = m.is_sos ? '#fef2f2' : undefined;
    return [
      { text: m.name, bold: true },
      { text: m.dose },
      timesCell(am, m.is_sos, 'AM'),
      timesCell(pm, m.is_sos, 'PM'),
      !m.is_sos && m.times.length === 0
        ? { text: [notes, notes ? ' · ' : '', { text: 'Sin horario', color: '#b45309' }], color: '#334155' }
        : { text: notes, color: '#334155' },
      ...WEEK.map(() => ({ text: ' ' })), // casilla para marcar a mano
    ].map((cell) => ({ ...cell, fillColor: fill }));
  });

  return {
    margin: [0, 0, 0, 8],
    table: {
      headerRows: 2,
      keepWithHeaderRows: 1, // el nombre nunca queda solo al final de una página
      dontBreakRows: true,
      widths: [88, 50, 56, 56, '*', ...WEEK.map(() => 9)],
      body: [nameRow, header, ...rows],
    },
    layout: {
      hLineColor: () => LINE,
      vLineColor: () => LINE,
      hLineWidth: () => 0.6,
      // Bordes: contorno + líneas de las casillas de la semana
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length || i >= 5 ? 0.6 : 0),
      paddingTop: () => 2.5,
      paddingBottom: () => 2.5,
      paddingLeft: (i) => (i >= 5 ? 1 : 3),
      paddingRight: (i) => (i >= 5 ? 1 : 3),
    },
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
      // Línea de marca bajo el encabezado (como borde de tabla: sin dibujos vectoriales)
      {
        table: { widths: ['*'], body: [[{ text: '', border: [false, false, false, true], margin: [0, 0, 0, 0] }]] },
        layout: { hLineWidth: () => 1.5, hLineColor: () => BRAND, paddingTop: () => 0, paddingBottom: () => 0 },
        margin: [0, 2, 0, 10],
      },
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

/** ¿Se está usando como app instalada (pantalla de inicio) y no en el navegador? */
export function isInstalledApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

/**
 * Navegador (computador o celular): abre el PDF en otra pestaña; ahí el visor del navegador
 * permite imprimir, guardar o compartir. Debe llamarse directo desde el clic (si no, se bloquea
 * como ventana emergente; en ese caso se descarga).
 */
export function openPdfInTab({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  if (tab) return 'opened';
  downloadBlob(url, filename);
  return 'downloaded';
}

function downloadBlob(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * App instalada: menú nativo para compartir/imprimir el PDF (en iOS window.print() no funciona ahí).
 * Si el sistema no puede compartir archivos, se descarga. Debe llamarse directo desde el toque.
 * Devuelve 'shared' | 'cancelled' | 'retry' (iOS perdió el toque) | 'downloaded'.
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
  downloadBlob(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
