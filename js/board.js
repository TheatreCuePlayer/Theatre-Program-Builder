// board.js — interactive Booklet Assembly Board. Drag section cards across page slots.
// Writes the manual arrangement back into State.doc.manual.
import { State } from './state.js';
import { buildCards } from './render.js';
import { seedManualFromSections } from './pagination.js';

let dragInfo = null; // { id, from: pageIndex|'tray' }

function ensureManual(doc) {
  if (!Array.isArray(doc.manual) || !doc.manual.length) {
    doc.manual = seedManualFromSections(doc);
  }
  return doc.manual;
}

// Remove a card id wherever it currently sits.
function removeCard(pages, id) {
  pages.forEach(pg => {
    const i = pg.indexOf(id);
    if (i !== -1) pg.splice(i, 1);
  });
}

function renderBoard(container, doc) {
  const pages = ensureManual(doc);
  const cards = buildCards(doc);
  const titleOf = Object.fromEntries(cards.map(c => [c.id, c.title]));
  const placed = new Set(pages.flat());
  const tray = cards.map(c => c.id).filter(id => !placed.has(id));

  container.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'board-toolbar';
  toolbar.innerHTML = `
    <button data-act="add" class="btn btn-ghost">+ Add blank page</button>
    <button data-act="reseed" class="btn btn-ghost">Reset from sections</button>
    <span class="board-hint">Drag cards between pages. Page 1 is the cover.</span>`;
  container.appendChild(toolbar);
  toolbar.querySelector('[data-act="add"]').onclick = () => {
    State.update(d => { ensureManual(d).push([]); });
  };
  toolbar.querySelector('[data-act="reseed"]').onclick = () => {
    State.update(d => { d.manual = seedManualFromSections(d); });
  };

  // Unplaced tray
  const trayEl = document.createElement('div');
  trayEl.className = 'board-tray';
  trayEl.innerHTML = `<div class="tray-label">Unplaced</div>`;
  const trayDrop = dropZone('tray');
  tray.forEach(id => trayDrop.appendChild(chip(id, titleOf[id], 'tray')));
  trayEl.appendChild(trayDrop);
  container.appendChild(trayEl);

  // Pages grid
  const grid = document.createElement('div');
  grid.className = 'board-grid';
  pages.forEach((cardIds, idx) => {
    const slot = document.createElement('div');
    slot.className = 'board-page';
    const head = document.createElement('div');
    head.className = 'board-page-head';
    head.innerHTML = `<span>Page ${idx + 1}${idx === 0 ? ' · Cover' : ''}</span>`;
    const del = document.createElement('button');
    del.className = 'board-del';
    del.textContent = '✕';
    del.title = 'Remove this page (cards return to Unplaced)';
    del.onclick = () => State.update(d => {
      const pgs = ensureManual(d);
      const [removed] = pgs.splice(idx, 1);
      // stranded cards simply become unplaced again (no data loss)
      if (!pgs.length) d.manual = seedManualFromSections(d);
    });
    head.appendChild(del);
    slot.appendChild(head);

    const zone = dropZone(idx);
    cardIds.forEach(id => zone.appendChild(chip(id, titleOf[id], idx)));
    slot.appendChild(zone);
    grid.appendChild(slot);
  });
  container.appendChild(grid);
}

function chip(id, title, from) {
  const el = document.createElement('div');
  el.className = 'board-chip';
  el.draggable = true;
  el.dataset.card = id;
  el.textContent = title || id;
  el.addEventListener('dragstart', (e) => {
    dragInfo = { id, from };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  return el;
}

function dropZone(target) {
  const zone = document.createElement('div');
  zone.className = 'board-dropzone';
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    if (!dragInfo) return;
    const { id } = dragInfo;
    State.update(d => {
      const pages = ensureManual(d);
      removeCard(pages, id);
      if (target === 'tray') { dragInfo = null; return; } // dropping on tray = unplace
      pages[target].push(id);
      dragInfo = null;
    });
  });
  return zone;
}

export { renderBoard };
