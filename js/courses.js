/* ==========================================================================
   courses.js — catalog loading + tile/lesson rendering.

   Drives:
     - courses.html  (#courseGrid)  — one tile per course, with progress
     - course.html   (#courseView)  — a course's modules, statuses, actions
   Reads data/catalog.json (subpath-safe) and combines it with SCE_PROGRESS.
   ========================================================================== */
(function () {
  "use strict";

  function t(k, f) { return window.SCE_I18N ? window.SCE_I18N.t(k, f) : (f || k); }
  function url(rel) { return window.SCE_I18N ? window.SCE_I18N.url(rel) : rel; }
  function getParam(n) {
    try { return new URLSearchParams(window.location.search).get(n); }
    catch (e) { return null; }
  }
  function el(html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    return tpl.content.firstChild;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  var ICONS = {
    welcome: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7z"/></svg>',
    growth: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"/><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z"/><path d="M12 12C12 9 10 7 7 7c0 3 2 5 5 5Z"/></svg>',
    gender: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 18h6"/></svg>',
    leadership: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18l3-9 4 4 4-7 4 5 3-3"/><path d="M3 21h18"/></svg>',
    digital: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2z"/><path d="M17 3v16"/></svg>'
  };
  function icon(name) { return ICONS[name] || ICONS.book; }

  var CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var ARROW = '<svg class="arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  // Lesson titles are authored content read from the package manifest (a
  // plain string); fall back to an i18n key only if a string isn't present.
  function lessonTitle(lesson) {
    return lesson.title || (lesson.titleKey ? t(lesson.titleKey) : lesson.id);
  }

  function modulesLabel(n) {
    return n + " " + t(n === 1 ? "courses.modulesOne" : "courses.modulesMany");
  }
  function ofDone(done, total) {
    return done + " " + t("courses.of") + " " + total + " " + t("courses.done");
  }

  function courseState(course) {
    var P = window.SCE_PROGRESS;
    var lessons = lessonsOf(course);
    var ids = lessons.map(function (l) { return l.id; });
    var counts = P ? P.courseCounts(course.id, lessons.length) : { done: 0, total: lessons.length };
    var complete = P ? P.isCourseComplete(course.id, ids) : false;
    var started = counts.done > 0 || lessons.some(function (l) {
      return P && P.getLessonStatus(course.id, l.id) === "in-progress";
    });
    return { counts: counts, complete: complete, started: started };
  }

  var CATALOG = null;
  function loadCatalog() {
    return fetch(url("data/catalog.json"), { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("catalog " + r.status); return r.json(); })
      .then(function (cat) { CATALOG = cat; return cat; })
      .catch(function () { return { courses: [] }; });
  }
  // content language = the language whose course MEDIA we load (Hindi -> en).
  function contentLang() {
    var ui = window.SCE_I18N ? SCE_I18N.chosenLang() : "en";
    var map = CATALOG && CATALOG.contentLang;
    return (map && map[ui]) || (window.SCE_I18N ? SCE_I18N.effectiveLang() : "en");
  }
  // Per-language lesson list (catalog v3: course.lessons is keyed by language).
  function lessonsOf(course) {
    var L = course.lessons || {};
    if (Array.isArray(L)) return L;             // back-compat if ever an array
    return L[contentLang()] || L.en || [];
  }

  /* ---------------------------------------------------------- courses index */
  function renderIndex(grid, catalog) {
    grid.innerHTML = "";
    if (!catalog.courses || !catalog.courses.length) {
      grid.appendChild(el('<p class="muted">' + esc(t("courses.empty")) + "</p>"));
      return;
    }
    catalog.courses.forEach(function (course) {
      var st = courseState(course);
      var pct = st.counts.total ? Math.round((st.counts.done / st.counts.total) * 100) : 0;
      var action = st.complete ? t("courses.review")
        : st.started ? t("courses.continue") : t("courses.start");

      var tile = el(
        '<a class="tile" href="' + url("course.html") + "?course=" + encodeURIComponent(course.id) + '">' +
          '<div class="tile__icon">' + icon(course.icon) + "</div>" +
          '<h3 class="tile__title">' + esc(t(course.titleKey)) + "</h3>" +
          '<p class="tile__meta">' + esc(modulesLabel(lessonsOf(course).length)) + "</p>" +
          '<p class="soft" style="font-size:var(--text-sm)">' + esc(t(course.descKey)) + "</p>" +
          '<div class="progress-meter" style="margin-block-start:var(--space-3)">' +
            '<div class="progress-meter__label">' +
              "<span>" + esc(st.complete ? t("courses.completed") : ofDone(st.counts.done, st.counts.total)) + "</span>" +
            "</div>" +
            '<div class="progress-track"><div class="progress-fill' + (st.complete ? " is-complete" : "") +
              '" style="width:' + pct + '%"></div></div>' +
          "</div>" +
          '<div class="tile__foot">' +
            statusBadge(st.complete ? "completed" : st.started ? "in-progress" : "not-started") +
            '<span class="btn btn--secondary" style="pointer-events:none">' + esc(action) + " " + ARROW + "</span>" +
          "</div>" +
        "</a>"
      );
      grid.appendChild(tile);
    });
  }

  function statusBadge(status) {
    var label = t("status." + status);
    var cls = "badge badge--" + status;
    var inner = status === "completed" ? CHECK : '<span class="dot"></span>';
    return '<span class="' + cls + '">' + inner + esc(label) + "</span>";
  }

  /* ------------------------------------------------------------ course view */
  function renderCourse(root, catalog) {
    var id = getParam("course");
    var course = (catalog.courses || []).filter(function (c) { return c.id === id; })[0];

    if (!course) {
      root.innerHTML =
        '<div class="card stack-sm">' +
          "<h1>" + esc(t("course.notfound.title")) + "</h1>" +
          '<p class="soft">' + esc(t("course.notfound.body")) + "</p>" +
          '<p><a class="btn btn--primary" href="' + url("courses.html") + '">' + esc(t("course.notfound.cta")) + "</a></p>" +
        "</div>";
      return;
    }

    document.title = t(course.titleKey) + " — Second Chance";
    var st = courseState(course);
    var pct = st.counts.total ? Math.round((st.counts.done / st.counts.total) * 100) : 0;
    var P = window.SCE_PROGRESS;

    var lessonsHTML = lessonsOf(course).map(function (lesson, i) {
      var status = P ? P.getLessonStatus(course.id, lesson.id) : "not-started";
      var action = status === "completed" ? t("course.review")
        : status === "in-progress" ? t("course.continue") : t("course.start");
      var launchHref = url("launch.html") + "?course=" + encodeURIComponent(course.id) +
        "&lesson=" + encodeURIComponent(lesson.id);
      var numInner = status === "completed" ? CHECK : (i + 1);
      return (
        '<li class="lesson ' + (status === "completed" ? "is-completed" : "") + '">' +
          '<span class="lesson__num" aria-hidden="true">' + numInner + "</span>" +
          '<div class="lesson__body">' +
            '<div class="lesson__title">' + esc(lessonTitle(lesson)) + "</div>" +
            '<div class="lesson__status-line">' + statusBadge(status) + "</div>" +
          "</div>" +
          '<a class="btn btn--secondary lesson__action" href="' + launchHref + '">' +
            esc(action) + " " + ARROW +
          "</a>" +
        "</li>"
      );
    }).join("");

    var completeBlock = st.complete ?
      '<div class="card notice--tip" style="border-color:var(--color-blue-100)">' +
        '<div class="stack-sm">' +
          "<h3>" + esc(t("course.complete.title")) + "</h3>" +
          '<p class="soft">' + esc(t("course.complete.body")) + "</p>" +
          '<p><a class="btn btn--primary" href="' + url("complete.html") + "?course=" +
            encodeURIComponent(course.id) + '">' + esc(t("course.complete.cta")) + "</a></p>" +
        "</div>" +
      "</div>" : "";

    root.innerHTML =
      '<a class="back-link" href="' + url("courses.html") + '">' +
        '<span class="chev" aria-hidden="true">‹</span> ' + esc(t("course.backToCourses")) +
      "</a>" +
      '<div class="page-head stack-sm">' +
        '<h1>' + esc(t(course.titleKey)) + "</h1>" +
        '<p class="lead">' + esc(t(course.descKey)) + "</p>" +
      "</div>" +
      '<div class="card" style="margin-block-end:var(--space-5)">' +
        '<div class="progress-meter">' +
          '<div class="progress-meter__label">' +
            "<span>" + esc(t("course.progress.heading")) + "</span>" +
            "<span>" + esc(st.complete ? t("courses.completed") : ofDone(st.counts.done, st.counts.total)) + "</span>" +
          "</div>" +
          '<div class="progress-track"><div class="progress-fill' + (st.complete ? " is-complete" : "") +
            '" style="width:' + pct + '%"></div></div>' +
        "</div>" +
      "</div>" +
      completeBlock +
      '<h2 style="margin-block:var(--space-6) var(--space-4)">' + esc(t("course.modulesHeading")) + "</h2>" +
      '<ul class="lesson-list">' + lessonsHTML + "</ul>" +
      '<div class="notice notice--tip" style="margin-block-start:var(--space-6)">' +
        '<span class="notice__icon" aria-hidden="true">' + infoSVG() + "</span>" +
        '<div class="notice__body">' +
          "<strong>" + esc(t("course.oneSitting.title")) + "</strong>" +
          "<p>" + esc(t("course.oneSitting.body")) + "</p>" +
        "</div>" +
      "</div>";
  }

  function infoSVG() {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
  }

  function start() {
    var grid = document.getElementById("courseGrid");
    var view = document.getElementById("courseView");
    if (!grid && !view) return;

    var ready = window.SCE_I18N && window.SCE_I18N.ready ? window.SCE_I18N.ready : Promise.resolve();
    Promise.all([ready, loadCatalog()]).then(function (res) {
      var catalog = res[1];
      if (grid) renderIndex(grid, catalog);
      if (view) renderCourse(view, catalog);
      if (window.SCE_I18N) window.SCE_I18N.apply(document);
    });
  }

  window.SCE_COURSES = { loadCatalog: loadCatalog, courseState: courseState };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
