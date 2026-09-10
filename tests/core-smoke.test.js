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

const diagnostic = core.sanitizeDiagnostic({
  pageType: "COURSE", partial: false,
  course: { id: "1", name: "Course", url: "https://moodle.uip.edu.pa/course/view.php?id=1&sesskey=secret" },
  courses: [], modules: [], activities: [], feedback: [], errors: []
});
assert.equal(diagnostic.course.url, "https://moodle.uip.edu.pa/course/view.php?id=1");
assert.equal(JSON.stringify(diagnostic).includes("secret"), false);
console.log("core smoke tests passed");
