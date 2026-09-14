/* Terminal outcome, late-hydration, and repeated-issue safety regressions. */
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";

const context = { globalThis: {}, URL, Set, JSON, Math, Date };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("extension/background/automation-engine.js", "utf8"), context, { filename: "automation-engine.js" });
const engine = context.UIPAutomationEngine;
const origin = "https://moodle.uip.edu.pa";
const course = { id: "8170", name: "Arquitectura de Computadoras", url: `${origin}/course/view.php?id=8170` };
const module = (id) => ({ id: String(id), name: `Módulo #${id}`, url: `${origin}/course/section.php?id=${id}` });
const feedback = (id) => ({ id: String(id), name: "Envíanos tu Opinión3", url: `${origin}/mod/feedback/view.php?id=${id}`, completionState: "incomplete", available: true });
const create = (modules) => engine.create({ course, modules, preference: "Excelente", workerTabId: 41 });

// UAT terminal mix: DONE means traversal finished, not universal success.
const terminalModules = Array.from({ length: 15 }, (_, index) => module(7001 + index));
let terminal = create(terminalModules);
terminal = {
  ...terminal,
  status: "RUNNING",
  phase: "NEXT_MODULE",
  currentModuleIndex: 15,
  modules: terminal.modules.map((item, index) => index === 0 ? { ...item, status: "completed", outcomeReason: "submission-verified", feedbackSummary: [{ id: "8801", name: "Encuesta 1", status: "submitted", reason: "submission-verified" }] } : index === 1 ? { ...item, status: "completed", outcomeReason: "completed", feedbackSummary: [{ id: "8802", name: "Encuesta 2", status: "completed", reason: "completed" }] } : index === 2 ? { ...item, status: "manual-required", outcomeReason: "form-not-compatible", feedbackSummary: [{ id: "8803", name: "Envíanos tu Opinión3", status: "manual-required", reason: "form-not-compatible" }] } : { ...item, status: "blocked", outcomeReason: "module-blocked" })
};
terminal = engine.onScan(terminal, {}).workflow;
assert.equal(terminal.status, "DONE");
assert.equal(terminal.terminalOutcome, "COMPLETED_WITH_ISSUES");
assert.deepEqual(terminal.progress, { total: 15, reviewed: 15, submitted: 1, alreadyCompleted: 1, noFeedback: 0, skipped: 12, manualRequired: 1, failed: 0 });
const terminalMetadata = engine.metadata(terminal);
assert.equal(terminalMetadata.moduleOutcomes.length, 15);
assert.deepEqual(terminalMetadata.moduleOutcomes[2], { id: "7003", name: "Módulo #7003", status: "manual-required", reason: "form-not-compatible", feedbacks: [{ id: "8803", name: "Envíanos tu Opinión3", status: "manual-required", reason: "form-not-compatible" }] });
assert.equal(JSON.stringify(terminalMetadata).includes("Excelente"), false, "diagnostics never expose the selected answer");

let success = create([module(7101)]);
success = { ...success, status: "RUNNING", phase: "NEXT_MODULE", currentModuleIndex: 1, modules: [{ ...success.modules[0], status: "completed", outcomeReason: "completed", feedbackSummary: [{ id: "8811", name: "Encuesta", status: "completed", reason: "completed" }] }] };
success = engine.onScan(success, {}).workflow;
assert.equal(success.terminalOutcome, "SUCCESS");

// A Feedback shell can render before its response URL; wait for fresh evidence.
let hydrated = engine.start(create([module(7201)])).workflow;
hydrated = engine.onScan(hydrated, { pageType: "SECTION", course: { id: "8170" }, currentSection: { id: "7201" }, feedback: [feedback(8821)] }).workflow;
let transition = engine.onScan(hydrated, { pageType: "FEEDBACK", course: { id: "8170" }, feedbackPage: { id: "8821", canRespond: null, responseUrl: null } });
assert.equal(transition.workflow.phase, "WAIT_FEEDBACK");
assert.notEqual(transition.workflow.modules[0].status, "manual-required");
transition = engine.onScan(transition.workflow, { pageType: "FEEDBACK", course: { id: "8170" }, feedbackPage: { id: "8821", canRespond: true, responseUrl: `${origin}/mod/feedback/complete.php?id=8821` } });
assert.equal(transition.workflow.phase, "OPEN_FORM");
assert.equal(transition.effect.url, `${origin}/mod/feedback/complete.php?id=8821`);

// A form shell can likewise hydrate after the route is visible.
transition = engine.onScan(transition.workflow, { pageType: "FEEDBACK_FORM", course: { id: "8170" }, feedbackForm: { id: "8821", detected: false } });
assert.equal(transition.workflow.phase, "WAIT_FORM");
assert.notEqual(transition.workflow.modules[0].status, "manual-required");
transition = engine.onScan(transition.workflow, { pageType: "FEEDBACK_FORM", course: { id: "8170" }, feedbackForm: { id: "8821", detected: true, canPrefill: true, preferenceOptions: ["Excelente"], signature: "form-8821", questions: [{ id: "1" }] } });
assert.equal(transition.effect.type, "PREFILL");

// Three same technical manual outcomes pause instead of silently continuing.
let circuit = engine.start(create([module(7301), module(7302), module(7303), module(7304)])).workflow;
for (let index = 0; index < 3; index += 1) {
  const feedbackId = String(8831 + index);
  circuit = { ...circuit, currentFeedbackId: feedbackId };
  circuit = engine.markCurrentFeedback(circuit, "manual-required", "form-not-compatible").workflow;
  circuit = engine.onScan(circuit, { pageType: "SECTION", course: { id: "8170" }, currentSection: { id: String(7301 + index) }, feedback: [feedback(feedbackId)] }).workflow;
}
assert.equal(circuit.status, "PAUSED");
assert.equal(circuit.lastError.code, "repeated-manual-issue");
assert.equal(circuit.progress.manualRequired, 3);
console.log("terminal outcomes, late hydration, and repeated-issue circuit tests passed");
