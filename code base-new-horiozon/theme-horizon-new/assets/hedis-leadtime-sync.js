/* ==========================================================================
   PDP lead-time / stock line — keep it in sync with the selected variant.

   The line beside QTY ("In Stock" / "Custom: Ready to Ship in N Weeks" /
   "Out of Stock") is produced by a custom-liquid block in templates/product.json
   from v.metafields.levlocal.lead_time on the selected variant.

   Horizon re-renders the product section when a variant changes, but it only
   morphs the blocks it knows about; a custom-liquid block is not one of them,
   so the line kept whatever value was rendered at page load and only corrected
   itself on a full refresh.

   The theme already does the expensive part for us: it fetches the freshly
   rendered section and hands it over on the `variant:update` event as
   detail.data.html (a parsed Document). So there is no extra network request
   here — we just lift the new .ah-leadtime out of that document and swap it in.
   ========================================================================== */
(function () {
  'use strict';

  var SELECTOR = '.ah-leadtime';

  /**
   * Replace the visible lead-time line with the one from the freshly rendered
   * markup. Text AND class are copied, because the class carries the
   * out-of-stock state (.ah-leadtime--oos) that colours it red.
   */
  function sync(doc) {
    if (!doc || typeof doc.querySelector !== 'function') return;

    var fresh = doc.querySelector(SELECTOR);
    var current = document.querySelector(SELECTOR);
    if (!fresh || !current) return;

    if (current.className !== fresh.className) current.className = fresh.className;
    if (current.textContent !== fresh.textContent) current.textContent = fresh.textContent;
  }

  document.addEventListener('variant:update', function (event) {
    var detail = event && event.detail;
    var data = detail && detail.data;
    if (!data) return;

    // Normal case: the theme hands us the re-rendered document.
    if (data.html) {
      sync(data.html);
      return;
    }

    // Fallback for a combined-listing swap, where the theme navigates to a new
    // product instead of supplying html. Fetch just this section rather than
    // the whole page.
    var newProduct = data.newProduct;
    if (!newProduct || !newProduct.url) return;

    var section = document.querySelector('.product-information');
    var sectionId = section && section.closest('[id^="shopify-section-"]');
    if (!sectionId) return;

    var id = sectionId.id.replace('shopify-section-', '');
    fetch(newProduct.url + (newProduct.url.indexOf('?') > -1 ? '&' : '?') + 'section_id=' + id)
      .then(function (r) {
        return r.ok ? r.text() : null;
      })
      .then(function (html) {
        if (html) sync(new DOMParser().parseFromString(html, 'text/html'));
      })
      .catch(function () {
        /* leave the existing line alone rather than showing something wrong */
      });
  });
})();
