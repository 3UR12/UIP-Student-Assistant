/* Dashboard start controls must be derived from state across consecutive runs. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

class ClassList {
  constructor(hidden = false) { this.values = new Set(hidden ? ["hidden"] : []); }
  toggle(name, force) { if (force === undefined ? !this.values.has(name) : force) this.values.add(name); else this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}
function element(hidden = false) {
  return { classList: new ClassList(hidden), style: {}, value: "", textContent: "", innerHTML: "", disabled: false, listeners: {}, addEventListener(name, listener) { this.listeners[name] = listener; }, querySelectorAll() { return []; } };
}
const ids = ["notice", "setup-view", "running-view", "paused-view", "done-view", "course-select", "module-list", "modules-fieldset", "module-count", "rating-select", "setup-reason", "prepare-run", "confirm-run", "confirm-summary", "progress-bar", "progress-label", "run-state", "current-module", "current-action", "run-problem", "technical-output", "current-feedback", "moodle-connection", "last-activity", "step-elapsed", "metric-submitted", "metric-completed", "metric-empty", "metric-manual", "activity-log", "module-summary", "done-summary", "done-submitted", "done-completed", "done-empty", "done-manual", "paused-title", "paused-reason", "resume-run", "restart-run", "retry-courses", "select-all", "clear-all", "dismiss-confirm", "start-run", "pause-run", "cancel-run", "cancel-paused", "open-moodle", "new-run"];
const hidden = new Set(["running-view", "paused-view", "done-view", "confirm-run", "run-problem", "restart-run"]);
const modules = Array.from({ length: 15 }, (_, index) => ({ id: String(7001 + index), name: `Módulo ${index + 1}`, url: `https://moodle.uip.edu.pa/course/section.php?id=${7001 + index}`, available: true, locked: false, selectable: true }));

function discovery(course) {
  return { status: "modules-ready", course, courses: [course], modules };
}
function runningWorkflow() { return { status: "RUNNING", progress: { total: 15, reviewed: 0 }, modules: [], workerConnected: true, activityLog: [] }; }
function doneWorkflow() { return { status: "DONE", progress: { total: 15, reviewed: 15 }, modules: [], workerConnected: true, activityLog: [] }; }

async function createDashboard(startPlan = []) {
  const elements = new Map(ids.map((id) => [id, element(hidden.has(id))]));
  const hook = {};
  let backend = { workflow: null, discovery: discovery({ id: "8199", name: "Compiladores" }) };
  let startCount = 0;
  let pendingStart = null;
  const chrome = { runtime: { lastError: null, onMessage: { addListener() {} }, sendMessage(message, callback) {
    if (message.type === "UIP_AUTOMATION_GET_STATE") { callback({ ok: true, ...backend }); return; }
    if (message.type === "UIP_AUTOMATION_NEW_RUN") { backend = { ...backend, workflow: null }; callback({ ok: true }); return; }
    if (message.type === "UIP_AUTOMATION_START") {
      startCount += 1;
      const outcome = startPlan.shift() || "success";
      if (outcome === "deferred") { pendingStart = callback; return; }
      if (outcome === "failure") { callback({ ok: false, error: "background-unavailable" }); return; }
      backend = { ...backend, workflow: runningWorkflow() }; callback({ ok: true }); return;
    }
    callback({ ok: true });
  } } };
  const document = { querySelector(selector) { return elements.get(selector.slice(1)) || element(); } };
  const context = { globalThis: {}, document, chrome, console, Set, Array, Promise, JSON, Date, Math, setInterval() { return 1; } };
  context.globalThis = context;
  context.__UIP_DASHBOARD_TEST_HOOK__ = hook;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/dashboard/dashboard.js", "utf8"), context, { filename: "dashboard.js" });
  await Promise.resolve();
  const configure = (course) => {
    backend = { workflow: null, discovery: discovery(course) };
    hook.setState(backend);
    elements.get("rating-select").value = "Excelente";
    hook.setSelectedModuleIds(modules.map((module) => module.id));
    hook.renderSetup();
    hook.openConfirmation();
  };
  return {
    elements, hook, configure, get startCount() { return startCount; }, setDone() { backend = { ...backend, workflow: doneWorkflow() }; hook.setState(backend); hook.renderSetup(); }, resolveDeferredStart() { backend = { ...backend, workflow: runningWorkflow() }; pendingStart({ ok: true }); pendingStart = null; }
  };
}

(async () => {
  // Two complete runs preserve discovery data but no transient disabled control.
  const repeated = await createDashboard();
  repeated.configure({ id: "8199", name: "Compiladores" });
  await repeated.hook.startConfiguredRun();
  assert.equal(repeated.startCount, 1);
  repeated.setDone();
  await repeated.hook.beginNewRun();
  repeated.configure({ id: "8200", name: "Bases de datos" });
  assert.equal(repeated.elements.get("confirm-run").classList.contains("hidden"), false);
  assert.equal(repeated.elements.get("start-run").disabled, false);
  await repeated.hook.startConfiguredRun();
  assert.equal(repeated.startCount, 2, "a second run can start after DONE and Nuevo recorrido");

  // An unsuccessful start leaves confirmation available for a deliberate retry.
  const failed = await createDashboard(["failure", "success"]);
  failed.configure({ id: "8199", name: "Compiladores" });
  await failed.hook.startConfiguredRun();
  assert.equal(failed.hook.snapshot().startRequestRunning, false);
  assert.equal(failed.hook.snapshot().confirmationOpen, true);
  assert.equal(failed.elements.get("start-run").disabled, false);
  await failed.hook.startConfiguredRun();
  assert.equal(failed.startCount, 2);

  // The explicit latch prevents duplicate start messages while a request is in flight.
  const doubleClick = await createDashboard(["deferred"]);
  doubleClick.configure({ id: "8199", name: "Compiladores" });
  const first = doubleClick.hook.startConfiguredRun();
  const second = doubleClick.hook.startConfiguredRun();
  assert.equal(doubleClick.startCount, 1);
  assert.equal(doubleClick.elements.get("start-run").disabled, true);
  doubleClick.resolveDeferredStart();
  await Promise.all([first, second]);
  assert.equal(doubleClick.startCount, 1);

  // A reopened dashboard starts with no stale latch after a completed workflow.
  const reopened = await createDashboard();
  reopened.setDone();
  await reopened.hook.beginNewRun();
  reopened.configure({ id: "8200", name: "Bases de datos" });
  assert.equal(reopened.elements.get("start-run").disabled, false);

  // Stress consecutive DONE -> NEW_RUN -> START cycles without a stuck button.
  const stress = await createDashboard();
  for (let index = 0; index < 20; index += 1) {
    stress.configure({ id: String(8300 + index), name: `Materia ${index + 1}` });
    assert.equal(stress.elements.get("start-run").disabled, false);
    await stress.hook.startConfiguredRun();
    stress.setDone();
    await stress.hook.beginNewRun();
  }
  assert.equal(stress.startCount, 20);
  console.log("dashboard start lifecycle tests passed: second run, retry, double-click, reopen, 20/20");
})().catch((error) => { console.error(error); process.exitCode = 1; });
