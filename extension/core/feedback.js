/* Feedback is determined by the Moodle module URL; labels are intentionally ignored. */
(function attachFeedback(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  core.findFeedback = function findFeedback(activities, document, errors) {
    return activities.filter((activity) => activity.type === "feedback").map((activity) => {
      try {
        const link = Array.from(document.querySelectorAll(core.selectors.activityLinks)).find((item) => core.absoluteUrl(item.getAttribute("href"), document.location.href) === activity.url);
        const container = core.closest(link, core.selectors.activityContainers);
        const required = container && (container.getAttribute("data-required") === "true" || container.classList.contains("required")) ? true : null;
        return { id: activity.id, name: activity.name, url: activity.url, completionState: activity.completionState, available: activity.available, required, position: activity.position };
      } catch (_) { core.captureError(errors, "feedback-item"); return null; }
    }).filter(Boolean);
  };
})(globalThis);
