/* Read and local-radio-prefill logic for the Feedback form currently open. */
(function attachFeedbackForm(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const labelLimit = 160;
  const signatureLimit = 8192;
  const normalize = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().toLocaleLowerCase() : "";
  const labelText = (node) => core.text(node, labelLimit);

  core.isFeedbackResponsePage = function isFeedbackResponsePage(document) {
    return /^\/mod\/feedback\/complete\.php$/i.test(document.location.pathname || "") && Boolean(core.idFromUrl(document.location.href, document.location.href));
  };

  core.findFeedbackResponseForm = function findFeedbackResponseForm(document) {
    if (!core.isFeedbackResponsePage(document)) return null;
    const forms = Array.from(document.querySelectorAll('form#feedback_complete_form, form[id*="feedback"], form[class*="feedback"], form[action*="/mod/feedback/complete.php"]'));
    return forms.find((form) => core.isDomVisible(form) && form.querySelector('input[type="radio"], input[type="checkbox"], textarea, select, input[type="text"], input:not([type])')) || null;
  };

  core.feedbackQuestionContainer = function feedbackQuestionContainer(input) {
    return core.closest(input, '[data-questionid], .feedback_item, .feedback_item_radio, .feedback_item_select, fieldset, .form-group') || input.parentElement;
  };

  core.feedbackOptionLabel = function feedbackOptionLabel(input, form) {
    if (!input) return null;
    const byFor = input.id && Array.from(form.querySelectorAll("label")).find((label) => label.htmlFor === input.id);
    return labelText(byFor || core.closest(input, "label"));
  };

  core.feedbackQuestionLabel = function feedbackQuestionLabel(container) {
    if (!container) return null;
    return labelText(container.querySelector('legend, .questiontext, .feedback_item_label, [data-region="question-label"], label'));
  };

  core.feedbackRequired = function feedbackRequired(inputs, container) {
    if (inputs.some((input) => input.required === true || input.getAttribute("aria-required") === "true")) return true;
    if (container && (container.getAttribute("aria-required") === "true" || container.getAttribute("data-required") === "true")) return true;
    return null;
  };

  core.feedbackFormSignature = function feedbackFormSignature(feedbackId, questions) {
    if (typeof feedbackId !== "string" || !feedbackId || !Array.isArray(questions)) return null;
    const identity = {
      feedbackId,
      radioQuestions: questions.filter((question) => question.type === "radio").map((question) => ({
        id: typeof question.id === "string" ? question.id : "",
        options: (question.options || []).map((option) => normalize(option.label))
      }))
    };
    const signature = JSON.stringify(identity);
    return signature.length <= signatureLimit ? signature : null;
  };

  const commonPreferenceOptions = (questions) => {
    const optionMaps = questions.map((question) => new Map(question.options
      .filter((option) => option.label)
      .map((option) => [normalize(option.label), option.label])));
    if (!optionMaps.length) return [];
    return Array.from(optionMaps[0]).filter(([key]) => optionMaps.every((options) => options.has(key))).map(([, label]) => label);
  };

  const belongsToForm = (input, form) => {
    if (!input || !form) return false;
    if (typeof form.contains === "function") return form.contains(input);
    return input.form === form;
  };

  core.inspectFeedbackForm = function inspectFeedbackForm(document) {
    const feedbackId = core.idFromUrl(document.location.href, document.location.href);
    const form = core.findFeedbackResponseForm(document);
    if (!form || !feedbackId) return null;
    const groups = new Map();
    Array.from(form.querySelectorAll('input[type="radio"]')).forEach((input) => {
      if (!input.name || input.disabled || !core.isDomVisible(input)) return;
      if (!groups.has(input.name)) groups.set(input.name, []);
      groups.get(input.name).push(input);
    });
    const questions = Array.from(groups.entries()).map(([name, inputs], index) => {
      const container = core.feedbackQuestionContainer(inputs[0]);
      return {
        id: name,
        index: index + 1,
        label: core.feedbackQuestionLabel(container),
        type: "radio",
        required: core.feedbackRequired(inputs, container),
        answered: inputs.some((input) => input.checked),
        currentValue: (inputs.find((input) => input.checked) || {}).value || null,
        options: inputs.map((input) => ({ label: core.feedbackOptionLabel(input, form), value: String(input.value || ""), selected: input.checked === true }))
      };
    });
    const unsupported = Array.from(form.querySelectorAll('textarea, select, input[type="checkbox"], input[type="text"], input:not([type])')).filter((input) => core.isDomVisible(input)).map((input, index) => {
      const container = core.feedbackQuestionContainer(input);
      const type = input.tagName.toLowerCase() === "textarea" ? "textarea" : input.tagName.toLowerCase() === "select" ? "select" : input.type === "checkbox" ? "checkbox" : "text";
      return { id: input.name || input.id || `manual-${index + 1}`, index: questions.length + index + 1, label: core.feedbackQuestionLabel(container), type, required: core.feedbackRequired([input], container), answered: type === "checkbox" ? input.checked === true : null, currentValue: null, options: [] };
    });
    const preferenceOptions = commonPreferenceOptions(questions);
    const signature = core.feedbackFormSignature(feedbackId, questions);
    return {
      id: feedbackId,
      pageUrl: core.canonicalMoodleUrl(document.location.href, document.location.href, "/mod/feedback/complete.php"),
      detected: true,
      questions: questions.concat(unsupported),
      supportedQuestions: questions.length,
      unsupportedQuestions: unsupported.length,
      canPrefill: questions.length > 0 && preferenceOptions.length > 0 && signature !== null,
      preferenceOptions,
      signature
    };
  };

  core.feedbackPrefillPreview = function feedbackPrefillPreview(formState, preference) {
    const result = { feedbackId: formState && formState.id || null, preference: null, totalQuestions: 0, matched: 0, changed: 0, alreadyMatching: 0, skippedExisting: 0, unsupported: 0, missingOption: 0, submitted: false, details: [] };
    if (!formState || typeof preference !== "string" || preference.length > labelLimit) return result;
    const normalizedPreference = normalize(preference);
    if (!normalizedPreference || !(formState.preferenceOptions || []).some((label) => normalize(label) === normalizedPreference)) return result;
    result.preference = preference.trim();
    result.totalQuestions = formState.questions.length;
    result.unsupported = formState.unsupportedQuestions;
    formState.questions.filter((question) => question.type === "radio").forEach((question) => {
      const matching = question.options.find((option) => normalize(option.label) === normalizedPreference);
      const selected = question.options.find((option) => option.selected);
      const detail = { id: question.id, label: question.label, status: "" };
      if (!matching) { result.missingOption += 1; detail.status = "missing-option"; }
      else {
        result.matched += 1;
        if (selected && selected !== matching) { result.skippedExisting += 1; detail.status = "existing-answer"; }
        else if (selected === matching) { result.alreadyMatching += 1; detail.status = "already-matching"; }
        else { result.changed += 1; detail.status = "changed"; }
      }
      result.details.push(detail);
    });
    return result;
  };

  core.prefillFeedbackForm = function prefillFeedbackForm(document, preference, expectedFeedbackId, expectedQuestionCount, expectedSignature) {
    const formState = core.inspectFeedbackForm(document);
    const result = core.feedbackPrefillPreview(formState, preference);
    const reject = (reason) => {
      result.matched = 0; result.changed = 0; result.alreadyMatching = 0; result.skippedExisting = 0; result.unsupported = 0; result.missingOption = 0; result.details = [];
      result.staleForm = reason === "form-changed";
      result.reason = reason;
      return result;
    };
    if (!formState || formState.id !== expectedFeedbackId || formState.questions.length !== expectedQuestionCount || typeof preference !== "string" || preference.length > labelLimit || typeof expectedSignature !== "string" || expectedSignature.length > signatureLimit) {
      return reject("form-changed");
    }
    if (formState.signature !== expectedSignature) {
      return reject("form-changed");
    }
    const normalizedPreference = normalize(preference);
    if (!normalizedPreference || !result.preference) return result;
    const form = core.findFeedbackResponseForm(document);
    if (!form) return reject("form-changed");
    result.matched = 0; result.changed = 0; result.alreadyMatching = 0; result.skippedExisting = 0; result.missingOption = 0;
    formState.questions.filter((question) => question.type === "radio").forEach((question) => {
      const inputs = Array.from(form.querySelectorAll('input[type="radio"]')).filter((input) => input.name === question.id && input.disabled !== true && core.isDomVisible(input) && belongsToForm(input, form));
      const target = inputs.find((input) => normalize(core.feedbackOptionLabel(input, form)) === normalizedPreference);
      const detail = result.details.find((item) => item.id === question.id);
      if (!target) { result.missingOption += 1; if (detail) detail.status = "missing-option"; return; }
      result.matched += 1;
      const selected = inputs.find((input) => input.checked);
      if (selected && selected !== target) { result.skippedExisting += 1; if (detail) detail.status = "existing-answer"; return; }
      if (selected === target) { result.alreadyMatching += 1; if (detail) detail.status = "already-matching"; return; }
      target.checked = true;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      result.changed += 1;
      if (detail) detail.status = "changed";
    });
    return result;
  };
})(globalThis);
