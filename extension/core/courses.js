/* Dashboard course-card extraction. Only visible links are reported. */
(function attachCourses(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  core.scanCourses = function scanCourses(scope, document, errors) {
    const found = new Map();
    const diagnostics = { candidateLinks: 0, canonicalLinks: 0, visibleLinks: 0, excludedLinks: 0, acceptedCourses: 0 };
    const scopes = new Set();
    const addScope = (candidate) => { if (candidate && typeof candidate.querySelectorAll === "function") scopes.add(candidate); };
    // Moodle themes place cards in different regions. Scan known course regions
    // and the document as a safe fallback, de-duplicating every observed link.
    addScope(scope);
    if (document && typeof document.querySelectorAll === "function") {
      ['#region-main', '[role="main"]', 'main', '[data-region="courses-view"]', '[data-region="course-list"]', '.block_myoverview'].forEach((selector) => {
        Array.from(document.querySelectorAll(selector)).forEach(addScope);
      });
      addScope(document);
    }
    const links = new Set();
    scopes.forEach((candidate) => Array.from(candidate.querySelectorAll(core.selectors.courseLinks)).forEach((link) => links.add(link)));
    links.forEach((link) => {
      try {
        diagnostics.candidateLinks += 1;
        if (core.isExcludedRegion(link)) { diagnostics.excludedLinks += 1; return; }
        const url = core.canonicalMoodleUrl(link.getAttribute("href"), document.location.href, "/course/view.php");
        const id = core.idFromUrl(url, document.location.href);
        if (!url || !/^\d+$/.test(id || "")) return;
        diagnostics.canonicalLinks += 1;
        if (!core.isDomVisible(link)) return;
        diagnostics.visibleLinks += 1;
        if (found.has(id)) return;
        const card = core.closest(link, '.coursebox, .dashboard-card, [data-course-id], [data-region="course-content"], li') || link.parentElement;
        const progressNode = card && card.querySelector('[role="progressbar"], .progress, [data-progress]');
        const aria = progressNode && progressNode.getAttribute("aria-valuenow");
        const progress = aria !== null && aria !== "" && !Number.isNaN(Number(aria)) ? Number(aria) : null;
        found.set(id, { id, name: core.text(link, 300), url, progress, visible: core.isDomVisible(link), source: "course-link" });
      } catch (_) { core.captureError(errors, "course"); }
    });
    const courses = Array.from(found.values());
    diagnostics.acceptedCourses = courses.length;
    Object.defineProperty(courses, "diagnostics", { value: diagnostics, enumerable: false });
    return courses;
  };
})(globalThis);
