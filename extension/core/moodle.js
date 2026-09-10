/* Page recognition and scanner orchestration. No browser-extension APIs here. */
(function attachMoodle(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};

  core.detectPageType = function detectPageType(document) {
    const path = document.location.pathname || "";
    if (/\/my\/?$/.test(path)) return "AREA_PERSONAL";
    if (/\/course\/view\.php$/.test(path)) return "COURSE";
    if (/\/course\/section\.php$/.test(path)) return "SECTION";
    if (/\/mod\/feedback\//.test(path)) return "FEEDBACK";
    return "OTHER";
  };

  core.isApparentlyLoggedOut = function isApparentlyLoggedOut(document) {
    return Boolean(document.querySelector('form#login, form[action*="login"], input[type="password"]'));
  };

  core.currentCourse = function currentCourse(document, pageType) {
    if (pageType !== "COURSE" && pageType !== "SECTION" && pageType !== "FEEDBACK") return null;
    const name = core.text(document.querySelector(core.selectors.courseName), 300);
    const id = pageType === "COURSE" ? core.idFromUrl(document.location.href, document.location.href) : null;
    return { id: id || null, name: name || null, url: pageType === "COURSE" ? document.location.href : null };
  };

  core.scanDocument = function scanDocument(document) {
    const errors = [];
    const pageType = core.detectPageType(document);
    let courses = []; let modules = []; let activities = []; let feedback = [];
    try { courses = core.scanCourses(document, errors); } catch (_) { core.captureError(errors, "courses"); }
    try { modules = core.scanModules(document, errors); } catch (_) { core.captureError(errors, "modules"); }
    try { activities = core.scanActivities(document, errors); } catch (_) { core.captureError(errors, "activities"); }
    try { feedback = core.findFeedback(activities, document, errors); } catch (_) { core.captureError(errors, "feedback"); }
    const completedFeedback = feedback.filter((item) => item.completionState === "completed").length;
    return {
      scannerVersion: core.VERSION, pageType,
      sessionApparentlyNotStarted: core.isApparentlyLoggedOut(document),
      course: core.currentCourse(document, pageType), courses, modules, activities, feedback,
      summary: {
        courses: courses.length, modules: modules.length, activities: activities.length, feedback: feedback.length,
        feedbackCompleted: completedFeedback,
        feedbackPending: feedback.filter((item) => item.completionState === "incomplete").length,
        modulesAvailable: modules.filter((item) => item.available === true).length,
        modulesLocked: modules.filter((item) => item.locked === true).length
      },
      partial: errors.length > 0, errors
    };
  };
})(globalThis);
