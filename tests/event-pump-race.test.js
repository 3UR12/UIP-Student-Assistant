/* Reproduces the authenticated UAT race: prefill -> immediate submit -> post-submit page-ready while the pump is busy. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadEngine() {
  const context = { globalThis: {}, URL, Set, JSON, Math, Date };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/background/automation-engine.js", "utf8"), context, { filename: "automation-engine.js" });
  return context.UIPAutomationEngine;
}
const engine = loadEngine();
const origin = "https://moodle.uip.edu.pa";
const course = { id: "9001", name: "Curso", url: `${origin}/course/view.php?id=9001` };
const selectedModule = { id: "7001", name: "Módulo #1", url: `${origin}/course/section.php?id=7001` };
const feedback = { id: "8801", name: "Envíanos tu opinión1", url: `${origin}/mod/feedback/view.php?id=8801`, completionState: "incomplete", available: true };
const sectionScan = { pageType: "SECTION", course: { id: "9001" }, currentSection: { id: "7001" }, feedback: [feedback] };
const viewScan = { pageType: "FEEDBACK", course: { id: "9001" }, feedbackPage: { id: "8801", canRespond: true, responseUrl: `${origin}/mod/feedback/complete.php?id=8801` } };
const formScan = { pageType: "FEEDBACK", course: { id: "9001" }, feedbackForm: { id: "8801", detected: true, canPrefill: true, preferenceOptions: ["Muy Bueno"], signature: "form-8801", questions: Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1) })) } };
const readySubmissionScan = { ...formScan, feedbackSubmission: { readyToSubmit: true, feedbackId: "8801", formSignature: "form-8801", supportedQuestions: 7 } };
const postSubmitScan = { pageType: "FEEDBACK", course: { id: "9001" }, feedbackResult: { feedbackId: "8801", submissionVerified: true, continueAction: { unique: true, kind: "link", signature: "continue-8801" } } };

async function runRaceScenario() {
  let workflow = engine.start(engine.create({ course, modules: [selectedModule], preference: "Muy Bueno", workerTabId: 41 })).workflow;
  workflow = engine.onScan(workflow, sectionScan).workflow;
  workflow = engine.onScan(workflow, viewScan).workflow;
  assert.equal(workflow.phase, "OPEN_FORM");
  const stored = { "uip.automation.v2": workflow };
  const listeners = {};
  const counts = { prefill: 0, submit: 0, continue: 0, watchdogRecoveries: 0 };
  const listenerSlot = (name) => ({ addListener(listener) { listeners[name] = listener; } });
  const chrome = {
    runtime: { lastError: null, getURL(path) { return `chrome-extension://test/${path}`; }, sendMessage() { return Promise.resolve(); }, onMessage: listenerSlot("message") },
    storage: { session: { async get(key) { await jitter(); return { [key]: stored[key] }; }, async set(value) { await jitter(); Object.assign(stored, value); }, async remove(key) { await jitter(); delete stored[key]; } } },
    action: { onClicked: listenerSlot("action") },
    alarms: { create() {}, async clear() { return true; }, onAlarm: listenerSlot("alarm") },
    tabs: {
      query(_query, callback) { setTimeout(() => callback([{ id: 41, url: `${origin}/mod/feedback/complete.php` }]), Math.floor(Math.random() * 3)); },
      get(id, callback) { setTimeout(() => callback(id === 41 ? { id: 41, url: `${origin}/mod/feedback/complete.php` } : null), Math.floor(Math.random() * 3)); },
      create(properties, callback) { setTimeout(() => callback({ id: 90, ...properties }), Math.floor(Math.random() * 3)); },
      update(id, properties, callback) { setTimeout(() => callback({ id, ...properties }), Math.floor(Math.random() * 3)); },
      sendMessage(id, message, callback) {
        assert.equal(id, 41);
        if (message.type === "UIP_SCAN_CURRENT_DOCUMENT") { setTimeout(() => callback(null), Math.floor(Math.random() * 3)); return; }
        if (message.type === "UIP_PREFILL_FEEDBACK") { counts.prefill += 1; setTimeout(() => callback({ ok: true, prefillResult: { staleForm: false }, scan: readySubmissionScan }), Math.floor(Math.random() * 3)); return; }
        if (message.type === "UIP_SUBMIT_FEEDBACK") {
          counts.submit += 1;
          // Moodle's completion document arrives before the submit callback unwinds.
          listeners.message({ type: "UIP_MOODLE_PAGE_READY", scan: postSubmitScan }, { tab: { id: 41 } }, () => {});
          setTimeout(() => callback({ ok: true, submitResult: { submitTriggered: true } }), Math.floor(Math.random() * 3));
          return;
        }
        if (message.type === "UIP_NAVIGATE_CONTINUE") {
          counts.continue += 1;
          listeners.message({ type: "UIP_MOODLE_PAGE_READY", scan: sectionScan }, { tab: { id: 41 } }, () => {});
          setTimeout(() => callback({ ok: true, navigationResult: { navigationTriggered: true } }), Math.floor(Math.random() * 3));
          return;
        }
        setTimeout(() => callback(null), Math.floor(Math.random() * 3));
      },
      onRemoved: listenerSlot("removed"), onUpdated: listenerSlot("updated")
    }
  };
  const context = { globalThis: {}, URL, Set, JSON, Math, Date, Promise, chrome, console };
  context.globalThis = context;
  context.importScripts = (path) => vm.runInContext(fs.readFileSync(`extension/background/${path}`, "utf8"), context, { filename: path });
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/background/workflow-service.js", "utf8"), context, { filename: "workflow-service.js" });
  const tick = () => new Promise((resolve) => setTimeout(resolve, 2));
  function jitter() { return new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3))); }
  await tick();

  // The first document load starts the whole chain. Duplicate tab/document events are intentional.
  listeners.message({ type: "UIP_MOODLE_PAGE_READY", scan: formScan }, { tab: { id: 41 } }, () => {});
  listeners.message({ type: "UIP_MOODLE_PAGE_READY", scan: formScan }, { tab: { id: 41 } }, () => {});
  listeners.updated(41, { status: "complete" }, { id: 41, url: `${origin}/mod/feedback/complete.php` });
  for (let index = 0; index < 30; index += 1) await tick();

  assert.equal(stored["uip.automation.v2"].status, "DONE", JSON.stringify({ phase: stored["uip.automation.v2"].phase, semantic: stored["uip.automation.v2"].semantic, transition: stored["uip.automation.v2"].transition, log: stored["uip.automation.v2"].activityLog.map((item) => item.label) }));
  assert.equal(stored["uip.automation.v2"].progress.submitted, 1);
  assert.equal(counts.prefill, 1);
  assert.equal(counts.submit, 1);
  assert.equal(counts.continue, 1);
  assert.equal(counts.watchdogRecoveries, 0);
}

(async () => {
  const repeat = Number((process.argv.find((argument) => argument.startsWith("--repeat=")) || "--repeat=1").split("=")[1]);
  assert.ok(Number.isInteger(repeat) && repeat >= 1 && repeat <= 100, "--repeat must be an integer between 1 and 100");
  for (let index = 0; index < repeat; index += 1) await runRaceScenario();
  console.log(`event pump race and real post-submit fixture tests passed ${repeat}/${repeat}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
