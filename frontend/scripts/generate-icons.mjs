// Genera favicon, emblema e íconos PWA a partir de public/icons/logo.png (sin dependencias).
// Uso: npm run icons   (re-ejecutar si cambia el logo; los PNG resultantes se versionan)
//
// El logo trae el emblema arriba y el texto abajo: para los íconos cuadrados se recorta
// solo el emblema (el texto sería ilegible a 48 px).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './png.mjs';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const PUBLIC_DIR = join(ICONS_DIR, '..');
const WHITE = [255, 255, 255, 255];

const logo = decodePng(readFileSync(join(ICONS_DIR, 'logo.png')));
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];

/** Recorta el emblema: el primer bloque de filas con tinta, separado del texto por filas vacías. */
function findEmblemBox(img) {
  const rowHasInk = (y) => {
    for (let x = 0; x < img.width; x++) if (alphaAt(img, x, y) > 24) return true;
    return false;
  };
  let top = 0;
  while (top < img.height && !rowHasInk(top)) top++;
  let bottom = top;
  while (bottom < img.height && rowHasInk(bottom)) bottom++;

  let left = img.width;
  let right = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < img.width; x++) {
      if (alphaAt(img, x, y) > 24) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
    }
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Muestreo bilineal con alfa premultiplicado (sin halos oscuros en los bordes). */
function sample(img, fx, fy) {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(fy)));
  const x1 = Math.min(img.width - 1, x0 + 1);
  const y1 = Math.min(img.height - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const out = [0, 0, 0, 0];
  for (const [x, y, w] of [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x1, y0, tx * (1 - ty)],
    [x0, y1, (1 - tx) * ty],
    [x1, y1, tx * ty],
  ]) {
    const i = (y * img.width + x) * 4;
    const a = (img.data[i + 3] / 255) * w;
    out[0] += img.data[i] * a;
    out[1] += img.data[i + 1] * a;
    out[2] += img.data[i + 2] * a;
    out[3] += a;
  }
  return out; // RGB premultiplicado + alfa (0..1)
}

/**
 * Dibuja `box` de `src` escalado dentro de un lienzo cuadrado `size`, ocupando `scale` del lado.
 * background: null (transparente) o RGBA. rounded: radio relativo de esquinas (0 = cuadrado).
 */
function render(src, box, size, { scale, background = null, rounded = 0 }) {
  const fit = (size * scale) / Math.max(box.w, box.h);
  const drawW = box.w * fit;
  const drawH = box.h * fit;
  const offX = (size - drawW) / 2;
  const offY = (size - drawH) / 2;
  const SS = 3;
  const data = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;

          if (rounded) {
            const rr = rounded * size;
            const cx = Math.min(Math.max(x, rr), size - rr);
            const cy = Math.min(Math.max(y, rr), size - rr);
            if ((x - cx) ** 2 + (y - cy) ** 2 > rr * rr) continue; // fuera de la esquina
          }

          let [sr, sg, sb, sa] = [0, 0, 0, 0];
          const u = (x - offX) / fit;
          const v = (y - offY) / fit;
          if (u >= 0 && v >= 0 && u < box.w && v < box.h) {
            [sr, sg, sb, sa] = sample(src, box.x + u - 0.5, box.y + v - 0.5);
          }
          if (background) {
            // composición "over" sobre el fondo opaco
            sr += background[0] * (1 - sa);
            sg += background[1] * (1 - sa);
            sb += background[2] * (1 - sa);
            sa = 1;
          }
          r += sr; g += sg; b += sb; a += sa;
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        data[i] = Math.round(r / a);
        data[i + 1] = Math.round(g / a);
        data[i + 2] = Math.round(b / a);
      }
      data[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng({ width: size, height: size, data });
}

const emblem = findEmblemBox(logo);
console.log(`logo ${logo.width}x${logo.height} · emblema ${emblem.w}x${emblem.h} en (${emblem.x},${emblem.y})`);

const targets = [
  // [archivo, tamaño, opciones]
  [join(PUBLIC_DIR, 'favicon.png'), 64, { scale: 1 }],
  [join(ICONS_DIR, 'emblem.png'), 256, { scale: 1 }],
  [join(ICONS_DIR, 'pwa-192x192.png'), 192, { scale: 0.74, background: WHITE, rounded: 0.2 }],
  [join(ICONS_DIR, 'pwa-512x512.png'), 512, { scale: 0.74, background: WHITE, rounded: 0.2 }],
  // maskable: el sistema recorta en círculo/squircle → contenido dentro de la zona segura (~60 %)
  [join(ICONS_DIR, 'maskable-512x512.png'), 512, { scale: 0.56, background: WHITE }],
  [join(ICONS_DIR, 'apple-touch-icon.png'), 180, { scale: 0.74, background: WHITE }],
];

for (const [file, size, opts] of targets) {
  writeFileSync(file, render(logo, emblem, size, opts));
  console.log(`✓ ${file.slice(PUBLIC_DIR.length + 1)}`);
}
