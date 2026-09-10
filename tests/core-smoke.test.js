/* Dependency-free checks for pure URL classification and diagnostic sanitization. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set };
context.globalThis = context;
vm.createContext(context);
["state.js", "moodle.js", "activities.js", "sanitize.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(`extension/core/${file}`, "utf8"), context, { filename: file });
});

const core = context.UIPScannerCore;
assert.equal(core.detectPageType({ location: { pathname: "/my/" } }), "AREA_PERSONAL");
assert.equal(core.detectPageType({ location: { pathname: "/course/view.php" } }), "COURSE");
assert.equal(core.detectPageType({ location: { pathname: "/course/section.php" } }), "SECTION");
assert.equal(core.detectPageType({ location: { pathname: "/mod/feedback/view.php" } }), "FEEDBACK");
assert.equal(core.classifyActivity("https://moodle.uip.edu.pa/mod/feedback/view.php?id=10"), "feedback");
assert.equal(core.classifyActivity("https://moodle.uip.edu.pa/mod/assign/view.php?id=11"), "assign");
assert.equal(core.classifyActivity("https://moodle.uip.edu.pa/mod/custom/view.php?id=12"), "unknown");

const unobstructedSection = { className: "", querySelector: () => null };
assert.equal(core.restriction(unobstructedSection, { navigable: true }).available, true);
assert.equal(core.restriction(unobstructedSection, { navigable: false }).available, null);
const restrictedSection = { className: "dimmed", querySelector: () => null };
assert.equal(core.restriction(restrictedSection, { navigable: true }).available, false);

const visibleLink = { getAttribute: () => null, style: {}, parentElement: null };
assert.equal(core.isDomVisible(visibleLink), true);
assert.equal(core.isDomVisible(null), false);
const hiddenParent = { hidden: true, getAttribute: () => null, style: {}, parentElement: null };
assert.equal(core.isDomVisible({ getAttribute: () => null, style: {}, parentElement: hiddenParent }), false);

const courseLink = {
  textContent: "Arquitectura de Computadoras",
  getAttribute: (name) => name === "href" ? "/course/view.php?id=8199&source=breadcrumb" : null
};
const sectionDocument = {
  location: { href: "https://moodle.uip.edu.pa/course/section.php?id=153818" },
  querySelector: (selector) => selector === core.selectors.courseLinks ? courseLink : null
};
assert.deepEqual(core.currentCourse(sectionDocument, "SECTION"), {
  id: "8199", name: "Arquitectura de Computadoras", url: "https://moodle.uip.edu.pa/course/view.php?id=8199"
});
assert.deepEqual(core.currentCourse({ location: sectionDocument.location, querySelector: () => null }, "SECTION"), { id: null, name: null, url: null });
const courseDocument = {
  location: { href: "https://moodle.uip.edu.pa/course/view.php?id=8199&sesskey=synthetic" },
  querySelector: () => ({ textContent: "Arquitectura de Computadoras" })
};
assert.deepEqual(core.currentCourse(courseDocument, "COURSE"), {
  id: "8199", name: "Arquitectura de Computadoras", url: "https://moodle.uip.edu.pa/course/view.php?id=8199"
});

const metadataOnlyActivity = {
  className: "modtype_feedback",
  id: "module-2059224",
  getAttribute: () => null
};
assert.equal(core.activityIdFromContainer(metadataOnlyActivity), "2059224");
assert.equal(core.activityTypeFromContainer(metadataOnlyActivity), "feedback");

const diagnostic = core.sanitizeDiagnostic({
  pageType: "COURSE", partial: false,
  course: { id: "1", name: "Course", url: "https://moodle.uip.edu.pa/course/view.php?id=1&sesskey=secret&lang=es" },
  courses: [], modules: [], activities: [], feedback: [], errors: []
});
assert.equal(diagnostic.course.url, "https://moodle.uip.edu.pa/course/view.php?id=1");
assert.equal(JSON.stringify(diagnostic).includes("secret"), false);
assert.equal(JSON.stringify(diagnostic).includes("lang=es"), false);
console.log("core smoke tests passed");
