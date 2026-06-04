# LevLocal — original backup (pre-Arhaus redesign)

Snapshots of the original **LevLocal** draft theme files, captured **2026-06-01 ~5:24 PM**,
*before* the Arhaus-style homepage redesign began.

- **Edited theme:** `LevLocal` (draft / UNPUBLISHED) — `gid://shopify/OnlineStoreTheme/141169786968`
- **Live theme (never touched):** `golden` (role: MAIN) — customers only ever see this one.

## Files in this folder
| File | Restores to | What it is |
|------|-------------|------------|
| `templates_index.json.orig` | `templates/index.json` | Original homepage layout (all original sections, before the Arhaus design replaced it) |
| `settings_data.json.orig` | `config/settings_data.json` | Original theme settings — colors, fonts, global options |
| `custom.css.orig` | `assets/custom.css` | Original custom CSS |

## How to fully revert the LevLocal homepage to original
1. Upload `templates_index.json.orig` back as `templates/index.json` on the LevLocal theme.
2. Delete the added section `sections/arhaus-home.liquid`.
3. (If desired) restore `config/settings_data.json` and `assets/custom.css` from the `.orig` files.
4. Revert `sections/header-group.json` → set `enable_transparent` back to `true` in the
   `header-navigation-plain` section (this single setting was flipped to make the header solid).

> Ask Claude to do any of the above — it can re-upload these files to the LevLocal draft via the
> Shopify Admin API in one step.

## Collection page (Arhaus redesign — 2026-06-03)
The individual collection pages (`/collections/*`) were restyled Arhaus-style.
- **New file:** `sections/arhaus-collection-header.liquid` — breadcrumb + large serif title +
  auto subcategory carousel (reads the `main-menu` submenu matching the current collection) +
  scoped CSS that restyles the Ella toolbar & product cards. Self-contained.
- **Edited:** `templates/collection.json` — added `arhaus-collection-header` to the order
  (above `product-grid`) and set the `product-grid` **lookbook** block to `"disabled": true`
  (so the title isn't shown twice). A copy of the pre-change template + the new section source
  live in `../theme-edits/`.
- **To revert:** in `templates/collection.json`, remove `arhaus-collection-header` from `order`
  (and the `sections` object) and set the lookbook block back to `"disabled": false`. Optionally
  delete `sections/arhaus-collection-header.liquid`. (`../theme-edits/templates/collection.json.before`
  is the exact original.)

## Notes
- `sections/arhaus-home.liquid` is **new** (created for the redesign) — it has no original to back up;
  removing it + restoring `templates/index.json` returns the homepage to its original state.
- `sections/header-group.json` was **not** separately snapshotted; only one setting changed
  (`enable_transparent`), noted above.
