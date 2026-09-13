/* v0.5 background owner: persistent state, worker tab, and single-flight automation. */
importScripts("../background/automation-engine.js");

const WORKFLOW_KEY = "uip.automation.v2";
const DISCOVERY_KEY = "uip.automation.discovery.v1";
const WATCHDOG_ALARM = "uip.automation.watchdog";
const MOODLE_ORIGIN = "https://moodle.uip.edu.pa";
const MOODLE_HOME = `${MOODLE_ORIGIN}/my/`;
const WAIT_TIMEOUT_MINUTES = 0.5;
let dashboardTabId = null;
let driving = false;

const engine = globalThis.UIPAutomationEngine;
const isMoodleUrl = (value) => {
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === MOODLE_ORIGIN; } catch (_) { return false; }
};
const runtimeError = () => chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
const storageGet = async (key) => {
  try { return { ok: true, value: (await chrome.storage.session.get(key))[key] }; }
  catch (_) { return { ok: false, error: "workflow-storage-unavailable" }; }
};
const storageSet = async (key, value) => {
  try { await chrome.storage.session.set({ [key]: value }); return { ok: true }; }
  catch (_) { return { ok: false, error: "workflow-storage-unavailable" }; }
};
const notifyDashboard = () => chrome.runtime.sendMessage({ type: "UIP_AUTOMATION_STATE_CHANGED" }).catch(() => undefined);

async function loadWorkflow() {
  const stored = await storageGet(WORKFLOW_KEY);
  if (!stored.ok) return stored;
  return { ok: true, workflow: engine.sanitize(stored.value) };
}
async function saveWorkflow(value) {
  const workflow = engine.sanitize(value);
  if (!workflow) return { ok: false, error: "workflow-invalid" };
  const saved = await storageSet(WORKFLOW_KEY, workflow);
  if (!saved.ok) return saved;
  const verified = await loadWorkflow();
  if (!verified.ok || !verified.workflow || verified.workflow.runId !== workflow.runId || verified.workflow.transition !== workflow.transition) return { ok: false, error: "workflow-save-verification-failed" };
  notifyDashboard();
  return { ok: true, workflow: verified.workflow };
}
async function persistWorkflow(value) {
  const saved = await saveWorkflow(value);
  if (saved.ok) await armWatchdog(saved.workflow);
  return saved;
}
async function clearWorkflow() {
  try { await chrome.storage.session.remove(WORKFLOW_KEY); await chrome.alarms.clear(WATCHDOG_ALARM); notifyDashboard(); return { ok: true }; }
  catch (_) { return { ok: false, error: "workflow-storage-unavailable" }; }
}
async function loadDiscovery() {
  const stored = await storageGet(DISCOVERY_KEY);
  if (!stored.ok) return stored;
  const value = stored.value && typeof stored.value === "object" ? stored.value : { courses: [], modules: [], course: null, updatedAt: null, error: null };
  return { ok: true, discovery: value };
}
async function saveDiscovery(value) {
  const safe = {
    courses: Array.isArray(value && value.courses) ? value.courses.slice(0, 200).map((course) => ({ id: typeof course.id === "string" ? course.id : null, url: isMoodleUrl(course.url) ? course.url : null, name: typeof course.name === "string" ? course.name.slice(0, 300) : null })).filter((course) => course.id && course.url) : [],
    modules: Array.isArray(value && value.modules) ? value.modules.slice(0, 300).map((module) => ({ id: typeof module.id === "string" ? module.id : null, url: isMoodleUrl(module.url) ? module.url : null, name: typeof module.name === "string" ? module.name.slice(0, 180) : null, available: module.available === true ? true : module.available === false ? false : null, locked: module.locked === true ? true : module.locked === false ? false : null, restrictionText: typeof module.restrictionText === "string" ? module.restrictionText.slice(0, 300) : null, sectionNumber: Number.isInteger(module.sectionNumber) ? module.sectionNumber : null })).filter((module) => module.id && module.url) : [],
    course: value && value.course && typeof value.course.id === "string" && isMoodleUrl(value.course.url) ? { id: value.course.id, url: value.course.url, name: typeof value.course.name === "string" ? value.course.name.slice(0, 300) : null } : null,
    updatedAt: Date.now(), error: value && typeof value.error === "string" ? value.error.slice(0, 120) : null
  };
  const saved = await storageSet(DISCOVERY_KEY, safe);
  if (saved.ok) notifyDashboard();
  return { ...saved, discovery: safe };
}
function tabsQuery(query) { return new Promise((resolve) => chrome.tabs.query(query, (tabs) => resolve(runtimeError() ? [] : tabs || []))); }
function tabsGet(tabId) { return new Promise((resolve) => chrome.tabs.get(tabId, (tab) => resolve(runtimeError() ? null : tab || null))); }
function tabsCreate(properties) { return new Promise((resolve) => chrome.tabs.create(properties, (tab) => resolve(runtimeError() ? null : tab || null))); }
function tabsUpdate(tabId, properties) { return new Promise((resolve) => chrome.tabs.update(tabId, properties, (tab) => resolve(runtimeError() ? null : tab || null))); }
function sendToWorker(tabId, message) { return new Promise((resolve) => chrome.tabs.sendMessage(tabId, message, (response) => resolve(runtimeError() ? null : response || null))); }

async function ensureWorker(preferredTabId) {
  if (Number.isInteger(preferredTabId)) {
    const tab = await tabsGet(preferredTabId);
    if (tab && isMoodleUrl(tab.url)) return tab;
  }
  const running = await loadWorkflow();
  if (running.ok && running.workflow && Number.isInteger(running.workflow.workerTabId)) {
    const tab = await tabsGet(running.workflow.workerTabId);
    if (tab && isMoodleUrl(tab.url)) return tab;
  }
  const moodleTabs = await tabsQuery({ url: `${MOODLE_ORIGIN}/*` });
  if (moodleTabs.length) return moodleTabs[0];
  return tabsCreate({ url: MOODLE_HOME, active: true });
}
async function armWatchdog(workflow) {
  if (!workflow || workflow.status !== "RUNNING") { await chrome.alarms.clear(WATCHDOG_ALARM); return; }
  await chrome.alarms.create(WATCHDOG_ALARM, { delayInMinutes: WAIT_TIMEOUT_MINUTES });
}
async function applyTransition(result) {
  if (!result || !result.workflow) return { ok: false, error: "workflow-invalid" };
  const saved = await saveWorkflow(result.workflow);
  if (!saved.ok) return saved;
  await armWatchdog(saved.workflow);
  if (result.effect) await executeEffect(saved.workflow, result.effect);
  return { ok: true, workflow: saved.workflow };
}
async function executeEffect(workflow, action) {
  if (!workflow || !action || !Number.isInteger(workflow.workerTabId)) return;
  if (action.type === "NAVIGATE") {
    if (!isMoodleUrl(action.url)) return;
    await tabsUpdate(workflow.workerTabId, { url: action.url });
    return;
  }
  if (action.type === "SCAN") { await scanWorker(workflow.workerTabId); return; }
  let response = null;
  if (action.type === "PREFILL") response = await sendToWorker(workflow.workerTabId, { type: "UIP_PREFILL_FEEDBACK", ...action });
  if (action.type === "SUBMIT") response = await sendToWorker(workflow.workerTabId, { type: "UIP_SUBMIT_FEEDBACK", ...action });
  if (action.type === "CONTINUE") response = await sendToWorker(workflow.workerTabId, { type: "UIP_NAVIGATE_CONTINUE", ...action });
  const current = await loadWorkflow();
  if (!current.ok || !current.workflow || current.workflow.runId !== workflow.runId || current.workflow.transition !== workflow.transition) return;
  if (action.type === "PREFILL") await applyTransition(engine.onPrefill(current.workflow, response));
  if (action.type === "SUBMIT") await applyTransition(engine.onSubmit(current.workflow, response));
  if (action.type === "CONTINUE") await applyTransition(engine.onContinue(current.workflow, response));
}
async function scanWorker(tabId) {
  if (!Number.isInteger(tabId)) return;
  const response = await sendToWorker(tabId, { type: "UIP_SCAN_CURRENT_DOCUMENT" });
  if (response && response.ok && response.scan) await handleScan(tabId, response.scan);
}
async function handleDiscovery(scan) {
  const current = await loadDiscovery();
  if (!current.ok) return;
  if (scan.sessionApparentlyNotStarted === true) { await saveDiscovery({ ...current.discovery, error: "login-required" }); return; }
  if (scan.pageType === "AREA_PERSONAL") await saveDiscovery({ ...current.discovery, courses: scan.courses || [], error: null });
  if (scan.pageType === "COURSE" && scan.course && scan.course.id) await saveDiscovery({ ...current.discovery, course: scan.course, modules: scan.modules || [], error: null });
}
async function handleScan(tabId, scan) {
  if (driving) return;
  driving = true;
  try {
    const loaded = await loadWorkflow();
    if (!loaded.ok) return;
    if (!loaded.workflow || !["RUNNING", "LOGIN_REQUIRED"].includes(loaded.workflow.status)) { await handleDiscovery(scan); return; }
    if (loaded.workflow.workerTabId !== tabId) return;
    if (loaded.workflow.status === "LOGIN_REQUIRED" && scan.sessionApparentlyNotStarted !== true) { await applyTransition(engine.resume(loaded.workflow)); return; }
    await applyTransition(engine.onScan(loaded.workflow, scan));
  } finally { driving = false; }
}
async function beginCourseDiscovery(sender) {
  const worker = await ensureWorker(sender && sender.tab && sender.tab.id);
  if (!worker) return { ok: false, error: "worker-unavailable" };
  await saveDiscovery({ courses: [], modules: [], course: null, updatedAt: Date.now(), error: null });
  await tabsUpdate(worker.id, { url: MOODLE_HOME });
  return { ok: true, workerTabId: worker.id };
}
async function selectCourse(course) {
  const discovery = await loadDiscovery();
  const found = discovery.ok && discovery.discovery.courses.find((item) => item.id === (course && course.id) && item.url === (course && course.url));
  if (!found) return { ok: false, error: "course-not-observed" };
  const worker = await ensureWorker();
  if (!worker) return { ok: false, error: "worker-unavailable" };
  await saveDiscovery({ ...discovery.discovery, course: found, modules: [], error: null });
  await tabsUpdate(worker.id, { url: found.url });
  return { ok: true, workerTabId: worker.id };
}
async function startRun(message) {
  const existing = await loadWorkflow();
  if (!existing.ok) return existing;
  if (existing.workflow && ["RUNNING", "PAUSED", "LOGIN_REQUIRED", "READY_TO_START"].includes(existing.workflow.status)) return { ok: false, error: "run-already-active" };
  const discovery = await loadDiscovery();
  if (!discovery.ok || !discovery.discovery.course) return { ok: false, error: "course-not-ready" };
  const worker = await ensureWorker();
  if (!worker) return { ok: false, error: "worker-unavailable" };
  const selected = new Set(Array.isArray(message.moduleIds) ? message.moduleIds.filter((id) => typeof id === "string") : []);
  const modules = discovery.discovery.modules.filter((module) => selected.has(module.id) && module.available === true && module.locked !== true);
  const workflow = engine.create({ course: discovery.discovery.course, modules, preference: message.preference, workerTabId: worker.id });
  if (!workflow) return { ok: false, error: "invalid-configuration" };
  const saved = await saveWorkflow(workflow);
  if (!saved.ok) return saved;
  await applyTransition(engine.start(saved.workflow));
  return { ok: true };
}
async function currentState() {
  const [workflow, discovery] = await Promise.all([loadWorkflow(), loadDiscovery()]);
  return { ok: workflow.ok && discovery.ok, workflow: workflow.ok ? engine.metadata(workflow.workflow) : null, discovery: discovery.ok ? discovery.discovery : null, error: !workflow.ok || !discovery.ok ? "workflow-storage-unavailable" : null };
}
async function openDashboard() {
  if (Number.isInteger(dashboardTabId)) {
    const previous = await tabsGet(dashboardTabId);
    if (previous) { await tabsUpdate(dashboardTabId, { active: true }); return; }
  }
  const dashboardUrl = chrome.runtime.getURL("dashboard/dashboard.html");
  const existing = (await tabsQuery({ url: dashboardUrl })).find((tab) => tab && tab.url === dashboardUrl);
  if (existing) { dashboardTabId = existing.id; await tabsUpdate(existing.id, { active: true }); return; }
  const tab = await tabsCreate({ url: dashboardUrl, active: true });
  dashboardTabId = tab && tab.id || null;
}
async function openMoodleWorker() {
  const tab = await ensureWorker();
  if (!tab || !Number.isInteger(tab.id)) return { ok: false, error: "worker-unavailable" };
  const loaded = await loadWorkflow();
  if (!loaded.ok) return loaded;
  if (loaded.workflow && loaded.workflow.workerTabId !== tab.id) {
    const bound = engine.bindWorker(loaded.workflow, tab.id);
    const saved = await persistWorkflow(bound);
    if (!saved.ok) return saved;
  }
  return { ok: true, workerTabId: tab.id };
}

chrome.action.onClicked.addListener(() => { openDashboard(); });
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === dashboardTabId) dashboardTabId = null;
  const workflow = await loadWorkflow();
  if (workflow.ok && workflow.workflow && workflow.workflow.workerTabId === tabId) await persistWorkflow(engine.workerClosed(workflow.workflow));
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isMoodleUrl(tab && tab.url)) scanWorker(tabId);
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm || alarm.name !== WATCHDOG_ALARM) return;
  const workflow = await loadWorkflow();
  if (workflow.ok && workflow.workflow) await applyTransition(engine.timeout(workflow.workflow));
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;
  const respond = (promise) => { Promise.resolve(promise).then(sendResponse).catch(() => sendResponse({ ok: false, error: "background-unavailable" })); return true; };
  if (message.type === "UIP_MOODLE_PAGE_READY") { handleScan(sender.tab && sender.tab.id, message.scan || null); return false; }
  if (message.type === "UIP_AUTOMATION_GET_STATE") return respond(currentState());
  if (message.type === "UIP_AUTOMATION_DISCOVER_COURSES") return respond(beginCourseDiscovery(sender));
  if (message.type === "UIP_AUTOMATION_SELECT_COURSE") return respond(selectCourse(message.course));
  if (message.type === "UIP_AUTOMATION_START") return respond(startRun(message));
  if (message.type === "UIP_AUTOMATION_PAUSE") return respond(loadWorkflow().then((result) => result.ok && result.workflow ? persistWorkflow(engine.pause(result.workflow)) : result));
  if (message.type === "UIP_AUTOMATION_RESUME") return respond(loadWorkflow().then(async (result) => {
    if (!result.ok || !result.workflow) return result;
    if (!Number.isInteger(result.workflow.workerTabId)) return { ok: false, error: "worker-not-bound" };
    const applied = await applyTransition(engine.resume(result.workflow));
    return applied && applied.ok ? { ok: true } : applied || { ok: false, error: "workflow-save-verification-failed" };
  }));
  if (message.type === "UIP_AUTOMATION_CANCEL") return respond(loadWorkflow().then((result) => result.ok && result.workflow ? persistWorkflow(engine.cancel(result.workflow)) : result));
  if (message.type === "UIP_AUTOMATION_OPEN_MOODLE") return respond(openMoodleWorker());
  if (message.type === "UIP_AUTOMATION_NEW_RUN") return respond(clearWorkflow());
  return undefined;
});

// Service workers can be reclaimed at any time. Restore the watchdog and
// request one fresh DOM scan when a run was active before reclamation.
loadWorkflow().then(async (result) => {
  if (!result.ok || !result.workflow || !["RUNNING", "LOGIN_REQUIRED"].includes(result.workflow.status)) return;
  await armWatchdog(result.workflow);
  if (Number.isInteger(result.workflow.workerTabId)) await scanWorker(result.workflow.workerTabId);
}).catch(() => undefined);
