/* Feedback is determined by the Moodle module URL; labels are intentionally ignored. */
(function attachFeedback(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  core.activityPageName = function activityPageName(document, scope) {
    const breadcrumb = document.querySelector('#page-navbar [aria-current="page"], .breadcrumb [aria-current="page"], #page-navbar .active, .breadcrumb .active');
    const heading = scope && scope.querySelector('[data-region="activity-information"] .activityname, [data-region="activity-information"] h1, .activity-header .activityname, .activity-header h1, [data-activityname]');
    return core.text(breadcrumb || heading, 160);
  };
  core.feedbackPageContext = function feedbackPageContext(document, scope) {
    const current = core.canonicalActivityFromUrl(document.location.href, document.location.href);
    const currentId = core.idFromUrl(document.location.href, document.location.href);
    const isFeedbackPath = /^\/mod\/feedback\/(?:view|complete)\.php$/i.test(document.location.pathname || "");
    if (!isFeedbackPath || !currentId) return null;
    const url = current && current.type === "feedback" ? current.url : `${document.location.origin}/mod/feedback/view.php?id=${encodeURIComponent(currentId)}`;
    const responseLink = scope && Array.from(scope.querySelectorAll('a[href*="/mod/feedback/complete.php"]')).find((link) =>
      core.isMoodlePathWithId(link.getAttribute("href"), document.location.href, "/mod/feedback/complete.php") &&
      core.idFromUrl(link.getAttribute("href"), document.location.href) === currentId
    );
    const currentIsResponse = /\/mod\/feedback\/complete\.php$/i.test(document.location.pathname || "");
    const responseUrl = responseLink
      ? core.canonicalMoodleUrl(responseLink.getAttribute("href"), document.location.href, "/mod/feedback/complete.php")
      : currentIsResponse ? core.canonicalMoodleUrl(document.location.href, document.location.href, "/mod/feedback/complete.php") : null;
    const name = core.activityPageName(document, scope);
    const available = core.restriction(scope, { navigable: Boolean(url) }).available;
    return { id: currentId, name, url, completionState: core.completionFor(scope, currentId), available, required: null, position: 1, canRespond: Boolean(responseUrl && (!responseLink || core.isDomVisible(responseLink))), responseUrl };
  };
  core.findFeedback = function findFeedback(activities, _document, errors) {
    return activities.filter((activity) => activity.type === "feedback").map((activity) => {
      try {
        return { id: activity.id, name: activity.name, url: activity.url, completionState: activity.completionState, available: activity.available, required: activity.required === true ? true : null, position: activity.position };
      } catch (_) { core.captureError(errors, "feedback-item"); return null; }
    }).filter(Boolean);
  };
})(globalThis);
