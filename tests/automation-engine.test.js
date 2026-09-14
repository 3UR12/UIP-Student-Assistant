/* Lifecycle and safety checks for the v0.5 background-owned automation engine. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set, JSON, Math, Date };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("extension/background/automation-engine.js", "utf8"), context, { filename: "automation-engine.js" });
const engine = context.UIPAutomationEngine;

const course = { id: "9001", name: "Ingeniería de software", url: "https://moodle.uip.edu.pa/course/view.php?id=9001" };
const modules = [
  { id: "7001", name: "Semana 1", url: "https://moodle.uip.edu.pa/course/section.php?id=7001" },
  { id: "7002", name: "Semana 2", url: "https://moodle.uip.edu.pa/course/section.php?id=7002" }
];
const section = (id, feedback) => ({ pageType: "SECTION", course: { id: "9001" }, currentSection: { id }, feedback });
const incomplete = (id) => ({ id, name: `Encuesta ${id}`, url: `https://moodle.uip.edu.pa/mod/feedback/view.php?id=${id}`, completionState: "incomplete", available: true });

function newWorkflow(selected = modules) {
  return engine.create({ course, modules: selected, preference: "Muy bueno", workerTabId: 41 });
}

let workflow = newWorkflow();
assert.equal(workflow.status, "READY_TO_START");
assert.equal(workflow.progress.total, 2);
assert.deepEqual(workflow.activityLog, []);
assert.equal(engine.create({ course, modules: [{ id: "7", url: "https://other.example/course/section.php?id=7" }], preference: "Bueno" }), null);

let transition = engine.start(workflow);
assert.equal(transition.workflow.status, "RUNNING");
assert.deepEqual(transition.effect, { type: "NAVIGATE", url: modules[0].url });
assert.equal(transition.workflow.activityLog.at(-1).label, "Abriendo módulo…");
workflow = transition.workflow;

// A warning for a different selected module is not enough to skip this one.
const unrelatedNotice = engine.onScan(workflow, { pageType: "COURSE", course: { id: "9001" }, pageNotices: [{ type: "warning", text: "Semana 2 no disponible" }] });
assert.equal(unrelatedNotice.workflow.modules[0].status, "running");
assert.equal(unrelatedNotice.effect, null);

function blockedByNotice(moduleName, notice) {
  const module = { id: "7999", name: moduleName, url: "https://moodle.uip.edu.pa/course/section.php?id=7999" };
  const running = engine.start(engine.create({ course, modules: [module], preference: "Muy bueno", workerTabId: 41 })).workflow;
  return engine.onScan(running, { pageType: "COURSE", course: { id: "9001" }, pageNotices: [{ type: "warning", text: notice }] }).workflow.modules[0].status;
}
assert.equal(blockedByNotice("Módulo#2 Memoria ROM y RAM", "Módulo#2 no disponible"), "blocked");
assert.notEqual(blockedByNotice("Módulo#2 Memoria ROM y RAM", "Módulo#3 no disponible"), "blocked");
assert.notEqual(blockedByNotice("Módulo #10", "Módulo#1 no disponible"), "blocked");
assert.equal(blockedByNotice("Módulo #2 - Memoria", "Módulo  #2 no disponible"), "blocked");
assert.notEqual(blockedByNotice("Módulo#2 Memoria ROM y RAM", "Contenido no disponible"), "blocked");

transition = engine.onScan(workflow, section("7001", [incomplete("8801")]));
assert.equal(transition.workflow.phase, "OPEN_FEEDBACK");
assert.equal(transition.effect.url, "https://moodle.uip.edu.pa/mod/feedback/view.php?id=8801");
workflow = transition.workflow;

transition = engine.onScan(workflow, { pageType: "FEEDBACK", course: { id: "9001" }, feedbackPage: { id: "8801", canRespond: true, responseUrl: "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=8801" } });
assert.equal(transition.workflow.phase, "OPEN_FORM");
assert.equal(transition.effect.url, "https://moodle.uip.edu.pa/mod/feedback/complete.php?id=8801");
workflow = transition.workflow;

const formScan = { pageType: "FEEDBACK_FORM", course: { id: "9001" }, feedbackForm: { id: "8801", detected: true, canPrefill: true, preferenceOptions: ["Muy bueno"], questions: [{ id: "1" }], signature: "form-8801" } };
transition = engine.onScan(workflow, formScan);
assert.equal(transition.effect.type, "PREFILL");
workflow = transition.workflow;
transition = engine.onPrefill(workflow, { ok: true, prefillResult: { staleForm: false } });
assert.equal(transition.effect.type, "SCAN");
workflow = transition.workflow;
transition = engine.onScan(workflow, { ...formScan, feedbackSubmission: { readyToSubmit: true, feedbackId: "8801", formSignature: "form-8801", supportedQuestions: 1 } });
assert.equal(transition.effect.type, "SUBMIT");
workflow = transition.workflow;
transition = engine.onSubmit(workflow, { ok: true, submitResult: { submitTriggered: true } });
assert.equal(transition.workflow.phase, "VERIFY_SUBMISSION");
assert.equal(transition.effect, null);
workflow = transition.workflow;

transition = engine.onScan(workflow, { pageType: "FEEDBACK", course: { id: "9001" }, feedbackResult: { feedbackId: "8801", submissionVerified: true, continueAction: null } });
assert.equal(transition.effect.type, "NAVIGATE");
assert.equal(transition.workflow.phase, "RECHECK_SECTION");
workflow = transition.workflow;
transition = engine.onScan(workflow, section("7001", [incomplete("8801")]));
assert.equal(transition.workflow.currentModuleIndex, 1);
assert.equal(transition.effect.url, modules[1].url);

// A duplicate submission must never be requested after a verified result.
const revisited = engine.onScan(transition.workflow, section("7002", [incomplete("8802")]));
assert.equal(revisited.effect.url, "https://moodle.uip.edu.pa/mod/feedback/view.php?id=8802");

const login = engine.onScan(engine.start(newWorkflow()).workflow, { sessionApparentlyNotStarted: true });
assert.equal(login.workflow.status, "LOGIN_REQUIRED");
assert.equal(login.effect, null);
const resumed = engine.resume(login.workflow);
assert.equal(resumed.workflow.status, "RUNNING");
assert.equal(resumed.effect.type, "NAVIGATE");

const pauseRequested = engine.pause(engine.start(newWorkflow()).workflow);
assert.equal(pauseRequested.pauseRequested, true);
const paused = engine.onScan(pauseRequested, section("7001", []));
assert.equal(paused.workflow.status, "PAUSED");
const cancelled = engine.cancel(paused.workflow);
assert.equal(cancelled.status, "CANCELLED");

const firstTimeout = engine.timeout(engine.start(newWorkflow()).workflow);
assert.equal(firstTimeout.effect.type, "NAVIGATE");
assert.equal(firstTimeout.effect.url, modules[0].url);
const secondTimeout = engine.timeout(firstTimeout.workflow);
assert.equal(secondTimeout.workflow.modules[0].status, "manual-required");
assert.equal(secondTimeout.effect.type, "NAVIGATE");

const stored = engine.sanitize({ ...engine.start(newWorkflow()).workflow, injectedHtml: "<form>secret</form>", course: { ...course, url: course.url, token: "secret" } });
assert.equal(JSON.stringify(stored).includes("secret"), false);
assert.equal(engine.sanitize({ version: 2, status: "RUNNING" }), null);
assert.deepEqual(engine.metadata(stored).modules.map((item) => item.id), ["7001", "7002"]);
assert.equal(JSON.stringify(engine.metadata(stored).modules).includes("secret"), false);
assert.ok(Array.isArray(engine.metadata(stored).activityLog));

console.log("automation engine tests passed");
