/* Conservative inspection and explicit triggering of the Feedback submit control. */
(function attachSubmission(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const signatureLimit = 8192;

  const belongsToForm = (element, form) => {
    if (!element || !form) return false;
    if (typeof form.contains === "function") return form.contains(element);
    return element.form === form;
  };

  const submitLabel = (control) => core.text(control, 160)
    || (control && control.getAttribute && (control.getAttribute("aria-label") || control.getAttribute("value")))
    || null;
  const excludedSubmitLabel = (label) => /^(cancelar|cancel|atr[aá]s|reset|volver|previsualizar|preview)$/i.test(typeof label === "string" ? label.replace(/\s+/g, " ").trim() : "");
  const isSubmitControl = (control) => String(control && ((control.getAttribute && control.getAttribute("type")) || control.type) || "").toLowerCase() === "submit";

  const controlSummary = (controls) => {
    const control = controls.length === 1 ? controls[0] : null;
    return {
      detected: controls.length > 0,
      unique: controls.length === 1,
      enabled: control ? control.disabled !== true : null,
      visible: control ? core.isDomVisible(control) : null,
      label: control ? submitLabel(control) : null
    };
  };

  core.findFeedbackSubmitControls = function findFeedbackSubmitControls(form) {
    if (!form || !form.querySelectorAll) return [];
    return Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'))
      .filter((control) => isSubmitControl(control) && belongsToForm(control, form) && !excludedSubmitLabel(submitLabel(control)));
  };

  core.inspectFeedbackSubmission = function inspectFeedbackSubmission(document) {
    const formState = core.inspectFeedbackForm(document);
    const form = core.findFeedbackResponseForm(document);
    const controls = core.findFeedbackSubmitControls(form);
    const submitControl = controlSummary(controls);
    const supportedQuestions = formState ? formState.supportedQuestions : 0;
    const answeredSupportedQuestions = formState ? formState.questions.filter((question) => question.type === "radio" && question.answered === true).length : 0;
    const unsupportedQuestions = formState ? formState.unsupportedQuestions : 0;
    const blockers = [];
    if (!core.isFeedbackResponsePage(document)) blockers.push("not-feedback-response");
    if (!formState || !form) blockers.push("form-not-detected");
    if (!formState || !formState.id) blockers.push("invalid-feedback-id");
    if (!formState || typeof formState.signature !== "string" || !formState.signature) blockers.push("missing-form-signature");
    if (supportedQuestions === 0) blockers.push("no-supported-questions");
    if (supportedQuestions !== answeredSupportedQuestions) blockers.push("unanswered-supported-questions");
    if (unsupportedQuestions !== 0) blockers.push("unsupported-questions");
    if (!submitControl.detected) blockers.push("missing-submit");
    else if (!submitControl.unique) blockers.push("ambiguous-submit");
    else if (submitControl.visible !== true) blockers.push("submit-hidden");
    else if (submitControl.enabled !== true) blockers.push("submit-disabled");
    return {
      feedbackId: formState && formState.id || null,
      formDetected: Boolean(formState && form),
      formSignature: formState && formState.signature || null,
      supportedQuestions,
      answeredSupportedQuestions,
      unsupportedQuestions,
      submitControl,
      readyToSubmit: blockers.length === 0,
      blockers
    };
  };

  core.submitFeedback = function submitFeedback(document, expected) {
    const submission = core.inspectFeedbackSubmission(document);
    const result = { submittedAttempted: false, submitTriggered: false, submissionVerified: null, reason: null, submission };
    if (!expected || submission.feedbackId !== expected.feedbackId || submission.formSignature !== expected.formSignature || submission.supportedQuestions !== expected.supportedQuestions || typeof expected.formSignature !== "string" || !expected.formSignature || expected.formSignature.length > signatureLimit) {
      result.reason = "form-changed";
      return result;
    }
    if (!submission.readyToSubmit) {
      result.reason = "form-changed";
      return result;
    }
    const form = core.findFeedbackResponseForm(document);
    const controls = core.findFeedbackSubmitControls(form);
    if (!form || controls.length !== 1 || controls[0].disabled === true || !core.isDomVisible(controls[0])) {
      result.reason = "form-changed";
      return result;
    }
    result.submittedAttempted = true;
    controls[0].click();
    result.submitTriggered = true;
    return result;
  };
})(globalThis);
