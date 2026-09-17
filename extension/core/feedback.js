/* Feedback is determined by the Moodle module URL; labels are intentionally ignored. */
(function attachFeedback(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const completionControlText = (value) => {
    const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim().toLocaleLowerCase() : "";
    return /^(por hacer|hecho|pendiente)\s*:/.test(text) || /\benviar retroalimentaci[oó]n\b/.test(text);
  };
  const normalizedText = (value) => typeof value === "string" ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase() : "";
  const completedEvidence = (scope) => {
    const value = normalizedText(core.text(scope, 2400));
    return /(?:feedback|retroalimentacion).{0,80}(?:completad|respondid|enviad)|(?:completad|respondid|enviad).{0,80}(?:feedback|retroalimentacion)|(?:you have|has) (?:completed|submitted)/.test(value);
  };
  core.activityPageName = function activityPageName(document, scope) {
    const heading = scope && scope.querySelector('[data-region="activity-information"] .activityname, [data-region="activity-information"] h1, .activity-header .activityname, .activity-header h1, [data-activityname]');
    const headingName = core.text(heading, 160);
    if (headingName && !completionControlText(headingName)) return headingName;
    const breadcrumb = document.querySelector('#page-navbar [aria-current="page"], .breadcrumb [aria-current="page"], #page-navbar .active, .breadcrumb .active');
    const breadcrumbName = core.text(breadcrumb, 160);
    return breadcrumbName && !completionControlText(breadcrumbName) ? breadcrumbName : null;
  };
  core.resolveFeedbackContext = function resolveFeedbackContext(document) {
    const currentId = core.idFromUrl(document.location.href, document.location.href);
    const current = core.canonicalActivityFromUrl(document.location.href, document.location.href);
    if (currentId) return { id: currentId, name: null, url: current && current.type === "feedback" ? current.url : `${document.location.origin}/mod/feedback/view.php?id=${encodeURIComponent(currentId)}`, recoveredFromBreadcrumb: false };
    if (!/^\/mod\/feedback\/complete\.php$/i.test(document.location.pathname || "") || !document.querySelectorAll) return null;
    const candidates = new Map();
    Array.from(document.querySelectorAll('#page-navbar a[href*="/mod/feedback/view.php"], .breadcrumb a[href*="/mod/feedback/view.php"], nav[aria-label="breadcrumb"] a[href*="/mod/feedback/view.php"]')).forEach((link) => {
      if (!core.isDomVisible(link)) return;
      const url = core.canonicalMoodleUrl(link.getAttribute("href"), document.location.href, "/mod/feedback/view.php");
      const id = core.idFromUrl(url, document.location.href);
      if (!id) return;
      candidates.set(id, { id, name: core.text(link, 160), url, recoveredFromBreadcrumb: true });
    });
    return candidates.size === 1 ? Array.from(candidates.values())[0] : null;
  };
  core.feedbackPageContext = function feedbackPageContext(document, scope) {
    const currentId = core.idFromUrl(document.location.href, document.location.href);
    const context = core.resolveFeedbackContext(document);
    const isFeedbackPath = /^\/mod\/feedback\/(?:view|complete)\.php$/i.test(document.location.pathname || "");
    if (!isFeedbackPath || !context) return null;
    const url = context.url;
    const responseLink = scope && Array.from(scope.querySelectorAll('a[href*="/mod/feedback/complete.php"]')).find((link) =>
      core.isMoodlePathWithId(link.getAttribute("href"), document.location.href, "/mod/feedback/complete.php") &&
      core.idFromUrl(link.getAttribute("href"), document.location.href) === context.id
    );
    const currentIsResponse = /\/mod\/feedback\/complete\.php$/i.test(document.location.pathname || "");
    const editableResponse = currentIsResponse && Boolean(currentId) && Boolean(core.findFeedbackResponseForm(document));
    const responseUrl = responseLink && (!currentIsResponse || editableResponse)
      ? core.canonicalMoodleUrl(responseLink.getAttribute("href"), document.location.href, "/mod/feedback/complete.php")
      : editableResponse ? core.canonicalMoodleUrl(document.location.href, document.location.href, "/mod/feedback/complete.php") : null;
    const name = context.name || core.activityPageName(document, scope);
    const available = core.restriction(scope, { navigable: Boolean(url) }).available;
    const canRespond = Boolean(responseUrl && (!responseLink || core.isDomVisible(responseLink)));
    // Completion badges vary by account and course. The actual Feedback view is authoritative.
    const capability = available === false ? "blocked" : canRespond || editableResponse ? "respondable" : completedEvidence(scope) ? "completed" : "unknown";
    return { id: context.id, name, url, completionState: core.completionFor(scope, context.id), capability, available, required: null, position: 1, canRespond, responseUrl };
  };
  core.findFeedback = function findFeedback(activities, _document, errors) {
    return activities.filter((activity) => activity.type === "feedback").map((activity) => {
      try {
        return { id: activity.id, name: activity.name, url: activity.url, completionState: activity.completionState, capability: activity.capability || "unknown", available: activity.available, required: activity.required === true ? true : null, position: activity.position };
      } catch (_) { core.captureError(errors, "feedback-item"); return null; }
    }).filter(Boolean);
  };
})(globalThis);
