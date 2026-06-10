# Hedi's Furniture — Antigravity / Gemini Project Instructions

## How to build (IMPORTANT)
- **Shopify-native first.** Whenever adding a section, block, menu, or any feature, prefer
  built-in Shopify / theme-native sections and settings (theme editor sections, menus/linklists,
  app blocks, existing theme section types). Use what already ships with the theme or Shopify.
- **Only code custom when it doesn't exist in Shopify.** If the desired thing genuinely isn't
  available as a native Shopify/theme section or setting, then build it custom in the codebase
  (custom Liquid sections/snippets, `assets/custom.css`, `assets/custom.js`). Document any custom
  addition here.
- Prefer the smallest change: extend/configure existing theme sections over creating new files.

## Store / theme facts
- Store: **Hedi's Furniture** — `hedisfurniture.com` (Shopify plan, USD, EDT).
- **Active working theme:** `Horizon` — DRAFT / UNPUBLISHED —
  `gid://shopify/OnlineStoreTheme/151554883672`.
  Local files live in `code base-new-horiozon/theme-horizon-new/`.
  The `shopify theme dev` server runs a **Development** copy (`151555866712`) from these local
  files — the live golden theme is **never** touched.
- **Live theme:** `golden` (role MAIN) — customers see this. **Never edit the live theme.**
- **OLD draft (do not touch):** `LevLocal` — `gid://shopify/OnlineStoreTheme/141169786968`.
  This was the previous working draft on the **Halo** theme; all work has migrated to Horizon.
  Original pre-redesign backups: `levlocal-arhaus-backup/` (see its README to revert).
- Theme files live on Shopify; read/write them via the Shopify Admin API (themeFiles /
  themeFilesUpsert). Writes are allowed on the Horizon unpublished theme only.

## ⚠️ Scope discipline — HORIZON ONLY
- **We are ONLY working in the Horizon theme.** That means:
  - Local files: `code base-new-horiozon/theme-horizon-new/**`
  - Shopify API theme ID: `151554883672` (draft) / dev copy `151555866712`
- Do NOT touch `theme/`, `code base-old-levlocal/`, or `levlocal-arhaus-backup/`.
- Multiple agents may work in parallel. **Stay in your lane** — only edit the files for your task.
- Collections / collection templates are often owned by another agent; do not touch them unless
  the task is explicitly about collections.
- The header menu `main-menu` is shared with golden — do NOT edit it or it breaks the live store.

## Project file map (Horizon theme)
```
code base-new-horiozon/theme-horizon-new/
├── assets/
│   ├── custom.css          ← ALL custom CSS overrides go here (single file, loads after base.css)
│   ├── order-swatches.js   ← Order Swatches web component
│   ├── base.css            ← Horizon vendor CSS — NEVER edit this
│   └── [115 total assets]
├── blocks/
│   ├── order-swatches.liquid  ← Order Swatches theme block
│   └── [93 other blocks]
├── sections/
│   ├── header.liquid       ← Main header (Horizon native, heavily configured)
│   ├── header-group.json   ← Header section group config
│   ├── section.liquid      ← Main section renderer
│   └── [43 other sections]
├── snippets/
│   ├── scripts.liquid      ← Loads order-swatches.js on product pages
│   └── [102 other snippets]
├── templates/
│   └── product.json        ← Product template with Order Swatches block placed
├── config/
│   ├── settings_data.json  ← Theme customizer saved values
│   └── settings_schema.json
├── layout/
│   └── theme.liquid        ← Root layout; loads custom.css AFTER base.css
└── .shopifyignore          ← Ignores *.tmp* files to avoid upload errors
```

## Design system — Arhaus-style on Horizon
All custom visual overrides live in `assets/custom.css`. Rules:
- **Headings / serif:** `"Cormorant Garamond"` (CSS var `--font-primary--family`, `--font-heading--family`, `--font-accent--family`)
- **Body / UI / labels:** `"Jost"` (CSS var `--font-body--family`, `--font-subheading--family`)
- **Global background:** Nardo grey `#e7e7e5` (light color schemes 1–4)
- **PDP background:** pure white `#ffffff` (`.product-information` + `.product-recommendations`)
- **Brand green:** `#1e3d2f` (announcement bar, ADD TO BAG button, hover states)
- **Body text:** `#1b1b1b` (near-black)
- **Muted text:** `#4a4641` (secondary info, links)
- **Light muted:** `#a8a39b` (SKU label)
- **Border / divider:** `#d9d5cf` / `#e3ded6`

## Custom additions

### Order Swatches (Horizon theme)
- **What:** A "Order Swatches" feature = a trigger button + slide-in `<dialog>` drawer that lets
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
  Selecting cards (max configurable, default 5) fills a live preview. "Order" adds one line item
  per swatch of the **Sample Swatch** product (`variant 43130775732312`, $5) to the cart via
  `/cart/add.js` with line-item properties `Swatch` (colour name), `Code` (variant SKU), and a
  hidden `_swatch_sample`. It dispatches `CartAddEvent` then opens the theme cart drawer.
- **Shows only** on products whose colour/fabric option has ≥ `min_swatches` (default 2) native
  swatches. Hidden on default-variant / no-swatch products.
- **Hover preview:** hovering / focusing a native colour swatch shows a fabric popover (close-up
  image + name + SKU + quick "Add this swatch") via the native Popover API (top layer), desktop
  only (`hover: hover`). Logic is in `order-swatches-component` (delegated on `<variant-picker>`).
- **Fabrics link:** the drawer has a "See all fabrics & care" link to
  `/collections/upholstery-swatches` (the **Fabrics** collection). NOTE: those 9 fabric products
  are currently **DRAFT/unpublished**, so the grid is empty — identical to golden. A top-nav link
  was **not** added because `main-menu` is shared with golden.
- **Native swatches** (the circular colour chips + `Color: <value>` label) are Horizon's built-in
  `variant-picker` block (`show_swatches: true`) — no custom code needed; configure swatches per
  option value in Admin.

### Product page (PDP) overrides — `assets/custom.css` sections 8, 8b, 8c
Key overrides applied to `.product-information`:
- **White background** for PDP + Recommendations sections (overrides global grey).
- **70/30 media/info grid** (widened from default 67/33 to match Arhaus ~70%).
- **Title:** serif 28–40px, weight 400, near-black, title case.
- **Price:** serif 18–22px.
- **SKU:** `SKU :` label prepended via `::before`, 10px Jost, light grey.
- **Option rows:** 2-column label LEFT / values RIGHT layout (Arhaus pattern). Swatch chips 30×30px square. Size pills are plain text with underline on `:checked`.
- **ADD TO BAG:** forest green `#1e3d2f`, square corners, uppercase tracked, full-width.
- **QTY stepper:** `Qty :` label via `::before`, square border `#d9d5cf`, 44px height.
- **Accelerated checkout** (Shop Pay etc.) hidden to match Arhaus single-button layout.

### Product card hover — cross-fade + springy zoom (`assets/custom.css` section 9)
Replicates the LevLocal / Halo golden card hover:
- Image 2 **cross-fades in** (opacity 0→1 over 0.5s) instead of Horizon's instant slide.
- Visible image **slow springy zoom** to `scale(1.05)` over 2s with `cubic-bezier(0,0,.44,1.18)`.
- Desktop only (`min-width: 750px`). Mobile keeps native swipe scroller.
- Quick-add "+" overlay is hidden (`.product-card .quick-add { display:none }`).

### Mega menu overrides (`assets/custom.css` sections 5, 7)
- **2 featured images** only in the menu product panel (3rd+ hidden).
- **No prices** in the mega menu.
- **"SHOP …" title prefix** via `::before` on `.resource-card__title`.
- **Grey panel** `#e7e7e5` for the mega menu underlay.
- **Slow springy zoom** applied to `.resource-card__image` on hover (consistent with cards).

### Header / announcement bar (`assets/custom.css` section 6)
- Dark forest-green `#1e3d2f` top bar with white text (`.announcement-bar`).
- Centered uppercase main nav with letter-spacing 0.12em.
- "Search" text label appended to the search icon via `::after` (desktop only).

## Shopify CLI workflow
```powershell
# Start local dev (syncs local → dev copy 151555866712, hot-reloads preview)
cd "code base-new-horiozon/theme-horizon-new"
shopify theme dev --store=hedisfurniture.myshopify.com --theme=151555866712

# Push a specific file to the DRAFT theme (not dev copy)
shopify theme push --store=hedisfurniture.myshopify.com --theme=151554883672 --only assets/custom.css

# Pull latest theme files from Shopify to local
shopify theme pull --store=hedisfurniture.myshopify.com --theme=151554883672
```

## Scratch / working files
- `.work/` — scratch files, base64 chunks, diagnostic scripts, golden-theme references.
  **Do not upload anything from `.work/` to Shopify.**
- `.gstack/browse-audit.jsonl` — browsing audit log from past sessions.
- `theme-edits/` — extracted PDP liquid files used for reference/comparison.
- `images/` — reference screenshots and design assets.

## Quick reference — Shopify IDs
| Resource | ID |
|---|---|
| Horizon draft theme | `gid://shopify/OnlineStoreTheme/151554883672` |
| Horizon dev (CLI) theme | `151555866712` |
| LevLocal draft (OLD — do not touch) | `gid://shopify/OnlineStoreTheme/141169786968` |
| Live golden theme | role: MAIN (never touch) |
| Sample Swatch product variant | `43130775732312` |
| Upholstery swatches collection | `/collections/upholstery-swatches` |
