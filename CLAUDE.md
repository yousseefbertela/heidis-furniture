# Hedi's Furniture — Project Instructions

## How to build (IMPORTANT)
- **Shopify-native first.** Whenever adding a section, block, menu, or any feature, prefer
  built-in Shopify / theme-native sections and settings (theme editor sections, menus/linklists,
  app blocks, existing theme section types). Use what already ships with the theme or Shopify.
- **Only code custom when it doesn't exist in Shopify.** If the desired thing genuinely isn't
  available as a native Shopify/theme section or setting, then build it custom in the codebase
  (custom Liquid sections/snippets, `assets/custom.css`, `assets/custom.js`). Document any custom
  addition here.
- Prefer the smallest change: extend/configure existing theme sections over creating new files.

## Deploying changes — how code reaches the Horizon draft (IMPORTANT)
Two push paths exist. **Prefer the CLI** — it surfaces validation errors the MCP hides.

1. **Edit locally** in `code base-new-horiozon/theme-horizon-new/`.
2. **Commit + push to GitHub** — `git push origin main`; repo `yousseefbertela/heidis-furniture`,
   **public**, commit straight to `main`.
3. **Push to the Horizon draft. Pick one:**
   - **CLI (preferred, authorized as of 2026-06-18).** Always scope to the changed file(s) and use
     `--nodelete` so it can NEVER touch editor-owned JSON or delete remote files:
     `shopify theme push --store=hedisfurniture.myshopify.com --theme=151554883672 --path="code base-new-horiozon/theme-horizon-new" --only=sections/hedis-footer.liquid --nodelete`
     A bare `shopify theme push` (no `--only`) would upload local `settings_data.json` /
     `templates/*.json` / `*-group.json` and **wipe the editor config** — never run it unscoped.
     The CLI prints real schema/Liquid errors (e.g. `Invalid schema: setting ... default is invalid`).
     To delete one remote file: `--only=<path>` with the file absent locally and WITHOUT `--nodelete`.
   - **MCP `themeFilesUpsert`** — `graphql_mutation`, `themeId: "gid://shopify/OnlineStoreTheme/151554883672"`,
     per file `body: { type: URL, value: "https://raw.githubusercontent.com/yousseefbertela/heidis-furniture/<SHA>/code%20base-new-horiozon/theme-horizon-new/<themepath>" }`
     (`%20` for the repo-path spaces; `filename` is the theme-root-relative path).
     **CRITICAL caveat:** an empty `upsertedThemeFiles` array does NOT prove success — Shopify
     **silently rejects invalid files** (e.g. a bad `{% schema %}`) and returns the same empty array
     with no `userErrors`. If a push "succeeds" but the draft never changes, the file is being
     rejected; switch to the CLI to see the actual error. (URL-body `type: URL` is also fragile.)
4. **Verify ALWAYS** with `theme(id){ files(filenames:[…]){ nodes{ checksumMd5 } } }` and match each to
   `git show HEAD:<repopath> | md5sum`. Mismatch = the push did not land — do not trust the success message.

**Schema gotcha:** a `link_list` setting's `default` accepts ONLY `main-menu` or `footer`; any other
menu handle is "invalid" and silently kills the whole upsert. To wire a column to a custom menu,
leave the `link_list` default off and resolve it in Liquid by handle: `linklists['shop'].links`
(see `sections/hedis-footer.liquid` — columns fall back to `shop`/`our-company`/`footer`).

**Safety:** the MCP **auto-blocks writes to the live/MAIN theme** — `themeFilesUpsert` only works on
unpublished themes, so it physically cannot touch live **golden**. Still always pass the draft id.

**Editor-owned files — do NOT push local over these:** `config/settings_data.json`,
`templates/*.json`, `sections/*-group.json`. The open theme editor owns + re-saves them, so for these
**Shopify is the source of truth**; local copies are stale snapshots and are *expected* to differ.
Pushing local over them wipes the user's editor config (theme settings, homepage/footer/header
layout). For content that must persist + stay editable, use **section-setting defaults in the
`.liquid` `{% schema %}`** (clobber-proof), not blocks.

## Store / theme facts
- Store: **Hedi's Furniture** — `hedisfurniture.com` (Shopify plan, USD, EDT).
- **Edited theme:** `LevLocal` — DRAFT / UNPUBLISHED — `gid://shopify/OnlineStoreTheme/141169786968`.
  This is the only theme we touch.
- **Live theme:** `golden` (role MAIN) — customers see this. **Never edit the live theme.**
- Theme is the **Halo** premium theme. Header is a section group (`sections/header-group.json`)
  with rows: `header-minimal` (dark top bar) → `header-utility` (search / center logo / icons)
  → `header-navigation-plain` (main centered nav, menu = `main-menu`) → `header-mobile`.
  Halo ships disabled `megamenu_style_1..5` blocks inside `header-navigation-plain`.
- Theme files live on Shopify; read/write them via the Shopify Admin API (themeFiles /
  themeFilesUpsert). Writes are allowed on this unpublished theme only.
- Original pre-redesign backups: `levlocal-arhaus-backup/` (see its README to revert).

## Scope discipline
- Multiple agents may work in parallel. **Stay in your lane** — only edit the files for your task.
- Collections / collection templates are often owned by another agent; do not touch them unless
  the task is explicitly about collections.

## Custom additions

### Order Swatches (Horizon theme)
- **Where:** `code base-new-horiozon/theme-horizon-new/` (the **Horizon** draft theme,
  `gid://shopify/OnlineStoreTheme/151554883672`). Changes reach this draft via the push flow above
  (GitHub → Shopify MCP `themeFilesUpsert`); golden is never touched.
- **What:** a "Order Swatches" feature = a trigger button + slide-in `<dialog>` drawer that lets
  a customer order up to N physical fabric/colour samples. Ported + improved from the live golden
  (Halo) custom feature.
- **Files:**
  - `blocks/order-swatches.liquid` — theme block (markup + `{% stylesheet %}` + `{% schema %}`).
    Drag-and-drop in the editor; configurable (button label, heading, max swatches, min swatches
    to show, sample product/variant, price note, padding).
  - `assets/order-swatches.js` — `<order-swatches-component>` web component (extends `@theme/component`).
  - `snippets/scripts.liquid` — loads `order-swatches.js` on product pages (in the `template==product` block).
  - `templates/product.json` — block instance placed in `main` › `product-details`, right after
    `variant_picker`.
- **How it works:** renders one card per native option-value swatch (Shopify Admin swatches).
  Selecting cards (max configurable, default 5) fills a live preview. "Order" adds one line item per
  swatch of the **Sample Swatch** product (`variant 43130775732312`, $5) to the cart via
  `/cart/add.js` with line-item properties `Swatch` (colour name), `Code` (variant SKU), and a hidden
  `_swatch_sample`. It dispatches `CartAddEvent` then opens the theme cart drawer.
- **Shows only** on products whose colour/fabric option has ≥ `min_swatches` (default 2) native
  swatches. Hidden on default-variant / no-swatch products.
- **Hover preview:** hovering / focusing a native colour swatch shows a fabric popover (close-up
  image + name + SKU + quick "Add this swatch") via the native Popover API (top layer), desktop only
  (`hover: hover`). Logic is in the same `order-swatches-component` (delegated on the main
  `<variant-picker>`).
- **Fabrics link:** the drawer has a "See all fabrics & care" link to
  `/collections/upholstery-swatches` (the **Fabrics** collection). NOTE: those 9 fabric products are
  currently **DRAFT/unpublished**, so the grid is empty — identical to golden. A top-nav link was
  **not** added because the header menu `main-menu` is shared with golden (editing it would change
  golden); add "Fabrics & Care" in Admin → Navigation, or point Horizon's `header-group.json` at a
  Horizon-only menu, when ready.
- **Native swatches** (the circular colour chips + `Color: <value>` label) are Horizon's built-in
  `variant-picker` block (`show_swatches: true`) — no custom code needed; just configure swatches per
  option value in Admin.

### Inspirational Gallery (Horizon theme) — "Your Style, Your Story"
- **What:** an Arhaus-style "Inspirational Gallery" page (full-bleed masonry of lifestyle/interior
  photos with an editorial heading + subtitle), modeled on
  `arhaus.com/pages/inspirational-gallery`. Lives under the **Design Services** area of the site.
- **Files (in `code base-new-horiozon/theme-horizon-new/`):**
  - `sections/hedis-inspiration-gallery.liquid` — reusable theme **section** (scoped `#hig-<id>`
    markup + `{% stylesheet %}`-style inline `<style>` + `{% schema %}`). Has a **preset**, so it can
    be dragged onto ANY page in the editor and ships pre-populated with ~24 demo interior images.
  - `templates/page.inspirational-gallery.json` — page template that renders the section with the 24
    demo image blocks (bootstrap; editor owns it after first open).
- **Shopify page:** "Inspirational Gallery" (`/pages/inspirational-gallery`,
  `Page id 120782028888`, template suffix `inspirational-gallery`, published). Unlinked from any menu,
  so it does NOT surface on live golden (golden lacks the template → renders as a plain page).
- **Editable:** heading, subtitle, breadcrumb toggle, columns (3-6, default 5), gap (default 4px), row-height unit
  (desktop+mobile), full-bleed toggle, colors, padding, lightbox toggle — all section settings.
  Each image is a **block**: native `image_picker` ("Select image" in editor) **plus** an `image_url`
  text fallback (so it ships populated without uploads), a `size` (normal / tall / wide / large
  feature → drives col/row spans for the masonry rhythm), and an optional `link`.
- **Layout:** CSS Grid masonry — `grid-template-columns: repeat(--cols,1fr)`, `grid-auto-rows: --unit`,
  `grid-auto-flow: row dense`; tiles span rows/cols by `size`. 5 cols desktop → 4 (≤1100) → 2 (≤749).
  Optional click-to-zoom **lightbox** (vanilla JS, prev/next/Esc). Scroll-reveal is gated on a
  JS-added `.hig-js` class so tiles are NEVER permanently hidden if JS is off/fails.
- **Demo images:** store CDN `/files/...fulfily*` interior room scenes (living/dining rooms, a person
  on a sofa, material close-ups). Merchant swaps any via the block's image picker.
- **NOT linked in nav:** `main-menu` (where "Design Services" lives) is shared with live golden, so a
  nav link was deliberately not added. To put it under Design Services: Admin → Navigation → Main menu
  → add item under "Design Services" → `/pages/inspirational-gallery` (this DOES change golden's nav),
  or point Horizon's `header-group.json` at a Horizon-only menu first.
