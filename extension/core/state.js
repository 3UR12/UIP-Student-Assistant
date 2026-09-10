/* Browser-independent shared scanner state and conservative DOM helpers. */
(function attachState(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};

  core.VERSION = "0.1.0";
  core.selectors = {
    courseLinks: 'a[href*="/course/view.php?id="]',
    sectionLinks: 'a[href*="/course/section.php?id="]',
    activityLinks: 'a[href*="/mod/"]',
    sectionContainers: '[data-for="course_section"], .course-section, li.section, .section',
    activityContainers: '.activity, [data-activityname], [data-activity-id]',
    restricted: '.availabilityinfo, .availability, .restricted, [data-availability], .dimmed',
    completion: '.completioninfo, .completion-status, [data-completion]',
    courseName: '.coursename, .course-title, [data-region="course-content"] h1, #page-header h1, h1'
  };

  core.text = function text(element, maxLength) {
    if (!element) return null;
    const value = (element.textContent || "").replace(/\s+/g, " ").trim();
    if (!value) return null;
    return value.slice(0, maxLength || 300);
  };

  core.absoluteUrl = function absoluteUrl(value, base) {
    try {
      const url = new URL(value, base);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch (_) { return null; }
  };

  core.idFromUrl = function idFromUrl(value, base) {
    try { return new URL(value, base).searchParams.get("id"); } catch (_) { return null; }
  };

  core.closest = function closest(element, selector) {
    try { return element && element.closest(selector); } catch (_) { return null; }
  };

  core.restriction = function restrictionFor(element) {
    if (!element) return { available: null, locked: null, restrictionText: null };
    const evidence = element.querySelector(core.selectors.restricted);
    const text = core.text(evidence, 300);
    const classText = String(element.className || "").toLowerCase();
    const locked = Boolean(text || /\b(restricted|unavailable|locked|dimmed)\b/.test(classText));
    return locked
      ? { available: false, locked: true, restrictionText: text || "Restricted by Moodle" }
      : { available: null, locked: null, restrictionText: null };
  };

  core.completionFor = function completionFor(element) {
    if (!element) return "unknown";
    const node = element.querySelector(core.selectors.completion);
    const aria = node && node.getAttribute("aria-label");
    const classes = String((node && node.className) || element.className || "").toLowerCase();
    if (/\b(completed|complete|done)\b/.test(String(aria || "").toLowerCase()) || /\b(completed|complete)\b/.test(classes)) return "completed";
    if (/\b(incomplete|notcompleted|todo)\b/.test(String(aria || "").toLowerCase()) || /\b(incomplete|notcompleted)\b/.test(classes)) return "incomplete";
    return "unknown";
  };

  core.captureError = function captureError(errors, stage) {
    errors.push({ stage: String(stage).slice(0, 80), message: "Scanner could not inspect this item." });
  };
})(globalThis);
