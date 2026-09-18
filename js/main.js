// main.js — wire the form, live preview, section-card rail, board, and print together.
import { State } from './state.js';
import { paginate } from './pagination.js';
import { renderBoard } from './board.js';
import { buildCards } from './render.js';
import { buildPrintRoot } from './booklet.js';
import { downloadSVG, copyPNG, libReady } from './export.js';

const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');
const boardEl = $('#board');
const previewWrap = $('#preview-wrap');
const cardsList = $('#cards-list');

State.init();

/* ----------------------------- form ----------------------------- */
function field(path, label, value, type = 'text') {
  const tag = type === 'textarea'
    ? `<textarea data-path="${path}" rows="3" class="fld">${escAttr(value)}</textarea>`
    : `<input data-path="${path}" value="${escAttr(value)}" class="fld" type="text">`;
  return `<label class="fld-wrap"><span class="fld-label">${label}</span>${tag}</label>`;
}
const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function listBlock(title, key, rows, cols, opts = {}) {
  const head = `<div class="grp-head"><span>${title}</span><button class="row-add" data-add="${key}">+ Add</button></div>`;
  const body = rows.map((row, i) => {
    const inputs = cols.map(c => c.type === 'textarea'
      ? `<textarea data-path="${key}.${i}.${c.k}" rows="${c.rows || 2}" class="fld" placeholder="${c.ph}">${escAttr(row[c.k])}</textarea>`
      : `<input data-path="${key}.${i}.${c.k}" value="${escAttr(row[c.k])}" class="fld" placeholder="${c.ph}">`).join('');
    const reorder = opts.reorder ? `
      <div class="row-move">
        <button class="row-up" data-move="${key}" data-i="${i}" data-dir="-1" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="row-dn" data-move="${key}" data-i="${i}" data-dir="1" title="Move down" ${i === rows.length - 1 ? 'disabled' : ''}>▼</button>
      </div>` : '';
    return `<div class="list-row ${opts.stacked ? 'stacked' : ''}">${reorder}<div class="row-fields">${inputs}</div><button class="row-del" data-del="${key}" data-i="${i}" title="Remove">✕</button></div>`;
  }).join('');
  return `<section class="grp">${head}<div class="grp-body">${body}</div></section>`;
}

// Custom sections (images / text boxes) — variable count, per-type fields, reorderable.
const IMG_SIZES = ['small', 'medium', 'large', 'xlarge'];
function customBlock(items) {
  const head = `<div class="grp-head"><span>Custom Sections</span><span class="custom-adds">
    <button class="row-add" data-addcustom="image">+ Image</button>
    <button class="row-add" data-addcustom="text">+ Text box</button></span></div>`;
  const rows = items.map((it, i) => {
    const reorder = `<div class="row-move">
      <button data-cmove="${i}" data-dir="-1" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button data-cmove="${i}" data-dir="1" title="Move down" ${i === items.length - 1 ? 'disabled' : ''}>▼</button></div>`;
    let fields;
    if (it.type === 'image') {
      fields = `
        <input data-path="custom.${i}.title" value="${escAttr(it.title)}" class="fld" placeholder="Label (shown on the board)">
        <input data-path="custom.${i}.url" value="${escAttr(it.url)}" class="fld" placeholder="Image URL or images/name.jpg">
        <input data-path="custom.${i}.caption" value="${escAttr(it.caption)}" class="fld" placeholder="Caption (optional)">
        <input data-path="custom.${i}.heading" value="${escAttr(it.heading)}" class="fld" placeholder="Printed heading (optional)">
        <label class="fld-inline">Size
          <select data-path="custom.${i}.size" class="fld">
            ${IMG_SIZES.map(s => `<option value="${s}" ${it.size === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>`;
    } else {
      fields = `
        <input data-path="custom.${i}.title" value="${escAttr(it.title)}" class="fld" placeholder="Label (shown on the board)">
        <input data-path="custom.${i}.heading" value="${escAttr(it.heading)}" class="fld" placeholder="Printed heading (optional)">
        <textarea data-path="custom.${i}.body" rows="3" class="fld" placeholder="Text">${escAttr(it.body)}</textarea>`;
    }
    return `<div class="list-row stacked">
      <span class="custom-type" title="${it.type}">${it.type === 'image' ? '🖼' : '¶'}</span>
      ${reorder}<div class="row-fields">${fields}</div>
      <button class="row-del" data-delcustom="${i}" title="Remove">✕</button></div>`;
  }).join('');
  const empty = `<div class="empty-hint">Add image or text-box sections — each becomes its own draggable card on the Assembly Board.</div>`;
  return `<section class="grp">${head}<div class="grp-body">${rows || empty}</div></section>`;
}

function renderForm() {
  const d = State.doc;
  const m = d.meta;
  $('#sidebar').innerHTML = `
    <section class="grp">
      <div class="grp-head"><span>Show Info</span></div>
      <div class="grp-body">
        ${field('meta.title', 'Title', m.title)}
        ${field('meta.subtitle', 'Subtitle / Company', m.subtitle)}
        ${field('meta.book', 'Book by', m.book)}
        ${field('meta.music', 'Music by', m.music)}
        ${field('meta.lyrics', 'Lyrics by', m.lyrics)}
        ${field('meta.director', 'Directed by', m.director)}
        ${field('meta.producer', 'Produced by', m.producer)}
        ${field('meta.venue', 'Venue', m.venue)}
        ${field('meta.dates', 'Dates', m.dates)}
        ${field('meta.licensing', 'Licensing / credit line', m.licensing, 'textarea')}
      </div>
    </section>
    <section class="grp">
      <div class="grp-head"><span>Director's Note</span></div>
      <div class="grp-body">
        ${field('directorNote.text', '', d.directorNote.text, 'textarea')}
        ${field('directorNote.by', 'Signed by', d.directorNote.by)}
      </div>
    </section>
    ${listBlock('Cast List (no photos)', 'cast', d.cast, [
      { k: 'character', ph: 'Character' }, { k: 'performer', ph: 'Performer' }])}
    ${listBlock('Musical Numbers / Songs', 'songs', d.songs, [
      { k: 'act', ph: 'Act / group' }, { k: 'title', ph: 'Song / scene title' }, { k: 'note', ph: 'Note (who sings)' }])}
    ${listBlock("Who's Who (photos + bios · everyone)", 'whoswho', d.whoswho, [
      { k: 'name', ph: 'Name' }, { k: 'credit', ph: 'Role / character' },
      { k: 'photo', ph: 'Photo URL or images/name.jpg' }, { k: 'bio', ph: 'Biography', type: 'textarea', rows: 3 }],
      { reorder: true, stacked: true })}
    ${listBlock('Creative Team', 'creative', d.creative, [
      { k: 'role', ph: 'Role' }, { k: 'name', ph: 'Name' }])}
    ${listBlock('Management', 'management', d.management, [
      { k: 'role', ph: 'Role' }, { k: 'name', ph: 'Name' }])}
    ${listBlock('Production Crew (one category, many names)', 'crew', d.crew, [
      { k: 'category', ph: 'Category (e.g. Scenery Construction)' },
      { k: 'names', ph: 'Names — one per line, or comma-separated', type: 'textarea', rows: 3 }],
      { stacked: true })}
    ${listBlock('QR Codes', 'qr', d.qr, [
      { k: 'label', ph: 'Label (e.g. Donate)' }, { k: 'url', ph: 'Link (https://…)' },
      { k: 'caption', ph: 'Caption (optional)' }], { stacked: true })}
    <section class="grp">
      <div class="grp-head"><span>Production Notes</span></div>
      <div class="grp-body">${field('productionNotes', '', d.productionNotes, 'textarea')}</div>
    </section>
    <section class="grp">
      <div class="grp-head"><span>Acknowledgments (back)</span></div>
      <div class="grp-body">${field('acknowledgments', '', d.acknowledgments, 'textarea')}</div>
    </section>
    <section class="grp">
      <div class="grp-head"><span>Back Page</span></div>
      <div class="grp-body">${field('backPage', '', d.backPage, 'textarea')}</div>
    </section>
    ${customBlock(d.custom)}`;
}

let customSeq = 0;
const uid = () => 'c' + Date.now().toString(36) + (customSeq++).toString(36);
function newCustom(type) {
  return type === 'image'
    ? { id: uid(), type: 'image', title: '', url: '', caption: '', heading: '', size: 'medium' }
    : { id: uid(), type: 'text', title: '', heading: '', body: '' };
}
// When a section is deleted, drop it from any manual (board) arrangement too.
function cleanupManual(id) {
  if (Array.isArray(State.doc.manual)) State.doc.manual.forEach(p => {
    const i = p.indexOf(id);
    if (i !== -1) p.splice(i, 1);
  });
}

// Write a value into the doc by dotted path (e.g. "cast.0.character").
function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}

const rowTemplate = {
  cast: () => ({ character: '', performer: '' }),
  creative: () => ({ role: '', name: '' }),
  management: () => ({ role: '', name: '' }),
  crew: () => ({ category: '', names: '' }),
  songs: () => ({ act: '', title: '', note: '' }),
  whoswho: () => ({ name: '', credit: '', photo: '', bio: '' }),
  qr: () => ({ label: '', url: '', caption: '' }),
};

// Typing: update doc + preview/cards, but do NOT rebuild the form (keeps focus/caret).
$('#sidebar').addEventListener('input', (e) => {
  const path = e.target.dataset.path;
  if (!path) return;
  setPath(State.doc, path, e.target.value);
  State.emit(); // save + re-render preview/cards (form is left intact so the caret stays put)
});

// Structural edits (add / remove / reorder rows) rebuild the form.
$('#sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { add, del, move, i, dir, addcustom, delcustom, cmove } = btn.dataset;
  if (add) {
    State.doc[add].push(rowTemplate[add]());
    renderForm(); State.emit();
  } else if (del) {
    State.doc[del].splice(Number(i), 1);
    renderForm(); State.emit();
  } else if (move) {
    const arr = State.doc[move];
    const from = Number(i), to = from + Number(dir);
    if (to < 0 || to >= arr.length) return;
    [arr[from], arr[to]] = [arr[to], arr[from]]; // swap adjacent
    renderForm(); State.emit();
  } else if (addcustom) {
    State.doc.custom.push(newCustom(addcustom));
    renderForm(); State.emit();
  } else if (delcustom !== undefined) {
    const [removed] = State.doc.custom.splice(Number(delcustom), 1);
    if (removed) cleanupManual(removed.id);
    renderForm(); State.emit();
  } else if (cmove !== undefined) {
    const arr = State.doc.custom;
    const from = Number(cmove), to = from + Number(dir);
    if (to < 0 || to >= arr.length) return;
    [arr[from], arr[to]] = [arr[to], arr[from]];
    renderForm(); State.emit();
  }
});

/* ----------------------------- preview / board ----------------------------- */
function refreshPreview() {
  if (State.doc.options.layoutMode === 'manual') {
    previewWrap.classList.add('hidden');
    boardEl.classList.remove('hidden');
    renderBoard(boardEl, State.doc);
  } else {
    boardEl.classList.add('hidden');
    previewWrap.classList.remove('hidden');
    paginate(stage, State.doc);
  }
}

function refreshCards() {
  const cards = buildCards(State.doc);
  cardsList.innerHTML = '';
  cards.forEach(card => {
    const wrap = document.createElement('div');
    wrap.className = 'rail-item';
    const head = document.createElement('div');
    head.className = 'rail-head';
    head.innerHTML = `<span>${card.title}</span>`;
    const btns = document.createElement('div');
    btns.className = 'rail-btns';
    const svgBtn = miniBtn('SVG');
    const pngBtn = miniBtn('PNG 300');
    btns.append(svgBtn, pngBtn);
    head.appendChild(btns);

    const scale = document.createElement('div');
    scale.className = 'card-scale';
    scale.appendChild(card.el); // the actual .section-card we export
    wrap.append(head, scale);
    cardsList.appendChild(wrap);

    // Thumbnail: scale the card to the rail width. The card keeps its true 5.5in box
    // (so export stays crisp); only the visual is scaled, and we set the wrapper height
    // so the scaled preview doesn't leave dead space.
    const s = Math.min(1, cardsList.clientWidth / (5.5 * 96));
    scale.style.transformOrigin = 'top left';
    scale.style.transform = `scale(${s})`;
    scale.style.width = (5.5 * 96 * s) + 'px';
    scale.style.height = (card.el.offsetHeight * s) + 'px';

    svgBtn.onclick = () => { toast('Rendering SVG…'); guardExport(async () => { await downloadSVG(card.el, card.title); toast('SVG downloaded'); }); };
    pngBtn.onclick = () => { toast('Rendering PNG (300 DPI)…'); guardExport(async () => {
      const where = await copyPNG(card.el, card.title);
      toast(where === 'clipboard' ? 'PNG copied to clipboard (300 DPI)' : 'PNG downloaded (300 DPI)');
    }); };
  });
}

function miniBtn(t) { const b = document.createElement('button'); b.className = 'mini-btn'; b.textContent = t; return b; }

async function guardExport(fn) {
  if (!libReady()) { toast('Export library still loading — try again in a moment'); return; }
  try { const r = await fn(); if (typeof r === 'string' && r !== 'clipboard') {} } catch (e) { toast('Export failed: ' + e.message); }
}

function refreshAll() { refreshPreview(); refreshCards(); }

/* ----------------------------- toolbar ----------------------------- */
function setSize(size) {
  State.update(d => { d.options.size = size; });
  $('#size-half').classList.toggle('is-active', size === 'half');
  $('#size-full').classList.toggle('is-active', size === 'full');
}
function setMode(mode) {
  State.update(d => { d.options.layoutMode = mode; });
  $('#mode-auto').classList.toggle('is-active', mode === 'auto');
  $('#mode-manual').classList.toggle('is-active', mode === 'manual');
}

$('#size-half').onclick = () => setSize('half');
$('#size-full').onclick = () => setSize('full');
$('#mode-auto').onclick = () => setMode('auto');
$('#mode-manual').onclick = () => setMode('manual');

$('#btn-new').onclick = () => {
  // Destructive: replaces the current program with a blank one. Confirm first.
  if (!confirm('Start a new show? This clears the current program. Export JSON first if you want to keep it.')) return;
  State.reset();
  renderForm(); syncToolbar();
  toast('New blank show');
};

$('#btn-export').onclick = () => State.exportJSON();
$('#btn-import').onclick = () => $('#file-input').click();
$('#file-input').onchange = (e) => {
  const f = e.target.files[0];
  if (f) State.importJSON(f).then(() => { renderForm(); syncToolbar(); refreshAll(); toast('Imported'); })
    .catch(() => toast('Import failed — not a valid program JSON'));
  e.target.value = '';
};

$('#btn-print').onclick = doPrint;

function syncToolbar() {
  const o = State.doc.options;
  $('#size-half').classList.toggle('is-active', o.size === 'half');
  $('#size-full').classList.toggle('is-active', o.size === 'full');
  $('#mode-auto').classList.toggle('is-active', o.layoutMode === 'auto');
  $('#mode-manual').classList.toggle('is-active', o.layoutMode === 'manual');
}

/* ----------------------------- print ----------------------------- */
function doPrint() {
  // Print always flows from the AUTO reading-order pages (even while editing on the board),
  // then imposes them into booklet order for half-sheets.
  const printStage = document.createElement('div');
  const forPrint = { ...State.doc, options: { ...State.doc.options, layoutMode: 'auto' } };
  document.body.appendChild(printStage);
  printStage.style.position = 'absolute';
  printStage.style.left = '-99999px';
  paginate(printStage, forPrint);

  // Match @page to the physical sheet: half = landscape 11x8.5 (2-up), full = portrait 8.5x11.
  let pageStyle = document.getElementById('page-style');
  if (!pageStyle) { pageStyle = document.createElement('style'); pageStyle.id = 'page-style'; document.head.appendChild(pageStyle); }
  const dims = State.doc.options.size === 'half' ? '11in 8.5in' : '8.5in 11in';
  pageStyle.textContent = `@page{ size:${dims}; margin:0; }`;

  const root = $('#print-root');
  root.innerHTML = '';
  root.className = `print-root print-${State.doc.options.size}`;
  root.appendChild(buildPrintRoot(printStage, State.doc.options.size));
  document.body.classList.add('printing');

  const cleanup = () => {
    document.body.classList.remove('printing');
    printStage.remove();
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // give layout a tick, then print
  setTimeout(() => window.print(), 60);
}

/* ----------------------------- toast ----------------------------- */
let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ----------------------------- boot ----------------------------- */
// Any state change (toggles, board drag/drop, import) re-renders preview + cards.
// The form is only rebuilt explicitly (add/remove rows, import) to preserve the caret.
State.subscribe(() => { refreshPreview(); refreshCards(); });

renderForm();
syncToolbar();
refreshAll();

// Optional deep link: ?show=shows/xyz.json loads a program hosted on THIS site.
const showParam = new URLSearchParams(location.search).get('show');
if (showParam) {
  State.loadURL(showParam)
    .then(() => { renderForm(); syncToolbar(); refreshAll(); toast('Loaded hosted show'); })
    .catch((e) => toast('Could not load show: ' + e.message));
}

// Pre-warm html-to-image's font/resource cache in the background so the FIRST
// real export is fast instead of paying the one-time font-embed cost on click.
setTimeout(() => {
  const c = document.querySelector('#cards-list .section-card');
  if (c && libReady()) window.htmlToImage.toSvg(c, { width: 8, height: 8 }).catch(() => {});
}, 1200);
