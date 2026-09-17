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

/* ---------- whole-section card HTML (Assembly Board + per-card export) ---------- */
function sectionInnerHTML(id, doc) {
  const m = doc.meta;
  switch (id) {
    case 'cover':
      return `
        <div class="cover">
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
          </div>
        </div>`;
    case 'cast':    return sectionHead('Cast') + `<div>${doc.cast.map(castRow).join('')}</div>`;
    case 'songs':   return sectionHead('Musical Numbers') + `<div class="scene-list">${doc.songs.map(songRow).join('')}</div>`;
    case 'creative':return sectionHead('Creative Team') + `<div>${doc.creative.filter(r => r.name || r.role).map(roleRow).join('')}</div>`;
    case 'management':return sectionHead('Management') + `<div>${doc.management.filter(r => r.name || r.role).map(roleRow).join('')}</div>`;
    case 'crew':    return sectionHead('Production Crew') + `<div class="crew-list">${doc.crew.filter(c => c.category || c.names).map(crewRow).join('')}</div>`;
    case 'whoswho': return sectionHead("Who's Who") + `<div class="ww-list">${doc.whoswho.filter(b => b.name || b.bio).map(wwRow).join('')}</div>`;
    case 'qr':      return sectionHead('Scan for More') + `<div class="qr-grid">${doc.qr.filter(q => q.url || q.label).map(qrTile).join('')}</div>`;
    case 'directorNote': return sectionHead("Director's Note") + `<div class="prose">${nl2br(doc.directorNote.text)}</div>${doc.directorNote.by ? `<div class="note-by">— ${esc(doc.directorNote.by)}</div>` : ''}`;
    case 'productionNotes': return sectionHead('Production Notes') + `<div class="prose">${nl2br(doc.productionNotes)}</div>`;
    case 'acknowledgments': return sectionHead('Acknowledgments') + `<div class="prose">${nl2br(doc.acknowledgments)}</div>`;
    case 'backPage': return sectionHead('Back Page') + `<div class="prose">${nl2br(doc.backPage)}</div>`;
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
  return SECTIONS.filter(s => hasContent(s.id, doc)).map(sec => {
    const el = document.createElement('div');
    el.className = 'section-card';
    el.dataset.card = sec.id;
    el.innerHTML = sectionInnerHTML(sec.id, doc);
    return { id: sec.id, title: sec.title, zone: sec.zone, el };
  });
}

/* ---------- fine-grained flow blocks (auto pagination; lists split across pages) ---------- */
function buildBlocks(doc) {
  const blocks = [];
  const push = (zone, keepWithNext, html) => {
    const el = document.createElement('div');
    el.className = 'block';
    el.innerHTML = html;
    blocks.push({ zone, keepWithNext, el });
  };
  const list = (id, zone, title, items, rowFn) => {
    if (!items.length) return;
    push(zone, true, sectionHead(title));
    items.forEach(it => push(zone, false, rowFn(it)));
  };
  const prose = (id, zone, title, text, by) => {
    if (!(text || '').trim()) return;
    push(zone, true, sectionHead(title));
    push(zone, false, `<div class="prose">${nl2br(text)}</div>${by ? `<div class="note-by">— ${esc(by)}</div>` : ''}`);
  };

  // Reading order mirrors SECTIONS.
  prose('directorNote', 'inner', "Director's Note", doc.directorNote.text, doc.directorNote.by);
  list('cast', 'inner', 'Cast', doc.cast.filter(c => c.character || c.performer), castRow);
  list('songs', 'inner', 'Musical Numbers', doc.songs.filter(s => s.title || s.act), songRow);
  list('whoswho', 'inner', "Who's Who", doc.whoswho.filter(b => b.name || b.bio || b.photo), wwRow);
  list('creative', 'inner', 'Creative Team', doc.creative.filter(r => r.name || r.role), roleRow);
  list('management', 'inner', 'Management', doc.management.filter(r => r.name || r.role), roleRow);
  list('crew', 'inner', 'Production Crew', doc.crew.filter(c => c.category || c.names), crewRow);
  prose('productionNotes', 'inner', 'Production Notes', doc.productionNotes);
  prose('acknowledgments', 'back', 'Acknowledgments', doc.acknowledgments);
  list('qr', 'back', 'Scan for More', doc.qr.filter(q => q.url || q.label), qrTile);
  prose('backPage', 'back', 'Back Page', doc.backPage);

  return blocks;
}

const coverHTML = (doc) => sectionInnerHTML('cover', doc);

export { SECTIONS, buildCards, buildBlocks, coverHTML, sectionInnerHTML, hasContent, esc };
