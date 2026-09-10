/* Dashboard course-card extraction. Only visible links are reported. */
(function attachCourses(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  core.scanCourses = function scanCourses(document, errors) {
    const found = new Map();
    document.querySelectorAll(core.selectors.courseLinks).forEach((link) => {
      try {
        const url = core.absoluteUrl(link.getAttribute("href"), document.location.href);
        const id = core.idFromUrl(url, document.location.href);
        if (!url || !id || found.has(id)) return;
        const card = core.closest(link, '.coursebox, .dashboard-card, [data-course-id], [data-region="course-content"], li') || link.parentElement;
        const progressNode = card && card.querySelector('[role="progressbar"], .progress, [data-progress]');
        const aria = progressNode && progressNode.getAttribute("aria-valuenow");
        const progress = aria !== null && aria !== "" && !Number.isNaN(Number(aria)) ? Number(aria) : null;
        found.set(id, { id, name: core.text(link, 300), url, progress, visible: true, source: "course-link" });
      } catch (_) { core.captureError(errors, "course"); }
    });
    return Array.from(found.values());
  };
})(globalThis);
