// upload.js — read an image File in the browser, downscale it, and return a data URL.
// Embedding images as data URLs keeps the program self-contained (no external hosting,
// no CORS/hotlink surprises) and lets the PNG/SVG card export work — a cross-origin URL
// would taint the export canvas and fail. Downscaling keeps localStorage/JSON reasonable.

// Photos rarely need more than ~1200px on the long edge for a half-letter playbill at
// 300 DPI; JPEG for photos, PNG only when the source has transparency (logos).
function fileToDataURL(file, { maxDim = 1200, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('that file is not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('could not decode image'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height) { resolve(reader.result); return; } // e.g. some SVGs
          const scale = Math.min(1, maxDim / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const usePng = file.type === 'image/png' || file.type === 'image/gif';
          resolve(canvas.toDataURL(usePng ? 'image/png' : 'image/jpeg', quality));
        } catch (e) { reject(e); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Rough byte size of a data: URL's payload, for storage warnings.
function dataUrlBytes(url) {
  const i = String(url || '').indexOf(',');
  if (i === -1) return 0;
  return Math.floor((url.length - i - 1) * 0.75);
}

export { fileToDataURL, dataUrlBytes };
