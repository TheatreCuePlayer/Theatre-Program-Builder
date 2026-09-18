# shows/

Store program `.json` files here (one per production). Two ways to use them:

1. **Import** — in the app, click *Import JSON* and pick the file.
2. **Deep link** — open the app with a `?show=` parameter pointing at a **relative**
   path in this site, and it loads automatically:

   ```
   https://program.theatrecueplayer.app/?show=shows/fantasticks.json
   ```

   Only same-origin relative paths are allowed (no `http://…`, no `//…`), so the app
   can't be tricked into loading JSON from another site. Loading a show this way
   replaces whatever is currently in the editor.

`sample.json` here is a small example you can open with
`?show=shows/sample.json`.
