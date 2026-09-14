/* Discovery regressions: UI reads must not restart slow Moodle navigation. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const origin = "https://moodle.uip.edu.pa";
const tick = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const courses = (count) => Array.from({ length: count }, (_, index) => ({ id: String(8100 + index), name: `Materia ${index + 1}`, url: `${origin}/course/view.php?id=${8100 + index}` }));

function harness(initialDiscovery, options = {}) {
  const stored = initialDiscovery ? { "uip.automation.discovery.v1": initialDiscovery } : {};
  const updates = [];
  const created = [];
  const alarms = [];
  const workerMessages = [];
  const listeners = {};
  const tabs = new Map(options.noWorker ? [] : [[41, { id: 41, url: `${origin}/my/` }]]);
  let messageListener = null;
  const listenerSlot = (name) => ({ addListener(listener) { listeners[name] = listener; } });
  const chrome = {
    runtime: { lastError: null, getURL(path) { return `chrome-extension://test/${path}`; }, sendMessage() { return Promise.resolve(); }, onMessage: { addListener(listener) { messageListener = listener; } } },
    storage: { session: {
      async get(key) { await tick(Math.floor(Math.random() * 3)); return { [key]: stored[key] }; },
      async set(value) { await tick(Math.floor(Math.random() * 3)); Object.assign(stored, value); },
      async remove(key) { delete stored[key]; }
    } },
    action: { onClicked: listenerSlot("action") },
    alarms: { create(name, options) { alarms.push({ name, options }); }, async clear(name) { alarms.push({ clear: name }); return true; }, onAlarm: listenerSlot("alarm") },
    tabs: {
      query(_query, callback) { callback(Array.from(tabs.values())); },
      get(id, callback) { callback(tabs.get(id)); },
      create(properties, callback) { const tab = { id: 99, ...properties }; tabs.set(tab.id, tab); created.push(tab); callback(tab); },
      update(id, properties, callback) { const tab = { ...(tabs.get(id) || { id }), ...properties, id }; tabs.set(id, tab); updates.push(tab); callback(tab); },
      // Deliberately no scan response: page-ready controls the simulated Moodle delay.
      sendMessage(_id, message, callback) { workerMessages.push(message); callback({ ok: true }); },
      onRemoved: listenerSlot("removed"), onUpdated: listenerSlot("updated")
    }
  };
  const context = { globalThis: {}, URL, Set, JSON, Math, Date, Promise, chrome, console };
  context.globalThis = context;
  context.importScripts = (path) => vm.runInContext(fs.readFileSync(`extension/background/${path}`, "utf8"), context, { filename: path });
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/background/workflow-service.js", "utf8"), context, { filename: "workflow-service.js" });
  return {
    stored, updates, created, alarms, workerMessages, listeners,
    request(message) { return new Promise((resolve) => { assert.equal(messageListener(message, {}, resolve), true, `${message.type} must retain response channel`); }); },
    page(scan) { assert.equal(messageListener({ type: "UIP_MOODLE_PAGE_READY", scan }, { tab: { id: 41 } }, () => {}), false); },
    settled(kind, requestId, reason, scan, tabId = 41) { assert.equal(messageListener({ type: "UIP_MOODLE_DISCOVERY_SETTLED", kind, requestId, reason, scan }, { tab: { id: tabId } }, () => {}), false); },
    async settle() { for (let index = 0; index < 8; index += 1) await tick(); },
    homeNavigations() { return updates.filter((tab) => tab.url === `${origin}/my/`).length; },
    primaryNavigations() { return updates.filter((tab) => tab.url === `${origin}/my/courses.php`).length; }
  };
}

async function newWorkerPrimaryScenario() {
  const test = harness(null, { noWorker: true });
  const result = await test.request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
  assert.equal(result.ok, true);
  assert.equal(test.created.length, 1);
  assert.equal(test.created[0].url, `${origin}/my/courses.php`);
  assert.equal(test.primaryNavigations(), 0, "a newly created primary tab must not be updated a second time");
  assert.equal(test.homeNavigations(), 0);
}

async function slowMoodleScenario() {
  const test = harness();
  const calls = await Promise.all(Array.from({ length: 10 }, () => test.request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" })));
  assert.equal(calls.filter((result) => result.ok).length, 10);
  assert.equal(test.primaryNavigations(), 1, "concurrent discovery must navigate My Courses only once");
  const requestId = test.stored["uip.automation.discovery.v1"].requestId;
  assert.equal(test.stored["uip.automation.discovery.v1"].status, "loading-courses");

  // Moodle stays pending while the dashboard polls GET_STATE repeatedly.
  for (let index = 0; index < 10; index += 1) {
    const state = await test.request({ type: "UIP_AUTOMATION_GET_STATE" });
    assert.equal(state.discovery.status, "loading-courses");
    assert.equal(state.discovery.requestId, requestId);
  }
  assert.equal(test.primaryNavigations(), 1, "read-only dashboard refreshes must not restart discovery");

  test.listeners.updated(41, { status: "complete" }, { id: 41, url: `${origin}/my/courses.php` });
  test.page({ pageType: "MY_COURSES", courses: [] });
  await test.settle();
  assert.equal(test.stored["uip.automation.discovery.v1"].status, "loading-courses", "an early empty dashboard must not become a terminal result");
  assert.ok(test.workerMessages.some((message) => message.type === "UIP_BEGIN_DISCOVERY_SETTLEMENT" && message.kind === "courses"));
  const primaryDiagnostics = { sourcePage: "MY_COURSES", candidateLinks: 8, canonicalLinks: 6, visibleLinks: 5, excludedLinks: 1, acceptedCourses: 5 };
  test.settled("courses", requestId, "items-found", { pageType: "MY_COURSES", courses: courses(5), courseDiscovery: primaryDiagnostics });
  test.settled("courses", requestId, "items-found", { pageType: "MY_COURSES", courses: courses(5), courseDiscovery: primaryDiagnostics });
  await test.settle();
  const ready = test.stored["uip.automation.discovery.v1"];
  assert.equal(ready.status, "courses-ready");
  assert.equal(ready.requestId, requestId);
  assert.equal(ready.courses.length, 5);
  assert.equal(ready.discoverySource, "my-courses");
  assert.equal(ready.fallbackUsed, false);
  assert.deepEqual(ready.courseDiscovery, primaryDiagnostics);
  assert.equal(test.primaryNavigations(), 1);
  assert.equal(test.homeNavigations(), 0);
}

async function staleRefreshScenario() {
  const initial = { status: "courses-ready", requestId: "old", startedAt: null, courses: courses(5), modules: [], course: null, error: null };
  const test = harness(initial);
  const start = await test.request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
  assert.equal(start.ok, true);
  assert.equal(test.stored["uip.automation.discovery.v1"].status, "loading-courses");
  assert.equal(test.stored["uip.automation.discovery.v1"].courses.length, 5, "refresh must keep stale courses visible");
  test.page({ pageType: "MY_COURSES", courses: courses(6) });
  await test.settle();
  assert.equal(test.stored["uip.automation.discovery.v1"].status, "courses-ready");
  assert.equal(test.stored["uip.automation.discovery.v1"].courses.length, 6);

  await test.request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
  await test.listeners.alarm({ name: "uip.automation.discovery.timeout" });
  assert.equal(test.stored["uip.automation.discovery.v1"].status, "error");
  assert.equal(test.stored["uip.automation.discovery.v1"].courses.length, 6, "timeout must preserve the last usable list");
}

async function terminalDiscoveryScenarios() {
  const login = harness();
  await login.request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
  login.page({ sessionApparentlyNotStarted: true });
  await login.settle();
  assert.equal(login.stored["uip.automation.discovery.v1"].status, "login-required");
  assert.equal(login.primaryNavigations(), 1);

  const zero = harness();
  await zero.request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
  zero.page({ pageType: "MY_COURSES", courses: [] });
  await zero.settle();
  assert.equal(zero.stored["uip.automation.discovery.v1"].status, "loading-courses");
  zero.settled("courses", zero.stored["uip.automation.discovery.v1"].requestId, "settled-empty", { pageType: "MY_COURSES", courses: [] });
  await zero.settle();
  assert.equal(zero.stored["uip.automation.discovery.v1"].status, "loading-courses");
  assert.equal(zero.stored["uip.automation.discovery.v1"].discoverySource, "dashboard");
  assert.equal(zero.stored["uip.automation.discovery.v1"].fallbackUsed, true);
  assert.equal(zero.primaryNavigations(), 1);
  assert.equal(zero.homeNavigations(), 1, "empty primary result gets exactly one /my/ fallback");
  zero.page({ pageType: "AREA_PERSONAL", courses: [] });
  await zero.settle();
  zero.settled("courses", zero.stored["uip.automation.discovery.v1"].requestId, "settled-empty", { pageType: "AREA_PERSONAL", courses: [] });
  await zero.settle();
  assert.equal(zero.stored["uip.automation.discovery.v1"].status, "courses-ready");
  assert.equal(zero.stored["uip.automation.discovery.v1"].courses.length, 0);
  assert.equal(zero.homeNavigations(), 1, "fallback cannot loop");

  const expired = harness({ status: "loading-courses", requestId: "stale-request", startedAt: Date.now() - 16000, courses: courses(5), modules: [], course: null, error: null });
  await expired.settle();
  assert.equal(expired.stored["uip.automation.discovery.v1"].status, "error", "worker restart must not extend an expired discovery");
  assert.equal(expired.stored["uip.automation.discovery.v1"].courses.length, 5);
  assert.equal(expired.homeNavigations(), 0);
}

async function modulesAndStaleSettlementScenarios() {
  const initial = { status: "courses-ready", requestId: "courses-ready", workerTabId: 41, startedAt: null, courses: courses(1), modules: [], course: null, error: null };
  const modules = harness(initial);
  const selected = await modules.request({ type: "UIP_AUTOMATION_SELECT_COURSE", course: courses(1)[0] });
  assert.equal(selected.ok, true);
  const requestId = modules.stored["uip.automation.discovery.v1"].requestId;
  modules.page({ pageType: "COURSE", course: { id: "8100" }, modules: [] });
  await modules.settle();
  assert.equal(modules.stored["uip.automation.discovery.v1"].status, "loading-modules");
  modules.settled("modules", requestId, "items-found", { pageType: "COURSE", course: { id: "8100" }, modules: Array.from({ length: 16 }, (_, index) => ({ id: String(7000 + index), name: `Semana ${index + 1}`, url: `${origin}/course/section.php?id=${7000 + index}`, available: true, locked: false })) });
  await modules.settle();
  assert.equal(modules.stored["uip.automation.discovery.v1"].status, "modules-ready");
  assert.equal(modules.stored["uip.automation.discovery.v1"].modules.length, 16);

  const emptyModules = harness(initial);
  await emptyModules.request({ type: "UIP_AUTOMATION_SELECT_COURSE", course: courses(1)[0] });
  const emptyRequest = emptyModules.stored["uip.automation.discovery.v1"].requestId;
  emptyModules.page({ pageType: "COURSE", course: { id: "8100" }, modules: [] });
  await emptyModules.settle();
  emptyModules.settled("modules", emptyRequest, "settled-empty", { pageType: "COURSE", course: { id: "8100" }, modules: [] });
  await emptyModules.settle();
  assert.equal(emptyModules.stored["uip.automation.discovery.v1"].status, "modules-ready");
  assert.equal(emptyModules.stored["uip.automation.discovery.v1"].modules.length, 0);

  const stale = harness();
  await stale.request({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
  const requestA = stale.stored["uip.automation.discovery.v1"].requestId;
  // This represents a newer persisted request after a navigation/document replacement.
  stale.stored["uip.automation.discovery.v1"] = { ...stale.stored["uip.automation.discovery.v1"], requestId: "courses-new-request", settlement: null };
  stale.settled("courses", requestA, "items-found", { pageType: "MY_COURSES", courses: courses(5) });
  await stale.settle();
  assert.equal(stale.stored["uip.automation.discovery.v1"].requestId, "courses-new-request");
  assert.equal(stale.stored["uip.automation.discovery.v1"].status, "loading-courses");
}

(async () => {
  const repeat = Number((process.argv.find((argument) => argument.startsWith("--repeat=")) || "--repeat=1").split("=")[1]);
  assert.ok(Number.isInteger(repeat) && repeat >= 1 && repeat <= 100, "--repeat must be an integer between 1 and 100");
  for (let index = 0; index < repeat; index += 1) await slowMoodleScenario();
  await newWorkerPrimaryScenario();
  await staleRefreshScenario();
  await terminalDiscoveryScenarios();
  await modulesAndStaleSettlementScenarios();
  console.log(`discovery lifecycle and slow Moodle tests passed ${repeat}/${repeat}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
