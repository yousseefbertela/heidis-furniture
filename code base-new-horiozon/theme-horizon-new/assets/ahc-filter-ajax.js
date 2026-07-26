/* ==========================================================================
   AHC filter AJAX — Arhaus-style instant filtering (no full page reload).

   Our custom collection filter (sections/hedis-collection-header.liquid) links
   each option to a normal Shopify filter URL. This controller intercepts those
   interactions, fetches the target URL, and swaps in the new product grid AND
   the refreshed filter header — so the page updates in place with live counts,
   instead of a full navigation.

   Design:
   - ONE persistent script, all handlers delegated on `document`, so they keep
     working after the header/grid DOM is replaced.
   - Swaps the two .shopify-section wrappers by id: the one containing
     .product-grid (results) and the one containing .ahc-toolbar (filter UI).
   - After swap, calls window.__ahcInitHeader() (defined by the header section)
     to rebind the rail/chip/drawer UI to the fresh DOM.
   - Preserves preview_theme_id on fetches so it works on the draft theme.
   - Handles browser back/forward via popstate.
   ========================================================================== */
(function () {
  'use strict';

  var busy = false;

  function gridSection() {
    var g = document.querySelector('.product-grid');
    return g ? g.closest('.shopify-section') : null;
  }
  function headerSection() {
    var t = document.querySelector('.ahc-toolbar');
    return t ? t.closest('.shopify-section') : null;
  }

  /* Carry preview_theme_id (draft preview) onto the fetch URL only. */
  function fetchUrl(url) {
    try {
      var cur = new URL(window.location.href);
      var pv = cur.searchParams.get('preview_theme_id');
      if (!pv) return url;
      var u = new URL(url, window.location.origin);
      if (!u.searchParams.get('preview_theme_id')) u.searchParams.set('preview_theme_id', pv);
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function setLoading(on) {
    var gs = gridSection();
    if (!gs) return;
    gs.style.transition = 'opacity .18s ease';
    gs.style.opacity = on ? '0.45' : '';
    gs.style.pointerEvents = on ? 'none' : '';
  }

  function swapById(doc, current) {
    if (!current) return;
    var fresh = doc.getElementById(current.id);
    if (fresh) current.replaceWith(fresh);
  }

  function render(url, isPop) {
    if (busy) return;
    busy = true;
    setLoading(true);

    fetch(fetchUrl(url), { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) {
        if (!r.ok) throw new Error('bad status ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        swapById(doc, gridSection());
        swapById(doc, headerSection());
        if (typeof window.__ahcInitHeader === 'function') window.__ahcInitHeader();
        if (doc.title) document.title = doc.title;
        if (!isPop) history.pushState({ ahc: 1 }, '', url);
        setLoading(false);
        busy = false;
        document.dispatchEvent(new CustomEvent('ahc:rendered'));
      })
      .catch(function () {
        // Network/parse failure — fall back to a normal navigation so the user
        // is never stuck.
        window.location.href = url;
      });
  }

  function go(url) {
    if (!url) return;
    render(url, false);
  }
  window.ahcAjax = { go: go };

  /* ---- Delegated interactions ------------------------------------------- */

  // Filter checkboxes (chip dropdowns + drawer) and sort dropdown.
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('.ahc-opt__cb[data-ahc-url]')) {
      go(t.getAttribute('data-ahc-url'));
    } else if (t.matches('[data-ahc-sort]')) {
      try {
        var u = new URL(window.location.href);
        u.searchParams.set('sort_by', t.value);
        u.searchParams.delete('page');
        // strip preview id from the pushed URL; fetchUrl re-adds it for the fetch
        u.searchParams.delete('preview_theme_id');
        go(u.pathname + u.search);
      } catch (err) { /* noop */ }
    }
  });

  // Active-filter chips (remove one), Clear All, and the drawer's "Clear all" link.
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var rem = e.target.closest('[data-ahc-chip-remove]');
    if (rem) {
      e.preventDefault();
      go(rem.getAttribute('data-ahc-url'));
      return;
    }
    var clr = e.target.closest('[data-ahc-clear], .ahc-drawer__clear');
    if (clr) {
      e.preventDefault();
      go(clr.getAttribute('data-ahc-url') || clr.getAttribute('href'));
      return;
    }
  });

  window.addEventListener('popstate', function () {
    render(window.location.href, true);
  });
})();
