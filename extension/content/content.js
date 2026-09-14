/* Moodle executor: the background owns workflow decisions; this script owns DOM primitives. */
let discoverySettlement = null;

function scanDiscoveryItems(kind) {
  const scan = globalThis.UIPScannerCore.scanDocument(document);
  const expectedPage = kind === "courses" ? "AREA_PERSONAL" : "COURSE";
  const items = kind === "courses" ? scan.courses : scan.modules;
  return { scan, valid: scan.pageType === expectedPage, found: Array.isArray(items) && items.length > 0 };
}
function stopDiscoverySettlement() {
  if (!discoverySettlement) return;
  if (discoverySettlement.timer) clearTimeout(discoverySettlement.timer);
  if (discoverySettlement.debounce) clearTimeout(discoverySettlement.debounce);
  if (discoverySettlement.observer) discoverySettlement.observer.disconnect();
  discoverySettlement = null;
}
function emitDiscoverySettlement(kind, requestId, reason, scan) {
  chrome.runtime.sendMessage({ type: "UIP_MOODLE_DISCOVERY_SETTLED", kind, requestId, reason, scannerVersion: scan.scannerVersion, pageType: scan.pageType, scan }).catch(() => undefined);
}
function beginDiscoverySettlement(message) {
  const kind = message && message.kind;
  const requestId = message && message.requestId;
  if (!(["courses", "modules"].includes(kind)) || typeof requestId !== "string" || !requestId || requestId.length > 100) return { ok: false, error: "Invalid discovery settlement request." };
  if (discoverySettlement && discoverySettlement.kind === kind && discoverySettlement.requestId === requestId) return { ok: true, alreadyObserving: true };
  stopDiscoverySettlement();
  const initial = scanDiscoveryItems(kind);
  if (!initial.valid || initial.found) {
    emitDiscoverySettlement(kind, requestId, initial.found ? "items-found" : "settled-empty", initial.scan);
    return { ok: true, settledImmediately: true };
  }
  const scope = (kind === "courses" ? globalThis.UIPScannerCore.findDashboardScope(document) : globalThis.UIPScannerCore.findMainContent(document)) || document.body || document.documentElement;
  if (!scope || typeof MutationObserver !== "function") {
    emitDiscoverySettlement(kind, requestId, "settled-empty", initial.scan);
    return { ok: true, settledImmediately: true };
  }
  const initialUrl = document.location.href;
  const finish = (reason) => {
    if (!discoverySettlement || discoverySettlement.kind !== kind || discoverySettlement.requestId !== requestId) return;
    const final = scanDiscoveryItems(kind);
    stopDiscoverySettlement();
    if (document.location.href === initialUrl) emitDiscoverySettlement(kind, requestId, final.found ? "items-found" : reason, final.scan);
  };
  const observer = new MutationObserver(() => {
    if (!discoverySettlement || discoverySettlement.debounce) return;
    discoverySettlement.debounce = setTimeout(() => {
      if (!discoverySettlement) return;
      discoverySettlement.debounce = null;
      const current = scanDiscoveryItems(kind);
      if (!current.valid || current.found) finish(current.found ? "items-found" : "settled-empty");
    }, 150);
  });
  discoverySettlement = { kind, requestId, observer, timer: null, debounce: null };
  observer.observe(scope, { childList: true, subtree: true });
  discoverySettlement.timer = setTimeout(() => finish("settled-empty"), 10000);
  return { ok: true };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return undefined;
  if (message.type === "UIP_BEGIN_DISCOVERY_SETTLEMENT") {
    try { sendResponse(beginDiscoverySettlement(message)); } catch (_) { sendResponse({ ok: false, error: "Discovery settlement could not start." }); }
    return false;
  }
  if (message.type === "UIP_SCAN_CURRENT_DOCUMENT") {
    try {
      const scan = globalThis.UIPScannerCore.scanDocument(document);
      sendResponse({ ok: true, scan });
    } catch (_) { sendResponse({ ok: false, error: "The page could not be scanned." }); }
    return false;
  }
  if (message.type === "UIP_PREFILL_FEEDBACK") {
    try {
      const preference = message.preference;
      const feedbackId = message.feedbackId;
      const expectedQuestionCount = message.expectedQuestionCount;
      const expectedSignature = message.expectedSignature;
      if (typeof preference !== "string" || preference.length > 160 || typeof feedbackId !== "string" || feedbackId.length > 80 || !Number.isInteger(expectedQuestionCount) || expectedQuestionCount < 1 || expectedQuestionCount > 200 || typeof expectedSignature !== "string" || !expectedSignature || expectedSignature.length > 8192) {
        sendResponse({ ok: false, error: "Invalid prefill request." });
        return false;
      }
      const prefillResult = globalThis.UIPScannerCore.prefillFeedbackForm(document, preference, feedbackId, expectedQuestionCount, expectedSignature);
      const scan = globalThis.UIPScannerCore.scanDocument(document);
      sendResponse({ ok: true, prefillResult, scan });
    } catch (_) { sendResponse({ ok: false, error: "The form could not be preselected." }); }
    return false;
  }
  if (message.type === "UIP_INSPECT_FEEDBACK_SUBMISSION") {
    try {
      const submission = globalThis.UIPScannerCore.inspectFeedbackSubmission(document);
      const scan = globalThis.UIPScannerCore.scanDocument(document);
      sendResponse({ ok: true, submission, scan });
    } catch (_) { sendResponse({ ok: false, error: "The submission controls could not be inspected." }); }
    return false;
  }
  if (message.type === "UIP_SUBMIT_FEEDBACK") {
    try {
      const expected = message.expected;
      if (!expected || typeof expected.feedbackId !== "string" || expected.feedbackId.length > 80 || typeof expected.formSignature !== "string" || !expected.formSignature || expected.formSignature.length > 8192 || !Number.isInteger(expected.supportedQuestions) || expected.supportedQuestions < 1 || expected.supportedQuestions > 200) {
        sendResponse({ ok: false, error: "Invalid submission request." });
        return false;
      }
      const submitResult = globalThis.UIPScannerCore.submitFeedback(document, expected);
      sendResponse({ ok: true, submitResult });
    } catch (_) { sendResponse({ ok: false, error: "The Feedback was not submitted." }); }
    return false;
  }
  if (message.type === "UIP_INSPECT_NAVIGATION") {
    try {
      const scan = globalThis.UIPScannerCore.scanDocument(document);
      sendResponse({ ok: true, navigation: { feedbackResult: scan.feedbackResult, sectionNavigation: scan.sectionNavigation }, scan });
    } catch (_) { sendResponse({ ok: false, error: "The navigation controls could not be inspected." }); }
    return false;
  }
  if (message.type === "UIP_NAVIGATE_CONTINUE") {
    try {
      const expected = message.expected;
      if (!expected || typeof expected.feedbackId !== "string" || expected.feedbackId.length > 80 || !["link", "form-submit"].includes(expected.kind) || typeof expected.signature !== "string" || !expected.signature || expected.signature.length > 1000) {
        sendResponse({ ok: false, error: "Invalid navigation request." });
        return false;
      }
      const scope = globalThis.UIPScannerCore.findMainContent(document);
      const result = globalThis.UIPScannerCore.inspectFeedbackResult(document, scope, globalThis.UIPScannerCore.feedbackPageContext(document, scope));
      if (!result || !["completed", "confirmation"].includes(result.state) || result.feedbackId !== expected.feedbackId) {
        sendResponse({ ok: true, navigationResult: { navigationTriggered: false, reason: "navigation-changed" } });
        return false;
      }
      const navigationResult = globalThis.UIPScannerCore.navigateContinue(document, scope, expected);
      sendResponse({ ok: true, navigationResult });
    } catch (_) { sendResponse({ ok: false, error: "The continuation link was not followed." }); }
    return false;
  }
  if (message.type === "UIP_INSPECT_WORKFLOW_NAVIGATION") {
    try {
      const expected = message.expected;
      if (!expected || !["section", "feedback", "response-form", "course-breadcrumb"].includes(expected.kind) || typeof expected.targetId !== "string" || !/^\d+$/.test(expected.targetId) || typeof expected.courseId !== "string" || !/^\d+$/.test(expected.courseId)) {
        sendResponse({ ok: false, error: "Invalid workflow navigation request." });
        return false;
      }
      const scan = globalThis.UIPScannerCore.scanDocument(document);
      const expectedPage = { section: "COURSE", feedback: "SECTION", "response-form": "FEEDBACK" }[expected.kind];
      if (expectedPage && scan.pageType !== expectedPage) {
        sendResponse({ ok: true, navigation: { detected: false, unique: false, action: null }, scan });
        return false;
      }
      const scope = globalThis.UIPScannerCore.findMainContent(document);
      const navigation = globalThis.UIPScannerCore.inspectWorkflowNavigation(document, scope, expected);
      sendResponse({ ok: true, navigation, scan });
    } catch (_) { sendResponse({ ok: false, error: "The workflow navigation could not be inspected." }); }
    return false;
  }
  if (message.type === "UIP_NAVIGATE_WORKFLOW") {
    try {
      const expected = message.expected;
      if (!expected || !["section", "feedback", "response-form", "course-breadcrumb"].includes(expected.kind) || typeof expected.targetId !== "string" || !/^\d+$/.test(expected.targetId) || typeof expected.courseId !== "string" || !/^\d+$/.test(expected.courseId)) {
        sendResponse({ ok: false, error: "Invalid workflow navigation request." });
        return false;
      }
      const scan = globalThis.UIPScannerCore.scanDocument(document);
      const expectedPage = { section: "COURSE", feedback: "SECTION", "response-form": "FEEDBACK" }[expected.kind];
      if (expectedPage && scan.pageType !== expectedPage) {
        sendResponse({ ok: true, navigationResult: { navigationTriggered: false, reason: "page-changed" } });
        return false;
      }
      if (expected.kind !== "course-breadcrumb" && (!scan.course || scan.course.id !== expected.courseId)) {
        sendResponse({ ok: true, navigationResult: { navigationTriggered: false, reason: "course-changed" } });
        return false;
      }
      const scope = globalThis.UIPScannerCore.findMainContent(document);
      const navigationResult = globalThis.UIPScannerCore.navigateWorkflow(document, scope, expected);
      sendResponse({ ok: true, navigationResult });
    } catch (_) { sendResponse({ ok: false, error: "The workflow navigation could not be activated." }); }
    return false;
  }
  return false;
});

/* A page-ready signal lets the persistent engine continue after Moodle navigation. */
try {
  const readyScan = globalThis.UIPScannerCore.scanDocument(document);
  chrome.runtime.sendMessage({
    type: "UIP_MOODLE_PAGE_READY",
    scannerVersion: readyScan.scannerVersion,
    pageType: readyScan.pageType,
    scan: readyScan
  }).catch(() => undefined);
} catch (_) {
  chrome.runtime.sendMessage({ type: "UIP_MOODLE_PAGE_READY", scannerVersion: globalThis.UIPScannerCore.VERSION, pageType: "OTHER" }).catch(() => undefined);
}
