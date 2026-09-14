/* Integration checks for the MV3 background owner using a deterministic Chrome mock. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

(async () => {
  const stored = {};
  const updates = [];
  const created = [];
  const alarms = [];
  const listeners = {};
  const tabs = new Map([[41, { id: 41, url: "https://moodle.uip.edu.pa/my/" }]]);
  let nextTabId = 99;
  let messageListener = null;
  const listenerSlot = (name) => ({ addListener(value) { listeners[name] = value; } });
  const chrome = {
    runtime: {
      lastError: null,
      getURL(path) { return `chrome-extension://test/${path}`; },
      sendMessage() { return Promise.resolve(); },
      onMessage: { addListener(value) { messageListener = value; } }
    },
    storage: { session: {
      async get(key) { return { [key]: stored[key] }; },
      async set(value) { Object.assign(stored, value); },
      async remove(key) { delete stored[key]; }
    } },
    action: { onClicked: listenerSlot("action") },
    alarms: { create(name, options) { alarms.push({ name, options }); }, async clear() { return true; }, onAlarm: listenerSlot("alarm") },
    tabs: {
      query(_query, callback) { callback(Array.from(tabs.values())); },
      get(id, callback) { callback(tabs.get(id)); },
      create(properties, callback) { const tab = { id: nextTabId++, ...properties }; tabs.set(tab.id, tab); created.push(tab); callback(tab); },
      update(id, properties, callback) { const tab = { ...(tabs.get(id) || { id }), ...properties, id }; tabs.set(id, tab); updates.push(tab); callback(tab); },
      sendMessage(_id, _message, callback) { callback(null); },
      onRemoved: listenerSlot("removed"),
      onUpdated: listenerSlot("updated")
    }
  };
  const context = { globalThis: {}, URL, Set, JSON, Math, Date, Promise, chrome, console };
  context.globalThis = context;
  context.importScripts = (path) => vm.runInContext(fs.readFileSync(`extension/background/${path}`, "utf8"), context, { filename: path });
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/background/workflow-service.js", "utf8"), context, { filename: "workflow-service.js" });

  const request = (message, sender = {}) => new Promise((resolve) => {
    const retained = messageListener(message, sender, resolve);
    assert.equal(retained, true, `message ${message.type} must keep its response channel`);
  });
  const initial = await request({ type: "UIP_AUTOMATION_GET_STATE" });
  assert.equal(initial.ok, true);
  assert.equal(initial.workflow, null);

  const discovery = await request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
  assert.equal(discovery.ok, true);
  assert.equal(created.at(-1).url, "https://moodle.uip.edu.pa/my/courses.php");
  assert.equal(created.at(-1).id, 99, "an unrelated Moodle tab is never repurposed as the worker");
  assert.equal(stored["uip.automation.discovery.v1"].courses.length, 0);
  const workerTabId = stored["uip.automation.discovery.v1"].workerTabId;

  const ready = messageListener({ type: "UIP_MOODLE_PAGE_READY", scan: { pageType: "MY_COURSES", courses: [{ id: "9001", name: "Curso", url: "https://moodle.uip.edu.pa/course/view.php?id=9001" }] } }, { tab: { id: workerTabId } }, () => {});
  assert.equal(ready, false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(stored["uip.automation.discovery.v1"].courses[0].id, "9001");

  const selected = await request({ type: "UIP_AUTOMATION_SELECT_COURSE", course: { id: "9001", name: "forged", url: "https://moodle.uip.edu.pa/course/view.php?id=9001" } });
  assert.equal(selected.ok, true);
  assert.equal(updates.at(-1).url, "https://moodle.uip.edu.pa/course/view.php?id=9001");
  messageListener({ type: "UIP_MOODLE_PAGE_READY", scan: { pageType: "COURSE", course: { id: "9001", name: "Curso", url: "https://moodle.uip.edu.pa/course/view.php?id=9001" }, modules: [{ id: "7000", name: null, url: "https://moodle.uip.edu.pa/course/section.php?id=7000", available: true, locked: false }, { id: "7001", name: "Semana 1", url: "https://moodle.uip.edu.pa/course/section.php?id=7001", available: true, locked: false }] } }, { tab: { id: workerTabId } }, () => {});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(stored["uip.automation.discovery.v1"].modules.find((item) => item.id === "7000").selectable, false);

  const invalidStart = await request({ type: "UIP_AUTOMATION_START", moduleIds: ["7000"], preference: "Muy bueno" });
  assert.equal(invalidStart.error, "invalid-configuration");
  const started = await request({ type: "UIP_AUTOMATION_START", moduleIds: ["7001"], preference: "Muy bueno" });
  assert.equal(started.ok, true);
  assert.equal(stored["uip.automation.v2"].status, "RUNNING");
  assert.equal(alarms.at(-1).name, "uip.automation.watchdog");
  assert.equal(updates.at(-1).url, "https://moodle.uip.edu.pa/course/section.php?id=7001");

  // Page-ready and tab-update duplicates are coalesced while the background drives one transition.
  const moduleReady = { type: "UIP_MOODLE_PAGE_READY", scan: { pageType: "SECTION", course: { id: "9001" }, currentSection: { id: "7001" }, feedback: [{ id: "8801", name: "Encuesta", url: "https://moodle.uip.edu.pa/mod/feedback/view.php?id=8801", completionState: "incomplete", available: true }] } };
  messageListener(moduleReady, { tab: { id: workerTabId } }, () => {});
  messageListener(moduleReady, { tab: { id: workerTabId } }, () => {});
  listeners.updated(workerTabId, { status: "complete" }, { id: workerTabId, url: "https://moodle.uip.edu.pa/course/section.php?id=7001" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(updates.filter((tab) => tab.url === "https://moodle.uip.edu.pa/mod/feedback/view.php?id=8801").length, 1);
  assert.equal(stored["uip.automation.v2"].phase, "OPEN_FEEDBACK");

  // Closing the persistent dashboard is observational only; the run keeps its state.
  listeners.action();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(tabs.get(100).url, "chrome-extension://test/dashboard/dashboard.html");
  tabs.delete(100);
  await listeners.removed(100);
  assert.equal(stored["uip.automation.v2"].status, "RUNNING");

  // Closing the Moodle worker pauses without losing the plan; a fresh worker can resume it.
  tabs.delete(workerTabId);
  await listeners.removed(workerTabId);
  assert.equal(stored["uip.automation.v2"].status, "PAUSED");
  assert.equal(stored["uip.automation.v2"].lastError.code, "worker-tab-closed");
  const reopened = await request({ type: "UIP_AUTOMATION_OPEN_MOODLE" });
  assert.equal(reopened.ok, true);
  assert.equal(reopened.workerTabId, 101);
  assert.equal(stored["uip.automation.v2"].workerTabId, 101);
  assert.ok(stored["uip.automation.v2"].transition > 0);
  const resumed = await request({ type: "UIP_AUTOMATION_RESUME" });
  assert.equal(resumed.ok, true);
  assert.equal(stored["uip.automation.v2"].status, "RUNNING");

  const pause = await request({ type: "UIP_AUTOMATION_PAUSE" });
  assert.equal(pause.ok, true);
  assert.equal(stored["uip.automation.v2"].pauseRequested, true);
  const cancel = await request({ type: "UIP_AUTOMATION_CANCEL" });
  assert.equal(cancel.ok, true);
  assert.equal(stored["uip.automation.v2"].status, "CANCELLED");
  const cleared = await request({ type: "UIP_AUTOMATION_NEW_RUN" });
  assert.equal(cleared.ok, true);
  assert.equal(stored["uip.automation.v2"], undefined);

  console.log("workflow service tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
