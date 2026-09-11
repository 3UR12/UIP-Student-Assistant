/* Pure popup workflow-hydration decisions; no Chrome APIs or DOM access. */
(function attachWorkflowUiState(global) {
  const api = {
    begin(epoch) { return { epoch, loading: true, error: false, workflow: null }; },
    hydrate(state, epoch, result) {
      if (!state || state.epoch !== epoch) return { apply: false, state };
      if (!result || result.ok !== true) return { apply: true, state: { epoch, loading: false, error: true, workflow: null } };
      return { apply: true, state: { epoch, loading: false, error: false, workflow: result.workflow || null } };
    },
    canCopy(state) { return Boolean(state && !state.loading && !state.error); },
    canProceedAfterSave(result) { return Boolean(result && result.ok === true && result.workflow); },
    diagnosticState(state, metadata) {
      if (metadata) return { workflow: metadata };
      return state && state.error ? { workflowState: "unavailable" } : {};
    },
    canShowPlanner(scan, state) { return Boolean(state && !state.loading && !state.error && state.workflow === null && scan && scan.pageType === "COURSE" && scan.course && scan.course.id); },
    feedbackViewAction(scan) {
      if (!scan || scan.pageType !== "FEEDBACK") return "none";
      if (scan.feedbackForm && scan.feedbackForm.detected === true) return "form-open";
      return scan.feedbackPage && scan.feedbackPage.id && scan.feedbackPage.canRespond === true ? "open-form" : "none";
    }
  };
  global.UIPWorkflowUiState = api;
})(globalThis);
