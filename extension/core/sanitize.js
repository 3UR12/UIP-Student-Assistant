/* Explicit allow-list sanitizer for copyable diagnostics. */
(function attachSanitizer(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const cleanText = (value) => typeof value === "string"
    ? value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted]").slice(0, 300)
    : null;
  const cleanUrl = (value) => {
    try {
      const url = new URL(value);
      if (url.hostname !== "moodle.uip.edu.pa") return null;
      const id = url.searchParams.get("id");
      return `${url.origin}${url.pathname}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
    } catch (_) { return null; }
  };
  const maybeBoolean = (value) => value === true || value === false ? value : null;
  const completion = (value) => ["completed", "incomplete", "unknown"].includes(value) ? value : "unknown";

  core.sanitizeDiagnostic = function sanitizeDiagnostic(scan) {
    const course = scan.course && { id: scan.course.id || null, name: cleanText(scan.course.name), url: cleanUrl(scan.course.url) };
    return {
      scannerVersion: core.VERSION,
      pageType: ["AREA_PERSONAL", "COURSE", "SECTION", "FEEDBACK", "OTHER"].includes(scan.pageType) ? scan.pageType : "OTHER",
      partial: Boolean(scan.partial),
      course: course || null,
      courses: (scan.courses || []).map((item) => ({ id: item.id || null, name: cleanText(item.name), url: cleanUrl(item.url), progress: Number.isFinite(item.progress) ? item.progress : null, visible: item.visible === true, source: item.source === "course-link" ? "course-link" : "unknown" })),
      modules: (scan.modules || []).map((item) => ({ id: item.id || null, name: cleanText(item.name), url: cleanUrl(item.url), available: maybeBoolean(item.available), locked: maybeBoolean(item.locked), restrictionText: cleanText(item.restrictionText), completionState: completion(item.completionState) })),
      activities: (scan.activities || []).map((item) => ({ id: item.id || null, name: cleanText(item.name), type: cleanText(item.type), url: cleanUrl(item.url), completionState: completion(item.completionState), available: maybeBoolean(item.available), restrictionText: cleanText(item.restrictionText) })),
      feedback: (scan.feedback || []).map((item) => ({ id: item.id || null, name: cleanText(item.name), url: cleanUrl(item.url), completionState: completion(item.completionState), available: maybeBoolean(item.available), required: maybeBoolean(item.required), position: Number.isInteger(item.position) ? item.position : null })),
      errors: (scan.errors || []).map((item) => ({ stage: cleanText(item.stage) || "unknown", message: "Scanner could not inspect this item." }))
    };
  };
})(globalThis);
