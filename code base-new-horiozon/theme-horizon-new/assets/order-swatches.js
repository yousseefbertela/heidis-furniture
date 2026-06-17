import { Component } from '@theme/component';
import { CartAddEvent } from '@theme/events';
import { fetchConfig } from '@theme/utilities';

/**
 * Order Swatches drawer.
 *
 * Lets a customer pick up to N fabric/colour swatches for a product and order them
 * as physical samples. Each selected swatch is added to the cart as one line item of a
 * configurable "sample" product, with the colour name + code stored as line-item
 * properties. After adding, the theme cart drawer is opened so the shopper can keep
 * browsing the product they were viewing.
 *
 * Markup contract (see blocks/order-swatches.liquid):
 *   <order-swatches-component data-max-swatches data-sample-variant-id data-order-label>
 *     <button on:click="/open">…trigger…</button>
 *     <dialog ref="drawer">            <!-- opened via showModal() → top layer -->
 *       <button on:click="/close">…close…</button>
 *       <button data-swatch-card on:click="/toggleSwatch" aria-pressed="false">…</button> …
 *       <p ref="message" role="status"></p>
 *       <span ref="selectionLabel"></span>
 *       <span ref="previewSlots[]"></span> …
 *       <button ref="orderButton" on:click="/submit">…</button>
 *     </dialog>
 *   </order-swatches-component>
 *
 * @typedef {object} Refs
 * @property {HTMLDialogElement} drawer
 * @property {HTMLButtonElement} orderButton
 * @property {HTMLElement} [message]
 * @property {HTMLElement} [selectionLabel]
 * @property {HTMLElement[]} [previewSlots]
 * @property {HTMLElement} [popover]
 * @property {HTMLImageElement} [popoverImg]
 * @property {HTMLElement} [popoverName]
 * @property {HTMLElement} [popoverCode]
 * @property {HTMLButtonElement} [popoverAdd]
 *
 * @extends {Component<Refs>}
 */
class OrderSwatchesComponent extends Component {
  requiredRefs = ['drawer', 'orderButton'];

  /** @type {Map<string, {name: string, code: string, image: string, color: string}>} */
  #selected = new Map();

  /** @type {Element | null} */
  #lastFocused = null;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #messageTimer;

  /** @type {Record<string, {name:string, code:string, image:string, color:string}> | null} */
  #fabricMap = null;

  /** @type {string} */
  #hoveredValue = '';

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #popHideTimer;

  /** @type {boolean} */
  #popoverOpen = false;

  /** @type {boolean} */
  #hoverEnabled = false;

  /** @returns {number} */
  get max() {
    const value = Number(this.dataset.maxSwatches);
    return Number.isFinite(value) && value > 0 ? value : 5;
  }

  /** @returns {string} */
  get sampleVariantId() {
    return (this.dataset.sampleVariantId || '').trim();
  }

  /** @returns {string} */
  get baseLabel() {
    return this.dataset.orderLabel || 'Order Swatches';
  }

  /** @type {(event: Event) => void} */
  #onCancel = (event) => {
    // Animate our own slide-out instead of the instant native close.
    event.preventDefault();
    this.close();
  };

  /** @type {(event: MouseEvent) => void} */
  #onBackdropClick = (event) => {
    if (event.target === this.refs.drawer) this.close();
  };

  /**
   * Delegated hover/focus handler for the native PDP swatches. Shows a fabric
   * preview popover for the swatch under the pointer; schedules a hide otherwise.
   * @type {(event: Event) => void}
   */
  #onPointerOver = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const popover = this.refs.popover;
    // Keep the popover open while the pointer/focus is inside it.
    if (popover instanceof HTMLElement && popover.contains(target)) {
      clearTimeout(this.#popHideTimer);
      return;
    }

    // Only react to the main product variant picker's swatches.
    const label = target.closest('.variant-option__button-label--has-swatch');
    if (label && label.closest('variant-picker')) {
      const input = label.querySelector('input');
      const value = input ? input.value || input.getAttribute('aria-label') || '' : '';
      if (value) {
        clearTimeout(this.#popHideTimer);
        this.#showPopover(String(value), label);
        return;
      }
    }

    if (this.#popoverOpen) this.#scheduleHide();
  };

  /** @type {() => void} */
  #onScrollHide = () => {
    if (this.#popoverOpen) this.#hidePopover();
  };

  /** @type {() => void} */
  #onVariantUpdate = () => this.#hidePopover();

  connectedCallback() {
    super.connectedCallback();
    const drawer = this.refs.drawer;
    if (drawer instanceof HTMLElement) {
      drawer.addEventListener('cancel', this.#onCancel);
      drawer.addEventListener('click', this.#onBackdropClick);
    }

    // Hover-preview popover only on devices that actually hover (skip touch).
    this.#hoverEnabled = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
    if (this.#hoverEnabled) {
      document.addEventListener('pointerover', this.#onPointerOver);
      document.addEventListener('focusin', this.#onPointerOver);
      window.addEventListener('scroll', this.#onScrollHide, { passive: true });
      document.addEventListener('variant:update', this.#onVariantUpdate);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    const drawer = this.refs.drawer;
    if (drawer instanceof HTMLElement) {
      drawer.removeEventListener('cancel', this.#onCancel);
      drawer.removeEventListener('click', this.#onBackdropClick);
    }
    if (this.#hoverEnabled) {
      document.removeEventListener('pointerover', this.#onPointerOver);
      document.removeEventListener('focusin', this.#onPointerOver);
      window.removeEventListener('scroll', this.#onScrollHide);
      document.removeEventListener('variant:update', this.#onVariantUpdate);
    }
    this.#unlockScroll();
  }

  /* ----------------------------------------------------------------- open/close */

  /** @param {Event} [event] */
  open(event) {
    event?.preventDefault();
    const drawer = /** @type {HTMLDialogElement} */ (this.refs.drawer);
    this.#lastFocused = document.activeElement;

    // showModal() promotes the dialog to the browser top layer, so it renders
    // above the sticky header / any stacking context. Focus trap + inert
    // background come for free.
    if (typeof drawer.showModal === 'function') {
      if (!drawer.open) drawer.showModal();
    } else {
      drawer.setAttribute('open', '');
    }

    this.#lockScroll();
    // Next frame so the slide-in transition runs from the closed position.
    requestAnimationFrame(() => drawer.classList.add('is-active'));
  }

  /** @param {Event} [event] */
  close(event) {
    event?.preventDefault();
    const drawer = /** @type {HTMLDialogElement} */ (this.refs.drawer);
    if (!drawer.classList.contains('is-active') && !drawer.open) return;

    drawer.classList.remove('is-active');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      drawer.removeEventListener('transitionend', onTransitionEnd);
      try {
        if (drawer.open) drawer.close();
      } catch (error) {
        drawer.removeAttribute('open');
      }
      this.#unlockScroll();
      if (this.#lastFocused instanceof HTMLElement) this.#lastFocused.focus();
    };
    /** @param {TransitionEvent} event */
    const onTransitionEnd = (event) => {
      if (event.target === drawer && event.propertyName === 'transform') finish();
    };
    drawer.addEventListener('transitionend', onTransitionEnd);
    // Fallback if the transition is skipped (reduced motion, display:none, etc.).
    setTimeout(finish, 480);
  }

  #lockScroll() {
    document.body.style.overflow = 'hidden';
  }

  #unlockScroll() {
    document.body.style.overflow = '';
  }

  /* ------------------------------------------------------------------ selection */

  /** @param {Event} event */
  toggleSwatch(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest('[data-swatch-card]');
    if (!(card instanceof HTMLElement)) return;

    const value = card.dataset.optionValue || '';
    if (!value) return;

    if (this.#selected.has(value)) {
      this.#selected.delete(value);
      card.classList.remove('is-selected');
      card.setAttribute('aria-pressed', 'false');
    } else {
      if (this.#selected.size >= this.max) {
        this.#flash(`You can select up to ${this.max} swatches.`);
        return;
      }
      this.#selected.set(value, {
        name: value,
        code: card.dataset.swatchCode || value,
        image: card.dataset.swatchImage || '',
        color: card.dataset.swatchColor || '',
      });
      card.classList.add('is-selected');
      card.setAttribute('aria-pressed', 'true');
      this.#clearMessage();
    }

    this.#renderPreview();
    this.#updateOrderButton();
  }

  #renderPreview() {
    const slots = this.refs.previewSlots;
    if (!Array.isArray(slots) || slots.length === 0) return;

    slots.forEach((slot) => {
      slot.innerHTML = '';
      slot.classList.remove('is-filled');
    });

    let index = 0;
    for (const swatch of this.#selected.values()) {
      const slot = slots[index];
      if (!slot) break;
      if (swatch.image) {
        const img = document.createElement('img');
        img.src = swatch.image;
        img.alt = swatch.name;
        slot.appendChild(img);
      } else if (swatch.color) {
        const block = document.createElement('span');
        block.className = 'order-swatches__slot-color';
        block.style.background = swatch.color;
        slot.appendChild(block);
      }
      slot.classList.add('is-filled');
      index++;
    }
  }

  #updateOrderButton() {
    const count = this.#selected.size;
    const button = this.refs.orderButton;
    if (button) {
      button.textContent =
        count > 0 ? `Order ${count} ${count === 1 ? 'Swatch' : 'Swatches'}` : this.baseLabel;
    }
    const label = this.refs.selectionLabel;
    if (label instanceof HTMLElement) {
      label.textContent = count > 0 ? `${count} of ${this.max} selected` : `Select up to ${this.max}`;
    }
  }

  /* --------------------------------------------------------------------- submit */

  /** @param {Event} [event] */
  async submit(event) {
    event?.preventDefault();

    if (this.#selected.size === 0) {
      this.#flash('Please select at least one swatch to order.');
      return;
    }

    const button = this.refs.orderButton;
    button.disabled = true;
    button.classList.add('is-loading');

    const ok = await this.#addSamples(Array.from(this.#selected.values()));

    if (!ok) {
      button.disabled = false;
      button.classList.remove('is-loading');
      return;
    }

    this.#reset();
    this.close();
    this.#openCart();
  }

  /**
   * Adds one sample line item per selection to the cart, then dispatches the
   * theme CartAddEvent so the cart drawer refreshes.
   * @param {Array<{name: string, code: string}>} selections
   * @returns {Promise<boolean>} whether the add succeeded
   */
  async #addSamples(selections) {
    const variantId = Number(this.sampleVariantId);
    if (!variantId) {
      this.#flash('Swatch ordering is unavailable right now.');
      console.error('[order-swatches] Missing or invalid data-sample-variant-id');
      return false;
    }

    const items = selections.map((swatch) => ({
      id: variantId,
      quantity: 1,
      properties: { Swatch: swatch.name, Code: swatch.code, _swatch_sample: 'true' },
    }));

    const sectionIds = Array.from(document.querySelectorAll('cart-items-component'))
      .map((node) => (node instanceof HTMLElement ? node.dataset.sectionId : null))
      .filter(Boolean);

    const payload = { items, sections: sectionIds.join(','), sections_url: window.location.pathname };

    try {
      const response = await fetch(
        Theme.routes.cart_add_url,
        fetchConfig('json', { body: JSON.stringify(payload) })
      );
      const data = await response.json();

      if (data.status) {
        // Shopify returns a non-zero `status` on error (e.g. sold out).
        this.#flash(data.description || data.message || 'Something went wrong. Please try again.');
        return false;
      }

      // Fetch the fresh cart so the drawer count is accurate.
      let cart;
      try {
        cart = await (await fetch(`${Theme.routes.cart_url}.js`)).json();
      } catch (error) {
        cart = undefined;
      }

      document.dispatchEvent(
        new CartAddEvent(cart, this.id || 'order-swatches', {
          source: 'order-swatches-component',
          itemCount: items.length,
          sections: data.sections,
        })
      );

      return true;
    } catch (error) {
      console.error('[order-swatches] add to cart failed', error);
      this.#flash('Something went wrong. Please try again.');
      return false;
    }
  }

  /* ----------------------------------------------------------- hover popover */

  /** @returns {Record<string, {name:string, code:string, image:string, color:string, info:string, care:string, content:string, tags:string[]}>} */
  get fabricMap() {
    if (this.#fabricMap) return this.#fabricMap;
    /** @type {Record<string, {name:string, code:string, image:string, color:string, info:string, care:string, content:string, tags:string[]}>} */
    const map = {};
    for (const card of this.querySelectorAll('[data-swatch-card]')) {
      if (!(card instanceof HTMLElement)) continue;
      const name = (card.dataset.optionValue || '').trim();
      if (!name) continue;
      map[name.toLowerCase()] = {
        name,
        code: card.dataset.swatchCode || name,
        image: card.dataset.swatchImage || '',
        color: card.dataset.swatchColor || '',
        info: (card.dataset.swatchInfo || '').trim(),
        care: (card.dataset.swatchCare || '').trim(),
        content: (card.dataset.swatchContent || '').trim(),
        tags: (card.dataset.swatchTags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
    }
    this.#fabricMap = map;
    return map;
  }

  /** @param {string} value @param {Element} anchor */
  #showPopover(value, anchor) {
    const popover = this.refs.popover;
    if (!(popover instanceof HTMLElement)) return;
    const data = this.fabricMap[value.toLowerCase()];
    if (!data) return;

    this.#hoveredValue = data.name;

    const img = this.refs.popoverImg;
    if (img instanceof HTMLImageElement) {
      if (data.image) {
        img.src = data.image;
        img.alt = data.name;
        img.style.display = '';
      } else {
        img.removeAttribute('src');
        img.style.display = 'none';
      }
    }
    
    // Name is the real option-value name — show it as-is.
    const nameEl = this.refs.popoverName;
    if (nameEl instanceof HTMLElement) nameEl.textContent = data.name;

    // SKU / code
    const codeEl = this.refs.popoverCode;
    if (codeEl instanceof HTMLElement) {
      const displayCode = (data.code || '').toUpperCase().trim();
      if (displayCode) {
        codeEl.textContent = `SKU: ${displayCode}`;
        codeEl.style.display = 'block';
      } else {
        codeEl.style.display = 'none';
      }
    }

    // Tags (pills) — real data only; hide the container when there are none.
    const tagsEl = this.refs.popoverTags;
    if (tagsEl instanceof HTMLElement) {
      tagsEl.innerHTML = '';
      data.tags.forEach((tag) => {
        const span = document.createElement('span');
        span.className = 'order-swatches__popover-tag';
        span.textContent = tag;
        tagsEl.appendChild(span);
      });
      tagsEl.hidden = data.tags.length === 0;
    }

    // Detail rows (INFO, CARE, CONTENT) — show only rows that have real data,
    // and hide the whole block when none do. Never invents fabric facts.
    let anyDetail = false;
    /** @param {HTMLElement | undefined} el @param {string} text */
    const setRow = (el, text) => {
      if (!(el instanceof HTMLElement)) return;
      const row = el.closest('.order-swatches__popover-detail-row');
      if (text) {
        el.textContent = text;
        if (row instanceof HTMLElement) row.hidden = false;
        anyDetail = true;
      } else if (row instanceof HTMLElement) {
        row.hidden = true;
      }
    };
    setRow(this.refs.popoverInfoText, data.info);
    setRow(this.refs.popoverCareText, data.care);
    setRow(this.refs.popoverContentText, data.content);

    const detailsEl = this.querySelector('.order-swatches__popover-details');
    if (detailsEl instanceof HTMLElement) detailsEl.hidden = !anyDetail;

    if (!this.#popoverOpen) {
      try {
        if (typeof popover.showPopover === 'function') popover.showPopover();
        else popover.setAttribute('data-open', '');
      } catch (error) {
        popover.setAttribute('data-open', '');
      }
      this.#popoverOpen = true;
    }
    this.#positionPopover(anchor);
  }

  /** @param {Element} anchor */
  #positionPopover(anchor) {
    const popover = this.refs.popover;
    if (!(popover instanceof HTMLElement)) return;

    // Find the product media gallery — this is the left column container.
    const gallery = document.querySelector('media-gallery')
      || document.querySelector('.product-media-gallery')
      || document.querySelector('.product-information__media');

    if (gallery) {
      // Overlay the popover on the product image area (reference style).
      const g = gallery.getBoundingClientRect();
      const margin = 0;

      // Position: top-right corner of the media gallery, flush.
      popover.style.left = `${Math.round(g.right - popover.offsetWidth)}px`;
      popover.style.top = `${Math.round(g.top)}px`;
      popover.style.maxHeight = `${Math.round(g.height)}px`;
    } else {
      // Fallback: position next to the swatch anchor.
      const a = anchor.getBoundingClientRect();
      const pr = popover.getBoundingClientRect();
      const margin = 8;
      const gap = 12;

      let left;
      if (a.right + gap + pr.width <= window.innerWidth - margin) {
        left = a.right + gap;
      } else if (a.left - gap - pr.width >= margin) {
        left = a.left - gap - pr.width;
      } else {
        left = Math.max(margin, Math.min(a.left + a.width / 2 - pr.width / 2, window.innerWidth - pr.width - margin));
      }

      let top = a.top + a.height / 2 - pr.height / 2;
      top = Math.max(margin, Math.min(top, window.innerHeight - pr.height - margin));

      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    }
  }

  /** @param {number} [delay] */
  #scheduleHide(delay = 200) {
    clearTimeout(this.#popHideTimer);
    this.#popHideTimer = setTimeout(() => this.#hidePopover(), delay);
  }

  #hidePopover() {
    const popover = this.refs.popover;
    if (popover instanceof HTMLElement && this.#popoverOpen) {
      try {
        if (typeof popover.hidePopover === 'function') popover.hidePopover();
        else popover.removeAttribute('data-open');
      } catch (error) {
        popover.removeAttribute('data-open');
      }
    }
    this.#popoverOpen = false;
    this.#hoveredValue = '';
  }

  /** Quick-add the currently hovered swatch from the popover. @param {Event} [event] */
  async addHovered(event) {
    event?.preventDefault();
    const value = this.#hoveredValue;
    if (!value) return;
    const data = this.fabricMap[value.toLowerCase()];
    if (!data) return;

    const button = this.refs.popoverAdd;
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
      button.classList.add('is-loading');
    }
    const ok = await this.#addSamples([{ name: data.name, code: data.code }]);
    if (button instanceof HTMLButtonElement) {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
    if (ok) {
      this.#hidePopover();
      this.#openCart();
    }
  }

  /** Close the popover when the X button is clicked. @param {Event} [event] */
  hidePopoverClick(event) {
    event?.preventDefault();
    this.#hidePopover();
  }

  #openCart() {
    const cartDrawer = document.querySelector('cart-drawer-component');
    if (cartDrawer && typeof (/** @type {any} */ (cartDrawer).open) === 'function') {
      /** @type {any} */ (cartDrawer).open();
    } else {
      window.location.href = Theme.routes.cart_url;
    }
  }

  #reset() {
    this.#selected.clear();
    for (const card of this.querySelectorAll('[data-swatch-card]')) {
      card.classList.remove('is-selected');
      card.setAttribute('aria-pressed', 'false');
    }
    this.#renderPreview();
    this.#updateOrderButton();
    const button = this.refs.orderButton;
    button.disabled = false;
    button.classList.remove('is-loading');
  }

  /* -------------------------------------------------------------------- message */

  /** @param {string} text */
  #flash(text) {
    const message = this.refs.message;
    if (!(message instanceof HTMLElement)) {
      return;
    }
    message.textContent = text;
    message.hidden = false;
    clearTimeout(this.#messageTimer);
    this.#messageTimer = setTimeout(() => this.#clearMessage(), 3500);
  }

  #clearMessage() {
    const message = this.refs.message;
    if (message instanceof HTMLElement) {
      message.hidden = true;
      message.textContent = '';
    }
  }
}

if (!customElements.get('order-swatches-component')) {
  customElements.define('order-swatches-component', OrderSwatchesComponent);
}
