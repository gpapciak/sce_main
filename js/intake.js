/* ==========================================================================
   intake.js — optional anonymous intake form + shared form helpers.

   - Wires single/multi-select option buttons (aria-pressed).
   - Mounts a searchable country picker (programme countries pinned on top,
     type-to-filter for any other country). Reused on complete.html.
   - On submit: stores answers in localStorage under the anonymous token and
     console.logs them. Leaves a clearly-marked Phase-2 Supabase hook.
   - Everything is optional and skippable. No PII, no free-text country.

   Exposes window.SCE_FORMS = { wireOptions, mountCountryPicker }.
   ========================================================================== */
(function () {
  "use strict";

  function t(k, f) { return window.SCE_I18N ? window.SCE_I18N.t(k, f) : (f || k); }
  function url(rel) { return window.SCE_I18N ? window.SCE_I18N.url(rel) : rel; }

  /* Programme core countries — pinned to the top of the picker for quick
     tapping. Listed alphabetically (no ranking implied between programmes).
     These ALSO remain in the full alphabetical list below — pinning is an
     additional shortcut, not a removal. Same list is reused on the completion
     screen so captured country values stay consistent for aggregation. */
  var PINNED = [
    "Australia", "Cameroon", "Chile", "India", "Jordan", "Mexico"
  ];

  /* Full country list (English ISO names). Used for type-to-filter. */
  var COUNTRIES = [
    "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
    "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
    "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon",
    "Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo (Brazzaville)","Congo (Kinshasa)",
    "Costa Rica","Côte d'Ivoire","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic",
    "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland",
    "France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea",
    "Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq",
    "Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo",
    "Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania",
    "Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius",
    "Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia",
    "Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway",
    "Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland",
    "Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
    "São Tomé and Príncipe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands",
    "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland",
    "Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
    "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
    "Vanuatu","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  /* -------------------------------------------------- single/multi options */
  function wireOptions(scope) {
    (scope || document).querySelectorAll("[data-options]").forEach(function (group) {
      var single = group.hasAttribute("data-single");
      group.querySelectorAll(".option").forEach(function (btn) {
        if (btn.getAttribute("type") == null) btn.setAttribute("type", "button");
        if (btn.getAttribute("aria-pressed") == null) btn.setAttribute("aria-pressed", "false");
        btn.addEventListener("click", function () {
          var on = btn.getAttribute("aria-pressed") === "true";
          if (single) {
            group.querySelectorAll(".option").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
            btn.setAttribute("aria-pressed", on ? "false" : "true");
          } else {
            btn.setAttribute("aria-pressed", on ? "false" : "true");
          }
        });
      });
    });
  }

  function readOptions(group) {
    var single = group.hasAttribute("data-single");
    var vals = [];
    group.querySelectorAll('.option[aria-pressed="true"]').forEach(function (b) {
      vals.push(b.getAttribute("data-value"));
    });
    return single ? (vals[0] || null) : vals;
  }

  /* ------------------------------------------------- searchable country picker
     root: a .combo element with a hidden input[data-country-value] and an
     input.combo__input + ul.combo__list. We build/refresh the option list.
     opts.onSelect(value) optional. */
  function mountCountryPicker(root, opts) {
    opts = opts || {};
    var input = root.querySelector(".combo__input");
    var list = root.querySelector(".combo__list");
    var hidden = root.querySelector("[data-country-value]");
    var activeIndex = -1;
    var current = [];

    function optionRow(name, pinned) {
      return '<li class="combo__opt' + (pinned ? " combo__pinned" : "") +
        '" role="option" data-value="' + esc(name) + '">' + esc(name) + "</li>";
    }

    function build(filter) {
      filter = (filter || "").trim().toLowerCase();
      var html = "";
      current = [];

      if (!filter) {
        html += '<li class="combo__group-label" role="presentation">' + esc(t("intake.group.pinned")) + "</li>";
        PINNED.forEach(function (c) { html += optionRow(c, true); current.push(c); });
        // Full alphabetical list — pinned countries are kept here too (the
        // pin is an extra shortcut at the top, not a removal from the list).
        html += '<li class="combo__group-label" role="presentation">' + esc(t("intake.group.all")) + "</li>";
        COUNTRIES.forEach(function (c) {
          html += optionRow(c, PINNED.indexOf(c) !== -1); current.push(c);
        });
      } else {
        var matches = COUNTRIES.filter(function (c) { return c.toLowerCase().indexOf(filter) !== -1; });
        // pinned matches first
        var pinnedM = matches.filter(function (c) { return PINNED.indexOf(c) !== -1; });
        var rest = matches.filter(function (c) { return PINNED.indexOf(c) === -1; });
        pinnedM.concat(rest).forEach(function (c) {
          html += optionRow(c, PINNED.indexOf(c) !== -1); current.push(c);
        });
        if (!current.length) {
          html = '<li class="combo__opt" role="presentation" aria-disabled="true">—</li>';
        }
      }
      list.innerHTML = html;
      activeIndex = -1;
    }

    function open() { build(input.value); list.hidden = false; input.setAttribute("aria-expanded", "true"); }
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); activeIndex = -1; }

    function choose(name) {
      input.value = name;
      if (hidden) hidden.value = name;
      close();
      if (opts.onSelect) opts.onSelect(name);
    }

    function highlight() {
      var rows = list.querySelectorAll(".combo__opt[data-value]");
      rows.forEach(function (r, i) { r.classList.toggle("active", i === activeIndex); });
      if (activeIndex >= 0 && rows[activeIndex]) rows[activeIndex].scrollIntoView({ block: "nearest" });
    }

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    list.setAttribute("role", "listbox");

    input.addEventListener("focus", open);
    input.addEventListener("input", function () { build(input.value); list.hidden = false; });
    input.addEventListener("keydown", function (e) {
      var rows = list.querySelectorAll(".combo__opt[data-value]");
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) open(); activeIndex = Math.min(activeIndex + 1, rows.length - 1); highlight(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); highlight(); }
      else if (e.key === "Enter") {
        if (!list.hidden && activeIndex >= 0 && rows[activeIndex]) { e.preventDefault(); choose(rows[activeIndex].getAttribute("data-value")); }
      } else if (e.key === "Escape") { close(); }
    });
    list.addEventListener("mousedown", function (e) {
      var li = e.target.closest(".combo__opt[data-value]");
      if (li) { e.preventDefault(); choose(li.getAttribute("data-value")); }
    });
    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) close();
    });

    build("");
    list.hidden = true;
    return { value: function () { return hidden ? hidden.value : input.value; }, set: choose };
  }

  /* ------------------------------------------------------ intake page logic */
  function intakeAnswers(form) {
    var get = function (name) {
      var g = form.querySelector('[data-options][data-name="' + name + '"]');
      return g ? readOptions(g) : null;
    };
    var countryHidden = form.querySelector("[data-country-value]");
    return {
      country: countryHidden ? (countryHidden.value || null) : null,
      age: get("age"),
      brings: get("brings") || [],
      found: get("found"),
      education: get("education")
    };
  }

  function showThanks() {
    var form = document.getElementById("intakeForm");
    var thanks = document.getElementById("intakeThanks");
    if (form) form.hidden = true;
    if (thanks) {
      thanks.hidden = false;
      thanks.setAttribute("tabindex", "-1");
      thanks.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function saveIntake(answers) {
    var token = window.SCE_PROGRESS ? window.SCE_PROGRESS.getOrCreateToken() : null;
    var record = { token: token, answers: answers, date: new Date().toISOString() };
    try { localStorage.setItem("sce_intake_v1", JSON.stringify(record)); } catch (e) {}
    // Remember country for the completion metric later (anonymous).
    if (answers.country) { try { localStorage.setItem("sce_country", answers.country); } catch (e) {} }

    // --- Phase 2 hook -------------------------------------------------------
    // Replace this console line with an anonymous INSERT into Supabase
    // (EU region). Send ONLY anonymous, token-linked answers — never a name.
    //   await supabase.from('intake').insert({ token, ...answers, date });
    try { console.log("[intake]", record); } catch (e) {}
    return record;
  }

  function initIntakePage() {
    var form = document.getElementById("intakeForm");
    if (!form) return;

    wireOptions(form);
    var combo = form.querySelector(".combo");
    if (combo) mountCountryPicker(combo);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      saveIntake(intakeAnswers(form));
      showThanks();
    });

    var skip = document.getElementById("intakeSkip");
    if (skip) skip.addEventListener("click", function (e) {
      e.preventDefault();
      window.location.href = url("courses.html");
    });
  }

  window.SCE_FORMS = {
    wireOptions: wireOptions,
    readOptions: readOptions,
    mountCountryPicker: mountCountryPicker
  };

  function start() {
    var ready = window.SCE_I18N && window.SCE_I18N.ready ? window.SCE_I18N.ready : Promise.resolve();
    ready.then(function () {
      initIntakePage();
      if (window.SCE_I18N) window.SCE_I18N.apply(document);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
