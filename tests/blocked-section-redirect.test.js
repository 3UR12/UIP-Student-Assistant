/* Service-level regressions for Moodle redirects, scan coalescing, and bounded recovery. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const origin = "https://moodle.uip.edu.pa";
const course = { id: "8169", name: "UAT Moodle", url: `${origin}/course/view.php?id=8169` };
const modules = [1, 2, 3].map((number) => ({ id: `71${number}`, name: `Módulo #${number}`, url: `${origin}/course/section.php?id=71${number}` }));
const tick = (milliseconds = 3) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function loadEngine() {
  const context = { globalThis: {}, URL, Set, JSON, Math, Date };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/background/automation-engine.js", "utf8"), context, { filename: "automation-engine.js" });
  return context.UIPAutomationEngine;
}
const engine = loadEngine();

function serviceHarness(seed) {
  const stored = { "uip.automation.v2": seed };
  const updates = [];
  const alarms = [];
  const tabs = new Map([[41, { id: 41, url: modules[0].url }]]);
  const listeners = {};
  let onMessage = null;
  const listenerSlot = (name) => ({ addListener(listener) { listeners[name] = listener; } });
  const chrome = {
    runtime: {
      lastError: null,
      getURL(path) { return `chrome-extension://test/${path}`; },
      sendMessage() { return Promise.resolve(); },
      onMessage: { addListener(listener) { onMessage = listener; } }
    },
    storage: { session: {
      async get(key) { await tick(Math.floor(Math.random() * 3)); return { [key]: stored[key] }; },
      async set(value) { await tick(Math.floor(Math.random() * 3)); Object.assign(stored, value); },
      async remove(key) { delete stored[key]; }
    } },
    action: { onClicked: listenerSlot("action") },
    alarms: { create(name, options) { alarms.push({ name, options }); }, async clear() { return true; }, onAlarm: listenerSlot("alarm") },
    tabs: {
      query(_query, callback) { callback(Array.from(tabs.values())); },
      get(id, callback) { callback(tabs.get(id)); },
      create(properties, callback) { const tab = { id: 99, ...properties }; tabs.set(tab.id, tab); callback(tab); },
      update(id, properties, callback) { const tab = { id, ...(tabs.get(id) || {}), ...properties }; tabs.set(id, tab); updates.push(tab); callback(tab); },
      sendMessage(_id, _message, callback) { callback(null); },
      onRemoved: listenerSlot("removed"), onUpdated: listenerSlot("updated")
    }
  };
  const context = { globalThis: {}, URL, Set, JSON, Math, Date, Promise, chrome, console };
  context.globalThis = context;
  context.importScripts = (path) => vm.runInContext(fs.readFileSync(`extension/background/${path}`, "utf8"), context, { filename: path });
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/background/workflow-service.js", "utf8"), context, { filename: "workflow-service.js" });
  return {
    stored, updates, alarms, listeners,
    page(scan) { assert.equal(onMessage({ type: "UIP_MOODLE_PAGE_READY", scan }, { tab: { id: 41 } }, () => {}), false); },
    async settle() { for (let index = 0; index < 6; index += 1) await tick(); }
  };
}

const completedSection = (module) => ({
  pageType: "SECTION", course: { id: course.id }, currentSection: { id: module.id },
  feedback: [{ id: `88${module.id}`, name: `Encuesta ${module.id}`, url: `${origin}/mod/feedback/view.php?id=88${module.id}`, completionState: "completed", available: true }]
});

async function runRedirectScenario() {
  const seed = engine.start(engine.create({ course, modules, preference: "Muy bueno", workerTabId: 41 })).workflow;
  const harness = serviceHarness(seed);
  await harness.settle();

  // Module 1 completes normally and navigates to module 2 exactly once.
  harness.page(completedSection(modules[0]));
  await harness.settle();
  assert.equal(harness.updates.filter((tab) => tab.url === modules[1].url).length, 1);

  // Moodle redirects the module URL to the same course and renders its warning.
  harness.page({ pageType: "COURSE", course: { id: "8169" }, pageNotices: [{ type: "warning", text: "Módulo#2 no disponible" }] });
  await harness.settle();
  const afterRedirect = harness.stored["uip.automation.v2"];
  assert.equal(afterRedirect.modules[1].status, "blocked");
  assert.equal(afterRedirect.lastError, null);
  assert.equal(afterRedirect.status, "RUNNING");
  assert.equal(harness.updates.filter((tab) => tab.url === modules[1].url).length, 1, "redirect must not re-navigate the blocked section");
  assert.equal(harness.updates.filter((tab) => tab.url === modules[2].url).length, 1);
  assert.ok(afterRedirect.activityLog.some((item) => /no está disponible/i.test(item.label)));

  harness.page(completedSection(modules[2]));
  await harness.settle();
  const done = harness.stored["uip.automation.v2"];
  assert.equal(done.status, "DONE");
  assert.deepEqual(done.modules.map((module) => module.status), ["completed", "blocked", "completed"]);
  assert.equal(done.progress.reviewed, 3);
  assert.equal(done.progress.skipped, 1);
  assert.equal(harness.alarms.length > 0, true);
}

async function runDedupeScenario() {
  const seed = engine.start(engine.create({ course, modules: [modules[0]], preference: "Muy bueno", workerTabId: 41 })).workflow;
  const harness = serviceHarness(seed);
  await harness.settle();
  const sameCourse = { pageType: "COURSE", course: { id: course.id }, pageNotices: [] };
  const before = harness.stored["uip.automation.v2"].transition;
  harness.page(sameCourse); harness.page(sameCourse); harness.page(sameCourse);
  await harness.settle();
  const afterBurst = harness.stored["uip.automation.v2"].transition;
  assert.equal(afterBurst, before + 1, "same in-flight DOM observation must coalesce");
  harness.page(sameCourse);
  await harness.settle();
  assert.equal(harness.stored["uip.automation.v2"].transition, afterBurst + 1, "the same DOM fingerprint must be processed after a workflow transition");
}

function assertBoundedNavigation() {
  let transition = engine.start(engine.create({ course, modules: [modules[0]], preference: "Muy bueno", workerTabId: 41 }));
  let navigationCount = transition.effect.type === "NAVIGATE" ? 1 : 0;
  transition = engine.onScan(transition.workflow, { pageType: "COURSE", course: { id: course.id }, pageNotices: [] });
  assert.equal(transition.effect, null, "wrong page must wait instead of navigating in a loop");
  transition = engine.timeout(transition.workflow);
  navigationCount += transition.effect && transition.effect.type === "NAVIGATE" ? 1 : 0;
  transition = engine.onScan(transition.workflow, { pageType: "COURSE", course: { id: course.id }, pageNotices: [] });
  assert.equal(transition.effect, null);
  transition = engine.timeout(transition.workflow);
  navigationCount += transition.effect && transition.effect.type === "NAVIGATE" ? 1 : 0;
  assert.equal(navigationCount, 2, "initial navigation plus one watchdog retry is the hard maximum");
  assert.equal(transition.workflow.status, "DONE");
  assert.equal(transition.workflow.modules[0].status, "manual-required");
}

(async () => {
  const repeat = Number((process.argv.find((argument) => argument.startsWith("--repeat=")) || "--repeat=1").split("=")[1]);
  assert.ok(Number.isInteger(repeat) && repeat >= 1 && repeat <= 100, "--repeat must be an integer between 1 and 100");
  for (let index = 0; index < repeat; index += 1) {
    await runRedirectScenario();
    await runDedupeScenario();
    assertBoundedNavigation();
  }
  console.log(`blocked section redirect, transition dedupe, and bounded navigation tests passed ${repeat}/${repeat}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
