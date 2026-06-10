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
  `gid://shopify/OnlineStoreTheme/151554883672`). The `shopify theme dev` server runs a
  **Development** theme copy (`151555866712`) from these local files — golden is never touched.
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
