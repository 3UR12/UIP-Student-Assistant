/* Pure popup workflow-hydration decisions; no Chrome APIs or DOM access. */
(function attachWorkflowUiState(global) {
  const api = {
    isCurrentEpoch(state, epoch) { return Boolean(state && state.epoch === epoch); },
    canCopy(state) { return Boolean(state && state.phase === "ready"); },
    canProceedAfterSave(result) { return Boolean(result && result.ok === true && result.workflow); },
    diagnosticState(state, metadata) {
      if (metadata) return { workflow: metadata };
      return state && state.phase === "error" ? { workflowState: "unavailable" } : {};
    },
    canShowPlanner(scan, state) { return Boolean(state && state.phase === "ready" && state.workflow === null && scan && scan.pageType === "COURSE" && scan.course && scan.course.id); },
    feedbackViewAction(scan) {
      if (!scan || scan.pageType !== "FEEDBACK") return "none";
      if (scan.feedbackForm && scan.feedbackForm.detected === true) return "form-open";
      return scan.feedbackPage && scan.feedbackPage.id && scan.feedbackPage.canRespond === true ? "open-form" : "none";
    }
  };
  global.UIPWorkflowUiState = api;
})(globalThis);
