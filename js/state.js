// state.js — single source of truth, autosave, JSON import/export
const SCHEMA = 2;
const LS_KEY = 'tpb.v1.doc';

function blankDoc() {
  return {
    schema: SCHEMA,
    meta: {
      title: 'Your Show Title',
      subtitle: '',
      licensing: '',
      book: '',
      music: '',
      lyrics: '',
      director: '',
      producer: '',
      venue: '',
      dates: '',
    },
    // Cast List — character/performer only, deliberately NO photos.
    cast: [{ character: 'Character', performer: 'Performer Name' }],
    // Creative Team — role/name.
    creative: [{ role: 'Director', name: '' }, { role: 'Music Director', name: '' }],
    // Management — role/name.
    management: [{ role: 'Producer', name: '' }],
    // Production Crew — each category listed once, many names (one per line).
    crew: [{ category: 'Scenery Construction', names: '' }],
    // Musical Numbers / Song list.
    songs: [{ act: 'Act I', title: 'Opening Number', note: '' }],
    // Who's Who — photo (URL) + bio for EVERYONE; reorderable.
    whoswho: [{ name: '', credit: '', photo: '', bio: '' }],
    // QR codes — label + URL + caption; placeable section.
    qr: [{ label: '', url: '', caption: '' }],
    directorNote: { by: '', text: '' },
    productionNotes: '',
    acknowledgments: '',
    backPage: '',
    options: { size: 'half', layoutMode: 'auto' },
    manual: null,
  };
}

const State = {
  doc: blankDoc(),
  listeners: new Set(),

  init() {
    const saved = this.load();
    if (saved) this.doc = saved;
    return this;
  },

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

  emit() {
    this.save();
    for (const fn of this.listeners) fn(this.doc);
  },

  update(mutator) { mutator(this.doc); this.emit(); },

  save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.doc)); } catch (e) { /* private mode */ }
  },

  load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) { return null; }
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (this.doc.meta.title || 'program').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url; a.download = `${safe}-program.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { this.doc = migrate(JSON.parse(reader.result)); this.emit(); resolve(this.doc); }
        catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  reset() { this.doc = blankDoc(); this.emit(); },

  // Load a show JSON hosted on THIS site (e.g. ?show=shows/fantasticks.json).
  // Restricted to same-origin relative paths so the app can't be pointed at a
  // foreign URL's JSON via a crafted link.
  async loadURL(path) {
    if (typeof path !== 'string' || /^[a-z]+:/i.test(path) || path.startsWith('//')) {
      throw new Error('only same-origin relative paths are allowed');
    }
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    this.doc = migrate(await res.json());
    this.emit();
    return this.doc;
  },
};

// Forward/backward-compatible loader. Fills missing fields and maps the v1 schema.
function migrate(d) {
  const base = blankDoc();
  if (!d || typeof d !== 'object') return base;
  const arr = (v, fb) => (Array.isArray(v) ? v : fb);
  const str = (v) => (typeof v === 'string' ? v : '');

  // v1 -> v2 field renames
  const songs = arr(d.songs, arr(d.scenes, base.songs));
  let whoswho = arr(d.whoswho, null);
  if (!whoswho && Array.isArray(d.bios)) {
    whoswho = d.bios.map(b => ({ name: str(b.name), credit: str(b.role), photo: '', bio: str(b.text) }));
  }
  if (!whoswho) whoswho = base.whoswho;

  return {
    schema: SCHEMA,
    meta: Object.assign(base.meta, d.meta || {}),
    cast: arr(d.cast, base.cast),
    creative: arr(d.creative, base.creative),
    management: arr(d.management, base.management),
    crew: arr(d.crew, base.crew),
    songs,
    whoswho,
    qr: arr(d.qr, base.qr),
    directorNote: Object.assign(base.directorNote, d.directorNote || {}),
    productionNotes: str(d.productionNotes),
    acknowledgments: str(d.acknowledgments),
    backPage: str(d.backPage) || str(d.notes),
    options: Object.assign(base.options, d.options || {}),
    manual: Array.isArray(d.manual) ? d.manual : null,
  };
}

export { State, blankDoc };
