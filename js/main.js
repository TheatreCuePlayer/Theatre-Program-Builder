// main.js — wire the form, live preview, section-card rail, board, and print together.
import { State } from './state.js';
import { paginate } from './pagination.js';
import { renderBoard } from './board.js';
import { buildCards, SECTIONS } from './render.js';
import { buildPrintRoot } from './booklet.js';
import { downloadSVG, copyPNG, libReady } from './export.js';
import { ROLES, ROLE_BY_KEY, SECTION_ROLES, FONTS, SIZE_OPTIONS, applyTypography } from './typography.js';
import { fileToDataURL, dataUrlBytes } from './upload.js';

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

// Collapsible sidebar groups. Open/closed state persists across form rebuilds (add/remove
// rows re-renders the whole form) so a section you collapsed stays collapsed.
const grpState = {}; // id -> open?  (set once the user toggles a section)
const DEFAULT_OPEN = new Set(['typography', 'showinfo']); // rest start collapsed
function grpIsOpen(id) {
  return id in grpState ? grpState[id] : DEFAULT_OPEN.has(id);
}
function detailsGroup(id, title, bodyHTML, headExtra = '') {
  const open = grpIsOpen(id) ? 'open' : '';
  return `<details class="grp" data-grp="${id}" ${open}>
    <summary class="grp-head"><span class="grp-title">${title}</span>${headExtra}</summary>
    <div class="grp-body">${bodyHTML}</div>
  </details>`;
}
function initCollapsibles() {
  document.querySelectorAll('#sidebar details[data-grp]').forEach(d => {
    d.addEventListener('toggle', () => { grpState[d.dataset.grp] = d.open; });
  });
}

// An image input that also accepts an upload from the device. A stored data: URL is shown
// as a thumbnail chip (never the giant string); a normal URL/path keeps the text box.
function imageField(path, value, ph) {
  const v = value || '';
  const isData = /^data:/.test(v);
  const thumb = v ? `<img class="img-thumb" src="${escAttr(v)}" alt="">` : '';
  if (isData) {
    return `<div class="img-field"><div class="img-uploaded">${thumb}
      <span class="img-tag">Uploaded image</span>
      <span class="img-acts">
        <button class="mini-btn" data-upload="${escAttr(path)}">Replace</button>
        <button class="mini-btn" data-imgclear="${escAttr(path)}">Clear</button>
      </span></div></div>`;
  }
  return `<div class="img-field">
    <div class="img-entry">
      <input data-path="${escAttr(path)}" value="${escAttr(v)}" class="fld" placeholder="${ph}">
      <button class="mini-btn" data-upload="${escAttr(path)}" title="Upload from your device">⬆ Upload</button>
    </div>
    ${v ? `<div class="img-uploaded">${thumb}<span class="img-tag">Linked image</span></div>` : ''}
  </div>`;
}

const optSel = (v, cur, label) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${label}</option>`;

// Page margins (inches) — global, lives in the Typography panel.
function pageMarginsHTML(o) {
  const v = (+(o.marginV ?? 0.5)).toFixed(2);
  const h = (+(o.marginH ?? 0.55)).toFixed(2);
  return `<div class="page-margins">
    <div class="ty-sub">Page margins</div>
    <label class="fld-inline">Top / bottom
      <input type="range" data-path="options.marginV" min="0.25" max="1.25" step="0.05" value="${v}"
        oninput="this.nextElementSibling.textContent=(+this.value).toFixed(2)+' in'">
      <span class="mgn-val">${v} in</span></label>
    <label class="fld-inline">Left / right
      <input type="range" data-path="options.marginH" min="0.25" max="1.25" step="0.05" value="${h}"
        oninput="this.nextElementSibling.textContent=(+this.value).toFixed(2)+' in'">
      <span class="mgn-val">${h} in</span></label>
  </div>`;
}

// Cover layout controls — shown only once a cover image is set.
function coverOptionsHTML(m) {
  if (!m.coverImage) return '';
  const heights = ['2', '2.5', '3', '3.5', '4', '5', '6'];
  return `<div class="cover-opts">
    <label class="fld-inline">Layout
      <select data-path="meta.coverLayout" class="fld">
        ${optSel('free', m.coverLayout, 'Free (drag & resize)')}
        ${optSel('background', m.coverLayout, 'Image behind text')}
        ${optSel('top', m.coverLayout, 'Image on top')}
        ${optSel('bottom', m.coverLayout, 'Image on bottom')}
      </select></label>
    <label class="fld-inline">Image fit
      <select data-path="meta.coverFit" class="fld">
        ${optSel('cover', m.coverFit, 'Fill (may crop)')}
        ${optSel('contain', m.coverFit, 'Fit (no crop)')}
      </select></label>
    <label class="fld-inline">Text position
      <select data-path="meta.coverTextPos" class="fld">
        ${optSel('top', m.coverTextPos, 'Top')}
        ${optSel('center', m.coverTextPos, 'Center')}
        ${optSel('bottom', m.coverTextPos, 'Bottom')}
      </select></label>
    <label class="fld-inline">Image height
      <select data-path="meta.coverImageHeight" class="fld">
        ${heights.map(h => optSel(h, m.coverImageHeight, h + ' in')).join('')}
      </select></label>
    <label class="fld-inline">Text panel
      <select data-path="meta.coverScrim" class="fld">
        ${optSel('off', m.coverScrim, 'None')}
        ${optSel('light', m.coverScrim, 'Light')}
        ${optSel('dark', m.coverScrim, 'Dark')}
      </select></label>
    <div class="empty-hint"><b>Free</b>: drag the image on the cover; use the corner dot to resize. <b>Text position</b> applies to “Image behind text”; <b>Image height</b> to “on top / on bottom”.</div>
  </div>`;
}

function listBlock(title, key, rows, cols, opts = {}) {
  const addBtn = `<button class="row-add" data-add="${key}">+ Add</button>`;
  const body = rows.map((row, i) => {
    const inputs = cols.map(c => c.render
      ? c.render(`${key}.${i}.${c.k}`, row[c.k])
      : c.type === 'textarea'
      ? `<textarea data-path="${key}.${i}.${c.k}" rows="${c.rows || 2}" class="fld" placeholder="${c.ph}">${escAttr(row[c.k])}</textarea>`
      : `<input data-path="${key}.${i}.${c.k}" value="${escAttr(row[c.k])}" class="fld" placeholder="${c.ph}">`).join('');
    const reorder = opts.reorder ? `
      <div class="row-move">
        <button class="row-up" data-move="${key}" data-i="${i}" data-dir="-1" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="row-dn" data-move="${key}" data-i="${i}" data-dir="1" title="Move down" ${i === rows.length - 1 ? 'disabled' : ''}>▼</button>
      </div>` : '';
    return `<div class="list-row ${opts.stacked ? 'stacked' : ''}">${reorder}<div class="row-fields">${inputs}</div><button class="row-del" data-del="${key}" data-i="${i}" title="Remove">✕</button></div>`;
  }).join('');
  return detailsGroup(key, title, (opts.controls || '') + body, addBtn);
}

// Who's Who options: uniform photo size + "Who's Who only" output mode.
function whoswhoControls(o) {
  const w = (+(o.wwPhotoW || 1)).toFixed(2);
  return `<div class="ww-ctrls">
    <label class="fld-inline">Photo size
      <input type="range" data-path="options.wwPhotoW" min="0.6" max="2.2" step="0.05" value="${w}"
        oninput="this.nextElementSibling.textContent=(+this.value).toFixed(2)+' in'">
      <span class="ww-size-val">${w} in</span></label>
    <label class="fld-inline ww-only">
      <input type="checkbox" data-path="options.whoswhoOnly" ${o.whoswhoOnly ? 'checked' : ''}>
      Who's Who only — hide cover &amp; other sections (fills the pages)</label>
  </div>`;
}

// Custom sections (images / text boxes) — variable count, per-type fields, reorderable.
const IMG_SIZES = ['small', 'medium', 'large', 'xlarge'];
function customBlock(items) {
  const headExtra = `<span class="custom-adds">
    <button class="row-add" data-addcustom="image">+ Image</button>
    <button class="row-add" data-addcustom="text">+ Text box</button></span>`;
  const rows = items.map((it, i) => {
    const reorder = `<div class="row-move">
      <button data-cmove="${i}" data-dir="-1" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button data-cmove="${i}" data-dir="1" title="Move down" ${i === items.length - 1 ? 'disabled' : ''}>▼</button></div>`;
    let fields;
    if (it.type === 'image') {
      fields = `
        <input data-path="custom.${i}.title" value="${escAttr(it.title)}" class="fld" placeholder="Label (shown on the board)">
        ${imageField(`custom.${i}.url`, it.url, 'Image URL, images/name.jpg, or upload →')}
        <input data-path="custom.${i}.caption" value="${escAttr(it.caption)}" class="fld" placeholder="Caption (optional)">
        <input data-path="custom.${i}.heading" value="${escAttr(it.heading)}" class="fld" placeholder="Printed heading (optional)">
        <label class="fld-inline">Size
          <select data-path="custom.${i}.size" class="fld">
            ${IMG_SIZES.map(s => `<option value="${s}" ${it.size === s ? 'selected' : ''}>${s}</option>`).join('')}
            <option value="custom" ${it.size === 'custom' ? 'selected' : ''}>custom (drag)</option>
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
  return detailsGroup('custom', 'Custom Sections', rows || empty, headExtra);
}

function renderForm() {
  const d = State.doc;
  const m = d.meta;
  const typographyBody = `
    ${pageMarginsHTML(d.options)}
    <label class="fld-inline ty-scope-row">Apply to
      <select id="type-scope" class="fld"></select></label>
    <div id="type-controls"></div>`;
  const showInfoBody = `
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
    <div class="grp-sub">Cover Image <span class="sub-note">optional — combines with the cover text</span></div>
    ${imageField('meta.coverImage', m.coverImage, 'Cover image URL, images/…, or upload →')}
    ${coverOptionsHTML(m)}
    <div class="grp-sub">Director's Note</div>
    ${field('directorNote.text', 'Note', d.directorNote.text, 'textarea')}
    ${field('directorNote.by', 'Signed by', d.directorNote.by)}`;

  $('#sidebar').innerHTML = `
    ${detailsGroup('typography', 'Typography', typographyBody,
      `<button class="row-add" data-tyreset title="Clear styles for the current scope">Reset</button>`)}
    ${detailsGroup('showinfo', 'Show Info', showInfoBody)}
    ${listBlock('Cast List (no photos)', 'cast', d.cast, [
      { k: 'character', ph: 'Character' }, { k: 'performer', ph: 'Performer' }], { reorder: true })}
    ${listBlock('Musical Numbers / Songs', 'songs', d.songs, [
      { k: 'act', ph: 'Act / group' }, { k: 'title', ph: 'Song / scene title' }, { k: 'note', ph: 'Note (who sings)' }], { reorder: true })}
    ${listBlock("Who's Who (photos + bios · everyone)", 'whoswho', d.whoswho, [
      { k: 'name', ph: 'Name' }, { k: 'credit', ph: 'Role / character' },
      { k: 'photo', ph: 'Photo URL or images/name.jpg', render: (p, v) => imageField(p, v, 'Photo URL, images/name.jpg, or upload →') },
      { k: 'bio', ph: 'Biography', type: 'textarea', rows: 3 }],
      { reorder: true, stacked: true, controls: whoswhoControls(d.options) })}
    ${listBlock('Creative Team', 'creative', d.creative, [
      { k: 'role', ph: 'Role' }, { k: 'name', ph: 'Name' }], { reorder: true })}
    ${listBlock('Management', 'management', d.management, [
      { k: 'role', ph: 'Role' }, { k: 'name', ph: 'Name' }], { reorder: true })}
    ${listBlock('Production Crew (one category, many names)', 'crew', d.crew, [
      { k: 'category', ph: 'Category (e.g. Scenery Construction)' },
      { k: 'names', ph: 'Names — one per line, or comma-separated', type: 'textarea', rows: 3 }],
      { stacked: true, reorder: true })}
    ${detailsGroup('productionNotes', 'Production Notes',
      field('productionNotes', '', d.productionNotes, 'textarea'))}
    ${detailsGroup('acknowledgments', 'Acknowledgments (back)',
      field('acknowledgments', '', d.acknowledgments, 'textarea'))}
    ${detailsGroup('backPage', 'Back Page',
      field('backPage', '', d.backPage, 'textarea'))}
    ${listBlock('QR Codes', 'qr', d.qr, [
      { k: 'label', ph: 'Label (e.g. Donate)' }, { k: 'url', ph: 'Link (https://…)' },
      { k: 'caption', ph: 'Caption (optional)' }], { stacked: true, reorder: true })}
    ${customBlock(d.custom)}`;
  initCollapsibles();
  initTypographyPanel();
}

/* ----------------------------- typography panel ----------------------------- */
let typeScope = 'global'; // 'global' or a section id; persists across form rebuilds

// Label + role set for whatever scope is selected.
function scopeRoleKeys(scope) {
  if (scope === 'global') return ROLES.map(r => r.key);
  const fixed = SECTION_ROLES[scope];
  if (fixed) return fixed;
  const item = (State.doc.custom || []).find(c => c.id === scope);
  if (item) return item.type === 'image' ? ['heading', 'caption'] : ['heading', 'body'];
  return [];
}

function scopeOptions() {
  const opts = [`<option value="global">All sections (global)</option>`];
  SECTIONS.forEach(s => { opts.push(`<option value="${s.id}">— ${escAttr(s.title)}</option>`); });
  (State.doc.custom || []).forEach(c => {
    const label = c.title || (c.type === 'image' ? 'Image' : 'Text box');
    opts.push(`<option value="${escAttr(c.id)}">— ${escAttr(label)}</option>`);
  });
  return opts.join('');
}

const EMPTY_STYLE = { font: '', weight: '', italic: '', size: '', align: '' };
function getStyle(scope, roleKey) {
  const st = State.doc.styles;
  if (scope === 'global') return st.roles[roleKey] || EMPTY_STYLE;
  return (st.sections[scope] && st.sections[scope][roleKey]) || EMPTY_STYLE;
}

function updateStyle(scope, roleKey, prop, value) {
  const st = State.doc.styles;
  if (scope === 'global') {
    st.roles[roleKey][prop] = value;
  } else {
    const sec = st.sections[scope] || (st.sections[scope] = {});
    const role = sec[roleKey] || (sec[roleKey] = { ...EMPTY_STYLE });
    role[prop] = value;
    // Prune empty overrides so exported JSON stays tidy.
    if (Object.values(role).every(v => !v)) delete sec[roleKey];
    if (!Object.keys(sec).length) delete st.sections[scope];
  }
  State.emit();
}

function resetScope() {
  const st = State.doc.styles;
  if (typeScope === 'global') ROLES.forEach(r => { st.roles[r.key] = { ...EMPTY_STYLE }; });
  else delete st.sections[typeScope];
  renderTypeControls();
  State.emit();
}

// One <select>. `opts` is [[value,label], …]; a leading Default option is added.
function tySelect(scope, roleKey, prop, current, opts, defaultLabel = 'Default') {
  const options = [`<option value="">${defaultLabel}</option>`]
    .concat(opts.map(([v, l]) => `<option value="${v}" ${current === v ? 'selected' : ''}>${l}</option>`))
    .join('');
  return `<select class="fld ty-sel" data-ty-role="${roleKey}" data-ty-prop="${prop}" data-ty-scopeid="${escAttr(scope)}">${options}</select>`;
}

function fontSelect(scope, roleKey, current) {
  const groups = [['serif', 'Serif'], ['sans', 'Sans'], ['display', 'Display'], ['script', 'Script']];
  let inner = `<option value="">Default</option>`;
  groups.forEach(([kind, label]) => {
    const fonts = FONTS.filter(f => f.kind === kind);
    if (!fonts.length) return;
    inner += `<optgroup label="${label}">` +
      fonts.map(f => `<option value="${f.id}" ${current === f.id ? 'selected' : ''}>${escAttr(f.label)}</option>`).join('') +
      `</optgroup>`;
  });
  return `<select class="fld ty-sel ty-font" data-ty-role="${roleKey}" data-ty-prop="font" data-ty-scopeid="${escAttr(scope)}">${inner}</select>`;
}

function roleControls(scope, roleKey) {
  const role = ROLE_BY_KEY[roleKey];
  const s = getStyle(scope, roleKey);
  return `<div class="ty-role">
    <div class="ty-role-head">${escAttr(role.label)}</div>
    ${fontSelect(scope, roleKey, s.font)}
    <div class="ty-row">
      ${tySelect(scope, roleKey, 'weight', s.weight, [['normal', 'Normal'], ['bold', 'Bold']], 'Weight')}
      ${tySelect(scope, roleKey, 'italic', s.italic, [['normal', 'Upright'], ['italic', 'Italic']], 'Italic')}
    </div>
    <div class="ty-row">
      ${tySelect(scope, roleKey, 'size', s.size, SIZE_OPTIONS.map(o => [o.v, o.label]), 'Size')}
      ${tySelect(scope, roleKey, 'align', s.align, [['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justify', 'Full (justify)']], 'Align')}
    </div>
  </div>`;
}

function renderTypeControls() {
  const host = $('#type-controls');
  if (!host) return;
  const keys = scopeRoleKeys(typeScope);
  const hint = typeScope === 'global'
    ? ''
    : `<div class="empty-hint">Overrides just this section. Leave a control on its label to inherit the global style.</div>`;
  host.innerHTML = hint + keys.map(k => roleControls(typeScope, k)).join('');
}

function initTypographyPanel() {
  const sel = $('#type-scope');
  if (!sel) return;
  // Scope may have pointed at a custom section that was since removed.
  if (typeScope !== 'global' && !SECTION_ROLES[typeScope] && !(State.doc.custom || []).some(c => c.id === typeScope)) {
    typeScope = 'global';
  }
  sel.innerHTML = scopeOptions();
  sel.value = typeScope;
  renderTypeControls();
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
  const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  setPath(State.doc, path, val);
  // A checkbox that changes layout (e.g. Who's Who only) must rebuild the board/stage split.
  State.emit(); // save + re-render preview/cards (form is left intact so the caret stays put)
});

// Structural edits (add / remove / reorder rows) rebuild the form.
// Typography controls (delegated so they survive form rebuilds).
$('#sidebar').addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'type-scope') { typeScope = t.value; renderTypeControls(); return; }
  const roleKey = t.dataset.tyRole;
  if (!roleKey) return;
  updateStyle(t.dataset.tyScopeid, roleKey, t.dataset.tyProp, t.value);
});

$('#sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  // A button inside a section header (<summary>) must act without toggling the section.
  if (btn.closest('summary')) e.preventDefault();
  if (btn.dataset.upload !== undefined) { pendingUploadPath = btn.dataset.upload; imgFileInput.click(); return; }
  if (btn.dataset.imgclear !== undefined) {
    setPath(State.doc, btn.dataset.imgclear, '');
    renderForm(); State.emit();
    return;
  }
  if (btn.dataset.tyreset !== undefined) { resetScope(); return; }
  const { add, del, move, i, dir, addcustom, delcustom, cmove } = btn.dataset;
  if (add) {
    State.doc[add].push(rowTemplate[add]());
    grpState[add] = true; // expand so the new (blank) row is visible
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
    grpState.custom = true; // expand so the new (blank) card is visible
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
  stage.dataset.mode = State.doc.options.layoutMode; // gates in-preview edit handles
  // The Assembly Board is bypassed in "Who's Who only" mode (that flows via auto).
  if (State.doc.options.layoutMode === 'manual' && !State.doc.options.whoswhoOnly) {
    previewWrap.classList.add('hidden');
    boardEl.classList.remove('hidden');
    renderBoard(boardEl, State.doc);
  } else {
    boardEl.classList.add('hidden');
    previewWrap.classList.remove('hidden');
    paginate(stage, State.doc);
    attachCoverInteractions();
    attachCustomImageResize();
  }
}

// Custom-section images: drag the bottom handle to set height (in flow). Screen renders
// pages at 96px/in, so pixels ÷ 96 = inches. Committed as the item's heightIn.
function attachCustomImageResize() {
  stage.querySelectorAll('[data-cimg]').forEach(fig => {
    const id = fig.dataset.cimg;
    const img = fig.querySelector('.block-img');
    const handle = fig.querySelector('.img-resize');
    if (!img || !handle) return;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const top = img.getBoundingClientRect().top;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const hIn = Math.min(Math.max((ev.clientY - top) / 96, 0.5), 10);
        img.style.height = hIn + 'in';
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        const hIn = Math.round(parseFloat(img.style.height) * 100) / 100;
        State.update(d => {
          const it = (d.custom || []).find(c => c.id === id);
          if (it) { it.heightIn = hIn; it.size = 'custom'; }
        });
        // Reflect the new size in the sidebar dropdown without rebuilding the whole form.
        const idx = (State.doc.custom || []).findIndex(c => c.id === id);
        const sel = document.querySelector(`select[data-path="custom.${idx}.size"]`);
        if (sel) sel.value = 'custom';
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  });
}

// Free-layout cover: drag the image box to move, drag the corner dot to resize.
// Positions are committed as fractions of the cover so they print true to the preview.
function attachCoverInteractions() {
  const m = State.doc.meta;
  if (m.coverLayout !== 'free' || !m.coverImage) return;
  const cover = stage.querySelector('.page-cover .cover-free');
  if (!cover) return;
  const box = cover.querySelector('.cover-imgbox');
  const handle = cover.querySelector('.cover-resize');
  if (!box || !handle) return;

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const commit = () => State.update(d => {
    d.meta.coverImageBox = {
      x: parseFloat(box.style.left) / 100,
      y: parseFloat(box.style.top) / 100,
      w: parseFloat(box.style.width) / 100,
    };
  });

  const startDrag = (e) => {
    if (e.target === handle) return; // resize is separate
    e.preventDefault();
    const rect = cover.getBoundingClientRect();
    const ox = e.clientX, oy = e.clientY;
    const bx = parseFloat(box.style.left) / 100, by = parseFloat(box.style.top) / 100;
    box.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const wFrac = parseFloat(box.style.width) / 100;
      const hFrac = box.offsetHeight / rect.height;
      box.style.left = clamp(bx + (ev.clientX - ox) / rect.width, 0, 1 - wFrac) * 100 + '%';
      box.style.top = clamp(by + (ev.clientY - oy) / rect.height, 0, 1 - hFrac) * 100 + '%';
    };
    const up = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); commit(); };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
  };

  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = cover.getBoundingClientRect();
    const x0 = parseFloat(box.style.left) / 100;
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const w = clamp((ev.clientX - rect.left) / rect.width - x0, 0.08, 1 - x0);
      box.style.width = w * 100 + '%';
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); commit(); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  box.addEventListener('pointerdown', startDrag);
  handle.addEventListener('pointerdown', startResize);
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
    // Fit the wrapper to the card. Recompute after layout and after any images load,
    // since a card's true height isn't known until its images have decoded.
    const fit = () => { scale.style.height = (card.el.offsetHeight * s) + 'px'; };
    fit();
    requestAnimationFrame(fit);
    card.el.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', fit, { once: true }); });

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

// Inject the typography <style>/<link>; when the font set changed, re-measure once the
// webfonts finish loading so auto-pagination reflects their real metrics.
function applyAndReflow() {
  // Uniform Who's Who photo size (portrait 4:5), applied via CSS vars so it reaches the
  // preview, print, and card export together.
  const w = parseFloat(State.doc.options.wwPhotoW) || 1;
  document.documentElement.style.setProperty('--ww-w', w + 'in');
  document.documentElement.style.setProperty('--ww-h', (w * 1.25) + 'in');

  // Page margins (affects the printable area, so pagination re-measures against them).
  const mv = parseFloat(State.doc.options.marginV); const mh = parseFloat(State.doc.options.marginH);
  document.documentElement.style.setProperty('--page-mv', (isNaN(mv) ? 0.5 : mv) + 'in');
  document.documentElement.style.setProperty('--page-mh', (isNaN(mh) ? 0.55 : mh) + 'in');

  const fontsChanged = applyTypography(State.doc);
  if (fontsChanged && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => refreshPreview());
  }
}

function refreshAll() { applyAndReflow(); refreshPreview(); refreshCards(); }

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
  // Print reflects the current layout: Auto flows the reading-order pages; Assembly Board
  // (manual) prints exactly the pages/sections you arranged. Half-sheets are then imposed
  // into booklet order.
  const printStage = document.createElement('div');
  document.body.appendChild(printStage);
  printStage.style.position = 'absolute';
  printStage.style.left = '-99999px';
  paginate(printStage, State.doc);

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

/* ----------------------------- image upload ----------------------------- */
// One shared, hidden file picker drives every "Upload"/"Replace" button. The button sets
// the target doc path; the chosen file is downscaled and stored inline as a data: URL.
let pendingUploadPath = null;
const IMAGE_WARN_KB = 800;  // per-image soft cap
const DOC_WARN_MB = 3.5;    // whole-program soft cap (localStorage ~5 MB)
const imgFileInput = document.createElement('input');
imgFileInput.type = 'file';
imgFileInput.accept = 'image/*';
imgFileInput.style.display = 'none';
document.body.appendChild(imgFileInput);
imgFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = ''; // allow re-picking the same file later
  const path = pendingUploadPath;
  pendingUploadPath = null;
  if (!file || !path) return;
  toast('Processing image…');
  try {
    const dataUrl = await fileToDataURL(file);
    setPath(State.doc, path, dataUrl);
    renderForm();
    State.emit();
    const kb = Math.round(dataUrlBytes(dataUrl) / 1024);
    // Per-image soft cap: even after downscaling, flag anything unusually heavy.
    toast(kb > IMAGE_WARN_KB
      ? `Image added (${kb} KB) — that's large; a smaller/simpler image keeps things fast.`
      : `Image added (${kb} KB)`);
    // Whole-program cap: browsers cap localStorage near ~5 MB.
    const totalMB = JSON.stringify(State.doc).length / (1024 * 1024);
    if (totalMB > DOC_WARN_MB) {
      setTimeout(() => toast(`Your program is now ${totalMB.toFixed(1)} MB. Export JSON to keep a safe copy — browser storage caps around 5 MB.`), 2600);
    }
  } catch (err) {
    toast('Could not add image: ' + err.message);
  }
});

// Warn once storage is full (embedded images are the usual cause).
State.onSaveError = () => toast('Browser storage is full — export your program as JSON to keep it, and use smaller or linked images.');

/* ----------------------------- boot ----------------------------- */
// Any state change (toggles, board drag/drop, import) re-renders preview + cards.
// The form is only rebuilt explicitly (add/remove rows, import) to preserve the caret.
State.subscribe(() => { applyAndReflow(); refreshPreview(); refreshCards(); });

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
