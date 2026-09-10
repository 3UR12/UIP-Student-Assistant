/* Dependency-free checks for pure URL classification and diagnostic sanitization. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set };
context.globalThis = context;
vm.createContext(context);
["state.js", "moodle.js", "courses.js", "modules.js", "activities.js", "feedback.js", "sanitize.js"].forEach((file) => {
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
assert.deepEqual(core.canonicalActivityFromUrl("https://moodle.uip.edu.pa/mod/feedback/view.php?id=2059248", "https://moodle.uip.edu.pa/my/"), {
  id: "2059248", type: "feedback", url: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=2059248"
});
assert.equal(core.canonicalActivityFromUrl("https://moodle.uip.edu.pa/mod/feedback/complete.php?id=2059248", "https://moodle.uip.edu.pa/my/"), null);
assert.equal(core.canonicalActivityFromUrl("https://moodle.uip.edu.pa/mod/forum/search.php?id=8199", "https://moodle.uip.edu.pa/my/"), null);

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
  id: "8199", name: "Arquitectura de Computadoras", rawName: "Arquitectura de Computadoras", displayName: null, url: "https://moodle.uip.edu.pa/course/view.php?id=8199"
});
assert.deepEqual(core.currentCourse({ location: sectionDocument.location, querySelector: () => null }, "SECTION"), { id: null, name: null, rawName: null, displayName: null, url: null });
const courseDocument = {
  location: { href: "https://moodle.uip.edu.pa/course/view.php?id=8199&sesskey=synthetic" },
  querySelector: () => ({ textContent: "Arquitectura de Computadoras" })
};
assert.deepEqual(core.currentCourse(courseDocument, "COURSE"), {
  id: "8199", name: "Arquitectura de Computadoras", rawName: "Arquitectura de Computadoras", displayName: null, url: "https://moodle.uip.edu.pa/course/view.php?id=8199"
});

const metadataOnlyActivity = {
  className: "modtype_feedback",
  id: "module-2059224",
  getAttribute: () => null
};
assert.equal(core.activityIdFromContainer(metadataOnlyActivity), "2059224");
assert.equal(core.activityTypeFromContainer(metadataOnlyActivity), "feedback");
assert.equal(core.activityHasIdentity({ className: "", id: "", getAttribute: () => null }), false);
assert.equal(core.activityNameFrom({ textContent: "Soy el Profesor y este texto no es un nombre", getAttribute: () => null, querySelector: () => null }, null), null);

const node = (attributes, textContent) => ({
  attributes: attributes || {}, textContent: textContent || "", className: "", style: {}, parentElement: null,
  getAttribute(name) { return this.attributes[name] || null; },
  querySelector() { return null; },
  closest() { return null; }
});
const semanticName = node({}, "Envíanos tu Opinión3");
const realActivity = node({}, "");
const actionActivity = node({}, "");
const ambiguousContainer = node({ "data-activityname": "Seleccionar actividad Etiqueta" }, "Texto de profesor que no debe exportarse");
const realView = node({ href: "/mod/feedback/view.php?id=2059248" }, "Envíanos tu Opinión3");
const actionView = node({ href: "/mod/feedback/view.php?id=2059248" }, "Responda a las preguntas");
const completeAction = node({ href: "/mod/feedback/complete.php?id=2059248" }, "Responda a las preguntas");
realView.parentElement = realActivity;
actionView.parentElement = actionActivity;
completeAction.parentElement = actionActivity;
realActivity.querySelector = (selector) => {
  if (selector.includes("activityname")) return semanticName;
  if (selector === core.selectors.activityLinks) return realView;
  return null;
};
actionActivity.querySelector = (selector) => selector === core.selectors.activityLinks ? actionView : null;
ambiguousContainer.querySelector = () => null;
realView.closest = (selector) => selector === core.selectors.activityContainers ? realActivity : null;
actionView.closest = (selector) => selector === core.selectors.activityContainers ? actionActivity : null;
completeAction.closest = (selector) => selector === core.selectors.activityContainers ? actionActivity : null;
const activityScope = {
  querySelectorAll(selector) {
    if (selector === core.selectors.activityLinks) return [actionView, realView, completeAction];
    if (selector === core.selectors.activityContainers) return [realActivity, actionActivity, ambiguousContainer];
    return [];
  }
};
const scannedActivities = core.scanActivities(activityScope, { location: { href: "https://moodle.uip.edu.pa/course/view.php?id=8199" } }, []);
assert.equal(scannedActivities.length, 1);
assert.equal(scannedActivities[0].id, "2059248");
assert.equal(scannedActivities[0].name, "Envíanos tu Opinión3");
assert.equal(scannedActivities[0].available, true);
assert.equal(core.findFeedback(scannedActivities, null, []).length, 1);

const feedbackHeading = node({}, "Envíanos tu Opinión3");
const feedbackCompletion = node({}, "Por hacer: Enviar retroalimentación");
const responseLink = node({ href: "/mod/feedback/complete.php?id=2059248" }, "Responda a las preguntas");
const feedbackScope = {
  querySelector(selector) {
    if (selector === core.selectors.completion) return feedbackCompletion;
    if (selector === core.selectors.restricted) return null;
    return feedbackHeading;
  },
  querySelectorAll: () => [responseLink]
};
const feedbackDocument = {
  location: {
    href: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=2059248",
    pathname: "/mod/feedback/view.php",
    origin: "https://moodle.uip.edu.pa"
  },
  querySelector: () => feedbackHeading
};
const feedbackPage = core.feedbackPageContext(feedbackDocument, feedbackScope);
assert.equal(feedbackPage.id, "2059248");
assert.equal(feedbackPage.responseUrl, "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=2059248");
assert.equal(feedbackPage.canRespond, true);
assert.equal(feedbackPage.completionState, "incomplete");

const completionNode = { textContent: "Hecho: Enviar retroalimentación", className: "", getAttribute: () => null };
assert.equal(core.completionFor({ querySelector: () => completionNode }), "completed");
const pendingCompletionNode = { textContent: "Por hacer: Enviar retroalimentación", className: "", getAttribute: () => null };
assert.equal(core.completionFor({ querySelector: () => pendingCompletionNode }), "incomplete");
assert.equal(core.completionFor({ textContent: "Hecho fuera de la región", querySelector: () => null }), "unknown");

const emptySection = { id: "", getAttribute: () => null, querySelector: () => null };
assert.equal(core.isMoodleSection(emptySection, { location: { href: "https://moodle.uip.edu.pa/course/view.php?id=1" } }), false);
assert.deepEqual(core.scanModules({ id: "", getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [] }, { location: { href: "https://moodle.uip.edu.pa/course/view.php?id=1" } }, []), []);

const sectionLink = node({ href: "/course/section.php?id=153818" }, "Módulo 1");
const currentSectionNode = node({ "data-sectionid": "1", "data-for": "course_section" }, "");
currentSectionNode.id = "section-1";
sectionLink.parentElement = currentSectionNode;
sectionLink.closest = (selector) => selector === core.selectors.sectionContainers ? currentSectionNode : null;
currentSectionNode.querySelector = (selector) => selector === core.selectors.sectionLinks ? sectionLink : null;
currentSectionNode.querySelectorAll = (selector) => selector === core.selectors.sectionLinks ? [sectionLink] : [];
const currentSectionModules = core.scanModules(currentSectionNode, { location: { href: "https://moodle.uip.edu.pa/course/section.php?id=153818" } }, [], "153818");
assert.equal(currentSectionModules.length, 1);
assert.equal(currentSectionModules[0].id, "153818");
assert.equal(currentSectionModules[0].sectionNumber, 1);

let moduleCalls = 0;
const originalScanModules = core.scanModules;
const originalScanCourses = core.scanCourses;
const originalScanActivities = core.scanActivities;
const originalFindFeedback = core.findFeedback;
const originalFindMainContent = core.findMainContent;
const originalFindDashboardScope = core.findDashboardScope;
core.findMainContent = () => null;
core.findDashboardScope = () => ({ querySelectorAll: () => [] });
core.scanModules = () => { moduleCalls += 1; return []; };
core.scanCourses = () => [];
core.scanActivities = () => [];
core.findFeedback = () => [];
const dashboardScan = core.scanDocument({ location: { pathname: "/my/", href: "https://moodle.uip.edu.pa/my/" }, querySelector: () => null });
assert.equal(moduleCalls, 0);
assert.deepEqual(dashboardScan.modules, []);
core.scanModules = originalScanModules;
core.scanCourses = originalScanCourses;
core.scanActivities = originalScanActivities;
core.findFeedback = originalFindFeedback;
core.findMainContent = originalFindMainContent;
core.findDashboardScope = originalFindDashboardScope;

const diagnostic = core.sanitizeDiagnostic({
  pageType: "COURSE", partial: false,
  course: { id: "1", name: "Course", url: "https://moodle.uip.edu.pa/course/view.php?id=1&sesskey=secret&lang=es" },
  courses: [], modules: [], activities: [{ id: "1", name: "x".repeat(500), type: "feedback", url: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=1" }], feedback: [], errors: []
});
assert.equal(diagnostic.course.url, "https://moodle.uip.edu.pa/course/view.php?id=1");
assert.equal(JSON.stringify(diagnostic).includes("secret"), false);
assert.equal(JSON.stringify(diagnostic).includes("lang=es"), false);
assert.equal(diagnostic.activities[0].name.length, 160);
console.log("core smoke tests passed");
