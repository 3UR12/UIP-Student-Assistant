/* Regression harness for service-worker restart watchdog recovery and dashboard deduplication. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function createEngine() {
  const context = { globalThis: {}, URL, Set, JSON, Math, Date };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/background/automation-engine.js", "utf8"), context, { filename: "automation-engine.js" });
  return context.UIPAutomationEngine;
}
const engine = createEngine();
const initialWorkflow = engine.start(engine.create({
  course: { id: "9001", name: "Curso", url: "https://moodle.uip.edu.pa/course/view.php?id=9001" },
  modules: [{ id: "7001", name: "Módulo", url: "https://moodle.uip.edu.pa/course/section.php?id=7001" }],
  preference: "Muy Bueno", workerTabId: 71
})).workflow;

(async () => {
  const stored = { "uip.automation.v2": initialWorkflow };
  const alarmOperations = [];
  const createdTabs = [];
  const updates = [];
  const sentMessages = [];
  const listeners = {};
  const tabs = new Map([
    [55, { id: 55, url: "chrome-extension://test/dashboard/dashboard.html" }],
    [71, { id: 71, url: "https://moodle.uip.edu.pa/course/section.php?id=7001" }]
  ]);
  const listenerSlot = (name) => ({ addListener(listener) { listeners[name] = listener; } });
  const chrome = {
    runtime: {
      lastError: null,
      getURL(path) { return `chrome-extension://test/${path}`; },
      sendMessage() { return Promise.resolve(); },
      onMessage: listenerSlot("message")
    },
    storage: { session: {
      async get(key) { return { [key]: stored[key] }; },
      async set(value) { Object.assign(stored, value); },
      async remove(key) { delete stored[key]; }
    } },
    action: { onClicked: listenerSlot("action") },
    alarms: {
      create(name, options) { alarmOperations.push({ operation: "create", name, options }); },
      async clear(name) { alarmOperations.push({ operation: "clear", name }); return true; },
      onAlarm: listenerSlot("alarm")
    },
    tabs: {
      query(_query, callback) { callback(Array.from(tabs.values())); },
      get(id, callback) { callback(tabs.get(id)); },
      create(properties, callback) { const tab = { id: 100 + createdTabs.length, ...properties }; createdTabs.push(tab); tabs.set(tab.id, tab); callback(tab); },
      update(id, properties, callback) { const tab = { ...(tabs.get(id) || { id }), ...properties, id }; tabs.set(id, tab); updates.push(tab); callback(tab); },
      // The initial scan intentionally does not answer; watchdog must recover it.
      sendMessage(id, message, callback) { sentMessages.push({ id, message }); callback(null); },
      onRemoved: listenerSlot("removed"),
      onUpdated: listenerSlot("updated")
    }
  };
  const bootServiceWorker = () => {
    const context = { globalThis: {}, URL, Set, JSON, Math, Date, Promise, chrome, console };
    context.globalThis = context;
    context.importScripts = (path) => vm.runInContext(fs.readFileSync(`extension/background/${path}`, "utf8"), context, { filename: path });
    vm.createContext(context);
    vm.runInContext(fs.readFileSync("extension/background/workflow-service.js", "utf8"), context, { filename: "workflow-service.js" });
  };
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  bootServiceWorker();
  await tick();
  alarmOperations.length = 0;
  sentMessages.length = 0;

  // A fresh MV3 global has no dashboardTabId, but must reuse the existing page.
  bootServiceWorker();
  await tick();
  assert.equal(alarmOperations.at(-1).operation, "create");
  assert.equal(alarmOperations.at(-1).name, "uip.automation.watchdog");
  assert.equal(sentMessages.some((item) => item.message.type === "UIP_SCAN_CURRENT_DOCUMENT"), true);
  listeners.action();
  await tick();
  assert.equal(createdTabs.length, 0);
  assert.equal(updates.some((tab) => tab.id === 55 && tab.active === true), true);

  // No page-ready arrives. One retry is armed, then the bounded watchdog exits RUNNING safely.
  await listeners.alarm({ name: "uip.automation.watchdog" });
  assert.equal(stored["uip.automation.v2"].status, "RUNNING");
  assert.equal(stored["uip.automation.v2"].waitRetries, 1);
  assert.equal(alarmOperations.at(-1).operation, "create");
  await listeners.alarm({ name: "uip.automation.watchdog" });
  assert.equal(stored["uip.automation.v2"].status, "DONE");
  assert.equal(stored["uip.automation.v2"].progress.manualRequired, 1);
  assert.equal(stored["uip.automation.v2"].waitRetries, 0);

  console.log("service-worker restart, watchdog, and dashboard dedupe tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
