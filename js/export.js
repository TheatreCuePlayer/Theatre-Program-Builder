// export.js — Download SVG / Copy PNG (300 DPI) for a single section card.
// Uses the global `htmlToImage` (html-to-image UMD from CDN). Cards are laid out in
// CSS pixels at 96dpi, so a 300-DPI raster needs pixelRatio = 300/96.
const DPI = 300;
const PIXEL_RATIO = DPI / 96;

function libReady() {
  return typeof window.htmlToImage !== 'undefined';
}

function fileName(base, ext) {
  return `${(base || 'card').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${ext}`;
}

// Snapshot options shared by SVG/PNG so exports match the on-screen card.
function opts(node) {
  return {
    backgroundColor: '#ffffff',
    // NOTE: no cacheBust — it forces every resource to re-download on each export,
    // which made repeat exports take ~10s. Fonts are embedded once and cached.
    style: { margin: '0' },
    width: node.offsetWidth,
    height: node.offsetHeight,
  };
}

async function downloadSVG(node, base) {
  if (!libReady()) throw new Error('html-to-image not loaded');
  const dataUrl = await window.htmlToImage.toSvg(node, opts(node));
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName(base, 'svg');
  a.click();
}

async function copyPNG(node, base) {
  if (!libReady()) throw new Error('html-to-image not loaded');
  const blob = await window.htmlToImage.toBlob(node, { ...opts(node), pixelRatio: PIXEL_RATIO });
  if (!blob) throw new Error('render failed');

  // Preferred path: put the PNG on the clipboard.
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      return 'clipboard';
    } catch (e) { /* fall through to download */ }
  }
  // Fallback: browsers without image clipboard support get a file download instead.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName(base, 'png');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'download';
}

export { downloadSVG, copyPNG, libReady };
