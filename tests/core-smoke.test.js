/* Dependency-free checks for pure URL classification and diagnostic sanitization. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set, Event };
context.globalThis = context;
vm.createContext(context);
["state.js", "moodle.js", "courses.js", "modules.js", "activities.js", "feedback.js", "feedback-form.js", "submission.js", "navigation.js", "notices.js", "workflow-navigation.js", "workflow-state.js", "sanitize.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(`extension/core/${file}`, "utf8"), context, { filename: file });
});

const core = context.UIPScannerCore;
assert.equal(core.VERSION, "0.5.0");
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
const unavailableNotice = { className: "alert alert-warning", textContent: "Módulo#2 no disponible", getAttribute: () => null, style: {}, parentElement: null };
assert.deepEqual(core.scanPageNotices({ querySelectorAll: () => [unavailableNotice] }, null, []), [{ type: "warning", text: "Módulo#2 no disponible" }]);
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
assert.equal(feedbackPage.name, "Envíanos tu Opinión3");
assert.equal(feedbackPage.responseUrl, "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=2059248");
assert.equal(feedbackPage.canRespond, true);
assert.equal(feedbackPage.completionState, "incomplete");

const activitySpecificHeading = node({}, "Envíanos tu Opinión3");
const genericCourseHeading = node({}, "Nombre completo del curso");
assert.equal(core.activityPageName({ querySelector: () => null }, { querySelector: () => activitySpecificHeading }), "Envíanos tu Opinión3");
assert.equal(core.activityPageName({ querySelector: () => null, genericCourseHeading }, { querySelector: () => null }), null);
const completionBreadcrumb = node({}, "Por hacer: Enviar retroalimentación");
assert.equal(core.activityPageName({ querySelector: () => completionBreadcrumb }, { querySelector: () => null }), null);
assert.equal(core.activityPageName({ querySelector: () => null }, { querySelector: () => null }), null);

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
const requiredIndicator = (attributes) => ({ tagName: "I", textContent: "Campo obligatorio", getAttribute: (name) => attributes[name] || null });
const requiredInput = { required: false, getAttribute: () => null };
const questionTextNode = { nodeType: 3, textContent: "La calidad del contenido del tema fue..." };
const requiredIcon = requiredIndicator({ title: "Campo obligatorio" });
const questionLabelWithIndicator = { tagName: "DIV", childNodes: [questionTextNode, requiredIcon], getAttribute: () => null };
const requiredQuestionContainer = {
  getAttribute: () => null,
  querySelector: () => questionLabelWithIndicator,
  querySelectorAll: () => [requiredIcon]
};
assert.equal(core.feedbackQuestionLabel(requiredQuestionContainer), "La calidad del contenido del tema fue...");
assert.equal(core.feedbackRequired([requiredInput], requiredQuestionContainer), true);
const ariaRequiredIcon = requiredIndicator({ "aria-label": "Campo obligatorio" });
assert.equal(core.feedbackRequired([requiredInput], { getAttribute: () => null, querySelectorAll: () => [ariaRequiredIcon] }), true);
const redIconWithoutText = { tagName: "I", className: "text-danger", getAttribute: () => null };
assert.equal(core.feedbackRequired([requiredInput], { getAttribute: () => null, querySelectorAll: () => [redIconWithoutText] }), null);
assert.equal(core.feedbackRequired([requiredInput], { getAttribute: () => null, querySelectorAll: () => [] }), null);
assert.equal(core.feedbackQuestionLabel({ querySelector: () => ({ textContent: "Pregunta literal <i class=\"icon\" title=\"Campo obligatorio\"></i>", getAttribute: () => null }) }), "Pregunta literal");
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

const makeSubmissionFixture = () => {
  const clicks = [];
  const radios = Array.from({ length: 7 }, (_, index) => ({ type: "radio", name: `multichoice_${index + 1}`, id: `radio-${index + 1}`, value: `safe-radio-${index + 1}`, checked: true, disabled: false, required: false, style: {}, parentElement: formQuestion(`Pregunta ${index + 1}`), getAttribute: () => null, closest() { return this.parentElement; }, dispatchEvent() {} }));
  const labels = radios.map((radio) => formLabel(radio.id, "Muy Bueno"));
  const submit = { tagName: "BUTTON", type: "submit", textContent: "Enviar sus respuestas", disabled: false, style: {}, getAttribute: (name) => name === "type" ? "submit" : null, click: () => clicks.push("submit") };
  const manual = [];
  const form = {
    style: {}, parentElement: null, getAttribute: () => null,
    querySelector(selector) { return selector.includes("input") || selector.includes("textarea") ? radios[0] : null; },
    querySelectorAll(selector) {
      if (selector === 'input[type="radio"]') return radios;
      if (selector === "label") return labels;
      if (selector.includes("textarea")) return manual;
      if (selector.includes('button[type="submit"]')) return this.submitControls || [submit];
      return [];
    },
    contains(element) { return radios.includes(element) || (this.submitControls || [submit]).includes(element); },
    submit() { throw new Error("form.submit must not be invoked"); },
    requestSubmit() { throw new Error("form.requestSubmit must not be invoked"); }
  };
  form.submitControls = [submit];
  const document = {
    location: { href: "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=2059248", pathname: "/mod/feedback/complete.php", origin: "https://moodle.uip.edu.pa" },
    querySelector: () => null,
    querySelectorAll: () => [form]
  };
  return { document, form, radios, submit, manual, clicks };
};

const readyFixture = makeSubmissionFixture();
const readySubmission = core.inspectFeedbackSubmission(readyFixture.document);
assert.equal(readySubmission.feedbackId, "2059248");
assert.equal(readySubmission.supportedQuestions, 7);
assert.equal(readySubmission.answeredSupportedQuestions, 7);
assert.equal(readySubmission.unsupportedQuestions, 0);
assert.equal(readySubmission.submitControl.unique, true);
assert.equal(readySubmission.readyToSubmit, true);
const editableResponseContext = core.feedbackPageContext(readyFixture.document, { querySelector: () => null, querySelectorAll: () => [] });
assert.equal(editableResponseContext.canRespond, true);
assert.equal(editableResponseContext.responseUrl, "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=2059248");
assert.equal(core.scanDocument(readyFixture.document).feedbackSubmission.readyToSubmit, true);
assert.deepEqual(readyFixture.clicks, []);
const prefillDoesNotSubmitFixture = makeSubmissionFixture();
const prefillDoesNotSubmitState = core.inspectFeedbackForm(prefillDoesNotSubmitFixture.document);
assert.equal(core.prefillFeedbackForm(prefillDoesNotSubmitFixture.document, "Muy Bueno", prefillDoesNotSubmitState.id, prefillDoesNotSubmitState.questions.length, prefillDoesNotSubmitState.signature).submitted, false);
assert.deepEqual(prefillDoesNotSubmitFixture.clicks, []);
const readyExpected = { feedbackId: readySubmission.feedbackId, formSignature: readySubmission.formSignature, supportedQuestions: readySubmission.supportedQuestions };
const triggeredSubmit = core.submitFeedback(readyFixture.document, readyExpected);
assert.equal(triggeredSubmit.submitTriggered, true);
assert.deepEqual(readyFixture.clicks, ["submit"]);

const unansweredFixture = makeSubmissionFixture();
unansweredFixture.radios[0].checked = false;
assert.equal(core.inspectFeedbackSubmission(unansweredFixture.document).readyToSubmit, false);
assert.equal(core.inspectFeedbackSubmission(unansweredFixture.document).blockers.includes("unanswered-supported-questions"), true);

const manualFixture = makeSubmissionFixture();
manualFixture.manual.push({ tagName: "SELECT", type: "select-one", name: "manual", id: "manual", style: {}, parentElement: formQuestion("Manual"), getAttribute: () => null, closest() { return this.parentElement; } });
assert.equal(core.inspectFeedbackSubmission(manualFixture.document).readyToSubmit, false);
assert.equal(core.inspectFeedbackSubmission(manualFixture.document).blockers.includes("unsupported-questions"), true);

const disabledSubmitFixture = makeSubmissionFixture();
disabledSubmitFixture.submit.disabled = true;
assert.equal(core.inspectFeedbackSubmission(disabledSubmitFixture.document).blockers.includes("submit-disabled"), true);
const hiddenSubmitFixture = makeSubmissionFixture();
hiddenSubmitFixture.submit.style.display = "none";
assert.equal(core.inspectFeedbackSubmission(hiddenSubmitFixture.document).blockers.includes("submit-hidden"), true);
const ambiguousSubmitFixture = makeSubmissionFixture();
const secondSubmit = { tagName: "INPUT", type: "submit", disabled: false, style: {}, getAttribute: (name) => name === "type" ? "submit" : name === "value" ? "Enviar" : null, click() { throw new Error("ambiguous submit must not click"); } };
ambiguousSubmitFixture.form.submitControls = [ambiguousSubmitFixture.submit, secondSubmit];
assert.equal(core.inspectFeedbackSubmission(ambiguousSubmitFixture.document).blockers.includes("ambiguous-submit"), true);
const outsideSubmitFixture = makeSubmissionFixture();
outsideSubmitFixture.form.submitControls = [{ tagName: "BUTTON", type: "submit", disabled: false, style: {}, getAttribute: (name) => name === "type" ? "submit" : null, click() {} }];
outsideSubmitFixture.form.contains = (element) => outsideSubmitFixture.radios.includes(element);
assert.equal(core.inspectFeedbackSubmission(outsideSubmitFixture.document).blockers.includes("missing-submit"), true);
const buttonFixture = makeSubmissionFixture();
buttonFixture.form.submitControls = [{ tagName: "BUTTON", type: "button", disabled: false, style: {}, getAttribute: (name) => name === "type" ? "button" : null, click() { throw new Error("type=button must not click"); } }];
assert.equal(core.inspectFeedbackSubmission(buttonFixture.document).blockers.includes("missing-submit"), true);
const cancelSubmitFixture = makeSubmissionFixture();
cancelSubmitFixture.submit.textContent = "Cancelar";
assert.equal(core.inspectFeedbackSubmission(cancelSubmitFixture.document).blockers.includes("missing-submit"), true);

const staleFixture = makeSubmissionFixture();
const staleExpected = core.inspectFeedbackSubmission(staleFixture.document);
staleFixture.document.location.href = "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=2059249";
assert.equal(core.submitFeedback(staleFixture.document, { feedbackId: staleExpected.feedbackId, formSignature: staleExpected.formSignature, supportedQuestions: staleExpected.supportedQuestions }).reason, "form-changed");
assert.deepEqual(staleFixture.clicks, []);
const changedAnswerFixture = makeSubmissionFixture();
const changedAnswerExpected = core.inspectFeedbackSubmission(changedAnswerFixture.document);
changedAnswerFixture.radios[2].checked = false;
assert.equal(core.submitFeedback(changedAnswerFixture.document, { feedbackId: changedAnswerExpected.feedbackId, formSignature: changedAnswerExpected.formSignature, supportedQuestions: changedAnswerExpected.supportedQuestions }).submitTriggered, false);
assert.deepEqual(changedAnswerFixture.clicks, []);
const changedSubmitFixture = makeSubmissionFixture();
const changedSubmitExpected = core.inspectFeedbackSubmission(changedSubmitFixture.document);
changedSubmitFixture.submit.disabled = true;
assert.equal(core.submitFeedback(changedSubmitFixture.document, { feedbackId: changedSubmitExpected.feedbackId, formSignature: changedSubmitExpected.formSignature, supportedQuestions: changedSubmitExpected.supportedQuestions }).submitTriggered, false);
assert.deepEqual(changedSubmitFixture.clicks, []);

const makeLink = (href, text, attributes) => ({ textContent: text, style: {}, className: attributes && attributes.className || "", getAttribute(name) { return name === "href" ? href : attributes && attributes[name] || null; }, clickCount: 0, click() { this.clickCount += 1; } });
const navigationDocument = { location: { href: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=2059248", pathname: "/mod/feedback/view.php" } };
const continueLink = makeLink("/course/view.php?id=8199", "Continuar");
const navigationScope = { querySelectorAll: () => [continueLink], contains: (link) => link === continueLink };
const continueAction = core.inspectContinueAction(navigationDocument, navigationScope);
assert.equal(continueAction.unique, true);
assert.equal(core.navigateContinue(navigationDocument, navigationScope, { kind: continueAction.kind, signature: continueAction.signature }).navigationTriggered, true);
assert.equal(continueLink.clickCount, 1);
const externalScope = { querySelectorAll: () => [makeLink("https://example.com/course/view.php?id=1", "Continuar"), makeLink("javascript:alert(1)", "Continuar")], contains: () => true };
assert.equal(core.inspectContinueAction(navigationDocument, externalScope).detected, false);
const ambiguousContinueScope = { querySelectorAll: () => [makeLink("/course/view.php?id=8199", "Continuar"), makeLink("/course/section.php?id=153820", "Volver al curso")], contains: () => true };
assert.equal(core.inspectContinueAction(navigationDocument, ambiguousContinueScope).unique, false);
const staleContinueLink = makeLink("/course/view.php?id=8199", "Continuar");
const staleContinueScope = { querySelectorAll: () => [staleContinueLink], contains: () => true };
const staleContinueAction = core.inspectContinueAction(navigationDocument, staleContinueScope);
staleContinueLink.getAttribute = (name) => name === "href" ? "/course/view.php?id=8200" : null;
assert.equal(core.navigateContinue(navigationDocument, staleContinueScope, { kind: staleContinueAction.kind, signature: staleContinueAction.signature }).navigationTriggered, false);
assert.equal(staleContinueLink.clickCount, 0);

const confirmationDocument = { location: { href: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=2059248", pathname: "/mod/feedback/view.php" }, querySelectorAll: () => [] };
const confirmationScope = { querySelector: () => ({}), querySelectorAll: () => [], contains: () => true };
const confirmationResult = core.inspectFeedbackResult(confirmationDocument, confirmationScope, { id: "2059248", completionState: "unknown" });
assert.equal(confirmationResult.state, "confirmation");
assert.equal(confirmationResult.submissionVerified, true);

const previousSectionLink = makeLink("/course/section.php?id=153819", "Anterior", { rel: "prev" });
const nextSectionLink = makeLink("/course/section.php?id=188888", "Siguiente", { rel: "next" });
previousSectionLink.parentElement = { className: "", querySelector: () => null };
nextSectionLink.parentElement = { className: "dimmed", querySelector: () => null };
const sectionNavigationDocument = { location: { href: "https://moodle.uip.edu.pa/course/section.php?id=153820", pathname: "/course/section.php" } };
const sectionNavigationScope = { querySelectorAll: () => [previousSectionLink, nextSectionLink] };
const sectionNavigation = core.inspectSectionNavigation(sectionNavigationDocument, sectionNavigationScope);
assert.equal(sectionNavigation.previous.id, "153819");
assert.equal(sectionNavigation.next.id, "188888");
assert.equal(sectionNavigation.next.available, false);
assert.notEqual(sectionNavigation.next.id, "153821");

const navigatorDiagnostic = core.sanitizeDiagnostic({ scannerVersion: core.VERSION, pageType: "FEEDBACK", feedbackSubmission: { feedbackId: "2059248", formDetected: true, formSignature: "safe-internal-signature", supportedQuestions: 7, answeredSupportedQuestions: 7, unsupportedQuestions: 0, submitControl: { detected: true, unique: true, enabled: true, visible: true, label: "Enviar" }, readyToSubmit: true, blockers: [] }, feedbackResult: { feedbackId: "2059248", state: "completed", completionState: "completed", submissionVerified: true, continueAction: { detected: true, unique: true, url: "https://moodle.uip.edu.pa/course/view.php?id=8199&sesskey=never-copy", label: "Continuar", signature: "internal-link-signature" } }, sectionNavigation, courses: [], modules: [], activities: [], feedback: [], errors: [] });
assert.equal(JSON.stringify(navigatorDiagnostic).includes("safe-internal-signature"), false);
assert.equal(JSON.stringify(navigatorDiagnostic).includes("internal-link-signature"), false);
assert.equal(JSON.stringify(navigatorDiagnostic).includes("sesskey"), false);

const breadcrumbFeedbackLink = (id, name) => ({ textContent: name, style: {}, parentElement: null, getAttribute: (attribute) => attribute === "href" ? `/mod/feedback/view.php?id=${id}` : null });
const completionEvidence = { textContent: "Hecho: Enviar retroalimentación", className: "", getAttribute: () => null };
const postSubmitBreadcrumb = breadcrumbFeedbackLink("2059248", "Envíanos tu Opinión3");
const postSubmitDocument = {
  location: { href: "https://moodle.uip.edu.pa/mod/feedback/complete.php", pathname: "/mod/feedback/complete.php", origin: "https://moodle.uip.edu.pa" },
  querySelectorAll(selector) { return selector.includes("breadcrumb") || selector.includes("page-navbar") ? [postSubmitBreadcrumb] : []; }
};
const postSubmitScope = {
  querySelector: () => ({ className: "alert-success", getAttribute: () => null }),
  querySelectorAll: (selector) => selector === core.selectors.completion ? [completionEvidence] : []
};
const recoveredContext = core.feedbackPageContext(postSubmitDocument, postSubmitScope);
assert.equal(recoveredContext.id, "2059248");
assert.equal(recoveredContext.name, "Envíanos tu Opinión3");
assert.equal(recoveredContext.url, "https://moodle.uip.edu.pa/mod/feedback/view.php?id=2059248");
assert.equal(recoveredContext.canRespond, false);
assert.equal(recoveredContext.responseUrl, null);
const recoveredResult = core.inspectFeedbackResult(postSubmitDocument, postSubmitScope, recoveredContext);
assert.equal(recoveredResult.state, "completed");
assert.equal(recoveredResult.submissionVerified, true);
const sameBreadcrumbDocument = { ...postSubmitDocument, querySelectorAll: (selector) => selector.includes("breadcrumb") || selector.includes("page-navbar") ? [postSubmitBreadcrumb, breadcrumbFeedbackLink("2059248", "Envíanos tu Opinión3")] : [] };
assert.equal(core.resolveFeedbackContext(sameBreadcrumbDocument).id, "2059248");
const ambiguousBreadcrumbDocument = { ...postSubmitDocument, querySelectorAll: (selector) => selector.includes("breadcrumb") || selector.includes("page-navbar") ? [postSubmitBreadcrumb, breadcrumbFeedbackLink("2059260", "Envíanos tu Opinión4")] : [] };
assert.equal(core.resolveFeedbackContext(ambiguousBreadcrumbDocument), null);
const noBreadcrumbDocument = { ...postSubmitDocument, querySelectorAll: () => [] };
assert.equal(core.resolveFeedbackContext(noBreadcrumbDocument), null);
const completeWithIdDocument = { ...postSubmitDocument, location: { href: "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=2059248", pathname: "/mod/feedback/complete.php", origin: "https://moodle.uip.edu.pa" }, querySelectorAll: () => [] };
assert.equal(core.resolveFeedbackContext(completeWithIdDocument).id, "2059248");
assert.equal(core.inspectFeedbackResult(readyFixture.document, null, { id: "2059248", completionState: "unknown" }).state, "still-editable");

const makeContinueButtonFixture = () => {
  const clicks = [];
  const hidden = { type: "hidden" };
  Object.defineProperty(hidden, "value", { get() { throw new Error("hidden value must never be read"); } });
  const form = {
    attributes: { method: "get", action: "https://moodle.uip.edu.pa/course/view.php" },
    getAttribute(name) { return this.attributes[name] || null; },
    contains(element) { return element === button || element === hidden; },
    submit() { throw new Error("continue form.submit must not be invoked"); },
    requestSubmit() { throw new Error("continue form.requestSubmit must not be invoked"); }
  };
  const button = {
    tagName: "BUTTON", type: "submit", textContent: "Continuar", disabled: false, style: {}, form,
    getAttribute(name) { return name === "type" ? "submit" : null; },
    click() { clicks.push("continue"); }
  };
  const document = { location: { href: "https://moodle.uip.edu.pa/mod/feedback/complete.php", pathname: "/mod/feedback/complete.php" } };
  const scope = {
    querySelectorAll(selector) { return selector === "a[href]" ? [] : [button]; },
    contains(element) { return element === button; }
  };
  return { document, scope, form, button, hidden, clicks };
};
const continueButtonFixture = makeContinueButtonFixture();
const continueButtonAction = core.inspectContinueAction(continueButtonFixture.document, continueButtonFixture.scope);
assert.equal(continueButtonAction.detected, true);
assert.equal(continueButtonAction.unique, true);
assert.equal(continueButtonAction.kind, "form-submit");
assert.equal(continueButtonAction.destinationPath, "/course/view.php");
assert.equal(continueButtonAction.method, "get");
assert.equal(continueButtonAction.url, null);
assert.equal(core.navigateContinue(continueButtonFixture.document, continueButtonFixture.scope, { kind: continueButtonAction.kind, signature: continueButtonAction.signature }).navigationTriggered, true);
assert.deepEqual(continueButtonFixture.clicks, ["continue"]);
const disabledContinueFixture = makeContinueButtonFixture();
disabledContinueFixture.button.disabled = true;
assert.equal(core.inspectContinueAction(disabledContinueFixture.document, disabledContinueFixture.scope).detected, false);
const hiddenContinueFixture = makeContinueButtonFixture();
hiddenContinueFixture.button.style.display = "none";
assert.equal(core.inspectContinueAction(hiddenContinueFixture.document, hiddenContinueFixture.scope).detected, false);
const postContinueFixture = makeContinueButtonFixture();
postContinueFixture.form.attributes.method = "post";
assert.equal(core.inspectContinueAction(postContinueFixture.document, postContinueFixture.scope).detected, false);
const externalContinueFixture = makeContinueButtonFixture();
externalContinueFixture.form.attributes.action = "https://example.com/course/view.php";
assert.equal(core.inspectContinueAction(externalContinueFixture.document, externalContinueFixture.scope).detected, false);
const scriptContinueFixture = makeContinueButtonFixture();
scriptContinueFixture.form.attributes.action = "javascript:alert(1)";
assert.equal(core.inspectContinueAction(scriptContinueFixture.document, scriptContinueFixture.scope).detected, false);
const dataContinueFixture = makeContinueButtonFixture();
dataContinueFixture.form.attributes.action = "data:text/html,continue";
assert.equal(core.inspectContinueAction(dataContinueFixture.document, dataContinueFixture.scope).detected, false);
const formactionContinueFixture = makeContinueButtonFixture();
formactionContinueFixture.button.getAttribute = (name) => name === "type" ? "submit" : name === "formaction" ? "https://example.com/course/view.php" : null;
assert.equal(core.inspectContinueAction(formactionContinueFixture.document, formactionContinueFixture.scope).detected, false);
const formmethodContinueFixture = makeContinueButtonFixture();
formmethodContinueFixture.button.getAttribute = (name) => name === "type" ? "submit" : name === "formmethod" ? "post" : null;
assert.equal(core.inspectContinueAction(formmethodContinueFixture.document, formmethodContinueFixture.scope).detected, false);
const ambiguousButtonFixture = makeContinueButtonFixture();
const secondContinueButton = { ...ambiguousButtonFixture.button, click() { throw new Error("ambiguous Continue must not click"); } };
ambiguousButtonFixture.form.contains = (element) => element === ambiguousButtonFixture.button || element === secondContinueButton || element === ambiguousButtonFixture.hidden;
ambiguousButtonFixture.scope.querySelectorAll = (selector) => selector === "a[href]" ? [] : [ambiguousButtonFixture.button, secondContinueButton];
ambiguousButtonFixture.scope.contains = (element) => element === ambiguousButtonFixture.button || element === secondContinueButton;
assert.equal(core.inspectContinueAction(ambiguousButtonFixture.document, ambiguousButtonFixture.scope).unique, false);
const mixedContinueFixture = makeContinueButtonFixture();
const mixedAnchor = makeLink("/course/view.php?id=8199", "Continuar");
mixedContinueFixture.scope.querySelectorAll = (selector) => selector === "a[href]" ? [mixedAnchor] : [mixedContinueFixture.button];
mixedContinueFixture.scope.contains = (element) => element === mixedContinueFixture.button || element === mixedAnchor;
assert.equal(core.inspectContinueAction(mixedContinueFixture.document, mixedContinueFixture.scope).unique, false);
const changedActionFixture = makeContinueButtonFixture();
const changedAction = core.inspectContinueAction(changedActionFixture.document, changedActionFixture.scope);
changedActionFixture.form.attributes.action = "https://moodle.uip.edu.pa/course/section.php";
assert.equal(core.navigateContinue(changedActionFixture.document, changedActionFixture.scope, { kind: changedAction.kind, signature: changedAction.signature }).reason, "navigation-changed");
assert.deepEqual(changedActionFixture.clicks, []);
const changedMethodFixture = makeContinueButtonFixture();
const changedMethod = core.inspectContinueAction(changedMethodFixture.document, changedMethodFixture.scope);
changedMethodFixture.form.attributes.method = "post";
assert.equal(core.navigateContinue(changedMethodFixture.document, changedMethodFixture.scope, { kind: changedMethod.kind, signature: changedMethod.signature }).navigationTriggered, false);
assert.deepEqual(changedMethodFixture.clicks, []);
const formContinueDiagnostic = core.sanitizeDiagnostic({ scannerVersion: core.VERSION, pageType: "FEEDBACK", feedbackResult: { feedbackId: "2059248", state: "completed", completionState: "completed", submissionVerified: true, continueAction: continueButtonAction }, courses: [], modules: [], activities: [], feedback: [], errors: [] });
assert.equal(formContinueDiagnostic.feedbackResult.continueAction.kind, "form-submit");
assert.equal(formContinueDiagnostic.feedbackResult.continueAction.destinationPath, "/course/view.php");
assert.equal(formContinueDiagnostic.feedbackResult.continueAction.method, "get");
assert.equal(JSON.stringify(formContinueDiagnostic).includes("signature"), false);

// v0.4 planner: only structurally proven, available section URLs may enter a plan.
const workflowCourse = { id: "9001" };
const workflowModules = [
  { id: "7001", url: "https://moodle.uip.edu.pa/course/section.php?id=7001", name: "Módulo 1", available: true, locked: false },
  { id: "7004", url: "https://moodle.uip.edu.pa/course/section.php?id=7004", name: "Módulo 2", available: null, locked: null },
  { id: "7010", url: "https://moodle.uip.edu.pa/course/section.php?id=7010", name: "Módulo 3", available: false, locked: true },
  { id: "7020", url: "https://moodle.uip.edu.pa/course/section.php?id=7021", name: "Incorrecta", available: true, locked: false },
  { id: "7040", url: "https://moodle.uip.edu.pa/course/section.php?id=7040", name: null, available: true, locked: false }
];
const workflowCandidates = core.workflowPlanCandidates(workflowCourse, workflowModules);
assert.deepEqual(workflowCandidates.map((item) => item.id), ["7001", "7004", "7010", "7040"]);
assert.equal(workflowCandidates[0].selectable, true);
assert.equal(workflowCandidates[1].selectable, false);
assert.equal(workflowCandidates[2].selectable, false);
assert.equal(workflowCandidates[3].autoSelected, false);
assert.equal(core.createWorkflowPlan("9001", "", workflowCandidates, ["7001"]), null);
assert.equal(core.createWorkflowPlan("9001", "Bueno", workflowCandidates, []), null);
const workflowPlan = core.createWorkflowPlan("9001", "Bueno", workflowCandidates, ["7001", "7004"]);
assert.deepEqual(workflowPlan.sections.map((item) => item.id), ["7001"]);
assert.equal(core.classifyWorkflowSection([]), "no-feedback");
assert.equal(core.classifyWorkflowSection([{ completionState: "completed", available: true }]), "completed");
assert.equal(core.classifyWorkflowSection([{ completionState: "incomplete", available: true }]), "needs-review");
assert.equal(core.classifyWorkflowSection([{ completionState: "incomplete", available: false }]), "blocked");
assert.equal(core.classifyWorkflowSection([{ completionState: "unknown", available: true }]), "unknown");
assert.equal(core.workflowNextSection({ sections: [{ id: "2", status: "completed" }, { id: "97", status: "pending" }], currentSectionId: "2" }).id, "97");

const makeWorkflowAnchor = (href, restricted) => ({
  style: {}, parentElement: { style: {}, className: restricted ? "dimmed" : "", querySelector: () => null },
  getAttribute: (name) => name === "href" ? href : null, clickCount: 0,
  click() { this.clickCount += 1; }
});
const workflowDocument = { location: { href: "https://moodle.uip.edu.pa/course/view.php?id=9001", pathname: "/course/view.php" } };
const goodSectionAnchor = makeWorkflowAnchor("/course/section.php?id=7001");
const workflowScope = { querySelectorAll: () => [goodSectionAnchor], contains: (item) => item === goodSectionAnchor };
const workflowExpected = { kind: "section", targetId: "7001", courseId: "9001" };
assert.equal(core.inspectWorkflowNavigation(workflowDocument, workflowScope, workflowExpected).unique, true);
assert.equal(core.navigateWorkflow(workflowDocument, workflowScope, workflowExpected).navigationTriggered, true);
assert.equal(goodSectionAnchor.clickCount, 1);
const wrongSectionAnchor = makeWorkflowAnchor("/course/section.php?id=7004");
assert.equal(core.inspectWorkflowNavigation(workflowDocument, { querySelectorAll: () => [wrongSectionAnchor], contains: () => true }, workflowExpected).detected, false);
const externalSectionAnchor = makeWorkflowAnchor("https://example.com/course/section.php?id=7001");
assert.equal(core.inspectWorkflowNavigation(workflowDocument, { querySelectorAll: () => [externalSectionAnchor], contains: () => true }, workflowExpected).detected, false);
const hiddenSectionAnchor = makeWorkflowAnchor("/course/section.php?id=7001"); hiddenSectionAnchor.style.display = "none";
assert.equal(core.inspectWorkflowNavigation(workflowDocument, { querySelectorAll: () => [hiddenSectionAnchor], contains: () => true }, workflowExpected).detected, false);
const restrictedSectionAnchor = makeWorkflowAnchor("/course/section.php?id=7001", true);
assert.equal(core.inspectWorkflowNavigation(workflowDocument, { querySelectorAll: () => [restrictedSectionAnchor], contains: () => true }, workflowExpected).detected, false);
const duplicateA = makeWorkflowAnchor("/course/section.php?id=7001"); const duplicateB = makeWorkflowAnchor("/course/section.php?id=7001");
assert.equal(core.inspectWorkflowNavigation(workflowDocument, { querySelectorAll: () => [duplicateA, duplicateB], contains: () => true }, workflowExpected).unique, false);
const feedbackAnchor = makeWorkflowAnchor("/mod/feedback/view.php?id=8801");
assert.equal(core.inspectWorkflowNavigation(workflowDocument, { querySelectorAll: () => [feedbackAnchor], contains: () => true }, { kind: "feedback", targetId: "8801", courseId: "9001" }).unique, true);
const responseAnchor = makeWorkflowAnchor("/mod/feedback/complete.php?id=8801");
assert.equal(core.navigateWorkflow(workflowDocument, { querySelectorAll: () => [responseAnchor], contains: () => true }, { kind: "response-form", targetId: "8801", courseId: "9001" }).navigationTriggered, true);
assert.equal(responseAnchor.clickCount, 1);
const breadcrumbAnchor = makeWorkflowAnchor("/course/view.php?id=9001");
workflowDocument.querySelectorAll = () => [breadcrumbAnchor];
assert.equal(core.navigateWorkflow(workflowDocument, workflowScope, { kind: "course-breadcrumb", targetId: "9001", courseId: "9001" }).navigationTriggered, true);
assert.equal(breadcrumbAnchor.clickCount, 1);
const staleWorkflowAnchor = makeWorkflowAnchor("/course/section.php?id=7001");
const staleWorkflowScope = { querySelectorAll: () => [staleWorkflowAnchor], contains: () => true };
const originalWorkflowInspect = core.inspectWorkflowNavigation;
let workflowInspectCount = 0;
core.inspectWorkflowNavigation = (...args) => { workflowInspectCount += 1; if (workflowInspectCount === 2) staleWorkflowAnchor.getAttribute = (name) => name === "href" ? "/course/section.php?id=7001&changed=1" : null; return originalWorkflowInspect(...args); };
assert.equal(core.navigateWorkflow(workflowDocument, staleWorkflowScope, workflowExpected).navigationTriggered, false);
assert.equal(staleWorkflowAnchor.clickCount, 0);
core.inspectWorkflowNavigation = originalWorkflowInspect;

// Pure state is shared; Chrome persistence exists only in the service worker.
const persisted = core.sanitizeWorkflow({ ...workflowPlan, sections: [{ ...workflowPlan.sections[0], formSignature: "must-not-persist", token: "must-not-persist" }], extra: "must-not-persist" });
assert.equal(JSON.stringify(persisted).includes("must-not-persist"), false);
assert.equal(core.sanitizeWorkflow({ version: 1, active: true, courseId: "9001", preference: "Bueno", sections: [{ id: "7001", url: "https://moodle.uip.edu.pa/course/section.php?id=7001", status: "not-a-status" }], currentSectionId: null }), null);
assert.equal(fs.existsSync("extension/popup") ? fs.readdirSync("extension/popup").length : 0, 0);

// The v0.4 popup hydration and manual workflow-storage tests were deliberately
// retired. v0.5 has no popup control surface and uses a new persisted engine;
// its lifecycle coverage lives in automation-engine.test.js.
console.log("core smoke tests passed");
