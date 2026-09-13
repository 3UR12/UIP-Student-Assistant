/* Restart, duplicate-event, worker-loss, login, and watchdog safety contracts. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set, JSON, Math, Date };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("extension/background/automation-engine.js", "utf8"), context, { filename: "automation-engine.js" });
const engine = context.UIPAutomationEngine;
const origin = "https://moodle.uip.edu.pa";
const course = { id: "9001", name: "Curso", url: `${origin}/course/view.php?id=9001` };
const courseModule = { id: "7001", name: "Módulo", url: `${origin}/course/section.php?id=7001` };
const feedback = { id: "8801", name: "Feedback", url: `${origin}/mod/feedback/view.php?id=8801`, completionState: "incomplete", available: true };
const sectionScan = { pageType: "SECTION", course: { id: "9001" }, currentSection: { id: "7001" }, feedback: [feedback] };
const viewScan = { pageType: "FEEDBACK", course: { id: "9001" }, feedbackPage: { id: "8801", canRespond: true, responseUrl: `${origin}/mod/feedback/complete.php?id=8801` } };
const formScan = { pageType: "FEEDBACK_FORM", course: { id: "9001" }, feedbackForm: { id: "8801", detected: true, canPrefill: true, preferenceOptions: ["Muy Bueno"], signature: "form-8801", questions: Array.from({ length: 7 }, (_, index) => ({ id: String(index) })) } };
const submissionScan = { ...formScan, feedbackSubmission: { readyToSubmit: true, feedbackId: "8801", formSignature: "form-8801", supportedQuestions: 7 } };
const restore = (value) => engine.sanitize(JSON.parse(JSON.stringify(value)));
const configured = () => engine.create({ course, modules: [courseModule], preference: "Muy Bueno", workerTabId: 71 });

// Restart before module navigation and after module navigation preserves the plan and target.
let state = engine.start(configured()).workflow;
let restart = restore(state);
assert.equal(restart.status, "RUNNING");
let transition = engine.onScan(restart, sectionScan);
assert.equal(transition.effect.type, "NAVIGATE");
assert.equal(transition.effect.url, `${origin}/mod/feedback/view.php?id=8801`);

// Restart after feedback navigation goes to the observed response form, not a guessed submit.
state = transition.workflow;
restart = restore(state);
transition = engine.onScan(restart, viewScan);
assert.equal(transition.effect.url, `${origin}/mod/feedback/complete.php?id=8801`);

// Restart after prefill keeps verification-only state; it cannot prefill a second time.
state = transition.workflow;
transition = engine.onScan(state, formScan);
assert.equal(transition.effect.type, "PREFILL");
state = engine.onPrefill(transition.workflow, { ok: true, prefillResult: { staleForm: false } }).workflow;
restart = restore(state);
transition = engine.onScan(restart, submissionScan);
assert.equal(transition.effect.type, "SUBMIT");

// Restart immediately after the real submit click and duplicate page/tab events never submit again.
state = transition.workflow;
const afterSubmitClick = engine.onSubmit(state, { ok: true, submitResult: { submitTriggered: true } }).workflow;
restart = restore(afterSubmitClick);
const duplicateReady = engine.onScan(restart, formScan);
const duplicateTabUpdate = engine.onScan(restart, formScan);
assert.equal(duplicateReady.workflow.phase, "VERIFY_SUBMISSION");
assert.equal(duplicateReady.effect, null);
assert.equal(duplicateTabUpdate.effect, null);
assert.notEqual(duplicateReady.effect && duplicateReady.effect.type, "SUBMIT");

// Restart before post-submit verification accepts one fresh Moodle result and closes the module.
restart = restore(duplicateReady.workflow);
transition = engine.onScan(restart, { pageType: "FEEDBACK", course: { id: "9001" }, feedbackResult: { feedbackId: "8801", submissionVerified: true, continueAction: null } });
assert.equal(transition.workflow.phase, "RECHECK_SECTION");
transition = engine.onScan(transition.workflow, sectionScan);
assert.equal(transition.workflow.status, "DONE");
assert.equal(transition.workflow.progress.submitted, 1);

// A watchdog is bounded in every waiting phase and does not leave a loading state forever.
["OPEN_SECTION", "OPEN_FEEDBACK", "OPEN_FORM", "VERIFY_FORM", "VERIFY_SUBMISSION", "CONTINUE"].forEach((phase) => {
  const base = engine.start(configured()).workflow;
  const waiting = restore({ ...base, phase, semantic: "Esperando Moodle…" });
  const first = engine.timeout(waiting);
  const second = engine.timeout(first.workflow);
  assert.equal(first.effect.type, "SCAN");
  assert.ok(["DONE", "RUNNING"].includes(second.workflow.status));
  assert.equal(second.workflow.waitRetries, 0);
  assert.notEqual(second.workflow.phase, phase, `watchdog remained in ${phase}`);
});

const workerLost = engine.workerClosed(engine.start(configured()).workflow);
assert.equal(workerLost.status, "PAUSED");
assert.equal(workerLost.lastError.code, "worker-tab-closed");
const resumed = engine.resume(workerLost);
assert.equal(resumed.workflow.status, "RUNNING");
assert.equal(resumed.effect.type, "NAVIGATE");

const loggedOut = engine.onScan(engine.start(configured()).workflow, { sessionApparentlyNotStarted: true });
assert.equal(loggedOut.workflow.status, "LOGIN_REQUIRED");
const loggedIn = engine.resume(loggedOut.workflow);
assert.equal(loggedIn.workflow.status, "RUNNING");

// Closing/reopening the dashboard does not mutate the persisted machine state.
const dashboardClosedState = restore(engine.start(configured()).workflow);
assert.equal(engine.metadata(dashboardClosedState).status, "RUNNING");
assert.equal(engine.metadata(restore(dashboardClosedState)).runId, dashboardClosedState.runId);

console.log("lifecycle, idempotency, and watchdog tests passed");
