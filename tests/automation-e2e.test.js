/* Deterministic end-to-end simulator: no dashboard action is permitted after START. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {}, URL, Set, JSON, Math, Date };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("extension/background/automation-engine.js", "utf8"), context, { filename: "automation-engine.js" });
const engine = context.UIPAutomationEngine;
const origin = "https://moodle.uip.edu.pa";

function fixtureFeedback(id, completionState = "incomplete") {
  return { id, name: `Feedback ${id}`, url: `${origin}/mod/feedback/view.php?id=${id}`, completionState, available: true };
}
function configuration(moduleCount = 2) {
  const modules = Array.from({ length: moduleCount }, (_, index) => ({
    id: String(7001 + index), name: `Módulo ${index + 1}`, url: `${origin}/course/section.php?id=${7001 + index}`
  }));
  return { course: { id: "9001", name: "Curso E2E", url: `${origin}/course/view.php?id=9001` }, modules, preference: "Muy Bueno", workerTabId: 51 };
}
function formScan(feedbackId) {
  return {
    pageType: "FEEDBACK_FORM", course: { id: "9001" },
    feedbackForm: { id: feedbackId, detected: true, canPrefill: true, preferenceOptions: ["Muy Bueno"], signature: `form-${feedbackId}`, questions: Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1) })) }
  };
}

function runAutomatedScenario(options = {}) {
  const config = configuration(options.moduleCount || 2);
  const feedbackByModule = options.feedbackByModule || new Map(config.modules.map((module, index) => [module.id, [fixtureFeedback(String(8801 + index))]]));
  const start = engine.start(engine.create(config));
  let workflow = start.workflow;
  let effect = start.effect;
  const submitCount = new Map();
  const history = [];
  let userActionsAfterStart = 0;
  let guard = 0;

  while (workflow.status !== "DONE") {
    assert.ok(guard++ < 100, `workflow stuck in ${workflow.phase}`);
    assert.ok(effect, `workflow stopped without terminal state in ${workflow.phase}`);
    history.push({ type: effect.type, phase: workflow.phase, module: workflow.currentModuleIndex, feedbackId: workflow.currentFeedbackId || null });
    let transition;
    const module = workflow.modules[workflow.currentModuleIndex];
    if (effect.type === "NAVIGATE" && effect.url.includes("/course/section.php")) {
      transition = engine.onScan(workflow, { pageType: "SECTION", course: { id: "9001" }, currentSection: { id: module.id }, feedback: feedbackByModule.get(module.id) || [] });
    } else if (effect.type === "NAVIGATE" && effect.url.includes("/mod/feedback/view.php")) {
      transition = engine.onScan(workflow, { pageType: "FEEDBACK", course: { id: "9001" }, feedbackPage: { id: workflow.currentFeedbackId, canRespond: true, responseUrl: `${origin}/mod/feedback/complete.php?id=${workflow.currentFeedbackId}` } });
    } else if (effect.type === "NAVIGATE" && effect.url.includes("/mod/feedback/complete.php")) {
      transition = engine.onScan(workflow, formScan(workflow.currentFeedbackId));
    } else if (effect.type === "PREFILL") {
      transition = engine.onPrefill(workflow, { ok: true, prefillResult: { staleForm: false } });
    } else if (effect.type === "SCAN") {
      transition = engine.onScan(workflow, { ...formScan(workflow.currentFeedbackId), feedbackSubmission: { readyToSubmit: true, feedbackId: workflow.currentFeedbackId, formSignature: `form-${workflow.currentFeedbackId}`, supportedQuestions: 7 } });
    } else if (effect.type === "SUBMIT") {
      const previous = submitCount.get(workflow.currentFeedbackId) || 0;
      submitCount.set(workflow.currentFeedbackId, previous + 1);
      assert.equal(previous, 0, `duplicate submit for Feedback ${workflow.currentFeedbackId}`);
      transition = engine.onSubmit(workflow, { ok: true, submitResult: { submitTriggered: true } });
    } else if (effect.type === "CONTINUE") {
      transition = engine.onContinue(workflow, { ok: true, navigationResult: { navigationTriggered: true } });
    } else {
      throw new Error(`unexpected effect ${effect.type}`);
    }

    workflow = transition.workflow;
    effect = transition.effect;
    if (!effect && workflow.status === "RUNNING" && workflow.phase === "VERIFY_SUBMISSION") {
      const continueAction = workflow.currentModuleIndex === 0 ? { unique: true, kind: "link", signature: `continue-${workflow.currentFeedbackId}` } : null;
      transition = engine.onScan(workflow, { pageType: "FEEDBACK", course: { id: "9001" }, feedbackResult: { feedbackId: workflow.currentFeedbackId, submissionVerified: true, continueAction } });
      workflow = transition.workflow;
      effect = transition.effect;
    }
    if (!effect && workflow.status === "RUNNING" && workflow.phase === "RECHECK_SECTION") {
      const current = workflow.modules[workflow.currentModuleIndex];
      transition = engine.onScan(workflow, { pageType: "SECTION", course: { id: "9001" }, currentSection: { id: current.id }, feedback: feedbackByModule.get(current.id) || [] });
      workflow = transition.workflow;
      effect = transition.effect;
    }
  }

  return { workflow, submitCount, history, userActionsAfterStart };
}

const repeats = Number((process.argv.find((argument) => argument.startsWith("--repeat=")) || "--repeat=1").split("=")[1]);
assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 1000, "--repeat must be an integer between 1 and 1000");
for (let iteration = 0; iteration < repeats; iteration += 1) {
  const result = runAutomatedScenario();
  assert.equal(result.workflow.status, "DONE");
  assert.equal(result.workflow.progress.reviewed, 2);
  assert.equal(result.workflow.progress.submitted, 2);
  assert.equal(result.submitCount.size, 2);
  assert.equal(Array.from(result.submitCount.values()).every((count) => count === 1), true);
  assert.equal(result.userActionsAfterStart, 0);
  assert.equal(result.history.filter((entry) => entry.type === "SUBMIT").length, 2);
}

const multi = runAutomatedScenario({
  moduleCount: 1,
  feedbackByModule: new Map([["7001", [fixtureFeedback("8801", "completed"), fixtureFeedback("8802"), fixtureFeedback("8803")]]])
});
assert.equal(multi.workflow.status, "DONE");
assert.equal(multi.workflow.progress.alreadyCompleted, 1);
assert.equal(multi.workflow.progress.submitted, 2);
assert.equal(multi.submitCount.get("8801"), undefined);
assert.equal(multi.submitCount.get("8802"), 1);
assert.equal(multi.submitCount.get("8803"), 1);

console.log(`automation e2e passed ${repeats}/${repeats}`);
