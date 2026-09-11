/* Passive bridge: scanning happens only after an explicit popup request. */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return undefined;
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
