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
