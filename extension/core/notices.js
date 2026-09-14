/* Extracts only visible Moodle notice containers; it never scans arbitrary page text. */
(function attachNotices(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const selectors = '[role="alert"], .alert, .alert-danger, .alert-warning, .notification, [data-region="notification"]';
  core.scanPageNotices = function scanPageNotices(document, scope, errors) {
    if (!document || !document.querySelectorAll) return [];
    const found = new Map();
    try {
      Array.from(document.querySelectorAll(selectors)).forEach((node) => {
        // Moodle may render its route warning above the main-course container.
        if (!core.isDomVisible(node)) return;
        const value = core.text(node, 260);
        if (!value) return;
        const className = typeof node.className === "string" ? node.className : "";
        const type = /danger|error/i.test(className) ? "error" : /warning/i.test(className) ? "warning" : "notice";
        found.set(`${type}:${value}`, { type, text: value });
      });
    } catch (_) { core.captureError(errors, "page-notices"); }
    return Array.from(found.values()).slice(0, 20);
  };
})(globalThis);
