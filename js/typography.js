// typography.js — turn doc.styles into ONE injected <style> block + a dynamic Google
// Fonts <link>. Because both live in <head>, the rules cover screen preview, print, and
// per-card PNG/SVG export (html-to-image inlines computed styles) with no extra wiring.
//
// Model:
//   doc.styles.roles[roleKey]              -> global style for a text role
//   doc.styles.sections[sectionId][roleKey]-> per-section override (higher specificity)
// A style object is { font, weight, italic, size, align }; '' anywhere means "inherit".
import { SECTIONS } from './render.js';

// A text role: `box` selectors carry family/weight/italic/align (they cascade); `sized`
// carries each concrete text element with its base point-size, so a size multiplier keeps
// the relative sizes within a role intact.
const ROLES = [
  { key: 'coverTitle',   label: 'Cover Title',
    box: '.cover-title',
    sized: [{ sel: '.cover-title', base: 34 }] },
  { key: 'coverCredits', label: 'Cover Subtitle & Credits',
    box: '.cover-kicker, .cover-credits, .cover-foot, .cover-license',
    sized: [{ sel: '.cover-kicker', base: 10 }, { sel: '.cover-credits', base: 13 },
            { sel: '.cover-foot', base: 9 }, { sel: '.cover-license', base: 7.5 }] },
  { key: 'heading',      label: 'Section Headings',
    box: '.section-head',
    sized: [{ sel: '.section-head', base: 16 }] },
  { key: 'body',         label: 'Body / Prose',
    box: '.prose, .note-by',
    sized: [{ sel: '.prose', base: 10 }, { sel: '.note-by', base: 11 }] },
  { key: 'list',         label: 'Lists',
    box: '.two-col-list, .scene, .crew-cat, .ww-body, .qr-meta',
    sized: [{ sel: '.two-col-list .row', base: 10.5 }, { sel: '.scene-line', base: 10.5 },
            { sel: '.scene-act', base: 8.5 }, { sel: '.crew-name', base: 10 },
            { sel: '.crew-people', base: 9.5 }, { sel: '.ww-name', base: 10.5 },
            { sel: '.ww-bio', base: 9 }, { sel: '.qr-label', base: 10 },
            { sel: '.qr-cap', base: 8.5 }, { sel: '.qr-url', base: 7 }] },
  { key: 'caption',      label: 'Captions',
    box: '.img-block figcaption',
    sized: [{ sel: '.img-block figcaption', base: 8.5 }] },
];
const ROLE_BY_KEY = Object.fromEntries(ROLES.map(r => [r.key, r]));

// Which roles are worth overriding per fixed section (custom sections computed by type).
const SECTION_ROLES = {
  cover: ['coverTitle', 'coverCredits'],
  directorNote: ['heading', 'body'],
  cast: ['heading', 'list'],
  songs: ['heading', 'list'],
  whoswho: ['heading', 'list'],
  creative: ['heading', 'list'],
  management: ['heading', 'list'],
  crew: ['heading', 'list'],
  productionNotes: ['heading', 'body'],
  acknowledgments: ['heading', 'body'],
  qr: ['heading', 'list'],
  backPage: ['heading', 'body'],
};

// Curated Google Fonts. `google` is the css2 family spec; `stack` is the CSS font stack.
const FONTS = [
  // Serif
  { id: 'cormorant',   label: 'Cormorant Garamond', kind: 'serif', stack: "'Cormorant Garamond', Georgia, serif", google: 'Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600' },
  { id: 'ebgaramond',  label: 'EB Garamond',        kind: 'serif', stack: "'EB Garamond', Georgia, serif",         google: 'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600' },
  { id: 'playfair',    label: 'Playfair Display',   kind: 'serif', stack: "'Playfair Display', Georgia, serif",    google: 'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700' },
  { id: 'baskerville', label: 'Libre Baskerville',  kind: 'serif', stack: "'Libre Baskerville', Georgia, serif",   google: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400' },
  { id: 'merriweather',label: 'Merriweather',       kind: 'serif', stack: "'Merriweather', Georgia, serif",        google: 'Merriweather:ital,wght@0,400;0,700;1,400;1,700' },
  { id: 'lora',        label: 'Lora',               kind: 'serif', stack: "'Lora', Georgia, serif",                google: 'Lora:ital,wght@0,400;0,600;0,700;1,400;1,600' },
  { id: 'crimson',     label: 'Crimson Pro',        kind: 'serif', stack: "'Crimson Pro', Georgia, serif",         google: 'Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600' },
  // Sans
  { id: 'inter',       label: 'Inter',              kind: 'sans',  stack: "'Inter', system-ui, sans-serif",        google: 'Inter:wght@400;500;600;700' },
  { id: 'sourcesans',  label: 'Source Sans 3',      kind: 'sans',  stack: "'Source Sans 3', system-ui, sans-serif",google: 'Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'montserrat',  label: 'Montserrat',         kind: 'sans',  stack: "'Montserrat', system-ui, sans-serif",   google: 'Montserrat:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'raleway',     label: 'Raleway',            kind: 'sans',  stack: "'Raleway', system-ui, sans-serif",      google: 'Raleway:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'worksans',    label: 'Work Sans',          kind: 'sans',  stack: "'Work Sans', system-ui, sans-serif",    google: 'Work+Sans:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'poppins',     label: 'Poppins',            kind: 'sans',  stack: "'Poppins', system-ui, sans-serif",      google: 'Poppins:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'nunitosans',  label: 'Nunito Sans',        kind: 'sans',  stack: "'Nunito Sans', system-ui, sans-serif",  google: 'Nunito+Sans:ital,wght@0,400;0,600;0,700;1,400' },
  // Display / title
  { id: 'cinzel',      label: 'Cinzel',             kind: 'display', stack: "'Cinzel', Georgia, serif",            google: 'Cinzel:wght@400;600;700' },
  { id: 'oswald',      label: 'Oswald',             kind: 'display', stack: "'Oswald', system-ui, sans-serif",     google: 'Oswald:wght@400;500;600;700' },
  { id: 'bebas',       label: 'Bebas Neue',         kind: 'display', stack: "'Bebas Neue', Impact, sans-serif",    google: 'Bebas+Neue' },
  // Script
  { id: 'greatvibes',  label: 'Great Vibes (script)', kind: 'script', stack: "'Great Vibes', cursive",            google: 'Great+Vibes' },
  { id: 'dancing',     label: 'Dancing Script',     kind: 'script', stack: "'Dancing Script', cursive",           google: 'Dancing+Script:wght@400;600;700' },
];
const FONT_BY_ID = Object.fromEntries(FONTS.map(f => [f.id, f]));

const SIZE_OPTIONS = [
  { v: '0.8', label: '80%' }, { v: '0.85', label: '85%' }, { v: '0.9', label: '90%' },
  { v: '0.95', label: '95%' }, { v: '1', label: '100%' }, { v: '1.1', label: '110%' },
  { v: '1.25', label: '125%' }, { v: '1.5', label: '150%' }, { v: '2', label: '200%' },
];

function emptyStyle() { return { font: '', weight: '', italic: '', size: '', align: '', invert: '' }; }

// A fresh, fully-populated styles object (all roles present, no section overrides).
function blankStyles() {
  const roles = {};
  ROLES.forEach(r => { roles[r.key] = emptyStyle(); });
  return { roles, sections: {} };
}

// Backfill a loaded styles object so every role exists and every field is a string.
function migrateStyles(s) {
  const base = blankStyles();
  if (!s || typeof s !== 'object') return base;
  const clean = (o) => {
    const t = emptyStyle();
    if (o && typeof o === 'object') for (const k of Object.keys(t)) if (typeof o[k] === 'string') t[k] = o[k];
    return t;
  };
  ROLES.forEach(r => { if (s.roles && s.roles[r.key]) base.roles[r.key] = clean(s.roles[r.key]); });
  if (s.sections && typeof s.sections === 'object') {
    for (const [sid, roleMap] of Object.entries(s.sections)) {
      if (!roleMap || typeof roleMap !== 'object') continue;
      const out = {};
      for (const [rk, val] of Object.entries(roleMap)) if (ROLE_BY_KEY[rk]) out[rk] = clean(val);
      if (Object.keys(out).length) base.sections[sid] = out;
    }
  }
  return base;
}

/* ---------------------------- CSS generation ---------------------------- */
// Prefix every comma-separated selector token (used to scope a role to one section).
function prefixSel(sel, prefix) {
  if (!prefix) return sel;
  return sel.split(',').map(x => prefix + x.trim()).join(', ');
}

function boxDecls(s) {
  const d = [];
  const f = s.font && FONT_BY_ID[s.font];
  if (f) d.push(`font-family:${f.stack}`);
  if (s.weight) d.push(`font-weight:${s.weight === 'bold' ? '700' : '400'}`);
  if (s.italic) d.push(`font-style:${s.italic === 'italic' ? 'italic' : 'normal'}`);
  if (s.align) d.push(`text-align:${s.align}`);
  if (s.invert === 'on') {
    // Inverted "block": white text on a near-black box that hugs the text and wraps per line.
    d.push('color:#fff', 'background:#111', 'padding:.03in .16in', 'display:inline-block',
      'border-bottom:0', 'border-radius:2px', '-webkit-box-decoration-break:clone', 'box-decoration-break:clone');
  } else if (s.invert === 'off') {
    // Explicitly cancel an inherited invert for this scope.
    d.push('color:inherit', 'background:transparent', 'padding:0');
  }
  return d;
}

function roleRules(role, s, prefix) {
  let css = '';
  const decls = boxDecls(s);
  if (decls.length) css += `${prefixSel(role.box, prefix)}{${decls.join(';')}}\n`;
  if (s.size && s.size !== '1') {
    css += role.sized.map(t => `${prefixSel(t.sel, prefix)}{font-size:calc(${t.base}pt * ${s.size})}`).join('\n') + '\n';
  }
  return css;
}

function buildCSS(doc) {
  const styles = doc.styles || blankStyles();
  let css = '/* generated by typography.js */\n';
  // Global role rules.
  ROLES.forEach(role => { css += roleRules(role, styles.roles[role.key] || emptyStyle(), ''); });
  // Per-section overrides (higher specificity via the [data-section] prefix).
  for (const [sid, roleMap] of Object.entries(styles.sections || {})) {
    const prefix = `[data-section="${cssEscape(sid)}"] `;
    for (const [rk, s] of Object.entries(roleMap)) {
      const role = ROLE_BY_KEY[rk];
      if (role) css += roleRules(role, s, prefix);
    }
  }
  return css;
}

// Section ids are our own slugs / custom uids, but escape defensively for the attr selector.
function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

// Every font id referenced anywhere in the doc's styles.
function usedFontIds(doc) {
  const ids = new Set();
  const scan = (m) => { for (const s of Object.values(m || {})) if (s && s.font) ids.add(s.font); };
  scan(doc.styles && doc.styles.roles);
  for (const roleMap of Object.values((doc.styles && doc.styles.sections) || {})) scan(roleMap);
  return [...ids].filter(id => FONT_BY_ID[id]);
}

/* ---------------------------- DOM application ---------------------------- */
let lastFontHref = '';

function applyTypography(doc) {
  let styleEl = document.getElementById('tpb-typography');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'tpb-typography';
    document.head.appendChild(styleEl); // after app.css -> wins on equal specificity
  }
  styleEl.textContent = buildCSS(doc);

  // Rebuild the dynamic fonts link only when the set actually changed.
  const ids = usedFontIds(doc);
  const href = ids.length
    ? 'https://fonts.googleapis.com/css2?' + ids.map(id => 'family=' + FONT_BY_ID[id].google).join('&') + '&display=swap'
    : '';
  if (href !== lastFontHref) {
    lastFontHref = href;
    let link = document.getElementById('tpb-fonts');
    if (!href) { if (link) link.remove(); return false; }
    if (!link) { link = document.createElement('link'); link.id = 'tpb-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = href;
    return true; // fonts changed — caller may want to re-measure once they load
  }
  return false;
}

export { ROLES, ROLE_BY_KEY, SECTION_ROLES, FONTS, SIZE_OPTIONS, blankStyles, migrateStyles, applyTypography };
