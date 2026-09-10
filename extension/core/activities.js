/* Activity links are classified from Moodle's URL path, not their displayed label. */
(function attachActivities(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const types = new Set(["feedback", "assign", "quiz", "forum", "resource", "url", "lesson", "workshop", "page", "folder"]);
  core.classifyActivity = function classifyActivity(url) {
    const match = String(url || "").match(/\/mod\/([^/?#]+)/i);
    const raw = match ? match[1].toLowerCase() : "";
    return types.has(raw) ? raw : "unknown";
  };
  core.canonicalActivityFromUrl = function canonicalActivityFromUrl(value, base) {
    try {
      const url = new URL(value, base);
      const origin = new URL(base).origin;
      const match = url.pathname.match(/^\/mod\/([^/]+)\/view\.php$/i);
      const id = url.searchParams.get("id");
      if (url.origin !== origin || !match || !id) return null;
      const plugin = match[1].toLowerCase();
      return { id, type: types.has(plugin) ? plugin : "unknown", url: `${url.origin}/mod/${plugin}/view.php?id=${encodeURIComponent(id)}` };
    } catch (_) { return null; }
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
  core.activityNameFrom = function activityNameFrom(container, link) {
    const named = container && container.querySelector('.activityname, [data-for="activityname"], [data-region="activityname"]');
    const attribute = container && container.getAttribute("data-activityname");
    return core.text(named, 160) || (attribute ? String(attribute).slice(0, 160) : null) || core.text(link, 160);
  };
  core.activityHasIdentity = function activityHasIdentity(container) {
    return Boolean(core.activityIdFromContainer(container) || core.activityTypeFromContainer(container) !== "unknown");
  };
  core.scanActivities = function scanActivities(scope, document, errors) {
    if (!scope) return [];
    const found = new Map();
    const linkedContainers = new Set();
    const linkedIds = new Set();
    scope.querySelectorAll(core.selectors.activityLinks).forEach((link, position) => {
      try {
        if (core.isExcludedRegion(link)) return;
        const canonical = core.canonicalActivityFromUrl(link.getAttribute("href"), document.location.href);
        if (!canonical) return;
        const activity = core.closest(link, core.selectors.activityContainers) || link.parentElement;
        if (activity) linkedContainers.add(activity);
        linkedIds.add(canonical.id);
        const key = `${canonical.type}:${canonical.id}`;
        const name = core.activityNameFrom(activity, link);
        const restriction = core.restriction(activity, { navigable: Boolean(activity && core.isDomVisible(activity) && core.isDomVisible(link)) });
        const candidate = { id: canonical.id, name, type: canonical.type, url: canonical.url, completionState: core.completionFor(activity), available: restriction.available, restrictionText: restriction.restrictionText, position: position + 1, nameQuality: activity && core.activityNameFrom(activity, null) ? 2 : 1 };
        const existing = found.get(key);
        if (!existing || candidate.nameQuality > existing.nameQuality) found.set(key, candidate);
      } catch (_) { core.captureError(errors, "activity"); }
    });
    scope.querySelectorAll(core.selectors.activityContainers).forEach((container) => {
      try {
        if (core.isExcludedRegion(container) || linkedContainers.has(container) || container.querySelector(core.selectors.activityLinks)) return;
        const id = core.activityIdFromContainer(container);
        const type = core.activityTypeFromContainer(container);
        if (!core.activityHasIdentity(container) || (id && linkedIds.has(id))) return;
        const name = core.activityNameFrom(container, null);
        if (!name) return;
        const key = id ? `${type}:${id}` : `container:${type}:${name.toLowerCase()}`;
        if (found.has(key)) return;
        const restriction = core.restriction(container);
        found.set(key, { id, name, type, url: null, completionState: core.completionFor(container), available: restriction.available, restrictionText: restriction.restrictionText, position: found.size + 1, nameQuality: 2 });
      } catch (_) { core.captureError(errors, "activity-container"); }
    });
    return Array.from(found.values()).map(({ nameQuality, ...activity }) => activity);
  };
})(globalThis);
