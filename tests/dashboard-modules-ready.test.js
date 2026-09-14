/* Dashboard regression: modules-ready must render, confirm, and start cleanly. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

class ClassList {
  constructor(hidden = false) { this.values = new Set(hidden ? ["hidden"] : []); }
  toggle(name, force) { if (force === undefined ? !this.values.has(name) : force) this.values.add(name); else this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}
function element(hidden = false) {
  return {
    classList: new ClassList(hidden), style: {}, value: "", textContent: "", innerHTML: "", disabled: false,
    listeners: {}, addEventListener(name, listener) { this.listeners[name] = listener; },
    querySelectorAll() { return []; }
  };
}

(async () => {
  const ids = ["notice", "setup-view", "running-view", "paused-view", "done-view", "course-select", "module-list", "modules-fieldset", "module-count", "rating-select", "setup-reason", "prepare-run", "confirm-run", "confirm-summary", "progress-bar", "progress-label", "run-state", "current-module", "current-action", "run-problem", "technical-output", "current-feedback", "moodle-connection", "last-activity", "step-elapsed", "metric-submitted", "metric-completed", "metric-empty", "metric-blocked", "metric-manual", "metric-failed", "activity-log", "module-summary", "done-title", "done-summary", "done-submitted", "done-completed", "done-empty", "done-blocked", "done-manual", "done-failed", "done-module-summary", "paused-title", "paused-reason", "resume-run", "restart-run", "retry-courses", "select-all", "clear-all", "dismiss-confirm", "start-run", "pause-run", "cancel-run", "cancel-paused", "open-moodle", "new-run"];
  const hidden = new Set(["running-view", "paused-view", "done-view", "confirm-run", "run-problem", "restart-run"]);
  const elements = new Map(ids.map((id) => [id, element(hidden.has(id))]));
  const modules = Array.from({ length: 15 }, (_, index) => ({ id: String(7001 + index), name: `Módulo ${index + 1}`, url: `https://moodle.uip.edu.pa/course/section.php?id=${7001 + index}`, available: true, locked: false, selectable: true }));
  modules.push({ id: "7999", name: null, url: "https://moodle.uip.edu.pa/course/section.php?id=7999", available: true, locked: false, selectable: false });
  let backend = { workflow: null, discovery: { status: "modules-ready", course: { id: "8199", name: "Compiladores" }, courses: [{ id: "8199", name: "Compiladores" }], modules } };
  const sent = [];
  const hook = {};
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        sent.push(message);
        if (message.type === "UIP_AUTOMATION_START") backend = { ...backend, workflow: { status: "RUNNING", progress: { total: 15, reviewed: 0 }, modules: [], workerConnected: true, activityLog: [] } };
        callback({ ok: true, ...backend });
      },
      onMessage: { addListener() {} }
    }
  };
  const document = { querySelector(selector) { return elements.get(selector.slice(1)) || element(); } };
  const context = { globalThis: {}, document, chrome, console, Set, Array, Promise, JSON, Date, Math, setInterval() { return 1; } };
  context.globalThis = context;
  context.__UIP_DASHBOARD_TEST_HOOK__ = hook;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/dashboard/dashboard.js", "utf8"), context, { filename: "dashboard.js" });
  await Promise.resolve();

  elements.get("rating-select").value = "Excelente";
  hook.setState(backend);
  hook.setSelectedModuleIds(modules.slice(0, 15).map((module) => module.id));
  hook.renderSetup();
  assert.equal(hook.snapshot().lastUiError, null, "modules-ready render must not throw");
  assert.equal(elements.get("notice").textContent, "Módulos cargados. Configura el recorrido.");
  assert.equal(elements.get("setup-reason").textContent, "El recorrido usará una sola confirmación antes de comenzar.");
  assert.equal(elements.get("prepare-run").disabled, false);
  assert.equal(elements.get("prepare-run").textContent, "Procesar 15 módulos");

  hook.openConfirmation();
  assert.equal(hook.snapshot().confirmationOpen, true);
  assert.equal(elements.get("confirm-run").classList.contains("hidden"), false);
  assert.equal(elements.get("confirm-summary").textContent, "Materia: Compiladores. Módulos: 15. Valoración: Excelente.");

  await hook.startConfiguredRun();
  const start = sent.find((message) => message.type === "UIP_AUTOMATION_START");
  assert.deepEqual(start.moduleIds, modules.slice(0, 15).map((module) => module.id));
  assert.equal(start.preference, "Excelente");
  assert.equal(elements.get("running-view").classList.contains("hidden"), false);
  assert.equal(elements.get("setup-view").classList.contains("hidden"), true);

  const outcomes = modules.slice(0, 15).map((item, index) => index === 0 ? { id: item.id, name: item.name, status: "completed", reason: "submission-verified" } : index === 1 ? { id: item.id, name: item.name, status: "completed", reason: "completed" } : index === 2 ? { id: item.id, name: item.name, status: "manual-required", reason: "form-not-compatible" } : { id: item.id, name: item.name, status: "blocked", reason: "module-blocked" });
  hook.setState({ workflow: { status: "DONE", terminalOutcome: "COMPLETED_WITH_ISSUES", progress: { total: 15, reviewed: 15, submitted: 1, alreadyCompleted: 1, noFeedback: 0, skipped: 12, manualRequired: 1, failed: 0 }, moduleOutcomes: outcomes }, discovery: backend.discovery });
  hook.renderSetup();
  assert.equal(elements.get("done-title").textContent, "Recorrido finalizado con incidencias");
  assert.equal(elements.get("done-summary").textContent.includes("15 de 15 módulos fueron evaluados"), true);
  assert.equal(elements.get("done-summary").textContent.includes("sin requerir pasos manuales"), false);
  assert.equal(elements.get("done-submitted").textContent, 1);
  assert.equal(elements.get("done-completed").textContent, 1);
  assert.equal(elements.get("done-blocked").textContent, 12);
  assert.equal(elements.get("done-manual").textContent, 1);
  assert.equal(elements.get("done-failed").textContent, 0);
  assert.equal(elements.get("done-module-summary").innerHTML.includes("No disponible"), true);
  assert.equal(elements.get("done-module-summary").innerHTML.includes("Revisión manual"), true);
  assert.equal(elements.get("done-module-summary").innerHTML.includes("No se pudo verificar el formulario automáticamente."), true);
  assert.equal(elements.get("technical-output").textContent.includes("moduleOutcomes"), true);
  assert.equal(elements.get("technical-output").textContent.includes("Excelente"), false);
  console.log("dashboard modules-ready setup and confirmation tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
