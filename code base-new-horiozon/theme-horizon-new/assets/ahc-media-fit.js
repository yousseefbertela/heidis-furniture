/* ==========================================================================
   PDP "Aspect Fit" height helper (desktop only).
   Sets --ahc-media-h on each product-media container to the exact height from
   the image's top edge down to the bottom of the viewport, so the (contain,
   bottom-aligned) image's bottom lands on the bottom of the screen — above the
   fold, never cropped. The top offset (header + breadcrumb) varies per page,
   so we measure it live rather than hard-coding a calc().
   ========================================================================== */
(function () {
  'use strict';

  var MIN = 340; // never collapse smaller than this

  function fit() {
    var desktop = window.matchMedia('(min-width: 750px)').matches;
    var containers = document.querySelectorAll('.product-information .product-media-container');
    containers.forEach(function (c) {
      if (!desktop) {
        c.style.removeProperty('--ahc-media-h');
        return;
      }
      // Distance from the top of the viewport to the top of the media, measured
      // at the top of the page (scrollY compensated so it's stable if scrolled).
      var topAbsolute = c.getBoundingClientRect().top + window.scrollY;
      var avail = window.innerHeight - topAbsolute; // = bottom-of-screen minus media top
      if (avail < MIN) avail = MIN;
      c.style.setProperty('--ahc-media-h', Math.round(avail) + 'px');
    });
  }

  var raf;
  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fit);
  }

  // Run several times early: the slideshow hydrates and images decode after
  // DOMContentLoaded, and window 'load' can be slow with many images, so we
  // don't want to wait for it before sizing.
  function boot() {
    schedule();
    [150, 500, 1200].forEach(function (t) { setTimeout(schedule, t); });
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  // Re-run after the theme swaps sections (e.g. variant change re-renders media).
  document.addEventListener('ahc:rendered', schedule);
})();
