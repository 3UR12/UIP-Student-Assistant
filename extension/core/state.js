/* Browser-independent shared scanner state and conservative DOM helpers. */
(function attachState(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};

  core.VERSION = "0.4.0";
  core.selectors = {
    courseLinks: 'a[href*="/course/view.php"]',
    courseBreadcrumbLinks: '#page-navbar a[href*="/course/view.php"], .breadcrumb a[href*="/course/view.php"], nav[aria-label="breadcrumb"] a[href*="/course/view.php"]',
    sectionLinks: 'a[href*="/course/section.php?id="]',
    activityLinks: 'a[href*="/mod/"]',
    sectionContainers: '[data-for="course_section"], [data-sectionid], .course-section, li[id^="section-"], .section[id^="section-"]',
    activityContainers: '.activity, [data-activityname], [data-activity-id]',
    restricted: '.availabilityinfo, .availability, .restricted, [data-availability], .dimmed',
    completion: '.completioninfo, .completion-status, [data-completion], [data-for="completioninfo"], [data-region="completion"], [data-region="completion-info"], [data-for="completion-info"]',
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

  core.isMoodlePathWithId = function isMoodlePathWithId(value, base, pathname) {
    try {
      const url = new URL(value, base);
      const origin = new URL(base).origin;
      return url.origin === origin && url.pathname === pathname && Boolean(url.searchParams.get("id"));
    } catch (_) { return false; }
  };

  core.canonicalMoodleUrl = function canonicalMoodleUrl(value, base, pathname) {
    if (!core.isMoodlePathWithId(value, base, pathname)) return null;
    const url = new URL(value, base);
    return `${url.origin}${url.pathname}?id=${encodeURIComponent(url.searchParams.get("id"))}`;
  };

  core.closest = function closest(element, selector) {
    try { return element && element.closest(selector); } catch (_) { return null; }
  };

  core.isExcludedRegion = function isExcludedRegion(element) {
    return Boolean(core.closest(element, 'nav, aside, footer, #page-footer, #page-navbar, .sidebar, .drawer, [data-region="drawer"], [data-region="courseindex"], .block_navigation, .block_settings'));
  };

  core.isCompatibleScan = function isCompatibleScan(scan) {
    return Boolean(scan && scan.scannerVersion === core.VERSION);
  };

  core.isDomVisible = function isDomVisible(element) {
    if (!element) return false;
    let current = element;
    while (current) {
      const ariaHidden = current.getAttribute && current.getAttribute("aria-hidden");
      const style = current.style || {};
      if (current.hidden === true || ariaHidden === "true" || style.display === "none" || style.visibility === "hidden") return false;
      try {
        const view = current.ownerDocument && current.ownerDocument.defaultView;
        const computed = view && view.getComputedStyle && view.getComputedStyle(current);
        if (computed && (computed.display === "none" || computed.visibility === "hidden")) return false;
      } catch (_) { /* Visibility cannot be computed; continue with available DOM evidence. */ }
      current = current.parentElement;
    }
    return true;
  };

  core.restriction = function restrictionFor(element, options) {
    if (!element) return { available: null, locked: null, restrictionText: null };
    const evidence = element.querySelector(core.selectors.restricted);
    const text = core.text(evidence, 300);
    const classText = String(element.className || "").toLowerCase();
    const locked = Boolean(text || /\b(restricted|unavailable|locked|dimmed)\b/.test(classText));
    if (locked) return { available: false, locked: true, restrictionText: text || "Restricted by Moodle" };
    if (options && options.navigable === true) return { available: true, locked: false, restrictionText: null };
    return { available: null, locked: null, restrictionText: null };
  };

  core.completionFor = function completionFor(element, cmid) {
    if (!element) return "unknown";
    const nodes = element.querySelectorAll ? Array.from(element.querySelectorAll(core.selectors.completion)) : [element.querySelector(core.selectors.completion)].filter(Boolean);
    const related = cmid && nodes.filter((node) => ["data-cmid", "data-activity-id", "data-module-id"].some((attribute) => node.getAttribute(attribute) === String(cmid)));
    const node = related && related.length ? related[0] : (cmid && nodes.length !== 1 ? null : nodes[0]);
    if (!node) return "unknown";
    const evidence = [node.getAttribute && node.getAttribute("aria-label"), core.text(node, 200), node.className]
      .filter(Boolean).join(" ").toLowerCase();
    if (/\b(hecho|completado|completed|complete|done)\b/.test(evidence)) return "completed";
    if (/\b(por hacer|pendiente|incomplete|notcompleted|todo)\b/.test(evidence)) return "incomplete";
    return "unknown";
  };

  core.captureError = function captureError(errors, stage) {
    errors.push({ stage: String(stage).slice(0, 80), message: "Scanner could not inspect this item." });
  };
})(globalThis);
