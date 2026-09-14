/* v0.5 background owner: persistent state, worker tab, and single-flight automation. */
importScripts("../background/automation-engine.js");

const WORKFLOW_KEY = "uip.automation.v2";
const DISCOVERY_KEY = "uip.automation.discovery.v1";
const WATCHDOG_ALARM = "uip.automation.watchdog";
const DISCOVERY_TIMEOUT_ALARM = "uip.automation.discovery.timeout";
const MOODLE_ORIGIN = "https://moodle.uip.edu.pa";
const MOODLE_HOME = `${MOODLE_ORIGIN}/my/`;
const MOODLE_MY_COURSES = `${MOODLE_ORIGIN}/my/courses.php`;
const WAIT_TIMEOUT_MINUTES = 0.5;
const DISCOVERY_TIMEOUT_MINUTES = 0.25;
let dashboardTabId = null;
let scanPumpRunning = false;
let courseDiscoveryPromise = null;
const pendingScans = [];
const activeScanKeys = new Map();
const DISCOVERY_STATUSES = new Set(["idle", "loading-courses", "courses-ready", "loading-modules", "modules-ready", "login-required", "error"]);
const DISCOVERY_SOURCES = new Set(["my-courses", "dashboard"]);

const engine = globalThis.UIPAutomationEngine;
const isMoodleUrl = (value) => {
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === MOODLE_ORIGIN; } catch (_) { return false; }
};
const runtimeError = () => chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
const observedModuleName = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 180) || null : null;
const isSelectableModule = (module) => {
  const name = observedModuleName(module && module.name);
  return module && module.available === true && module.locked !== true && Boolean(name) && !/^(general|secci[oó]n general|general section)$/i.test(name);
};
const safeCourseDiscovery = (value) => {
  const count = (name) => Number.isInteger(value && value[name]) ? Math.max(0, Math.min(10000, value[name])) : 0;
  return { sourcePage: value && ["AREA_PERSONAL", "MY_COURSES"].includes(value.sourcePage) ? value.sourcePage : null, candidateLinks: count("candidateLinks"), canonicalLinks: count("canonicalLinks"), visibleLinks: count("visibleLinks"), excludedLinks: count("excludedLinks"), acceptedCourses: count("acceptedCourses") };
};
const coursePageFor = (discovery) => discovery && discovery.discoverySource === "dashboard" ? "AREA_PERSONAL" : "MY_COURSES";
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
  const value = stored.value && typeof stored.value === "object" ? stored.value : {};
  const inferredStatus = value.error === "login-required" ? "login-required" : Array.isArray(value.modules) && value.modules.length && value.course ? "modules-ready" : Array.isArray(value.courses) && value.courses.length ? "courses-ready" : "idle";
  return { ok: true, discovery: { courses: [], modules: [], course: null, requestId: null, workerTabId: null, settlement: null, discoverySource: "my-courses", fallbackUsed: false, courseDiscovery: null, startedAt: null, updatedAt: null, error: null, ...value, discoverySource: DISCOVERY_SOURCES.has(value.discoverySource) ? value.discoverySource : "my-courses", fallbackUsed: value.fallbackUsed === true, courseDiscovery: safeCourseDiscovery(value.courseDiscovery), status: DISCOVERY_STATUSES.has(value.status) ? value.status : inferredStatus } };
}
async function saveDiscovery(value) {
  const safe = {
    courses: Array.isArray(value && value.courses) ? value.courses.slice(0, 200).map((course) => ({ id: typeof course.id === "string" ? course.id : null, url: isMoodleUrl(course.url) ? course.url : null, name: typeof course.name === "string" ? course.name.slice(0, 300) : null })).filter((course) => course.id && course.url) : [],
    modules: Array.isArray(value && value.modules) ? value.modules.slice(0, 300).map((module) => {
      const name = observedModuleName(module && module.name);
      const safe = { id: typeof module.id === "string" ? module.id : null, url: isMoodleUrl(module.url) ? module.url : null, name, available: module.available === true ? true : module.available === false ? false : null, locked: module.locked === true ? true : module.locked === false ? false : null, restrictionText: typeof module.restrictionText === "string" ? module.restrictionText.slice(0, 300) : null, sectionNumber: Number.isInteger(module.sectionNumber) ? module.sectionNumber : null };
      return { ...safe, selectable: isSelectableModule(safe) };
    }).filter((module) => module.id && module.url) : [],
    course: value && value.course && typeof value.course.id === "string" && isMoodleUrl(value.course.url) ? { id: value.course.id, url: value.course.url, name: typeof value.course.name === "string" ? value.course.name.slice(0, 300) : null } : null,
    status: value && DISCOVERY_STATUSES.has(value.status) ? value.status : "idle",
    requestId: value && typeof value.requestId === "string" ? value.requestId.slice(0, 100) : null,
    workerTabId: value && Number.isInteger(value.workerTabId) ? value.workerTabId : null,
    settlement: value && value.settlement && ["courses", "modules"].includes(value.settlement.kind) && typeof value.settlement.requestId === "string" ? { kind: value.settlement.kind, requestId: value.settlement.requestId.slice(0, 100) } : null,
    discoverySource: value && DISCOVERY_SOURCES.has(value.discoverySource) ? value.discoverySource : "my-courses",
    fallbackUsed: value && value.fallbackUsed === true,
    courseDiscovery: safeCourseDiscovery(value && value.courseDiscovery),
    startedAt: value && Number.isFinite(value.startedAt) ? value.startedAt : null,
    updatedAt: Date.now(), error: value && typeof value.error === "string" ? value.error.slice(0, 120) : null
  };
  const saved = await storageSet(DISCOVERY_KEY, safe);
  if (saved.ok) notifyDashboard();
  return { ...saved, discovery: safe };
}
async function armDiscoveryTimeout(discovery, clearWhenInactive = true) {
  if (!discovery || !["loading-courses", "loading-modules"].includes(discovery.status)) {
    if (clearWhenInactive) await chrome.alarms.clear(DISCOVERY_TIMEOUT_ALARM);
    return;
  }
  const startedAt = Number.isFinite(discovery.startedAt) ? discovery.startedAt : Date.now();
  const remaining = Math.max(0.01, DISCOVERY_TIMEOUT_MINUTES - Math.max(0, Date.now() - startedAt) / 60000);
  await chrome.alarms.create(DISCOVERY_TIMEOUT_ALARM, { delayInMinutes: remaining });
}
async function persistDiscovery(value) {
  const saved = await saveDiscovery(value);
  if (saved.ok) await armDiscoveryTimeout(saved.discovery);
  return saved;
}
function tabsQuery(query) { return new Promise((resolve) => chrome.tabs.query(query, (tabs) => resolve(runtimeError() ? [] : tabs || []))); }
function tabsGet(tabId) { return new Promise((resolve) => chrome.tabs.get(tabId, (tab) => resolve(runtimeError() ? null : tab || null))); }
function tabsCreate(properties) { return new Promise((resolve) => chrome.tabs.create(properties, (tab) => resolve(runtimeError() ? null : tab || null))); }
function tabsUpdate(tabId, properties) { return new Promise((resolve) => chrome.tabs.update(tabId, properties, (tab) => resolve(runtimeError() ? null : tab || null))); }
function sendToWorker(tabId, message) { return new Promise((resolve) => chrome.tabs.sendMessage(tabId, message, (response) => resolve(runtimeError() ? null : response || null))); }

async function ensureWorker(preferredTabId, initialUrl = MOODLE_HOME) {
  if (Number.isInteger(preferredTabId)) {
    const tab = await tabsGet(preferredTabId);
    if (tab && isMoodleUrl(tab.url)) return tab;
  }
  const running = await loadWorkflow();
  if (running.ok && running.workflow && Number.isInteger(running.workflow.workerTabId)) {
    const tab = await tabsGet(running.workflow.workerTabId);
    if (tab && isMoodleUrl(tab.url)) return tab;
  }
  const discovery = await loadDiscovery();
  if (discovery.ok && discovery.discovery && Number.isInteger(discovery.discovery.workerTabId)) {
    const tab = await tabsGet(discovery.discovery.workerTabId);
    if (tab && isMoodleUrl(tab.url)) return tab;
  }
  // Never redirect an arbitrary Moodle tab the student is using. A worker is
  // either one we already persisted or a dedicated tab owned by this flow.
  return tabsCreate({ url: initialUrl, active: true });
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
  if (action.type === "PROCESS_SCAN") { await enqueueScan(workflow.workerTabId, action.scan); return; }
  if (action.type === "SCAN") { await scanWorker(workflow.workerTabId); return; }
  let response = null;
  if (action.type === "PREFILL") response = await sendToWorker(workflow.workerTabId, { ...action, type: "UIP_PREFILL_FEEDBACK" });
  if (action.type === "SUBMIT") response = await sendToWorker(workflow.workerTabId, { ...action, type: "UIP_SUBMIT_FEEDBACK" });
  if (action.type === "CONTINUE") response = await sendToWorker(workflow.workerTabId, { ...action, type: "UIP_NAVIGATE_CONTINUE" });
  const current = await loadWorkflow();
  if (!current.ok || !current.workflow || current.workflow.runId !== workflow.runId || current.workflow.transition !== workflow.transition) return;
  if (action.type === "PREFILL") await applyTransition(engine.onPrefill(current.workflow, response));
  if (action.type === "SUBMIT") await applyTransition(engine.onSubmit(current.workflow, response));
  if (action.type === "CONTINUE") await applyTransition(engine.onContinue(current.workflow, response));
}
async function scanWorker(tabId) {
  if (!Number.isInteger(tabId)) return;
  const response = await sendToWorker(tabId, { type: "UIP_SCAN_CURRENT_DOCUMENT" });
  if (response && response.ok && response.scan) await enqueueScan(tabId, response.scan);
}
async function requestDiscoverySettlement(discovery, tabId, kind, scan) {
  if (!discovery || discovery.workerTabId !== tabId || discovery.settlement && discovery.settlement.kind === kind && discovery.settlement.requestId === discovery.requestId) return;
  const saved = await persistDiscovery({ ...discovery, settlement: { kind, requestId: discovery.requestId }, courseDiscovery: kind === "courses" ? scan && scan.courseDiscovery : discovery.courseDiscovery });
  if (saved.ok) await sendToWorker(tabId, { type: "UIP_BEGIN_DISCOVERY_SETTLEMENT", kind, requestId: discovery.requestId });
}
async function useDashboardCourseFallback(discovery, navigate) {
  if (!discovery || discovery.discoverySource !== "my-courses" || discovery.fallbackUsed === true) return { ok: false, error: "discovery-fallback-unavailable" };
  const switched = await persistDiscovery({ ...discovery, discoverySource: "dashboard", fallbackUsed: true, settlement: null, startedAt: Date.now(), error: null });
  if (!switched.ok || !navigate) return switched;
  if (await tabsUpdate(discovery.workerTabId, { url: MOODLE_HOME })) return switched;
  await persistDiscovery({ ...switched.discovery, status: "error", startedAt: null, error: "discovery-navigation-failed" });
  return { ok: false, error: "discovery-navigation-failed" };
}
async function resumeCourseDiscoveryAfterLogin(discovery, tabId, scan) {
  const requestId = `courses-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const loading = await persistDiscovery({ ...discovery, status: "loading-courses", requestId, workerTabId: tabId, settlement: null, discoverySource: "my-courses", fallbackUsed: false, courseDiscovery: null, startedAt: Date.now(), error: null });
  if (!loading.ok) return loading;
  if (scan && scan.pageType === "MY_COURSES") {
    await handleDiscovery(tabId, scan);
    return loading;
  }
  if (!await tabsUpdate(tabId, { url: MOODLE_MY_COURSES })) {
    await persistDiscovery({ ...loading.discovery, status: "error", startedAt: null, error: "discovery-navigation-failed" });
    return { ok: false, error: "discovery-navigation-failed" };
  }
  return loading;
}
async function handleDiscovery(tabId, scan) {
  const current = await loadDiscovery();
  if (!current.ok) return;
  const discovery = current.discovery;
  if (discovery.workerTabId !== tabId) return;
  if (scan.sessionApparentlyNotStarted === true) { await persistDiscovery({ ...discovery, status: "login-required", settlement: null, startedAt: null, error: "login-required" }); return; }
  if (discovery.status === "login-required") { await resumeCourseDiscoveryAfterLogin(discovery, tabId, scan); return; }
  if (discovery.status === "loading-courses") {
    const expectedPage = coursePageFor(discovery);
    if (scan.pageType !== expectedPage) {
      // A redirected My Courses request can already be on /my/. Reuse that
      // document as the one allowed fallback rather than navigating again.
      if (discovery.discoverySource === "my-courses" && scan.pageType === "AREA_PERSONAL") {
        const fallback = await useDashboardCourseFallback(discovery, false);
        if (fallback.ok) await handleDiscovery(tabId, scan);
      } else if (discovery.discoverySource === "my-courses") await useDashboardCourseFallback(discovery, true);
      return;
    }
    if (Array.isArray(scan.courses) && scan.courses.length) await persistDiscovery({ ...discovery, status: "courses-ready", settlement: null, startedAt: null, courses: scan.courses, courseDiscovery: scan.courseDiscovery, error: null });
    else await requestDiscoverySettlement(discovery, tabId, "courses", scan);
    return;
  }
  if (discovery.status === "loading-modules" && scan.pageType === "COURSE" && scan.course && discovery.course && scan.course.id === discovery.course.id) {
    if (Array.isArray(scan.modules) && scan.modules.length) await persistDiscovery({ ...discovery, status: "modules-ready", settlement: null, startedAt: null, course: scan.course, modules: scan.modules, error: null });
    else await requestDiscoverySettlement(discovery, tabId, "modules");
  }
}
async function handleDiscoverySettlement(tabId, message) {
  const kind = message && message.kind;
  const requestId = message && message.requestId;
  const scan = message && message.scan;
  if (!(["courses", "modules"].includes(kind)) || typeof requestId !== "string" || !scan || typeof scan !== "object") return;
  const current = await loadDiscovery();
  if (!current.ok) return;
  const discovery = current.discovery;
  const expectedStatus = kind === "courses" ? "loading-courses" : "loading-modules";
  const expectedPage = kind === "courses" ? coursePageFor(discovery) : "COURSE";
  if (discovery.status !== expectedStatus || discovery.requestId !== requestId || discovery.workerTabId !== tabId || scan.pageType !== expectedPage) return;
  if (scan.sessionApparentlyNotStarted === true) { await persistDiscovery({ ...discovery, status: "login-required", settlement: null, startedAt: null, error: "login-required" }); return; }
  if (kind === "modules" && (!scan.course || !discovery.course || scan.course.id !== discovery.course.id)) return;
  const items = kind === "courses" ? scan.courses : scan.modules;
  if (!Array.isArray(items) || (!items.length && message.reason !== "settled-empty")) return;
  if (kind === "courses" && !items.length && message.reason === "settled-empty" && discovery.discoverySource === "my-courses" && discovery.fallbackUsed !== true) {
    await useDashboardCourseFallback(discovery, true);
    return;
  }
  await persistDiscovery(kind === "courses"
    ? { ...discovery, status: "courses-ready", settlement: null, startedAt: null, courses: items, courseDiscovery: scan.courseDiscovery, error: null }
    : { ...discovery, status: "modules-ready", settlement: null, startedAt: null, course: scan.course, modules: items, error: null });
}
async function processScan(tabId, scan) {
  try {
    const loaded = await loadWorkflow();
    if (!loaded.ok) return;
    if (!loaded.workflow || !["RUNNING", "LOGIN_REQUIRED"].includes(loaded.workflow.status)) { await handleDiscovery(tabId, scan); return; }
    if (loaded.workflow.workerTabId !== tabId) return;
    if (loaded.workflow.status === "LOGIN_REQUIRED" && scan.sessionApparentlyNotStarted !== true) { await applyTransition(engine.resume(loaded.workflow)); return; }
    await applyTransition(engine.onScan(loaded.workflow, scan));
  } catch (_) {
    // The watchdog remains armed for RUNNING workflows if a scan cannot be processed.
  }
}
async function enqueueScan(tabId, scan) {
  if (!Number.isInteger(tabId) || !scan || typeof scan !== "object") return;
  const key = JSON.stringify({
    pageType: scan.pageType || null,
    courseId: scan.course && scan.course.id || null,
    sectionId: scan.currentSection && scan.currentSection.id || null,
    feedbackId: scan.feedbackPage && scan.feedbackPage.id || scan.feedbackForm && scan.feedbackForm.id || null,
    formSignature: scan.feedbackForm && scan.feedbackForm.signature || null,
    readyToSubmit: scan.feedbackSubmission && scan.feedbackSubmission.readyToSubmit === true,
    resultId: scan.feedbackResult && scan.feedbackResult.feedbackId || null,
    submissionVerified: scan.feedbackResult && scan.feedbackResult.submissionVerified === true,
    feedback: Array.isArray(scan.feedback) ? scan.feedback.map((item) => [item && item.id || null, item && item.completionState || null, item && item.available === true]).slice(0, 50) : [],
    notices: Array.isArray(scan.pageNotices) ? scan.pageNotices.map((item) => [item && item.type || null, item && item.text || null]).slice(0, 20) : []
  });
  if (activeScanKeys.get(tabId) === key) return;
  if (pendingScans.some((item) => item.tabId === tabId && item.key === key)) return;
  // Identical observations coalesce; every distinct DOM state stays queued.
  pendingScans.push({ tabId, scan, key });
  if (scanPumpRunning) return;
  scanPumpRunning = true;
  try {
    while (pendingScans.length) {
      const next = pendingScans.shift();
      activeScanKeys.set(next.tabId, next.key);
      await processScan(next.tabId, next.scan);
      activeScanKeys.delete(next.tabId);
    }
  } finally {
    scanPumpRunning = false;
  }
}
async function beginCourseDiscovery(sender) {
  if (courseDiscoveryPromise) return { ok: true, alreadyRunning: true };
  let operation;
  operation = (async () => {
    const current = await loadDiscovery();
    if (!current.ok) return current;
    if (current.discovery.status === "loading-courses") return { ok: true, alreadyRunning: true, requestId: current.discovery.requestId };
    const worker = await ensureWorker(sender && sender.tab && sender.tab.id, MOODLE_MY_COURSES);
    if (!worker) {
      await persistDiscovery({ ...current.discovery, status: "error", startedAt: null, error: "worker-unavailable" });
      return { ok: false, error: "worker-unavailable" };
    }
    const requestId = `courses-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // Keep last known courses visible while Moodle refreshes the source page.
    const loading = await persistDiscovery({ ...current.discovery, status: "loading-courses", requestId, workerTabId: worker.id, settlement: null, discoverySource: "my-courses", fallbackUsed: false, courseDiscovery: null, startedAt: Date.now(), error: null });
    if (!loading.ok) return loading;
    const navigated = worker.url === MOODLE_MY_COURSES ? worker : await tabsUpdate(worker.id, { url: MOODLE_MY_COURSES });
    if (!navigated) {
      await persistDiscovery({ ...loading.discovery, status: "error", startedAt: null, error: "discovery-navigation-failed" });
      return { ok: false, error: "discovery-navigation-failed" };
    }
    return { ok: true, workerTabId: worker.id, requestId };
  })();
  courseDiscoveryPromise = operation;
  try { return await operation; }
  finally { if (courseDiscoveryPromise === operation) courseDiscoveryPromise = null; }
}
async function selectCourse(course) {
  const discovery = await loadDiscovery();
  const found = discovery.ok && discovery.discovery.courses.find((item) => item.id === (course && course.id) && item.url === (course && course.url));
  if (!found) return { ok: false, error: "course-not-observed" };
  const worker = await ensureWorker();
  if (!worker) return { ok: false, error: "worker-unavailable" };
  const loading = await persistDiscovery({ ...discovery.discovery, status: "loading-modules", requestId: `modules-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, workerTabId: worker.id, settlement: null, startedAt: Date.now(), course: found, modules: [], error: null });
  if (!loading.ok) return loading;
  if (!await tabsUpdate(worker.id, { url: found.url })) {
    await persistDiscovery({ ...loading.discovery, status: "error", startedAt: null, error: "discovery-navigation-failed" });
    return { ok: false, error: "discovery-navigation-failed" };
  }
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
  const modules = discovery.discovery.modules.filter((module) => selected.has(module.id) && module.selectable === true);
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
async function expireDiscovery() {
  const current = await loadDiscovery();
  if (!current.ok || !["loading-courses", "loading-modules"].includes(current.discovery.status)) return;
  await persistDiscovery({ ...current.discovery, status: "error", startedAt: null, error: "discovery-timeout" });
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
  const tab = await ensureWorker(null, MOODLE_MY_COURSES);
  if (!tab || !Number.isInteger(tab.id)) return { ok: false, error: "worker-unavailable" };
  await tabsUpdate(tab.id, { active: true });
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
  if (!alarm) return;
  if (alarm.name === DISCOVERY_TIMEOUT_ALARM) { await expireDiscovery(); return; }
  if (alarm.name === WATCHDOG_ALARM) {
    const workflow = await loadWorkflow();
    if (workflow.ok && workflow.workflow) await applyTransition(engine.timeout(workflow.workflow));
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;
  const respond = (promise) => { Promise.resolve(promise).then(sendResponse).catch(() => sendResponse({ ok: false, error: "background-unavailable" })); return true; };
  if (message.type === "UIP_MOODLE_PAGE_READY") { enqueueScan(sender.tab && sender.tab.id, message.scan || null); return false; }
  if (message.type === "UIP_MOODLE_DISCOVERY_SETTLED") { handleDiscoverySettlement(sender.tab && sender.tab.id, message); return false; }
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
// A reclaimed service worker must retain the terminal discovery state or
// restore its timeout, never restart Moodle navigation on its own.
loadDiscovery().then(async (result) => {
  if (!result.ok) return;
  const startedAt = Number.isFinite(result.discovery.startedAt) ? result.discovery.startedAt : Date.now();
  if (["loading-courses", "loading-modules"].includes(result.discovery.status) && Date.now() - startedAt >= DISCOVERY_TIMEOUT_MINUTES * 60000) await expireDiscovery();
  else await armDiscoveryTimeout(result.discovery, false);
}).catch(() => undefined);
