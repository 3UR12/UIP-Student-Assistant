/* Chrome-only, ephemeral allow-listed workflow persistence. */
(function attachWorkflowSession(global) {
  const key = "uip.workflow.v1";
  const statuses = new Set(["pending", "visiting", "needs-review", "completed", "no-feedback", "blocked", "unknown"]);
  const validId = (value) => typeof value === "string" && /^\d+$/.test(value);
  const cleanText = (value, length) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, length) : null;
  const cleanUrl = (value, id) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.origin !== "https://moodle.uip.edu.pa" || url.pathname !== "/course/section.php" || url.searchParams.get("id") !== id) return null;
      return `https://moodle.uip.edu.pa/course/section.php?id=${encodeURIComponent(id)}`;
    } catch (_) { return null; }
  };
  const sanitize = (value) => {
    if (!value || value.version !== 1 || value.active !== true || !validId(value.courseId) || !cleanText(value.preference, 160) || !Array.isArray(value.sections)) return null;
    const seen = new Set();
    const sections = value.sections.map((item) => {
      const id = item && item.id;
      const url = item && cleanUrl(item.url, id);
      const status = item && statuses.has(item.status) ? item.status : null;
      if (!validId(id) || !url || !status || seen.has(id)) return null;
      seen.add(id);
      return { id, url, name: cleanText(item.name, 160), status };
    });
    if (!sections.length || sections.some((item) => !item)) return null;
    const currentSectionId = value.currentSectionId === null ? null : validId(value.currentSectionId) && seen.has(value.currentSectionId) ? value.currentSectionId : null;
    if (value.currentSectionId !== null && currentSectionId === null) return null;
    return { version: 1, active: true, courseId: value.courseId, preference: cleanText(value.preference, 160), sections, currentSectionId };
  };
  const sessionArea = () => global.chrome && chrome.storage && chrome.storage.session;
  const api = {
    key,
    sanitize,
    metadata(workflow) {
      const value = sanitize(workflow);
      if (!value) return null;
      const reviewed = value.sections.filter((item) => item.status === "completed" || item.status === "no-feedback").length;
      const current = value.sections.find((item) => item.id === value.currentSectionId);
      return { active: true, courseId: value.courseId, totalSections: value.sections.length, reviewedSections: reviewed, currentSectionId: value.currentSectionId, currentStatus: current ? current.status : null };
    },
    load() {
      const area = sessionArea();
      if (!area) return Promise.resolve(null);
      return new Promise((resolve) => area.get(key, (result) => resolve(sanitize(result && result[key]))));
    },
    save(workflow) {
      const area = sessionArea(); const clean = sanitize(workflow);
      if (!area || !clean) return Promise.resolve(null);
      return new Promise((resolve) => area.set({ [key]: clean }, () => resolve(clean)));
    },
    clear() {
      const area = sessionArea();
      if (!area) return Promise.resolve();
      return new Promise((resolve) => area.remove(key, resolve));
    }
  };
  global.UIPWorkflowSession = api;
})(globalThis);
