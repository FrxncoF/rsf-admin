import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { residentsApi } from '@/features/residents/residentsApi';
import { cn, roomLabel } from '@/lib/utils';

const MAX_SUGGESTIONS = 6;
// Texto justo antes del cursor: "@" al inicio o tras un espacio, y lo escrito después (hasta 30 letras)
const TRIGGER = /(?:^|\s)@([\p{L}\d' ]{0,30})$/u;
// Mención guardada en el texto: @[Nombre Apellido]
const TOKEN = /(@\[[^\]\n]{1,60}\])/;
const TOKEN_BEFORE_CARET = /@\[[^\]\n]{1,60}\]$/;

const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Nombre que queda en la mención: primer nombre + primer apellido. */
const mentionLabel = (r) => `${r.first_name.split(' ')[0]} ${r.last_name.split(' ')[0]}`;

/** Texto de un reporte con las menciones como etiquetas (sin @). */
export function MentionText({ text }) {
  return text.split(TOKEN).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="mx-0.5 inline-block rounded-md bg-brand-100 px-1.5 font-semibold text-brand-800">
        {part.slice(2, -1)}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Dibujo detrás del textarea (que tiene el texto transparente): mismo texto y mismas medidas,
 * pero las menciones como etiqueta. "@" y los corchetes ocupan su lugar sin verse, así el cursor
 * calza exacto; la negrita se simula con un trazo para no cambiar el ancho de las letras.
 */
function Backdrop({ text }) {
  return text.split(TOKEN).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i}>
        <span className="text-transparent">@</span>
        <span className="rounded-md bg-brand-100 text-brand-800 [-webkit-text-stroke:0.4px_currentColor] [box-decoration-break:clone]">
          <span className="text-transparent">[</span>
          {part.slice(2, -1)}
          <span className="text-transparent">]</span>
        </span>
      </span>
    ) : (
      part
    ),
  );
}

// Estilos que afectan dónde cae el cursor dentro del textarea (para ubicar la lista junto a él)
const MIRROR_PROPS = [
  'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontFamily', 'fontSize', 'fontWeight',
  'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'tabSize',
];

function caretPosition(textarea, index) {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const prop of MIRROR_PROPS) mirror.style[prop] = style[prop];
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '-9999px' });
  mirror.textContent = textarea.value.slice(0, index);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const pos = { top: marker.offsetTop, left: marker.offsetLeft, lineHeight: parseFloat(style.lineHeight) || 22 };
  mirror.remove();
  return pos;
}

// Textarea y dibujo de fondo deben medir exactamente igual
const SHARED = 'w-full whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-[15px] leading-relaxed';

/**
 * Textarea donde "@" despliega los residentes de la sede y filtra mientras se escribe.
 * Al elegir uno queda como etiqueta (se guarda como "@[Nombre Apellido]").
 * Crece con el texto en vez de tener barra de desplazamiento, para que el fondo calce.
 */
export function MentionTextarea({ value, onChange, siteId, rows = 14, className, ...props }) {
  const ref = useRef(null);
  const [residents, setResidents] = useState([]);
  const [mention, setMention] = useState(null); // { start, query } mientras se escribe una mención
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!siteId) return setResidents([]);
    const controller = new AbortController();
    residentsApi
      .list({ site_id: siteId, status: 'active', pageSize: 200, sort: 'name' }, { signal: controller.signal })
      .then(({ data }) => setResidents(data))
      .catch(() => {});
    return () => controller.abort();
  }, [siteId]);

  // Alto según el contenido (mínimo `rows` líneas)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const words = normalize(mention.query).split(' ').filter(Boolean);
    return residents
      .filter((r) => {
        const haystack = normalize(`${r.first_name} ${r.last_name} ${r.room ?? ''}`).split(/\s+/);
        return words.every((w) => haystack.some((h) => h.startsWith(w)));
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [mention, residents]);

  const open = Boolean(mention) && suggestions.length > 0;

  useEffect(() => setActive(0), [mention?.query]);

  useLayoutEffect(() => {
    if (open && ref.current) setPos(caretPosition(ref.current, mention.start));
  }, [open, mention?.start]);

  function detect(textarea) {
    const caret = textarea.selectionStart;
    if (caret !== textarea.selectionEnd) return setMention(null);
    const match = textarea.value.slice(0, caret).match(TRIGGER);
    setMention(match ? { start: caret - match[1].length - 1, query: match[1] } : null);
  }

  function replaceRange(start, end, insert) {
    const textarea = ref.current;
    onChange(value.slice(0, start) + insert + value.slice(end));
    requestAnimationFrame(() => {
      const at = start + insert.length;
      textarea.focus();
      textarea.setSelectionRange(at, at);
    });
  }

  function pick(resident) {
    replaceRange(mention.start, ref.current.selectionStart, `@[${mentionLabel(resident)}] `);
    setMention(null);
  }

  function onKeyDown(e) {
    const textarea = e.currentTarget;
    // Borrar justo después de una etiqueta la borra completa
    if (e.key === 'Backspace' && textarea.selectionStart === textarea.selectionEnd) {
      const before = value.slice(0, textarea.selectionStart);
      const token = before.match(TOKEN_BEFORE_CARET);
      if (token) {
        e.preventDefault();
        replaceRange(before.length - token[0].length, textarea.selectionStart, '');
        return;
      }
    }
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // que no cierre el diálogo completo
      setMention(null);
    }
  }

  return (
    <div className="relative">
      <div aria-hidden="true" className={cn(SHARED, 'pointer-events-none absolute inset-0 overflow-hidden border-transparent text-slate-900')}>
        <Backdrop text={value} />
        {'​'}
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target);
        }}
        onKeyDown={onKeyDown}
        onClick={(e) => detect(e.target)}
        onBlur={() => setTimeout(() => setMention(null), 150)}
        aria-autocomplete="list"
        aria-expanded={open}
        className={cn(
          SHARED,
          'relative block resize-none overflow-hidden border-slate-300 bg-transparent text-transparent caret-slate-900 [-webkit-text-fill-color:transparent]',
          'placeholder:text-slate-400 placeholder:[-webkit-text-fill-color:var(--color-slate-400)]',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
          className,
        )}
        {...props}
      />
      {open && pos && (
        <ul
          role="listbox"
          className="absolute z-10 max-w-[calc(100%-1rem)] min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: pos.top + pos.lineHeight + 4, left: Math.min(pos.left, Math.max(0, (ref.current?.clientWidth ?? 300) - 240)) }}
        >
          {suggestions.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // que el textarea no pierda el foco
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm', i === active ? 'bg-brand-50 text-brand-800' : 'text-slate-700')}
            >
              <span className="truncate font-medium">
                {r.first_name} {r.last_name}
              </span>
              {r.room && <span className="shrink-0 text-xs text-slate-400">{roomLabel(r)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
