// booklet.js — saddle-stitch imposition. Reading-order pages -> fold-and-staple sheet order.

// For a booklet of T pages (T padded to a multiple of 4), return the ordered list of
// printed SIDES. Each side is [leftPageNumber, rightPageNumber], 1-indexed.
// T=8 -> [8,1],[2,7],[6,3],[4,5]  (fold the stack, staple the spine, read 1..8 in order)
function impose(T) {
  const pairs = [];
  let a = 1, b = T, flip = true;
  for (let i = 0; i < T / 2; i++) {
    pairs.push(flip ? [b, a] : [a, b]);
    a++; b--; flip = !flip;
  }
  return pairs;
}

function padToBooklet(n) {
  return n % 4 === 0 ? n : n + (4 - (n % 4));
}

// Build the print DOM from the live preview pages.
//  - half (5.5x8.5): impose 2-up on landscape 8.5x11 sheets, with blanks padded in.
//  - full (8.5x11): one page per portrait sheet, in reading order (no imposition).
function buildPrintRoot(previewStage, size) {
  const pages = Array.from(previewStage.querySelectorAll('.page'));
  const root = document.createElement('div');
  root.className = `print-root print-${size}`;

  if (size !== 'half') {
    pages.forEach(pg => {
      const sheet = document.createElement('div');
      sheet.className = 'print-sheet portrait';
      sheet.appendChild(clonePageInner(pg, size));
      root.appendChild(sheet);
    });
    return root;
  }

  const T = padToBooklet(pages.length);
  const sides = impose(T);
  sides.forEach(([L, R]) => {
    const sheet = document.createElement('div');
    sheet.className = 'print-sheet landscape';
    sheet.appendChild(slotFor(pages, L, size));
    sheet.appendChild(slotFor(pages, R, size));
    root.appendChild(sheet);
  });
  return root;
}

function slotFor(pages, pageNum, size) {
  const slot = document.createElement('div');
  slot.className = 'print-slot';
  const src = pages[pageNum - 1]; // 1-indexed; undefined -> blank pad page
  if (src) slot.appendChild(clonePageInner(src, size));
  else {
    const blank = document.createElement('div');
    blank.className = `page pg-${size} page-blank`;
    slot.appendChild(blank);
  }
  return slot;
}

function clonePageInner(pageEl, size) {
  const clone = pageEl.cloneNode(true);
  clone.classList.add('print-page');
  return clone;
}

export { impose, padToBooklet, buildPrintRoot };
