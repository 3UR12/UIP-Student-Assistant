/* Explicit allow-list sanitizer for copyable diagnostics. */
(function attachSanitizer(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const cleanText = (value) => typeof value === "string"
    ? value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted]").slice(0, 300)
    : null;
  const cleanLabel = (value) => {
    const text = cleanText(value);
    return text ? text.slice(0, 160) : null;
  };
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
    const course = scan.course && { id: scan.course.id || null, name: cleanLabel(scan.course.name), rawName: cleanLabel(scan.course.rawName), displayName: cleanLabel(scan.course.displayName), url: cleanUrl(scan.course.url) };
    return {
      scannerVersion: typeof scan.scannerVersion === "string" ? scan.scannerVersion : null,
      pageType: ["AREA_PERSONAL", "COURSE", "SECTION", "FEEDBACK", "OTHER"].includes(scan.pageType) ? scan.pageType : "OTHER",
      partial: Boolean(scan.partial),
      course: course || null,
      currentSection: scan.currentSection ? { id: scan.currentSection.id || null, sectionNumber: Number.isInteger(scan.currentSection.sectionNumber) ? scan.currentSection.sectionNumber : null, name: cleanLabel(scan.currentSection.name), url: cleanUrl(scan.currentSection.url) } : null,
      feedbackPage: scan.feedbackPage ? { id: scan.feedbackPage.id || null, name: cleanLabel(scan.feedbackPage.name), url: cleanUrl(scan.feedbackPage.url), canRespond: maybeBoolean(scan.feedbackPage.canRespond), responseUrl: cleanUrl(scan.feedbackPage.responseUrl), completionState: completion(scan.feedbackPage.completionState) } : null,
      feedbackForm: scan.feedbackForm ? {
        id: scan.feedbackForm.id || null,
        pageUrl: cleanUrl(scan.feedbackForm.pageUrl),
        detected: scan.feedbackForm.detected === true,
        supportedQuestions: Number.isInteger(scan.feedbackForm.supportedQuestions) ? scan.feedbackForm.supportedQuestions : 0,
        unsupportedQuestions: Number.isInteger(scan.feedbackForm.unsupportedQuestions) ? scan.feedbackForm.unsupportedQuestions : 0,
        canPrefill: scan.feedbackForm.canPrefill === true,
        preferenceOptions: (scan.feedbackForm.preferenceOptions || []).map(cleanLabel).filter(Boolean),
        questions: (scan.feedbackForm.questions || []).map((item) => ({ id: cleanLabel(item.id), index: Number.isInteger(item.index) ? item.index : null, label: cleanLabel(item.label), type: ["radio", "checkbox", "textarea", "select", "text"].includes(item.type) ? item.type : "unknown", required: maybeBoolean(item.required), answered: item.answered === true, options: (item.options || []).map((option) => ({ label: cleanLabel(option.label), selected: option.selected === true })) }))
      } : null,
      courses: (scan.courses || []).map((item) => ({ id: item.id || null, name: cleanLabel(item.name), url: cleanUrl(item.url), progress: Number.isFinite(item.progress) ? item.progress : null, visible: item.visible === true, source: item.source === "course-link" ? "course-link" : "unknown" })),
      modules: (scan.modules || []).map((item) => ({ id: item.id || null, sectionNumber: Number.isInteger(item.sectionNumber) ? item.sectionNumber : null, name: cleanLabel(item.name), url: cleanUrl(item.url), available: maybeBoolean(item.available), locked: maybeBoolean(item.locked), restrictionText: cleanText(item.restrictionText), completionState: completion(item.completionState) })),
      activities: (scan.activities || []).map((item) => ({ id: item.id || null, name: cleanLabel(item.name), type: cleanLabel(item.type), url: cleanUrl(item.url), completionState: completion(item.completionState), available: maybeBoolean(item.available), restrictionText: cleanText(item.restrictionText) })),
      feedback: (scan.feedback || []).map((item) => ({ id: item.id || null, name: cleanLabel(item.name), url: cleanUrl(item.url), completionState: completion(item.completionState), available: maybeBoolean(item.available), required: maybeBoolean(item.required), position: Number.isInteger(item.position) ? item.position : null })),
      errors: (scan.errors || []).map((item) => ({ stage: cleanText(item.stage) || "unknown", message: "Scanner could not inspect this item." }))
    };
  };
})(globalThis);
