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

  /* ---- Drawer state across an AJAX swap ---------------------------------
     openDrawer() puts .ahc-drawer-open on <body>, which is `overflow:hidden`.
     Filtering replaces the whole header section, so the drawer node the close
     handler was bound to is destroyed and closeDrawer() never runs - the body
     class survives and the page can never be scrolled again. That hit every
     filter click from inside the drawer, and was most obvious with the sliders
     because they fire a filter on every drag.

     Fix: remember whether the drawer was open (and how far its body was
     scrolled) before the swap, then put it back afterwards. If it was NOT
     open, clear the stale lock defensively. */
  function captureDrawer() {
    var open = document.querySelector('.ahc-drawer.is-open');
    var body = open && open.querySelector('.ahc-drawer__body');
    return { open: !!open, scrollTop: body ? body.scrollTop : 0 };
  }

  function restoreDrawer(state) {
    if (state && state.open && typeof window.__ahcOpenDrawer === 'function') {
      window.__ahcOpenDrawer();
      var body = document.querySelector('.ahc-drawer .ahc-drawer__body');
      if (body && state.scrollTop) body.scrollTop = state.scrollTop;
      return;
    }
    // Nothing open - make sure no scroll lock was left behind.
    document.body.classList.remove('ahc-drawer-open');
  }

  function render(url, isPop) {
    if (busy) return;
    busy = true;
    setLoading(true);
    var drawerState = captureDrawer();

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
        restoreDrawer(drawerState);
        if (doc.title) document.title = doc.title;
        if (!isPop) history.pushState({ ahc: 1 }, '', url);
        setLoading(false);
        busy = false;
        document.dispatchEvent(new CustomEvent('ahc:rendered'));
      })
      .catch(function () {
        document.body.classList.remove('ahc-drawer-open');
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

  /* ---- Case-variant merge ------------------------------------------------
     Shopify exposes "Round" and "round" as two separate facet values because
     the underlying metafield strings differ in case. The section renders ONE
     row for them and lists the extra variants in data-ahc-merge; here we append
     those to the URL so ticking the row filters on every variant at once. */
  function withMerged(cb) {
    var url = cb.getAttribute('data-ahc-url');
    var merge = cb.getAttribute('data-ahc-merge');
    var param = cb.getAttribute('data-ahc-param');
    if (!url || !merge || !param) return url;
    // Only widen the selection when switching ON. Turning off, url_to_remove
    // already strips the whole param.
    if (!cb.checked) return url;
    try {
      var u = new URL(url, window.location.origin);
      merge.split('||').forEach(function (v) {
        if (v) u.searchParams.append(param, v);
      });
      return u.pathname + u.search;
    } catch (e) { return url; }
  }

  /* ---- Dimension range sliders ------------------------------------------
     Width / Depth / Height are discrete Shopify facet values, not a true numeric
     range, so the slider picks every value inside the chosen span and applies
     them together (the filter param accepts repeats). */
  function initRanges(root) {
    (root || document).querySelectorAll('[data-ahc-range]').forEach(function (box) {
      if (box.dataset.ahcReady) return;
      box.dataset.ahcReady = '1';

      var raw = (box.getAttribute('data-values') || '').split('||');
      var vals = raw.map(function (s) { return String(s).trim(); }).filter(Boolean)
        .map(function (s) { return { label: s, n: parseFloat(String(s).replace(/[^0-9.-]/g, '')) }; })
        .filter(function (o) { return !isNaN(o.n); })
        .sort(function (a, b) { return a.n - b.n; });
      if (vals.length < 2) { box.style.display = 'none'; return; }

      var active = (box.getAttribute('data-active') || '').split('||')
        .map(function (s) { return parseFloat(String(s).replace(/[^0-9.-]/g, '')); })
        .filter(function (n) { return !isNaN(n); });

      var minIn = box.querySelector('.ahc-range__in--min');
      var maxIn = box.querySelector('.ahc-range__in--max');
      var outMin = box.querySelector('.ahc-range__out--min');
      var outMax = box.querySelector('.ahc-range__out--max');
      var fill = box.querySelector('.ahc-range__fill');
      var last = vals.length - 1;

      [minIn, maxIn].forEach(function (el) { el.min = 0; el.max = last; el.step = 1; });
      minIn.value = active.length ? Math.max(0, vals.findIndex(function (v) { return v.n >= Math.min.apply(null, active); })) : 0;
      maxIn.value = active.length ? Math.max(0, vals.map(function (v) { return v.n; }).lastIndexOf(Math.max.apply(null, active))) : last;
      if (+maxIn.value < +minIn.value) maxIn.value = last;

      function paint() {
        var a = Math.min(+minIn.value, +maxIn.value), b = Math.max(+minIn.value, +maxIn.value);
        outMin.textContent = vals[a].label;
        outMax.textContent = vals[b].label;
        fill.style.left = (a / last * 100) + '%';
        fill.style.right = (100 - b / last * 100) + '%';
      }

      function apply() {
        var a = Math.min(+minIn.value, +maxIn.value), b = Math.max(+minIn.value, +maxIn.value);
        var param = box.getAttribute('data-param');
        try {
          var u = new URL(window.location.href);
          u.searchParams.delete(param);
          u.searchParams.delete('page');
          u.searchParams.delete('preview_theme_id');
          // Selecting the whole span means "no constraint" - leave the param off.
          if (!(a === 0 && b === last)) {
            for (var i = a; i <= b; i++) u.searchParams.append(param, vals[i].label);
          }
          go(u.pathname + u.search);
        } catch (e) { /* noop */ }
      }

      minIn.addEventListener('input', paint);
      maxIn.addEventListener('input', paint);
      minIn.addEventListener('change', apply);
      maxIn.addEventListener('change', apply);
      paint();
    });
  }
  document.addEventListener('ahc:rendered', function () { initRanges(document); });
  if (document.readyState !== 'loading') initRanges(document);
  else document.addEventListener('DOMContentLoaded', function () { initRanges(document); });

  /* ---- Delegated interactions ------------------------------------------- */

  // Filter checkboxes (chip dropdowns + drawer) and sort dropdown.
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('.ahc-opt__cb[data-ahc-url]')) {
      go(withMerged(t));
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
