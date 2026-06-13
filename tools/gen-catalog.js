#!/usr/bin/env node
/*
 * gen-catalog.js — build data/catalog.json from the real SCORM packages across
 * ALL languages, and print an inventory table. Run from sce_main:
 *     node tools/gen-catalog.js
 *
 * Each language is self-contained: lessons come from that language's own folders,
 * ordered by their leading number (numeric), with the launch file derived from
 * each lesson's own imsmanifest.xml (never assumes index.html). No cross-language
 * mapping. Course folders are expected to share the English names.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");           // parent of sce_main

const LANGS = ["en", "es", "fr", "ar"];                     // hi uses en media (no hi repos)
const COURSES = [                                            // course -> repo group + meta
  { id: "welcome",         group: 1, icon: "welcome",    titleKey: "course.welcome.title",         descKey: "course.welcome.desc" },
  { id: "personal-growth", group: 1, icon: "growth",     titleKey: "course.personal-growth.title", descKey: "course.personal-growth.desc" },
  { id: "gender",          group: 2, icon: "gender",     titleKey: "course.gender.title",          descKey: "course.gender.desc" },
  { id: "leadership",      group: 2, icon: "leadership", titleKey: "course.leadership.title",       descKey: "course.leadership.desc" },
];

function repoDir(lang, group) { return path.join(ROOT, "sce_courses_" + lang + group); }
function numPrefix(n) { const m = n.match(/^(\d+)/); return m ? parseInt(m[1], 10) : 1e9; }
function decode(s){return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));}
function manifestInfo(xml, fallback) {
  let title = null, href = null, ver = null;
  let m = xml.match(/<item[^>]*>[\s\S]*?<title>([^<]*)<\/title>/); if (m && m[1].trim()) title = decode(m[1].trim());
  if (!title) { m = xml.match(/<organization[^>]*>\s*<title>([^<]*)<\/title>/); if (m && m[1].trim()) title = decode(m[1].trim()); }
  if (!title) title = fallback.replace(/^\d+_/, "").replace(/_/g, " ");
  m = xml.match(/<schemaversion>([^<]*)<\/schemaversion>/i); if (m) ver = m[1].trim();
  let ref = null; const im = xml.match(/<item[^>]*identifierref="([^"]+)"/); if (im) ref = im[1];
  if (ref) { const rx = new RegExp('<resource[^>]*identifier="' + ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*href="([^"]+)"'); m = xml.match(rx); if (m) href = m[1]; }
  if (!href) { m = xml.match(/<resource[^>]*href="([^"]+)"/); if (m) href = m[1]; }
  return { title, href, ver };
}

const catalog = { version: 3, _comment: "Catalog v3 — per-language lessons. Each course's `lessons` is keyed by content language; the launcher picks lessons[contentLang] (Hindi->en). repoPattern + course.group resolve sce_courses_{lang}{group} (sibling, same origin). Lesson `path` is the in-repo package dir; the launcher reads each package's imsmanifest.xml for the real launch file + SCORM version (never assumes index.html). Built by tools/gen-catalog.js — do not hand-edit lessons.", repoPattern: "../sce_courses_{lang}{group}", contentLang: { en: "en", hi: "en", es: "es", fr: "fr", ar: "ar" }, courses: [] };

const flags = [];
const inventory = [];

for (const c of COURSES) {
  const courseEntry = { id: c.id, slug: c.id, icon: c.icon, repoGroup: c.group, titleKey: c.titleKey, descKey: c.descKey, lessons: {} };
  for (const lang of LANGS) {
    const dir = path.join(repoDir(lang, c.group), c.id);
    const repoName = "sce_courses_" + lang + c.group;
    if (!fs.existsSync(dir)) { flags.push(`MISSING course folder: ${repoName}/${c.id}`); courseEntry.lessons[lang] = []; inventory.push({ lang, repo: repoName, course: c.id, count: 0, lessons: [], note: "FOLDER MISSING" }); continue; }
    let dirs = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== ".git").map(e => e.name);
    dirs.sort((a, b) => numPrefix(a) - numPrefix(b) || a.localeCompare(b));
    const lessons = [], rows = [];
    for (const d of dirs) {
      const mp = path.join(dir, d, "imsmanifest.xml");
      let info = { title: d, href: null, ver: null }, bad = null;
      if (!fs.existsSync(mp)) bad = "no manifest";
      else { try { info = manifestInfo(fs.readFileSync(mp, "utf8"), d); } catch (e) { bad = "manifest parse error"; } }
      if (!info.href && !bad) bad = "no launch href in manifest";
      if (bad) flags.push(`${repoName}/${c.id}/${d}: ${bad}`);
      lessons.push({ id: d, title: info.title, path: c.id + "/" + d });
      rows.push({ id: d, launch: info.href || "(?)", ver: info.ver || "?" });
    }
    courseEntry.lessons[lang] = lessons;
    inventory.push({ lang, repo: repoName, course: c.id, count: lessons.length, lessons: rows });
  }
  catalog.courses.push(courseEntry);
}

for (const c of COURSES) {
  const counts = LANGS.map(l => (catalog.courses.find(x => x.id === c.id).lessons[l] || []).length);
  LANGS.forEach((l, i) => { if (counts[i] === 0 && Math.max(...counts) > 0) flags.push(`${c.id}: ${l} has 0 lessons (others: ${counts.join("/")})`); });
}

fs.writeFileSync(path.join(__dirname, "..", "data", "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");

console.log("INVENTORY (language · repo/course · count · SCORM · launch files · lessons in numeric order)\n");
let curLang = null;
for (const r of inventory) {
  if (r.lang !== curLang) { curLang = r.lang; console.log("\n========== " + r.lang.toUpperCase() + " =========="); }
  if (r.note === "FOLDER MISSING") { console.log(`  ${r.repo}/${r.course}: !! FOLDER MISSING`); continue; }
  const launches = [...new Set(r.lessons.map(x => x.launch))];
  const launchSummary = launches.length === 1 ? `launch=${launches[0]} (all)` : `launch VARIES: ${r.lessons.map(x => x.id + "->" + x.launch).join(", ")}`;
  const vers = [...new Set(r.lessons.map(x => x.ver))];
  console.log(`  ${r.repo}/${r.course}: ${r.count} lessons | SCORM ${vers.join(",")} | ${launchSummary}`);
  console.log(`      order: ${r.lessons.map(x => x.id).join(", ")}`);
}
console.log("\nCROSS-LANGUAGE COUNTS (differences are expected):");
for (const c of COURSES) {
  const cc = catalog.courses.find(x => x.id === c.id);
  console.log("  " + c.id.padEnd(16) + LANGS.map(l => l + ":" + (cc.lessons[l] || []).length).join("  "));
}
console.log("\nFLAGS (" + flags.length + "):");
flags.forEach(f => console.log("  ⚠ " + f));
if (!flags.length) console.log("  none");
