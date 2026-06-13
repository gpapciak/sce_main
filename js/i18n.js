/* ==========================================================================
   i18n.js — runtime, buildless internationalisation.

   - All user-facing strings live in i18n/<lang>.json (no hardcoded text).
   - Loads the chosen language at runtime, swaps strings into the DOM,
     and sets <html lang> / <html dir>.
   - English is the only LIVE language for now; the other four are
     scaffolded. Choosing a non-live language stores the preference but
     falls back to English CONTENT (never a broken / all-"TODO" page) and
     surfaces a friendly "coming soon" state.
   - Paths are resolved relative to THIS script's own URL, so everything
     works when served from a subpath (e.g. /sce_main/) or from root.
   ========================================================================== */
(function () {
  "use strict";

  // Resolve the site root from this script's own location (subpath-safe).
  var JS_DIR = new URL(".", document.currentScript.src);
  var ROOT = new URL("../", JS_DIR).href; // always ends with "/"

  // Language registry.
  //   live:true  → usable now (no "coming soon" gate).
  //   en  — fully live (interface + English course media).
  //   hi  — live as an INTERFACE language; its courses load the English
  //         modules (there is no Hindi course media, by design — see
  //         catalog.contentLang). The launcher shows a clear note. Interface
  //         text becomes Hindi as soon as i18n/hi.json is translated; until
  //         then it falls back to English per-key.
  //   es/fr/ar — "coming soon" until both their interface strings AND their
  //         course media (sce_courses_xx1/xx2) are placed.
  //   draft:true → show a "preliminary translation" banner (per-language; the
  //     single mechanism serves fr/ar later — flip on when their first-pass
  //     translation ships, remove once a native speaker signs it off).
  var LANGS = [
    { code: "en", native: "English",  dir: "ltr", live: true  },
    { code: "es", native: "Español",  dir: "ltr", live: true, draft: true },
    { code: "fr", native: "Français", dir: "ltr", live: false },
    { code: "hi", native: "हिन्दी",     dir: "ltr", live: true  },
    { code: "ar", native: "العربية",   dir: "rtl", live: false }
  ];
  var LANG_KEY = "sce_lang";
  var DEFAULT = "en";

  function byCode(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return null;
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* private mode / full — ignore */ }
  }

  // The language the learner CHOSE (may not be live).
  function chosenLang() {
    var c = safeGet(LANG_KEY);
    return byCode(c) ? c : DEFAULT;
  }

  // The language whose CONTENT we actually render (live only → English fallback).
  function effectiveLang(chosen) {
    var meta = byCode(chosen);
    return meta && meta.live ? chosen : DEFAULT;
  }

  var strings = {};   // effective-language strings
  var enStrings = {}; // English fallback, always loaded

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function t(key, fallback) {
    if (strings && Object.prototype.hasOwnProperty.call(strings, key) &&
        strings[key] && strings[key].indexOf("TODO") !== 0) {
      return strings[key];
    }
    if (enStrings && Object.prototype.hasOwnProperty.call(enStrings, key)) {
      return enStrings[key];
    }
    return fallback != null ? fallback : key;
  }

  function applyTranslations(scope) {
    var root = scope || document;

    // Text content
    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    // Inline HTML (our own JSON only — used for copy with <strong>/line breaks)
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    // Attributes: data-i18n-attr="placeholder:key; aria-label:other"
    root.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var bits = pair.split(":");
        if (bits.length === 2) {
          el.setAttribute(bits[0].trim(), t(bits[1].trim()));
        }
      });
    });
  }

  function applyDocumentLang() {
    var chosen = chosenLang();
    var eff = effectiveLang(chosen);
    var effMeta = byCode(eff) || byCode(DEFAULT);
    // Content is in the effective language → lang attr reflects what's read.
    document.documentElement.setAttribute("lang", eff);
    document.documentElement.setAttribute("dir", effMeta.dir);
    document.documentElement.setAttribute("data-pref-lang", chosen);
  }

  function setLang(code) {
    if (!byCode(code)) return;
    safeSet(LANG_KEY, code);
  }

  var readyResolve;
  var ready = new Promise(function (res) { readyResolve = res; });

  function init() {
    applyDocumentLang();
    var chosen = chosenLang();
    var eff = effectiveLang(chosen);

    var enURL = ROOT + "i18n/en.json";
    var effURL = ROOT + "i18n/" + eff + ".json";

    // Always have English available as the ultimate fallback.
    var pEn = fetchJSON(enURL).catch(function () { return {}; });
    var pEff = eff === "en" ? pEn : fetchJSON(effURL).catch(function () { return null; });

    return Promise.all([pEn, pEff]).then(function (res) {
      enStrings = res[0] || {};
      strings = res[1] || enStrings;
      applyTranslations(document);
      readyResolve(api);
      document.dispatchEvent(new CustomEvent("i18n:ready", { detail: api }));
      return api;
    });
  }

  var api = {
    ROOT: ROOT,
    LANGS: LANGS,
    t: t,
    apply: applyTranslations,
    setLang: setLang,
    chosenLang: chosenLang,
    effectiveLang: function () { return effectiveLang(chosenLang()); },
    isLive: function () { var m = byCode(chosenLang()); return !!(m && m.live); },
    meta: byCode,
    ready: ready,
    // Resolve a path against the site root (subpath-safe).
    url: function (rel) { return ROOT + String(rel).replace(/^\//, ""); }
  };

  window.SCE_I18N = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
