/* ==========================================================================
   progress.js — anonymous, on-device progress & completion model.

   No login. Progress lives in localStorage, version-tagged, under an opaque
   random token that identifies NOBODY. Everything is wrapped so that missing,
   empty, or older data degrades to a clean "not started" state and NEVER
   throws an error at a learner.

   Public API (window.SCE_PROGRESS):
     getOrCreateToken()
     getProgress()
     setLessonStatus(course, lesson, status)
     getLessonStatus(course, lesson)
     isCourseComplete(course)
     courseCounts(course, totalLessons)   -> { done, total }
     markCourseComplete(course, meta)      -> records courseCompletedAt + country
     recordCompletion(course, country)     -> anonymous completion metric (local)
     setLang(lang)
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "sce_progress_v1";
  var VERSION = 1;
  var STATUSES = ["not-started", "in-progress", "completed"];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  // RFC4122-ish v4 UUID. Uses crypto when available, falls back safely.
  function uuidv4() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
      if (window.crypto && window.crypto.getRandomValues) {
        var b = new Uint8Array(16);
        window.crypto.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        var h = [];
        for (var i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
        return h[0]+h[1]+h[2]+h[3]+"-"+h[4]+h[5]+"-"+h[6]+h[7]+"-"+h[8]+h[9]+"-"+h[10]+h[11]+h[12]+h[13]+h[14]+h[15];
      }
    } catch (e) { /* fall through */ }
    // Last resort (non-crypto). Still opaque; identifies nobody.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (new Date().getTime() + Math.floor(performance.now ? performance.now() : 0)) % 16;
      var v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function freshState() {
    return { version: VERSION, token: uuidv4(), lang: "en", courses: {}, completions: [] };
  }

  // Read + validate. Anything wrong → clean fresh state (never throw).
  function read() {
    var raw = lsGet(KEY);
    if (!raw) return freshState();
    var data;
    try { data = JSON.parse(raw); } catch (e) { return freshState(); }
    if (!data || typeof data !== "object") return freshState();
    if (data.version !== VERSION) {
      // Older/newer schema: start clean but keep a stable token if present & sane.
      var s = freshState();
      if (typeof data.token === "string" && data.token.length >= 8) s.token = data.token;
      return s;
    }
    if (typeof data.token !== "string" || data.token.length < 8) data.token = uuidv4();
    if (!data.courses || typeof data.courses !== "object") data.courses = {};
    if (!Array.isArray(data.completions)) data.completions = [];
    return data;
  }

  function write(state) {
    try { lsSet(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    return state;
  }

  function getOrCreateToken() {
    var s = read();
    if (!lsGet(KEY)) write(s); // persist on first ever read
    return s.token;
  }

  function getProgress() { return read(); }

  function setLang(lang) {
    var s = read();
    s.lang = lang || s.lang || "en";
    return write(s);
  }

  function ensureCourse(s, course) {
    if (!s.courses[course]) s.courses[course] = { lessons: {}, courseCompletedAt: null };
    if (!s.courses[course].lessons) s.courses[course].lessons = {};
    return s.courses[course];
  }

  function getLessonStatus(course, lesson) {
    var s = read();
    var c = s.courses[course];
    if (!c || !c.lessons) return "not-started";
    return c.lessons[lesson] || "not-started";
  }

  function setLessonStatus(course, lesson, status) {
    if (STATUSES.indexOf(status) === -1) status = "not-started";
    var s = read();
    var c = ensureCourse(s, course);
    c.lessons[lesson] = status;
    return write(s);
  }

  // Course is complete when every known lesson id is "completed".
  // `lessonIds` may be passed for authority; otherwise we use stored lessons.
  function isCourseComplete(course, lessonIds) {
    var s = read();
    var c = s.courses[course];
    if (!c || !c.lessons) return false;
    var ids = Array.isArray(lessonIds) && lessonIds.length ? lessonIds : Object.keys(c.lessons);
    if (!ids.length) return false;
    for (var i = 0; i < ids.length; i++) {
      if (c.lessons[ids[i]] !== "completed") return false;
    }
    return true;
  }

  function courseCounts(course, totalLessons) {
    var s = read();
    var c = s.courses[course];
    var done = 0;
    if (c && c.lessons) {
      Object.keys(c.lessons).forEach(function (k) {
        if (c.lessons[k] === "completed") done++;
      });
    }
    return { done: done, total: totalLessons || (c && c.lessons ? Object.keys(c.lessons).length : 0) };
  }

  // Stamp course completion. `dateISO` is passed in (callers stamp the date).
  function markCourseComplete(course, dateISO) {
    var s = read();
    var c = ensureCourse(s, course);
    if (!c.courseCompletedAt) c.courseCompletedAt = dateISO || null;
    return write(s);
  }

  function getCourseCompletedAt(course) {
    var s = read();
    var c = s.courses[course];
    return c ? c.courseCompletedAt : null;
  }

  /* The reliable anonymous completion metric. Records token + course + country
     + date locally. NEVER the name. Phase 2 hook mirrors this to Supabase. */
  function recordCompletion(course, country, dateISO) {
    var s = read();
    var existing = null;
    for (var i = 0; i < s.completions.length; i++) {
      if (s.completions[i].course === course) { existing = s.completions[i]; break; }
    }
    if (existing) {
      // Upsert country if it wasn't known at first record (e.g. intake skipped).
      if (!existing.country && country) existing.country = country;
    } else {
      s.completions.push({
        token: s.token,
        course: course,
        country: country || null,
        date: dateISO || null
      });
    }
    markCourseComplete(course, dateISO);
    write(s);

    // --- Phase 2 hook -------------------------------------------------------
    // Replace this console line with an anonymous INSERT into Supabase
    // (EU region). Send ONLY: token, course, country, date. Never the name.
    //   await supabase.from('completions').insert({ token, course, country, date });
    try {
      // eslint-disable-next-line no-console
      console.log("[completion]", { token: s.token, course: course, country: country || null, date: dateISO || null });
    } catch (e) {}
    return s;
  }

  window.SCE_PROGRESS = {
    STATUSES: STATUSES,
    getOrCreateToken: getOrCreateToken,
    getProgress: getProgress,
    setLang: setLang,
    getLessonStatus: getLessonStatus,
    setLessonStatus: setLessonStatus,
    isCourseComplete: isCourseComplete,
    courseCounts: courseCounts,
    markCourseComplete: markCourseComplete,
    getCourseCompletedAt: getCourseCompletedAt,
    recordCompletion: recordCompletion
  };
})();
