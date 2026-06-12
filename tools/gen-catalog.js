// One-shot catalog generator. Reads the real SCORM packages in the sibling
// English course repos and emits data/catalog.json. Run from sce_main with the
// repos as siblings of sce_main (i.e. cwd = sce_main, repos at ../sce_courses_*).
const fs = require("fs");

const ROOT = ".."; // parent dir containing sce_main + course repos

// Course -> repo group + repo language source (English media), icon, i18n title keys.
const COURSES = [
  { id: "welcome",         repoGroup: 1, icon: "welcome",    titleKey: "course.welcome.title",         descKey: "course.welcome.desc" },
  { id: "personal-growth", repoGroup: 1, icon: "growth",     titleKey: "course.personal-growth.title", descKey: "course.personal-growth.desc" },
  { id: "gender",          repoGroup: 2, icon: "gender",     titleKey: "course.gender.title",          descKey: "course.gender.desc" },
  { id: "leadership",      repoGroup: 2, icon: "leadership", titleKey: "course.leadership.title",       descKey: "course.leadership.desc" },
];

function repoDir(group) { return ROOT + "/sce_courses_en" + group; }

function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
}

function titleFromManifest(xml, fallbackName) {
  var m = xml.match(/<item[^>]*>[\s\S]*?<title>([^<]*)<\/title>/);
  if (m && m[1].trim()) return decode(m[1].trim());
  var o = xml.match(/<organization[^>]*>\s*<title>([^<]*)<\/title>/);
  if (o && o[1].trim()) return decode(o[1].trim());
  // Last resort: prettify the folder name (strip numeric prefix, split camelCase).
  return fallbackName.replace(/^\d+_/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function numPrefix(name) { var m = name.match(/^(\d+)/); return m ? parseInt(m[1], 10) : 99999; }

const out = {
  version: 2,
  _comment: "Catalog v2. Each course declares repoGroup (1 or 2); the launcher resolves its media repo as sce_courses_{contentLang}{group} (a SIBLING of sce_main, same origin). `contentLang` maps a UI language to the language its course MEDIA is in: Hindi (hi) uses the English modules (en). Lesson `title` is the authored title read from the package imsmanifest.xml; `path` is the in-repo path. The launcher reads each package's imsmanifest.xml for the real launch file + SCORM version (never assumes index.html).",
  repoPattern: "../sce_courses_{lang}{group}",
  contentLang: { en: "en", hi: "en", es: "es", fr: "fr", ar: "ar" },
  courses: [],
};

for (const c of COURSES) {
  const dir = repoDir(c.repoGroup) + "/" + c.id;
  const lessonDirs = fs.readdirSync(dir, { withFileTypes: true })
    .filter(function (e) { return e.isDirectory() && e.name !== ".git"; })
    .map(function (e) { return e.name; })
    .sort(function (a, b) { return numPrefix(a) - numPrefix(b) || a.localeCompare(b); });

  const lessons = lessonDirs.map(function (d) {
    const mpath = dir + "/" + d + "/imsmanifest.xml";
    let title;
    try { title = titleFromManifest(fs.readFileSync(mpath, "utf8"), d); }
    catch (e) { title = d.replace(/^\d+_/, ""); }
    return { id: d, title: title, path: c.id + "/" + d };
  });

  out.courses.push({
    id: c.id, slug: c.id, icon: c.icon, repoGroup: c.repoGroup,
    titleKey: c.titleKey, descKey: c.descKey, lessons: lessons,
  });
}

fs.writeFileSync("data/catalog.json", JSON.stringify(out, null, 2) + "\n");
console.log("Wrote data/catalog.json");
out.courses.forEach(function (c) { console.log("  " + c.id + " (repo en" + c.repoGroup + "): " + c.lessons.length + " lessons"); });
console.log("\nSample titles:");
out.courses.forEach(function (c) {
  console.log("  [" + c.id + "] " + c.lessons.slice(0, 3).map(function (l) { return l.id + ' => "' + l.title + '"'; }).join(" | "));
});
