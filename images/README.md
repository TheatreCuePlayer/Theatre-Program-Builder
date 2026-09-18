# images/

Put performer/creative headshots here (e.g. `emma-stone.jpg`) and reference them in the
app's **Who's Who → Photo** field with a **relative path**:

```
images/emma-stone.jpg
```

Because these are served from the **same origin** as the app, they:

- display and print reliably (no CORS/hotlink issues), and
- export cleanly — the Who's Who card's **Copy PNG / SVG** works (no tainted canvas,
  unlike cross-origin photo hosts).

Keep this folder in a **private** repo behind Cloudflare Access so the photos are not
publicly fetchable. Get performers' consent before adding photos, and remember git
history retains deleted files.
