# Theatre Program Builder

A single-page web app for building printable theatre programs (playbills). Enter your
show info, cast, crew, musical numbers, and bios; preview the pages live; and print a
real fold-and-staple booklet.

## Run it

ES modules need to be served over HTTP (opening `index.html` directly via `file://`
won't load the JS). From this folder:

```bash
python -m http.server 8770
```

Then open <http://localhost:8770/index.html>.

## Features

- **Sidebar form** — Show Info, Director's Note, Cast List (no photos), Musical
  Numbers / Songs, Who's Who (photo + bio for everyone, reorderable ▲▼), Creative Team,
  Management, Production Crew (one category → many names), QR Codes, Production Notes,
  Acknowledgments, Back Page. Every field autosaves to `localStorage`.
- **Photos** are linked by URL (kept out of the JSON so files stay small); each has a
  fixed print box so pagination height is deterministic even before the image loads.
- **QR codes** render as crisp inline **SVG** (vector — sharp at any print DPI), each
  with a label, link, and optional caption.
- **Import / Export JSON** — save and reload a whole program as one `.json` file.
- **Live preview** — strict 5.5×8.5 half-sheet cards, toggle to 8.5×11 full page.
- **Smart pagination** — content is flowed into pages by *measuring* real rendered
  height, so text never clips mid-line. Headings never orphan at a page foot.
- **Assembly Board** — flip to a manual mode and drag whole section cards across page
  slots to arrange the booklet by hand. "Reset from sections" reseeds the auto layout.
- **Booklet printing** — `Print / PDF` imposes the reading-order pages into
  fold-and-staple order (e.g. 8·1, 2·7, 6·3, 4·5), 2-up on landscape 8.5×11, padded to
  a multiple of 4. Full-page mode prints one 8.5×11 sheet per page instead.
- **Section cards** — each section is an independent card with **Download SVG** and
  **Copy PNG (300 DPI)** buttons.

## Layout / files

| File | Role |
|------|------|
| `index.html` | shell: sidebar, preview, board, cards rail |
| `css/app.css` | on-screen chrome + page/card typography |
| `css/print.css` | `@page`, imposition sheets, print-only rules |
| `js/state.js` | data model, autosave, JSON import/export |
| `js/render.js` | doc → section cards + flow blocks |
| `js/pagination.js` | measurement-based auto page breaks |
| `js/board.js` | drag-drop Assembly Board |
| `js/booklet.js` | reading-order → saddle-stitch imposition |
| `js/export.js` | `html-to-image` SVG / 300-DPI PNG |
| `js/main.js` | wiring |

## Notes & caveats

- **Tailwind is used only for app chrome**, never inside the printable pages (those use
  absolute `in`/`pt` units). Page-size classes are named `pg-half` / `pg-full` to avoid a
  collision with Tailwind's built-in `size-full` utility.
- **PNG/SVG export** uses `html-to-image` (SVG `<foreignObject>`). The first export after
  load pays a one-time font-embedding cost (a "Rendering…" toast shows meanwhile); later
  exports are ~1–2s. `foreignObject`→PNG can drop fonts/images in Safari.
- **Linked photos + card export:** photos are loaded without `crossorigin` so they always
  display on screen and in print, regardless of the host's CORS headers. The cost is that
  exporting a card that contains cross-origin photos (i.e. the Who's Who card) taints the
  canvas and the PNG/SVG export will fail for photo hosts that don't send CORS headers.
  Printing is unaffected. Host photos on a CORS-enabled URL if you need that card exported.
- **QR codes** are generated with `qrcode-generator` (CDN).
- **Copy PNG** uses the async clipboard when available and falls back to a file download.
