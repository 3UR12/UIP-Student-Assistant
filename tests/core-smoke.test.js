/* Dependency-free checks for pure URL classification and diagnostic sanitization. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set, Event };
context.globalThis = context;
vm.createContext(context);
["state.js", "moodle.js", "courses.js", "modules.js", "activities.js", "feedback.js", "feedback-form.js", "sanitize.js"].forEach((file) => {
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
assert.equal(core.classifyActivity("https://moodle.uip.edu.pa/mod/attendance/view.php?id=12"), "attendance");
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
const dashboardBlockChild = {
  closest(selector) { return selector.includes(".block,") || selector.endsWith(".block") ? {} : null; }
};
assert.equal(core.isExcludedRegion(dashboardBlockChild), false);
const drawerChild = {
  closest(selector) { return selector.includes(".drawer") ? {} : null; }
};
assert.equal(core.isExcludedRegion(drawerChild), true);

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
const outerMain = node({}, "");
const nestedCourseContent = node({}, "");
const scopedDocument = {
  querySelector(selector) {
    if (selector === "#region-main") return outerMain;
    if (selector === '[data-region="course-content"]') return nestedCourseContent;
    return null;
  }
};
assert.equal(core.findMainContent(scopedDocument), outerMain);
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
  querySelectorAll: (selector) => selector === core.selectors.completion ? [feedbackCompletion] : [responseLink]
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

const activitySpecificHeading = node({}, "Envíanos tu Opinión3");
const genericCourseHeading = node({}, "Nombre completo del curso");
assert.equal(core.activityPageName({ querySelector: () => null }, { querySelector: () => activitySpecificHeading }), "Envíanos tu Opinión3");
assert.equal(core.activityPageName({ querySelector: () => null, genericCourseHeading }, { querySelector: () => null }), null);

const completionNode = { textContent: "Hecho: Enviar retroalimentación", className: "", getAttribute: () => null };
assert.equal(core.completionFor({ querySelector: () => completionNode }), "completed");
const pendingCompletionNode = { textContent: "Por hacer: Enviar retroalimentación", className: "", getAttribute: () => null };
assert.equal(core.completionFor({ querySelector: () => pendingCompletionNode }), "incomplete");
assert.equal(core.completionFor({ textContent: "Hecho fuera de la región", querySelector: () => null }), "unknown");
const unrelatedCompletion = node({ "data-cmid": "111" }, "Hecho");
const relatedCompletion = node({ "data-cmid": "2059248" }, "Por hacer: Enviar retroalimentación");
assert.equal(core.completionFor({ querySelectorAll: () => [unrelatedCompletion, relatedCompletion], querySelector: () => null }, "2059248"), "incomplete");
assert.equal(core.completionFor({ querySelectorAll: () => [unrelatedCompletion, node({ "data-cmid": "222" }, "Hecho")], querySelector: () => null }, "2059248"), "unknown");

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

const independentSectionLink = node({ href: "/course/section.php?id=153819" }, "Unidad 2");
const operationalSectionLink = node({ href: "/course/section.php?id=153820" }, "Ir a sección");
const independentSectionScope = {
  id: "", getAttribute: () => null, querySelector: () => null,
  querySelectorAll: (selector) => selector === core.selectors.sectionLinks ? [independentSectionLink, operationalSectionLink] : []
};
const independentModules = core.scanModules(independentSectionScope, { location: { href: "https://moodle.uip.edu.pa/course/view.php?id=8199" } }, []);
assert.equal(independentModules.length, 2);
assert.equal(independentModules[0].id, "153819");
assert.equal(independentModules[0].name, "Unidad 2");
assert.equal(independentModules[1].name, null);

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

const originalFindCurrentSection = core.findCurrentSection;
core.findMainContent = () => ({ querySelectorAll: () => [] });
core.findCurrentSection = () => null;
core.scanActivities = () => [{ id: "2059248", type: "feedback" }];
const fallbackSectionScan = core.scanDocument({ location: { pathname: "/course/section.php", href: "https://moodle.uip.edu.pa/course/section.php?id=153818" }, querySelector: () => null });
assert.equal(fallbackSectionScan.currentSection.id, "153818");
assert.equal(fallbackSectionScan.modules.length, 1);
assert.equal(fallbackSectionScan.activities.length, 1);
core.findCurrentSection = originalFindCurrentSection;
core.findMainContent = originalFindMainContent;
core.scanActivities = originalScanActivities;

const diagnostic = core.sanitizeDiagnostic({
  scannerVersion: "0.1.1", pageType: "COURSE", partial: false,
  course: { id: "1", name: "Course", url: "https://moodle.uip.edu.pa/course/view.php?id=1&sesskey=secret&lang=es" },
  courses: [], modules: [], activities: [{ id: "1", name: "x".repeat(500), type: "feedback", url: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=1" }], feedback: [], errors: []
});
assert.equal(diagnostic.course.url, "https://moodle.uip.edu.pa/course/view.php?id=1");
assert.equal(JSON.stringify(diagnostic).includes("secret"), false);
assert.equal(JSON.stringify(diagnostic).includes("lang=es"), false);
assert.equal(diagnostic.activities[0].name.length, 160);
assert.equal(diagnostic.scannerVersion, "0.1.1");
assert.equal(core.isCompatibleScan({ scannerVersion: core.VERSION }), true);
assert.equal(core.isCompatibleScan({ scannerVersion: "0.1.1" }), false);

const formLabel = (forId, text) => ({ htmlFor: forId, textContent: text, getAttribute: () => null, style: {}, parentElement: null });
const formQuestion = (text) => ({
  textContent: "", style: {}, parentElement: null, getAttribute: () => null,
  querySelector: () => ({ textContent: text, getAttribute: () => null })
});
const events = [];
const formInputs = [];
const syntheticInput = (name, id, value, question, options) => {
  const input = { type: "radio", name, id, value, checked: Boolean(options && options.checked), required: Boolean(options && options.required), disabled: Boolean(options && options.disabled), style: options && options.style || {}, parentElement: question,
    getAttribute: (attribute) => options && options.attributes && options.attributes[attribute] || null,
    closest: () => question,
    dispatchEvent: (event) => events.push(`${id}:${event.type}`)
  };
  formInputs.push(input);
  return input;
};
const q1 = formQuestion("Pregunta uno");
const q2 = formQuestion("Pregunta dos");
const q3 = formQuestion("Pregunta tres");
const q4 = formQuestion("Pregunta cuatro");
const q1Excellent = syntheticInput("q1", "q1-ex", "value-9", q1, { required: true });
const q1VeryGood = syntheticInput("q1", "q1-mb", "value-7", q1);
const q2VeryGood = syntheticInput("q2", "q2-mb", "other-value", q2);
const q2Good = syntheticInput("q2", "q2-b", "selected-value", q2, { checked: true });
const q3VeryGood = syntheticInput("q3", "q3-mb", "third-value", q3);
const q3Good = syntheticInput("q3", "q3-b", "another-value", q3);
const q4VeryGood = syntheticInput("q4", "q4-mb", "already-value", q4, { checked: true });
const q1VeryGoodHidden = syntheticInput("q1", "q1-mb-hidden", "hidden-value", q1, { style: { display: "none" } });
const q1VeryGoodDisabled = syntheticInput("q1", "q1-mb-disabled", "disabled-value", q1, { disabled: true });
const labelsForForm = [formLabel("q1-ex", "Excelente"), formLabel("q1-mb", "Muy Bueno"), formLabel("q1-mb-hidden", "Muy Bueno"), formLabel("q1-mb-disabled", "Muy Bueno"), formLabel("q2-mb", "Muy Bueno"), formLabel("q2-b", "Bueno"), formLabel("q3-mb", "Muy Bueno"), formLabel("q3-b", "Bueno"), formLabel("q4-mb", "Muy Bueno")];
const protectedManual = (tagName, type, name, checked) => {
  const input = { tagName, type, name, id: name, checked: Boolean(checked), style: {}, parentElement: formQuestion(name), getAttribute: () => null, closest: () => formQuestion(name) };
  Object.defineProperty(input, "value", { get() { throw new Error(`${name} value must not be read`); } });
  return input;
};
const manualText = protectedManual("TEXTAREA", "textarea", "comment", false);
const manualInput = protectedManual("INPUT", "text", "short-answer", false);
const manualSelect = protectedManual("SELECT", "select-one", "choice", false);
const manualCheckbox = { tagName: "INPUT", type: "checkbox", name: "consent", id: "consent", checked: false, style: {}, parentElement: formQuestion("Consentimiento"), getAttribute: () => null, closest: () => formQuestion("Consentimiento") };
const hiddenInput = { type: "hidden", value: "synthetic-hidden-value" };
let radioOrder = formInputs;
const syntheticForm = {
  style: {}, parentElement: null, getAttribute: () => null,
  querySelector(selector) { return selector.includes("input") ? formInputs[0] : null; },
  querySelectorAll(selector) {
    if (selector === 'input[type="radio"]') return radioOrder;
    if (selector === "label") return labelsForForm;
    if (selector.includes("textarea")) return [manualText, manualInput, manualSelect, manualCheckbox];
    return [];
  },
  contains(input) { return formInputs.includes(input); },
  submit() { throw new Error("submit must not be called"); }
};
const responseDocument = {
  location: { href: "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=synthetic-feedback", pathname: "/mod/feedback/complete.php" },
  querySelectorAll: () => [syntheticForm]
};
const viewDocument = { location: { href: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=synthetic-feedback", pathname: "/mod/feedback/view.php" }, querySelectorAll: () => [syntheticForm] };
assert.equal(core.inspectFeedbackForm(viewDocument), null);
const inspectedForm = core.inspectFeedbackForm(responseDocument);
assert.equal(inspectedForm.id, "synthetic-feedback");
assert.equal(inspectedForm.questions.length, 8);
assert.equal(inspectedForm.supportedQuestions, 4);
assert.equal(inspectedForm.unsupportedQuestions, 4);
assert.equal(inspectedForm.questions[0].options[1].label, "Muy Bueno");
assert.equal(inspectedForm.questions[0].options[1].value, "value-7");
assert.equal(inspectedForm.questions[1].answered, true);
assert.equal(inspectedForm.questions[0].required, true);
assert.equal(inspectedForm.questions[1].required, null);
assert.equal(inspectedForm.preferenceOptions.includes("Muy Bueno"), true);
assert.equal(inspectedForm.preferenceOptions.includes("Bueno"), false);
assert.equal(inspectedForm.canPrefill, true);
assert.equal(typeof inspectedForm.signature, "string");
assert.equal(inspectedForm.signature.includes("value-7"), false);
assert.equal(inspectedForm.signature.includes("hidden-value"), false);
assert.equal(inspectedForm.questions.find((item) => item.id === "comment").answered, null);
assert.equal(inspectedForm.questions.find((item) => item.id === "short-answer").answered, null);
assert.equal(inspectedForm.questions.find((item) => item.id === "choice").answered, null);
assert.equal(inspectedForm.questions.find((item) => item.id === "consent").answered, false);
assert.equal(core.feedbackPrefillPreview(inspectedForm, "Muy Bue").preference, null);
const preview = core.feedbackPrefillPreview(inspectedForm, "Muy Bueno");
assert.equal(preview.changed, 2);
assert.equal(preview.skippedExisting, 1);
assert.equal(preview.missingOption, 0);
assert.equal(core.prefillFeedbackForm(responseDocument, "Muy Bueno", "synthetic-feedback", 99, inspectedForm.signature).changed, 0);

labelsForForm.find((label) => label.htmlFor === "q4-mb").textContent = "Excelente";
const noCommonPreference = core.inspectFeedbackForm(responseDocument);
assert.deepEqual(noCommonPreference.preferenceOptions, []);
assert.equal(noCommonPreference.canPrefill, false);
labelsForForm.find((label) => label.htmlFor === "q4-mb").textContent = "Muy Bueno";

q4VeryGood.name = "q4-different";
const differentQuestion = core.prefillFeedbackForm(responseDocument, "Muy Bueno", "synthetic-feedback", inspectedForm.questions.length, inspectedForm.signature);
assert.equal(differentQuestion.changed, 0);
assert.equal(differentQuestion.staleForm, true);
assert.equal(differentQuestion.reason, "form-changed");
assert.equal(q1VeryGood.checked, false);
q4VeryGood.name = "q4";

labelsForForm.find((label) => label.htmlFor === "q3-mb").textContent = "Excelente";
const differentOptions = core.prefillFeedbackForm(responseDocument, "Muy Bueno", "synthetic-feedback", inspectedForm.questions.length, inspectedForm.signature);
assert.equal(differentOptions.changed, 0);
assert.equal(differentOptions.reason, "form-changed");
assert.equal(q1VeryGood.checked, false);
labelsForForm.find((label) => label.htmlFor === "q3-mb").textContent = "Muy Bueno";

radioOrder = formInputs.slice().reverse();
const differentOrder = core.prefillFeedbackForm(responseDocument, "Muy Bueno", "synthetic-feedback", inspectedForm.questions.length, inspectedForm.signature);
assert.equal(differentOrder.changed, 0);
assert.equal(differentOrder.reason, "form-changed");
assert.equal(q1VeryGood.checked, false);
radioOrder = formInputs;

const prefill = core.prefillFeedbackForm(responseDocument, "Muy Bueno", "synthetic-feedback", inspectedForm.questions.length, inspectedForm.signature);
assert.equal(prefill.changed, 2);
assert.equal(prefill.skippedExisting, 1);
assert.equal(prefill.alreadyMatching, 1);
assert.equal(prefill.missingOption, 0);
assert.equal(prefill.unsupported, 4);
assert.equal(prefill.submitted, false);
assert.equal(q1VeryGood.checked, true);
assert.equal(q2Good.checked, true);
assert.equal(q3VeryGood.checked, true);
assert.equal(q3Good.checked, false);
assert.equal(q1VeryGoodHidden.checked, false);
assert.equal(q1VeryGoodDisabled.checked, false);
assert.deepEqual(events, ["q1-mb:input", "q1-mb:change", "q3-mb:input", "q3-mb:change"]);
const formDiagnostic = core.sanitizeDiagnostic({ scannerVersion: core.VERSION, pageType: "FEEDBACK", feedbackForm: inspectedForm, courses: [], modules: [], activities: [], feedback: [], errors: [] });
assert.equal(JSON.stringify(formDiagnostic).includes("synthetic-hidden-value"), false);
assert.equal(JSON.stringify(formDiagnostic).includes("value-7"), false);
assert.equal(JSON.stringify(formDiagnostic).includes("comment"), true);
assert.equal(Object.hasOwn(formDiagnostic.feedbackForm, "signature"), false);
assert.equal(formDiagnostic.feedbackForm.questions.find((item) => item.id === "comment").answered, null);
assert.equal(formDiagnostic.feedbackForm.questions.find((item) => item.id === "consent").answered, false);
console.log("core smoke tests passed");
