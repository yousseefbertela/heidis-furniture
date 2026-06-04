# PDP (Product Page) Investigation — Halo theme on LevLocal

Theme: **LevLocal** (DRAFT) — `gid://shopify/OnlineStoreTheme/141169786968`
Live theme: **golden** (MAIN, do not edit).

---

## 1. Files returned by the original graphql_query

The pre-existing tool-result file `mcp-75f816d9-...-1780519942186.txt` contained ONLY one file:

| Filename | Role |
| --- | --- |
| `templates/product.json` | The template that wires up which sections render on the PDP and what settings/blocks each carries. |

The user's task asked for `sections/product-template.liquid` and/or `sections/product.liquid` from this file — neither exists in the result. I followed up with two additional `graphql_query` calls to fetch the actual section and snippet liquid files. The PDP in Halo is **not** a single `product.liquid`. Halo splits the PDP across:

| Filename | Role |
| --- | --- |
| `sections/main-product.liquid` | The section. Loads PDP CSS, reads `settings.product_page_layout`, then `render`s one of 8 layout snippets. Almost the entire file (lines 31–3194 of 3195) is `{% schema %}`. |
| `snippets/product-page-full-width.liquid` | **Currently active** PDP layout. `settings.product_page_layout = "full_width"` in `config/settings_data.json`. 1323 lines. |
| `snippets/product-page.liquid` | The "default" PDP layout. Near-identical wrapper structure to `-full-width`. 1328 lines. |
| `snippets/product-page-full-width-2.liquid` | Alternative full-width variant (not fetched, but referenced from `main-product.liquid`). |
| `snippets/product-page-gallery.liquid` | Gallery layout. |
| `snippets/product-page-left-thumbs.liquid` | Left thumbnails layout. |
| `snippets/product-page-right-thumbs.liquid` | Right thumbnails layout. |
| `snippets/product-page-left-right-sidebar.liquid` | Sidebar layout. |
| `snippets/product-page-horizontal-tabs-no-sidebar.liquid` | Horizontal tabs layout. |

The dispatch logic is the entire pre-schema body of `sections/main-product.liquid`:

```liquid
{% assign product_page_layout = settings.product_page_layout %}
{% if product_page_layout == "default" %}        {% render 'product-page' %}
{% elsif product_page_layout == "full_width" %}  {% render 'product-page-full-width' %}
{% elsif product_page_layout == "full_width_2" %}{% render 'product-page-full-width-2' %}
{% elsif product_page_layout == "gallery" %}     {% render 'product-page-gallery' %}
{% elsif product_page_layout == "left_thumbs" %} {% render 'product-page-left-thumbs' %}
{% elsif product_page_layout == "right_thumbs" %}{% render 'product-page-right-thumbs' %}
{% elsif product_page_layout == "left_right_sidebar" %}{% render 'product-page-left-right-sidebar' %}
{% elsif product_page_layout == "horizontal_tabs_no_sidebar" %}{% render 'product-page-horizontal-tabs-no-sidebar' %}
{% endif %}
```

So the choice of layout is a **global theme setting** (Theme settings → not the section editor). Changing the PDP layout requires editing `settings.product_page_layout` in `config/settings_data.json`, not the section.

Local copies of the extracted files (for reference while editing):
- `theme-edits/_extracted_product.json`
- `theme-edits/_extracted_main-product.liquid`
- `theme-edits/_extracted_snippets_product-page-full-width.liquid` (ACTIVE)
- `theme-edits/_extracted_snippets_product-page.liquid`

---

## 2. `templates/product.json` — section order

`templates/product.json` is the auto-generated Shopify theme template. Top-level `order` is:

```json
"order": [
    "main",
    "product-recommendations",
    "product-recently-viewed",
    "0111b221-449b-4223-b585-619bf909becc",
    "6fa9ad8c-45e4-45b3-b4f1-529a43f15335"
]
```

So the page renders, top to bottom:
1. `main` — type `main-product` (the PDP itself).
2. `product-recommendations` — "Related Products" slider (4 per row, 10 max, slider layout).
3. `product-recently-viewed` — "Recently Viewed Products" slider.
4. Two `image-banner` sections — **both `disabled: true`**, so they do not render.

### `main` section settings (the bits that affect layout)

```json
"settings": {
    "container": "default",          // full-bleed not used
    "padding_full_width": 0,
    "show_sticky_info": true,        // right column is sticky
    "main_image_position": "left",   // media on LEFT, info on RIGHT
    "main_image_layout": "1",
    "thumnail_layout": "3",          // thumbnail under main media
    "thumbnail_to_show": 4,
    "show_sidebar": false,
    "enable_sticky": false,
    "sidebar_position": "left",
    "product_image_ratio": "portrait",
    "portrait_aspect_ratio": 101,
    "media_fit": "contain",
    "product_image_popup": "fancybox",
    "show_sticky_add_to_cart": false,
    "show_tab": true,
    "tab_layout": "vertical",        // accordion tabs (Description, Dimensions, etc.) on desktop
    "tab_layout_mobile": "vertical",
    ...
}
```

### Active blocks (33 in `block_order`)

In order — bracketed names are the `type`s:

1. breadcrumb
2. title
3. short_description
4. info
5. price
6. custom_liquid (`ready_to_deliver` metafield message)
7. custom (Custom Tab — **disabled**)
8. hot_stock (**disabled**)
9. countdown (**disabled**)
10. variant_picker (`picker_type: button`, `show_variant_image_group: true`)
11. variant_description
12. custom_information "Free shipping?" (**disabled** — replaced by `custom_liquid` below)
13. custom_liquid (SVG truck "Free shipping?" link to `/pages/delivery-shipping`)
14. custom_liquid (variant SKU live-updating script)
15. custom_liquid (vendor link, `productView-info-item`)
16. quantity_selector
17. perks (size chart + compare-color)
18. affirm Pay-Over-Time messaging (**disabled**)
19. buy_buttons
20. customer_viewing (**disabled**)
21. pickup_availability (**disabled**)
22. trust_image
23. custom — "Dimensions" (metafield `custom.dimensions`)
24. description
25. custom — "Color" (metafield `custom.color`)
26. custom — "Material" (metafield `custom.material`)
27. custom — "FABRIC DETAILS" (metafield, blank key)
28. custom — "Shipping & Delivery" (static HTML, big block)
29. custom — "Return and Exchanges" (static HTML)
30. review (**disabled**)
31. share
32. custom_information "Free Returns" (with shield SVG, popup content about restocking fee)
33. complementary_products (**disabled**)
34. custom_information "100% Warranty" (gear SVG, popup about Wesley hall/Robin Bruce lifetime)

---

## 3. Main layout structure (the wrapping HTML)

Both `product-page.liquid` and `product-page-full-width.liquid` have **the same column model**. The relevant DOM is:

```liquid
<div class="product-details product-full-width{% if has_sidebar %} has-sidebar{% endif %}"
     data-section-id="{{ section.id }}" data-section-type="product"
     id="ProductSection-{{ section.id }}">

    {% if has_breadcrumb %}
        <div class="productView-moreItem moreItem-breadcrumb ...">
            <div class="container | container-1170 | container-1770 | container-full">
                {% render 'breadcrumb' ... %}
            </div>
        </div>
    {% endif %}

    <!-- TWO-COLUMN PDP STARTS -->
    <div class="productView-container {container|container-1170|container-1770|container-full}">
        <div class="productView halo-productView
                    layout-{{ thumnail_layout }}
                    positionMainImage--{{ main_image_position }}     <!-- left|right -->
                    {% if show_sticky_info %} productView-sticky{% endif %}
                    {% if has_sidebar %} has-left-sidebar sidebar--layout_vertical{% endif %}">

            {%- if has_sidebar -%}
                <div class="page-sidebar page-sidebar-{left|right} ...">...</div>
                <div class="page-content" id="ProductContent">
            {%- endif -%}

                <div class="productView-top">                              <!-- the 2-col flex/grid row -->
                    <!-- LEFT (or right, controlled by main_image_position): MEDIA COLUMN -->
                    <div class="halo-productView-left productView-images clearfix" data-image-gallery>
                        ... cursor, badge, main slider, video popup, zoom icon, compare-color ...
                        <div class="productView-images-wrapper" data-video-{{ video_layout }}>
                            <div class="productView-image-wrapper">
                                <div class="productView-nav style-{{ main_image_layout }} image-fit-{{ media_fit }}">
                                    {% for media in product.media %}
                                        <div class="productView-image productView-image-{{ media_size }} fit-{{ media_fit }}">
                                            <div class="productView-img-container product-single__media" ...>
                                                ... image / model / video / external_video ...
                                            </div>
                                        </div>
                                    {% endfor %}
                                </div>
                            </div>
                            <div class="productView-thumbnail-wrapper">
                                <div class="productView-for"
                                     data-max-thumbnail-to-show="{{ max_thumbnail_to_show }}">
                                    ... thumbnails (type depends on layout-{{ thumnail_layout }}) ...
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT (or left): INFO COLUMN -->
                    <div class="halo-productView-right productView-details clearfix">
                        <div class="productView-product clearfix">
                            <!-- 30+ productView-moreItem divs, one per block rendered from section.blocks -->
                            <div class="productView-moreItem moreItem-breadcrumb hidden-on-mobile">...</div>
                            <div class="productView-moreItem">...vendor...</div>
                            <div class="productView-moreItem">...title...</div>
                            <div class="productView-moreItem">
                                <div class="productView-meta">...meta...</div>
                            </div>
                            <div class="productView-moreItem">...short_description...</div>
                            <div class="productView-moreItem">
                                <div class="productView-price">...price...</div>
                            </div>
                            ... countdown / variant_picker / variant_description / qty_selector ...
                            ... perks / buy_buttons / pickup / trust_image / share ...
                            ... custom_information cards / custom_text ...
                            <complementary-products class="productView-complementary ...">...</complementary-products>
                        </div>
                    </div>
                </div><!-- /.productView-top -->

            {%- if has_sidebar -%}
                </div><!-- /.page-content -->
            {%- endif -%}

        </div><!-- /.productView.halo-productView -->
    </div><!-- /.productView-container -->

    {% unless has_product_combo %}{% render 'product-bundle' %}{% endunless %}

    <!-- HORIZONTAL TABS RAIL UNDER THE COLUMNS (only when tab_layout == 'horizontal') -->
    <div class="productView-bottom ...">
        <div class="container | ...">
            {%- if show_tab and tab_layout == 'horizontal' -%}
                {% render 'halo-product-tab' ... %}
            {%- endif -%}
        </div>
    </div>

</div><!-- /.product-details.product-full-width -->
```

### Key wrapper classes (the layout knobs)

| Class | What it does |
| --- | --- |
| `product-details product-full-width` | Outermost wrapper. `product-full-width` is the snippet's identity — different snippets put a different second class here (`product-default`, etc.). |
| `productView-container` + one of `container` / `container-1170` / `container-1770` / `container-full` | Width constraint, driven by section setting `container`. |
| `productView halo-productView` | The flex/grid row that becomes the two-column desktop layout. |
| `layout-{thumnail_layout}` (1–4) | Switches thumbnail placement (under main, vertical-left, vertical-right, grid). |
| `positionMainImage--{left\|right}` | Flips which column the media goes in. |
| `productView-sticky` | Adds when `show_sticky_info` — info column gets `position: sticky`. |
| `has-left-sidebar sidebar--layout_vertical` | Added only if `show_sidebar` is on. |
| `halo-productView-left productView-images` | **Media column** (gallery + thumbnails). |
| `halo-productView-right productView-details` | **Info column** (title, price, variants, ATC, accordions, share, trust icons). |
| `productView-product` | Inner wrapper inside the info column. |
| `productView-moreItem` | Per-block wrapper (each section block becomes one of these). |
| `productView-top` | Wraps the 2-column row. |
| `productView-bottom` | Full-width strip below the 2-column row, used when tab_layout is `horizontal`. |

`product-bundle` ("Frequently Bought Together") renders **between** the two-column row and the `productView-bottom` strip, full-width.

---

## 4. Schema settings that drive PDP layout (theme editor)

These are the `{% schema %}` settings on the `main-product` section that the merchant can change in the editor. Layout-relevant only:

### Container / page width
| id | type | options | default |
| --- | --- | --- | --- |
| `container` | select | `container`, `1170`, `1770`, `fullwidth` | `container` |
| `padding_full_width` | range | 0–200 | `0` |
| `show_sticky_info` | checkbox | — | `true` |

### Section margins
| `mg_top_desktop`/`tablet`/`mobile`, `mg_bottom_desktop`/`tablet`/`mobile` | range | — | `0` |

### Main image / media column
| id | type | options | default |
| --- | --- | --- | --- |
| `main_image_arrows_desktop` | checkbox | — | `false` |
| `main_image_arrows_mobile` | checkbox | — | `true` |
| `main_image_counter_mobile` | checkbox | — | `true` |
| `main_image_enable_parallax_mb` | checkbox | — | `false` |
| `main_image_show_zoom_icon_mb` | checkbox | — | `true` |
| `main_image_position` | select | `left`, `right` | `left`  ← **flips media/info columns** |
| `main_image_layout` | select | `1`, `2`, `3` | `1` |
| `main_image_show_custom_cursor` | checkbox | — | `false` |
| `count_color` | color | — | `#191919` |
| `icon_color` | color | — | `#000000` |

### Thumbnails
| id | type | options | default |
| --- | --- | --- | --- |
| `show_thumbnail_mobile` | checkbox | — | `true` |
| `thumnail_layout` | select | `1`, `2`, `3`, `4` | `3`  ← **changes the column ratio**: 1/2 = vertical thumbs (narrower main image), 3 = thumbs under, 4 = grid |
| `thumbnail_to_show` | range | — | `6` |

### Sidebar (if you turn it on, the PDP becomes 3-column)
| id | type | options | default |
| --- | --- | --- | --- |
| `show_sidebar` | checkbox | — | `false` |
| `show_sidebar_collapse` | checkbox | — | `true` |
| `enable_sticky` | checkbox | — | `false` |
| `sidebar_layout` | select | `layout_1`, `layout_2` | `layout_1` |
| `sidebar_collapse_default` | select | `expand`, `close` | `expand` |
| `sidebar_position` | select | `left`, `right` | `left` |
| `sidebar_heading_font` / `_font_size` / `_font_weight` / `_text_transform` | various | — | — |

### Media aspect ratio (affects how tall the media column is)
| id | type | options | default |
| --- | --- | --- | --- |
| `product_image_ratio` | select | `adapt`, `portrait`, `square` | `adapt` |
| `portrait_aspect_ratio` | range | — | `148` (percent) |
| `zoomed_image` | checkbox | — | `true` |
| `media_fit` | select | `unset`, `contain`, `cover` | `cover` |
| `product_image_popup` | select | `none`, `fancybox` | `fancybox` |
| `video_layout` | select | `thumbnail`, `popup` | `thumbnail` |

### Sticky add to cart bar
| id | type | options | default |
| --- | --- | --- | --- |
| `show_sticky_add_to_cart` | checkbox | — | `true` |
| `show_sticky_vendor` | checkbox | — | `false` |
| `sticky_atc_layout` | select | `1`, `2` | `1` |

### Tabs (Description / Dimensions / Shipping / etc.)
| id | type | options | default |
| --- | --- | --- | --- |
| `show_tab` | checkbox | — | `true` |
| `tab_layout` | select | `vertical`, `vertical_sidebar`, `horizontal`, `popup` | `popup` ← `horizontal` is the only layout that uses the `productView-bottom` rail; the others render the tabs inside the info column. |
| `tab_layout_mobile` | select | `vertical`, `vertical_sidebar`, `popup` | `popup` |
| `icon_style_layout` | select | `style_1`, `style_2` | `style_1` |
| `title_padding_top_bottom` | range | — | `15` |

### Bundle (FBT) settings
`show_product_bundle`, `background_color`, `padding_top/bottom` (desktop/tablet/mobile), `block_title`, `block_title_align`, `block_dots`, `block_arrows`, `product_style` (1/2/3), `block_image_ratio` (adapt/portrait/square), discount bar, total-button colors.

---

## 5. Bottom line — what to change for a redesign

- **To pick a different overall PDP shell** (e.g. left thumbs, gallery, sidebar): change `product_page_layout` in `config/settings_data.json` (theme global setting). Each value renders a different `snippets/product-page-*.liquid`.
- **To resize/shift the two columns** without writing custom CSS: change `main_image_position` (flip), `thumnail_layout` (changes media-column width), and `container` (page width).
- **To toggle sticky info column**: `show_sticky_info`.
- **To change the active snippet's HTML**: edit `snippets/product-page-full-width.liquid` (it's what renders today). Its 2-column row sits inside `.productView` and is the only place to change column widths if you need them custom.
- **To change order or content of the right-column blocks**: edit the `block_order` in `templates/product.json` (or via Shopify theme editor — the section is "Product information").
- **Custom CSS overrides** should live in `assets/custom.css` per project rules.
