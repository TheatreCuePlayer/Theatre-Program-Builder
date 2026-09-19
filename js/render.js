// render.js — turn the doc into section cards (for board/export) and flow blocks (auto pagination)

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

// Ordered section metadata. `zone` steers cover→front, content→inner, back matter→last.
const SECTIONS = [
  { id: 'cover',           title: 'Cover',            zone: 'front' },
  { id: 'directorNote',    title: "Director's Note",  zone: 'inner' },
  { id: 'cast',            title: 'Cast',             zone: 'inner' },
  { id: 'songs',           title: 'Musical Numbers',  zone: 'inner' },
  { id: 'whoswho',         title: "Who's Who",        zone: 'inner' },
  { id: 'creative',        title: 'Creative Team',    zone: 'inner' },
  { id: 'management',      title: 'Management',       zone: 'inner' },
  { id: 'crew',            title: 'Production Crew',  zone: 'inner' },
  { id: 'productionNotes', title: 'Production Notes', zone: 'inner' },
  { id: 'acknowledgments', title: 'Acknowledgments',  zone: 'back' },
  { id: 'qr',              title: 'QR Codes',         zone: 'back' },
  { id: 'backPage',        title: 'Back Page',        zone: 'back' },
];

const sectionHead = (t) => `<h2 class="section-head">${esc(t)}</h2>`;

// Default printed headings per section. Users can override any of these (doc.headings[id]),
// e.g. "Who's Who" -> "Who's Who in Blinn College – Brenham Theatre".
const DEFAULT_HEADINGS = {
  directorNote: "Director's Note",
  cast: 'Cast',
  songs: 'Musical Numbers',
  whoswho: "Who's Who",
  creative: 'Creative Team',
  management: 'Management',
  crew: 'Production Crew',
  productionNotes: 'Production Notes',
  acknowledgments: 'Acknowledgments',
  qr: 'Scan for More',
  backPage: 'Back Page',
};
function headingText(doc, id) {
  const h = doc && doc.headings && doc.headings[id];
  return (typeof h === 'string' && h.trim()) ? h : DEFAULT_HEADINGS[id];
}

// Linked photo (URL/path). Fixed CSS box keeps pagination height deterministic even
// before/without the image loading. crossorigin lets CORS-enabled hosts export cleanly.
function photo(url, cls) {
  if (!url) return `<div class="photo ${cls} photo-empty"><span>photo</span></div>`;
  // NOTE: no crossorigin — many photo hosts omit CORS headers, and crossorigin would
  // then break the image even on screen/print. Cost: html-to-image PNG/SVG export of a
  // card containing cross-origin photos taints the canvas and will fail for those hosts.
  return `<img class="photo ${cls}" src="${attr(url)}" loading="eager" alt="">`;
}

// Crisp vector QR (SVG) via the global qrcode-generator. Sized by CSS on the wrapper.
function qrSVG(text) {
  if (!text || typeof window.qrcode === 'undefined') return '<div class="qr-missing"></div>';
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
  } catch (e) { return '<div class="qr-missing"></div>'; }
}

const splitNames = (s) => String(s || '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean);

// A block image (custom section). Fixed-height box (via .img-<size> CSS) keeps
// pagination deterministic; object-fit:contain shows the whole image without cropping.
// A custom-section image figure. Size is a preset (img-<size>) unless the user drag-sized
// it, in which case size==='custom' and heightIn (inches) is applied inline. The resize
// handle is present but only shown/active in the live auto-preview (see CSS + main.js).
function customImageFigure(item) {
  const useCustom = item.size === 'custom' && item.heightIn;
  const sizeClass = useCustom ? '' : `img-${item.size || 'medium'}`;
  const style = useCustom ? ` style="height:${item.heightIn}in"` : '';
  const inner = item.url
    ? `<img class="block-img"${style} src="${attr(item.url)}" loading="eager" alt=""><span class="img-resize" data-cresize></span>`
    : `<div class="block-img photo-empty"${style}><span>image</span></div>`;
  const cap = item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : '';
  return `<figure class="img-block ${sizeClass}" data-cimg="${attr(item.id)}"><div class="block-img-wrap">${inner}</div>${cap}</figure>`;
}

// HTML for a user-added custom section (image or text box).
function customInnerHTML(item) {
  if (item.type === 'image') {
    const head = item.heading ? sectionHead(item.heading) : '';
    return head + customImageFigure(item);
  }
  const h = item.heading || '';
  return (h ? sectionHead(h) : '') + `<div class="prose">${nl2br(item.body)}</div>`;
}

const customHasContent = (item) =>
  item.type === 'image' ? !!(item.url || item.heading || item.caption)
                        : !!((item.body || '').trim() || item.heading);
const customLabel = (item) =>
  item.title || (item.type === 'image' ? 'Image' : 'Text box');

/* ---------- item renderers (shared by whole-card HTML and flow blocks) ---------- */
const castRow = (c) => `<dl class="two-col-list"><div class="row"><dt>${esc(c.character)}</dt><dd>${esc(c.performer)}</dd></div></dl>`;
const roleRow = (r) => `<dl class="two-col-list"><div class="row"><dt>${esc(r.role)}</dt><dd>${esc(r.name)}</dd></div></dl>`;
const songRow = (s) => `
  <div class="scene ${s.act ? 'has-act' : ''}">
    ${s.act ? `<div class="scene-act">${esc(s.act)}</div>` : ''}
    <div class="scene-line"><span class="scene-title">${esc(s.title)}</span>${s.note ? `<span class="scene-note">${esc(s.note)}</span>` : ''}</div>
  </div>`;
const crewRow = (c) => `
  <div class="crew-cat">
    <div class="crew-name">${esc(c.category)}</div>
    <div class="crew-people">${splitNames(c.names).map(esc).join(' &middot; ')}</div>
  </div>`;
const wwRow = (b) => `
  <div class="ww">
    ${photo(b.photo, 'ww-photo')}
    <div class="ww-body">
      <div class="ww-name">${esc(b.name)}${b.credit ? ` <span class="ww-credit">${esc(b.credit)}</span>` : ''}</div>
      <div class="ww-bio">${nl2br(b.bio)}</div>
    </div>
  </div>`;
const qrTile = (q) => `
  <div class="qr-tile">
    <div class="qr-code">${qrSVG(q.url)}</div>
    <div class="qr-meta">
      ${q.label ? `<div class="qr-label">${esc(q.label)}</div>` : ''}
      ${q.caption ? `<div class="qr-cap">${esc(q.caption)}</div>` : ''}
      ${q.url ? `<div class="qr-url">${esc(q.url)}</div>` : ''}
    </div>
  </div>`;

// Cover text block (kicker / title / credits / foot), shared by every cover layout.
function coverText(m) {
  return `
    ${m.subtitle ? `<div class="cover-kicker">${esc(m.subtitle)}</div>` : ''}
    <h1 class="cover-title">${esc(m.title)}</h1>
    <div class="cover-credits">
      ${m.book ? `<div>Book by ${esc(m.book)}</div>` : ''}
      ${m.music ? `<div>Music by ${esc(m.music)}</div>` : ''}
      ${m.lyrics ? `<div>Lyrics by ${esc(m.lyrics)}</div>` : ''}
      ${m.director ? `<div>Directed by ${esc(m.director)}</div>` : ''}
    </div>
    <div class="cover-foot">
      ${m.venue ? `<div>${esc(m.venue)}</div>` : ''}
      ${m.dates ? `<div>${esc(m.dates)}</div>` : ''}
      ${m.licensing ? `<div class="cover-license">${esc(m.licensing)}</div>` : ''}
    </div>`;
}

// Cover markup: plain text cover, or image + text via the chosen layout.
function coverMarkup(m) {
  const text = coverText(m);
  if (!m.coverImage) return `<div class="cover">${text}</div>`;

  const fit = m.coverFit === 'contain' ? 'contain' : 'cover';
  const scrim = ['light', 'dark'].includes(m.coverScrim) ? m.coverScrim : 'off';
  const img = `<img class="cover-image" src="${attr(m.coverImage)}" alt="">`;
  const textBlock = `<div class="cover-text scrim-${scrim}">${text}</div>`;

  // Free: a movable/resizable image frame over the centered text (drag/resize wired in main.js).
  if (m.coverLayout === 'free') {
    const b = m.coverImageBox || { x: 0.32, y: 0.08, w: 0.36 };
    const style = `left:${(b.x * 100)}%;top:${(b.y * 100)}%;width:${(b.w * 100)}%`;
    return `<div class="cover cover-free">
      <div class="cover-text cover-free-text scrim-${scrim}">${text}</div>
      <div class="cover-imgbox" style="${style}">${img}<span class="cover-resize" data-resize></span></div>
    </div>`;
  }

  if (m.coverLayout === 'top' || m.coverLayout === 'bottom') {
    const h = parseFloat(m.coverImageHeight) || 3;
    const band = `<div class="cover-band fit-${fit}" style="height:${h}in">${img}</div>`;
    const parts = m.coverLayout === 'top' ? band + textBlock : textBlock + band;
    return `<div class="cover cover-stack layout-${m.coverLayout}">${parts}</div>`;
  }

  // background: image fills the cover, text overlaid at the chosen vertical position
  const pos = ['top', 'center', 'bottom'].includes(m.coverTextPos) ? m.coverTextPos : 'center';
  return `<div class="cover cover-bg fit-${fit} textpos-${pos}">${img}
    <div class="cover-textwrap">${textBlock}</div></div>`;
}

/* ---------- whole-section card HTML (Assembly Board + per-card export) ---------- */
function sectionInnerHTML(id, doc) {
  const m = doc.meta;
  switch (id) {
    case 'cover':
      return coverMarkup(m);
    case 'cast':    return sectionHead(headingText(doc, 'cast')) + `<div>${doc.cast.map(castRow).join('')}</div>`;
    case 'songs':   return sectionHead(headingText(doc, 'songs')) + `<div class="scene-list">${doc.songs.map(songRow).join('')}</div>`;
    case 'creative':return sectionHead(headingText(doc, 'creative')) + `<div>${doc.creative.filter(r => r.name || r.role).map(roleRow).join('')}</div>`;
    case 'management':return sectionHead(headingText(doc, 'management')) + `<div>${doc.management.filter(r => r.name || r.role).map(roleRow).join('')}</div>`;
    case 'crew':    return sectionHead(headingText(doc, 'crew')) + `<div class="crew-list">${doc.crew.filter(c => c.category || c.names).map(crewRow).join('')}</div>`;
    case 'whoswho': return sectionHead(headingText(doc, 'whoswho')) + `<div class="ww-list">${doc.whoswho.filter(b => b.name || b.bio).map(wwRow).join('')}</div>`;
    case 'qr':      return sectionHead(headingText(doc, 'qr')) + `<div class="qr-grid">${doc.qr.filter(q => q.url || q.label).map(qrTile).join('')}</div>`;
    case 'directorNote': return sectionHead(headingText(doc, 'directorNote')) + `<div class="prose">${nl2br(doc.directorNote.text)}</div>${doc.directorNote.by ? `<div class="note-by">— ${esc(doc.directorNote.by)}</div>` : ''}`;
    case 'productionNotes': return sectionHead(headingText(doc, 'productionNotes')) + `<div class="prose">${nl2br(doc.productionNotes)}</div>`;
    case 'acknowledgments': return sectionHead(headingText(doc, 'acknowledgments')) + `<div class="prose">${nl2br(doc.acknowledgments)}</div>`;
    case 'backPage': return sectionHead(headingText(doc, 'backPage')) + `<div class="prose">${nl2br(doc.backPage)}</div>`;
  }
  return '';
}

function hasContent(id, doc) {
  switch (id) {
    case 'cover': return true;
    case 'cast': return doc.cast.some(c => c.character || c.performer);
    case 'songs': return doc.songs.some(s => s.title || s.act);
    case 'creative': return doc.creative.some(r => r.name || r.role);
    case 'management': return doc.management.some(r => r.name || r.role);
    case 'crew': return doc.crew.some(c => c.category || c.names);
    case 'whoswho': return doc.whoswho.some(b => b.name || b.bio || b.photo);
    case 'qr': return doc.qr.some(q => q.url || q.label);
    case 'directorNote': return !!(doc.directorNote.text || '').trim();
    case 'productionNotes': return !!doc.productionNotes.trim();
    case 'acknowledgments': return !!doc.acknowledgments.trim();
    case 'backPage': return !!doc.backPage.trim();
  }
  return false;
}

function buildCards(doc) {
  const cards = SECTIONS.filter(s => hasContent(s.id, doc)).map(sec => {
    const el = document.createElement('div');
    el.className = 'section-card';
    el.dataset.card = sec.id;
    el.dataset.section = sec.id; // per-section typography hook
    el.innerHTML = sectionInnerHTML(sec.id, doc);
    return { id: sec.id, title: sec.title, zone: sec.zone, el };
  });
  // Custom sections are always shown (the user added them on purpose) and live in the body zone.
  (doc.custom || []).forEach(item => {
    const el = document.createElement('div');
    el.className = 'section-card';
    el.dataset.card = item.id;
    el.dataset.section = item.id; // per-section typography hook
    el.innerHTML = customInnerHTML(item);
    cards.push({ id: item.id, title: customLabel(item), zone: 'inner', el });
  });
  return cards;
}

/* ---------- fine-grained flow blocks (auto pagination; lists split across pages) ---------- */
function buildBlocks(doc) {
  const blocks = [];
  const push = (id, zone, keepWithNext, html) => {
    const el = document.createElement('div');
    el.className = 'block';
    el.dataset.section = id; // per-section typography hook
    el.innerHTML = html;
    blocks.push({ zone, keepWithNext, el });
  };
  const list = (id, zone, title, items, rowFn) => {
    if (!items.length) return;
    push(id, zone, true, sectionHead(title));
    items.forEach(it => push(id, zone, false, rowFn(it)));
  };
  const prose = (id, zone, title, text, by) => {
    if (!(text || '').trim()) return;
    push(id, zone, true, sectionHead(title));
    push(id, zone, false, `<div class="prose">${nl2br(text)}</div>${by ? `<div class="note-by">— ${esc(by)}</div>` : ''}`);
  };

  // Reading order mirrors SECTIONS.
  prose('directorNote', 'inner', headingText(doc, 'directorNote'), doc.directorNote.text, doc.directorNote.by);
  list('cast', 'inner', headingText(doc, 'cast'), doc.cast.filter(c => c.character || c.performer), castRow);
  list('songs', 'inner', headingText(doc, 'songs'), doc.songs.filter(s => s.title || s.act), songRow);
  list('whoswho', 'inner', headingText(doc, 'whoswho'), doc.whoswho.filter(b => b.name || b.bio || b.photo), wwRow);
  list('creative', 'inner', headingText(doc, 'creative'), doc.creative.filter(r => r.name || r.role), roleRow);
  list('management', 'inner', headingText(doc, 'management'), doc.management.filter(r => r.name || r.role), roleRow);
  list('crew', 'inner', headingText(doc, 'crew'), doc.crew.filter(c => c.category || c.names), crewRow);
  prose('productionNotes', 'inner', headingText(doc, 'productionNotes'), doc.productionNotes);

  // Custom sections flow at the end of the body in Auto mode; the Assembly Board is
  // how you place each one on a specific page.
  (doc.custom || []).filter(customHasContent).forEach(item => {
    if (item.type === 'image') {
      if (item.heading) push(item.id, 'inner', true, sectionHead(item.heading));
      push(item.id, 'inner', false, customImageFigure(item));
    } else {
      if (item.heading) push(item.id, 'inner', true, sectionHead(item.heading));
      push(item.id, 'inner', false, `<div class="prose">${nl2br(item.body)}</div>`);
    }
  });
  prose('acknowledgments', 'back', headingText(doc, 'acknowledgments'), doc.acknowledgments);
  list('qr', 'back', headingText(doc, 'qr'), doc.qr.filter(q => q.url || q.label), qrTile);
  prose('backPage', 'back', headingText(doc, 'backPage'), doc.backPage);

  // Drop sections the user excluded from the printed program (Include toggle). "Who's Who
  // only" mode always keeps Who's Who so the standalone insert still works.
  const wwOnly = doc.options && doc.options.whoswhoOnly;
  return blocks.filter(b => {
    const id = b.el.dataset.section;
    if (wwOnly && id === 'whoswho') return true;
    return sectionShown(doc, id);
  });
}

// A section prints unless explicitly excluded (doc.shown[id] === false).
function sectionShown(doc, id) {
  return !doc.shown || doc.shown[id] !== false;
}

const coverHTML = (doc) => sectionInnerHTML('cover', doc);

export { SECTIONS, buildCards, buildBlocks, coverHTML, sectionInnerHTML, hasContent, esc, DEFAULT_HEADINGS, headingText, sectionShown };
