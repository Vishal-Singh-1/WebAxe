
(function () {
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function init() {
    const btn = document.getElementById('hamburger-btn');
    const menu = document.getElementById('mobile-menu');
    const backdrop = document.getElementById('menu-backdrop');
    const closeBtn = document.getElementById('mobile-close');

    if (!btn || !menu || !backdrop || !closeBtn) {
      // Elements not present — nothing to do.
      return;
    }

    let lastFocusedBeforeOpen = null;
    let focusableEls = [];
    let firstFocusable = null;
    let lastFocusable = null;

    function refreshFocusable() {
      focusableEls = Array.from(menu.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null || el === closeBtn);
      firstFocusable = focusableEls[0] || closeBtn;
      lastFocusable = focusableEls[focusableEls.length - 1] || closeBtn;
    }

    function openMenu() {
      lastFocusedBeforeOpen = document.activeElement;
      btn.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.classList.add('nav-open');

      refreshFocusable();
      // Move focus to close button or first focusable item in menu
      (firstFocusable || closeBtn).focus();

      document.addEventListener('keydown', onKeyDown);
    }

    function closeMenu(returnFocus = true) {
      btn.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('nav-open');

      document.removeEventListener('keydown', onKeyDown);
      if (returnFocus && lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') {
        lastFocusedBeforeOpen.focus();
      }
    }

    function toggleMenu() {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      if (expanded) closeMenu();
      else openMenu();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        return;
      }

      if (e.key === 'Tab') {
        // Focus trap: keep focus inside the menu while it's open
        refreshFocusable();
        if (focusableEls.length === 0) {
          // nothing to trap
          e.preventDefault();
          closeBtn.focus();
          return;
        }

        const activeIndex = focusableEls.indexOf(document.activeElement);

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstFocusable || activeIndex === 0) {
            e.preventDefault();
            (lastFocusable || firstFocusable).focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastFocusable || activeIndex === focusableEls.length - 1) {
            e.preventDefault();
            (firstFocusable || lastFocusable).focus();
          }
        }
      }
    }

    // Event listeners
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
    });

    backdrop.addEventListener('click', (e) => {
      closeMenu();
    });

    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
    });

    // Close when a link inside the menu is clicked (delegated)
    menu.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.tagName && t.tagName.toLowerCase() === 'a') {
        // allow navigation but close the menu
        closeMenu(false);
      }
    });

    // Ensure aria attributes initial state
    btn.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();