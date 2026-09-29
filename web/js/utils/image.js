const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

export async function compressImage(file, options = {}) {
  const {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    mimeType = 'image/jpeg'
  } = options;

  if (!file || !file.type.startsWith('image/')) {
    throw new Error('invalid_image');
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);

  if (typeof bitmap.close === 'function') bitmap.close();

  return await toBlob(canvas, mimeType, quality);
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to legacy loader
    }
  }
  return await loadViaImageElement(file);
}

function loadViaImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_load_failed'));
    };
    img.src = url;
  });
}

function fitWithin(width, height, max) {
  if (width <= max && height <= max) return { width, height };
  const ratio = Math.min(max / width, max / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  };
}

function toBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('compression_failed'));

        if (blob.size > MAX_FILE_SIZE) {
          canvas.toBlob(
            (retry) => (retry ? resolve(retry) : reject(new Error('compression_failed'))),
            mimeType,
            Math.max(0.5, quality - 0.15)
          );
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

export function blobToPreviewUrl(blob) {
  return URL.createObjectURL(blob);
}

export function revokePreviewUrl(url) {
  if (url) URL.revokeObjectURL(url);
}
