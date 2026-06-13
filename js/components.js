/* ==========================================================================
   components.js — shared header / footer / language selector.

   Injected client-side so the chrome isn't duplicated across pages.
   All links and the logo are resolved through SCE_I18N.url(), i.e. relative
   to the site root derived from the script URL — works at a subpath.

   Usage in a page:
     <div data-include="header"></div>   ... page content ...   <div data-include="footer"></div>
   ========================================================================== */
(function () {
  "use strict";

  function url(rel) {
    return window.SCE_I18N ? window.SCE_I18N.url(rel) : rel;
  }

  function headerHTML() {
    var logo = url("assets/logo/SCE_logo_transparent_true.png");
    return '' +
      '<a class="skip-link" href="#main" data-i18n="a11y.skip">Skip to content</a>' +
      '<header class="site-header">' +
        '<div class="container site-header__inner">' +
          '<a class="brand" href="' + url("index.html") + '" data-i18n-attr="aria-label:brand.home">' +
            '<img src="' + logo + '" alt="Second Chance" width="168" height="59">' +
          '</a>' +
          '<nav class="header-nav" data-i18n-attr="aria-label:nav.label">' +
            '<a class="nav-link" href="' + url("courses.html") + '" data-i18n="nav.courses">Courses</a>' +
            '<a class="nav-link" href="' + url("help/how-to.html") + '" data-i18n="nav.howto">How it works</a>' +
            '<button type="button" class="lang-chip" id="langChipBtn" data-i18n-attr="aria-label:nav.language">' +
              globeSVG() +
              '<span id="langChipLabel">English</span>' +
            '</button>' +
            '<button type="button" class="menu-toggle" id="menuToggle" aria-expanded="false" ' +
              'aria-controls="menuDrawer" data-i18n-attr="aria-label:nav.menu">' +
              menuSVG() +
            '</button>' +
          '</nav>' +
        '</div>' +
        '<div class="menu-drawer" id="menuDrawer">' +
          '<div class="container">' +
            '<ul>' +
              '<li><a href="' + url("courses.html") + '" data-i18n="nav.courses">Courses</a></li>' +
              '<li><a href="' + url("help/why.html") + '" data-i18n="nav.why">Why these courses</a></li>' +
              '<li><a href="' + url("help/how-to.html") + '" data-i18n="nav.howto">How it works</a></li>' +
              '<li><a href="' + url("help/tips.html") + '" data-i18n="nav.tips">Tips</a></li>' +
              '<li><a href="' + url("help/faq.html") + '" data-i18n="nav.faq">FAQ</a></li>' +
              '<li><a href="' + url("help/contact.html") + '" data-i18n="nav.contact">Contact</a></li>' +
              '<li><a href="' + url("intake.html") + '" data-i18n="nav.intake">Quick questions</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  function footerHTML() {
    var year = document.documentElement.getAttribute("data-year") || "";
    return '' +
      '<footer class="site-footer">' +
        '<div class="container site-footer__inner">' +
          '<div>' +
            '<span class="wordmark">Second Chance</span> ' +
            '<span data-i18n="footer.tagline">Foundational courses</span>' +
          '</div>' +
          '<nav data-i18n-attr="aria-label:footer.label">' +
            '<a href="' + url("help/why.html") + '" data-i18n="nav.why">Why these courses</a>' +
            '<a href="' + url("help/how-to.html") + '" data-i18n="nav.howto">How it works</a>' +
            '<a href="' + url("help/faq.html") + '" data-i18n="nav.faq">FAQ</a>' +
            '<a href="' + url("help/contact.html") + '" data-i18n="nav.contact">Contact</a>' +
          '</nav>' +
        '</div>' +
        '<div class="container">' +
          '<p class="muted" style="font-size:var(--text-xs); margin-block-start:var(--space-3)" ' +
             'data-i18n="footer.privacy">This site is anonymous. It never asks for your name or email.</p>' +
        '</div>' +
      '</footer>';
  }

  function langDialogHTML() {
    var langs = window.SCE_I18N ? window.SCE_I18N.LANGS : [];
    var chosen = window.SCE_I18N ? window.SCE_I18N.chosenLang() : "en";
    var items = langs.map(function (l) {
      var current = l.code === chosen ? ' aria-current="true"' : "";
      var soon = l.live ? "" :
        '<span class="soon" data-i18n="lang.soon">Coming soon</span>';
      return '<button type="button" class="lang-option" data-lang="' + l.code + '"' + current + '>' +
               '<span class="native" lang="' + l.code + '" dir="' + l.dir + '">' + l.native + '</span>' +
               soon +
             '</button>';
    }).join("");
    return '' +
      '<dialog class="lang-dialog" id="langDialog">' +
        '<h2 data-i18n="lang.choose">Choose your language</h2>' +
        '<div class="lang-grid">' + items + '</div>' +
        '<button type="button" class="btn btn--secondary lang-dialog__close" id="langDialogClose" ' +
          'data-i18n="common.close">Close</button>' +
      '</dialog>';
  }

  function globeSVG() {
    return '<svg class="globe" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
  }
  function menuSVG() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  }

  function wireHeader() {
    var toggle = document.getElementById("menuToggle");
    var drawer = document.getElementById("menuDrawer");
    if (toggle && drawer) {
      toggle.addEventListener("click", function () {
        var open = drawer.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    var chipBtn = document.getElementById("langChipBtn");
    var dialog = document.getElementById("langDialog");
    if (chipBtn && dialog) {
      chipBtn.addEventListener("click", function () {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      });
      var closeBtn = document.getElementById("langDialogClose");
      if (closeBtn) closeBtn.addEventListener("click", function () { dialog.close(); });
      dialog.addEventListener("click", function (e) {
        // click on backdrop closes
        if (e.target === dialog) dialog.close();
      });
      dialog.querySelectorAll(".lang-option").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var code = btn.getAttribute("data-lang");
          window.SCE_I18N.setLang(code);
          // Reload so strings + dir re-render cleanly everywhere.
          window.location.reload();
        });
      });
    }

    // Reflect the displayed language on the header chip.
    var label = document.getElementById("langChipLabel");
    if (label && window.SCE_I18N) {
      var meta = window.SCE_I18N.meta(window.SCE_I18N.chosenLang());
      if (meta) label.textContent = meta.native;
    }
  }

  function inject() {
    document.querySelectorAll('[data-include="header"]').forEach(function (slot) {
      slot.outerHTML = headerHTML() + langDialogHTML();
    });
    document.querySelectorAll('[data-include="footer"]').forEach(function (slot) {
      slot.outerHTML = footerHTML();
    });
    wireHeader();
    if (window.SCE_I18N) window.SCE_I18N.apply(document);
  }

  function start() {
    inject();
    // Re-apply translations once strings have loaded (covers race on first paint).
    if (window.SCE_I18N && window.SCE_I18N.ready) {
      window.SCE_I18N.ready.then(function () {
        window.SCE_I18N.apply(document);
        var label = document.getElementById("langChipLabel");
        if (label) {
          var meta = window.SCE_I18N.meta(window.SCE_I18N.chosenLang());
          if (meta) label.textContent = meta.native;
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
