/* Activity links are classified from Moodle's URL path, not their displayed label. */
(function attachActivities(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const types = new Set(["feedback", "assign", "quiz", "forum", "resource", "url", "lesson", "workshop", "page", "folder"]);
  core.classifyActivity = function classifyActivity(url) {
    const match = String(url || "").match(/\/mod\/([^/?#]+)/i);
    const raw = match ? match[1].toLowerCase() : "";
    return types.has(raw) ? raw : "unknown";
  };
  core.activityTypeFromContainer = function activityTypeFromContainer(container) {
    if (!container) return "unknown";
    const attribute = container.getAttribute("data-activitytype") || container.getAttribute("data-moduletype");
    const match = String(attribute || container.className || "").match(/(?:modtype[-_]|activitytype[-_])([a-z0-9_]+)/i);
    const raw = match ? match[1].toLowerCase() : String(attribute || "").toLowerCase();
    return types.has(raw) ? raw : "unknown";
  };
  core.activityIdFromContainer = function activityIdFromContainer(container) {
    if (!container) return null;
    const dataId = container.getAttribute("data-activity-id") || container.getAttribute("data-cmid");
    if (dataId) return dataId;
    const match = String(container.id || "").match(/^module[-_](\d+)$/i);
    return match ? match[1] : null;
  };
  core.scanActivities = function scanActivities(document, errors) {
    const found = new Map();
    const linkedContainers = new Set();
    const linkedIds = new Set();
    document.querySelectorAll(core.selectors.activityLinks).forEach((link, position) => {
      try {
        const url = core.absoluteUrl(link.getAttribute("href"), document.location.href);
        const id = core.idFromUrl(url, document.location.href);
        if (!url || !id || found.has(url)) return;
        const activity = core.closest(link, core.selectors.activityContainers) || link.parentElement;
        if (activity) linkedContainers.add(activity);
        linkedIds.add(id);
        const named = activity && activity.querySelector('.activityname, [data-activityname]') || link;
        const restriction = core.restriction(activity);
        found.set(url, { id, name: core.text(named, 300), type: core.classifyActivity(url), url, completionState: core.completionFor(activity), available: restriction.available, restrictionText: restriction.restrictionText, position: position + 1 });
      } catch (_) { core.captureError(errors, "activity"); }
    });
    document.querySelectorAll(core.selectors.activityContainers).forEach((container) => {
      try {
        if (linkedContainers.has(container) || container.querySelector(core.selectors.activityLinks)) return;
        const id = core.activityIdFromContainer(container);
        const type = core.activityTypeFromContainer(container);
        const hasMetadata = Boolean(id || type !== "unknown" || container.getAttribute("data-activityname"));
        if (!hasMetadata || (id && linkedIds.has(id))) return;
        const key = id ? `container:${id}` : `container:${found.size + 1}`;
        if (found.has(key)) return;
        const named = container.querySelector('.activityname, [data-activityname]') || container;
        const restriction = core.restriction(container);
        found.set(key, { id, name: core.text(named, 300), type, url: null, completionState: core.completionFor(container), available: restriction.available, restrictionText: restriction.restrictionText, position: found.size + 1 });
      } catch (_) { core.captureError(errors, "activity-container"); }
    });
    return Array.from(found.values());
  };
})(globalThis);
