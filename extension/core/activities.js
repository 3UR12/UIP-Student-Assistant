/* Activity links are classified from Moodle's URL path, not their displayed label. */
(function attachActivities(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const types = new Set(["feedback", "assign", "quiz", "forum", "resource", "url", "lesson", "workshop", "page", "folder"]);
  core.classifyActivity = function classifyActivity(url) {
    const match = String(url || "").match(/\/mod\/([^/?#]+)/i);
    const raw = match ? match[1].toLowerCase() : "";
    return types.has(raw) ? raw : "unknown";
  };
  core.scanActivities = function scanActivities(document, errors) {
    const found = new Map();
    document.querySelectorAll(core.selectors.activityLinks).forEach((link, position) => {
      try {
        const url = core.absoluteUrl(link.getAttribute("href"), document.location.href);
        const id = core.idFromUrl(url, document.location.href);
        if (!url || !id || found.has(url)) return;
        const activity = core.closest(link, core.selectors.activityContainers) || link.parentElement;
        const named = activity && activity.querySelector('.activityname, [data-activityname]') || link;
        const restriction = core.restriction(activity);
        found.set(url, { id, name: core.text(named, 300), type: core.classifyActivity(url), url, completionState: core.completionFor(activity), available: restriction.available, restrictionText: restriction.restrictionText, position: position + 1 });
      } catch (_) { core.captureError(errors, "activity"); }
    });
    return Array.from(found.values());
  };
})(globalThis);
