/* Realistic My Courses extraction: cards can span theme scopes and an aside. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set };
context.globalThis = context;
vm.createContext(context);
["state.js", "moodle.js", "courses.js"].forEach((file) => vm.runInContext(fs.readFileSync(`extension/core/${file}`, "utf8"), context, { filename: file }));
const core = context.UIPScannerCore;

function link(id, options = {}) {
  const parent = { style: {}, parentElement: null, querySelector() { return null; }, getAttribute() { return null; } };
  return {
    textContent: options.name || `Materia ${id}`,
    style: options.hidden ? { display: "none" } : {},
    parentElement: parent,
    getAttribute(name) { return name === "href" ? `/course/view.php?id=${id}` : null; },
    closest(selector) {
      if (options.region === "drawer" && selector.includes(".drawer")) return {};
      if (options.region === "navigation" && selector.includes('nav[aria-label]')) return {};
      // A valid card in an aside must not be discarded by generic layout tags.
      if (options.region === "aside" && selector.includes("aside")) return {};
      return null;
    }
  };
}

const primary = link("8100", { name: "Arquitectura de Computadoras" });
const inAside = link("8101", { name: "Redes", region: "aside" });
const navigation = link("8102", { region: "navigation" });
const hidden = link("8103", { hidden: true });
const malformed = link("not-a-number");
const scopeA = { querySelectorAll(selector) { return selector === core.selectors.courseLinks ? [primary, navigation] : []; } };
const scopeB = { querySelectorAll(selector) { return selector === core.selectors.courseLinks ? [inAside, hidden, malformed] : []; } };
const document = {
  location: { href: "https://moodle.uip.edu.pa/my/courses.php", pathname: "/my/courses.php" },
  querySelectorAll(selector) {
    if (selector === core.selectors.courseLinks) return [];
    if (["#region-main", '[data-region="courses-view"]'].includes(selector)) return [selector === "#region-main" ? scopeA : scopeB];
    return [];
  }
};

assert.equal(core.detectPageType(document), "MY_COURSES");
const scanned = core.scanCourses(null, document, []);
assert.deepEqual(scanned.map((course) => course.id), ["8100", "8101"]);
assert.equal(scanned.diagnostics.candidateLinks, 5);
assert.equal(scanned.diagnostics.excludedLinks, 1);
assert.equal(scanned.diagnostics.canonicalLinks, 3);
assert.equal(scanned.diagnostics.visibleLinks, 2);
assert.equal(scanned.diagnostics.acceptedCourses, 2);

const noGenericNotice = link("8110");
const genericDocument = {
  location: { href: "https://moodle.uip.edu.pa/my/courses.php", pathname: "/my/courses.php" },
  querySelectorAll(selector) { return selector === core.selectors.courseLinks ? [noGenericNotice] : []; }
};
assert.equal(core.scanCourses(null, genericDocument, []).length, 1, "document fallback must work without a dashboard scope");
console.log("My Courses discovery scanner tests passed");
