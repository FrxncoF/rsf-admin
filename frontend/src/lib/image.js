// Fotos de perfil: se achican en el navegador antes de subirlas.
// Una foto de celular (3–12 MB, 4000 px) queda en ~150–400 KB a 1024 px, más que suficiente
// para un avatar, y el servidor nunca recibe archivos sobre su límite de 5 MB.

const MAX_SIDE = 1024;
const QUALITY = 0.85;

const isHeic = (file) => /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

export class ImageError extends Error {}

/** Decodifica la imagen respetando la orientación EXIF (fotos de celular giradas). */
async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* algunos navegadores no aceptan opciones o el formato: se intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Devuelve un JPEG de máx. 1024 px por lado. Lanza ImageError con un mensaje para el usuario. */
export async function prepareProfilePhoto(file) {
  if (!file.type.startsWith('image/') && !isHeic(file)) throw new ImageError('El archivo no es una imagen');

  let source;
  try {
    source = await decode(file);
  } catch {
    throw new ImageError(
      isHeic(file)
        ? 'Este navegador no puede abrir fotos HEIC del iPhone. Súbela desde el mismo iPhone, o expórtala como JPG.'
        : 'No se pudo leer la imagen. Prueba con otra foto (JPG o PNG).',
    );
  }

  const width = source.width;
  const height = source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  // Fondo blanco: los PNG con transparencia no quedan negros al pasar a JPEG
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new ImageError('No se pudo procesar la imagen');
  const name = file.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
}
