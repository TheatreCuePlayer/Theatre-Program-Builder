// pagination.js — flow blocks into fixed-size pages by MEASURING real rendered height.
// Pages must be live in the DOM for measurement, so this builds directly into `stage`.
import { buildBlocks, coverHTML, buildCards, SECTIONS } from './render.js';

const OVERFLOW_TOL = 1; // px slack to avoid off-by-one breaks

function newPage(doc, kind) {
  const page = document.createElement('div');
  page.className = `page pg-${doc.options.size}` + (kind ? ` page-${kind}` : '');
  const body = document.createElement('div');
  body.className = 'page-body';
  const foot = document.createElement('div');
  foot.className = 'page-foot';
  page.appendChild(body);
  page.appendChild(foot);
  return { page, body, foot };
}

function overflowing(body) {
  return body.scrollHeight - body.clientHeight > OVERFLOW_TOL;
}

// Flow a list of {el, keepWithNext} blocks across as many pages as needed.
function flow(stage, doc, blocks, startKind) {
  let p = newPage(doc, startKind);
  stage.appendChild(p.page);
  let onPage = 0; // blocks currently placed on this page

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    b.el.__meta = b;
    p.body.appendChild(b.el);
    onPage++;

    if (overflowing(p.body) && onPage > 1) {
      // This block doesn't fit. Pull it back and start a new page.
      p.body.removeChild(b.el);

      // Orphan control: if the previous block was a "keep with next" heading,
      // carry it onto the new page too so a heading never sits alone at a page foot.
      let carry = null;
      const last = p.body.lastElementChild;
      if (last && last.__meta && last.__meta.keepWithNext) {
        carry = last;
        p.body.removeChild(last);
      }

      p = newPage(doc, startKind);
      stage.appendChild(p.page);
      onPage = 0;

      if (carry) { p.body.appendChild(carry); onPage++; }
      p.body.appendChild(b.el);
      onPage++;
      // Extreme case: a single block taller than a page — leave it (clips minimally,
      // CSS keeps it readable). Nothing sane to split further at block granularity.
    }
  }
  return p;
}

// Full auto layout: cover alone on p1, inner content flowed, back content on its own final page(s).
function paginateAuto(stage, doc) {
  stage.innerHTML = '';

  // "Who's Who only" mode: no cover, no other sections — just the flowing Who's Who,
  // so it can fill the pages of a standalone (reusable) insert.
  const wwOnly = doc.options.whoswhoOnly;

  if (!wwOnly) {
    const cover = newPage(doc, 'cover');
    cover.body.dataset.section = 'cover'; // per-section typography hook
    cover.body.innerHTML = coverHTML(doc);
    stage.appendChild(cover.page);
  }

  let blocks = buildBlocks(doc);
  if (wwOnly) blocks = blocks.filter(b => b.el.dataset.section === 'whoswho');
  const inner = blocks.filter(b => b.zone === 'inner');
  const back = blocks.filter(b => b.zone === 'back');

  if (inner.length) flow(stage, doc, inner);
  if (back.length) flow(stage, doc, back, 'back'); // back zone forced onto fresh page(s)

  if (!wwOnly) numberPages(stage); // a standalone insert prints without page numbers
  return stage.querySelectorAll('.page').length;
}

// Manual layout: render exactly the pages/cards the board defined. One card per placement.
function paginateManual(stage, doc) {
  stage.innerHTML = '';
  const cards = Object.fromEntries(buildCards(doc).map(c => [c.id, c]));
  const pages = doc.manual && doc.manual.length ? doc.manual : [[]];

  pages.forEach((cardIds, idx) => {
    const kind = idx === 0 ? 'cover' : null;
    const p = newPage(doc, kind);
    cardIds.forEach(id => {
      const card = cards[id];
      if (!card) return;
      const wrap = document.createElement('div');
      wrap.className = 'block';
      wrap.dataset.section = id; // per-section typography hook
      wrap.innerHTML = card.el.innerHTML;
      p.body.appendChild(wrap);
    });
    stage.appendChild(p.page);
  });

  numberPages(stage);
  return stage.querySelectorAll('.page').length;
}

// Seed a manual arrangement from what auto produced, at whole-section granularity.
function seedManualFromSections(doc) {
  const cards = buildCards(doc);
  const front = cards.filter(c => c.zone === 'front').map(c => c.id);
  const inner = cards.filter(c => c.zone === 'inner').map(c => c.id);
  const back = cards.filter(c => c.zone === 'back').map(c => c.id);
  const pages = [];
  front.forEach(id => pages.push([id]));   // cover alone
  inner.forEach(id => pages.push([id]));   // one section per page to start
  if (back.length) pages.push(back);       // back matter together
  return pages;
}

function numberPages(stage) {
  const pages = stage.querySelectorAll('.page');
  pages.forEach((pg, i) => {
    const foot = pg.querySelector('.page-foot');
    if (foot) foot.textContent = i === 0 ? '' : String(i + 1);
  });
}

function paginate(stage, doc) {
  // "Who's Who only" always flows via auto (the board can't spill one card across pages).
  if (doc.options.whoswhoOnly) return paginateAuto(stage, doc);
  return doc.options.layoutMode === 'manual'
    ? paginateManual(stage, doc)
    : paginateAuto(stage, doc);
}

export { paginate, paginateAuto, paginateManual, seedManualFromSections };
