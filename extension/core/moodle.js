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

  core.firstVisibleMatch = function firstVisibleMatch(document, selectors) {
    for (const selector of selectors) {
      const candidate = document.querySelector(selector);
      if (candidate && core.isDomVisible(candidate)) return candidate;
    }
    return null;
  };

  core.findMainContent = function findMainContent(document) {
    return core.firstVisibleMatch(document, ['#region-main', 'main[role="main"]', '[role="main"]', 'main', '[data-region="course-content"]']);
  };

  core.currentSectionFromUrl = function currentSectionFromUrl(document) {
    const url = core.canonicalMoodleUrl(document.location.href, document.location.href, "/course/section.php");
    if (!url) return null;
    return { id: core.idFromUrl(url, document.location.href), sectionNumber: null, name: null, url, available: null, locked: null, restrictionText: null, completionState: "unknown" };
  };

  core.findDashboardScope = function findDashboardScope(document) {
    return core.firstVisibleMatch(document, ['#region-main', '[role="main"]', 'main', '[data-region="courses-view"]', '[data-region="course-list"]', '.block_myoverview']);
  };

  core.currentCourse = function currentCourse(document, pageType) {
    if (pageType !== "COURSE" && pageType !== "SECTION" && pageType !== "FEEDBACK") return null;
    if (pageType === "COURSE") {
      const name = core.text(document.querySelector(core.selectors.courseName), 300);
      const url = core.canonicalMoodleUrl(document.location.href, document.location.href, "/course/view.php");
      return { id: core.idFromUrl(url, document.location.href), name: name || null, rawName: name || null, displayName: null, url };
    }
    const link = document.querySelector(core.selectors.courseBreadcrumbLinks) || document.querySelector(core.selectors.courseLinks);
    const url = link && core.canonicalMoodleUrl(link.getAttribute("href"), document.location.href, "/course/view.php");
    if (!url) return { id: null, name: null, rawName: null, displayName: null, url: null };
    const name = core.text(link, 160);
    return { id: core.idFromUrl(url, document.location.href), name, rawName: name, displayName: null, url };
  };

  core.scanDocument = function scanDocument(document) {
    const errors = [];
    const pageType = core.detectPageType(document);
    let courses = []; let modules = []; let activities = []; let feedback = []; let currentSection = null; let feedbackPage = null; let feedbackForm = null; let feedbackSubmission = null; let feedbackResult = null; let sectionNavigation = null;
    const mainScope = core.findMainContent(document);
    try {
      if (pageType === "AREA_PERSONAL") courses = core.scanCourses(core.findDashboardScope(document), document, errors);
    } catch (_) { core.captureError(errors, "courses"); }
    try {
      if (pageType === "COURSE" && mainScope) modules = core.scanModules(mainScope, document, errors);
      if (pageType === "SECTION" && mainScope) {
        const sectionScope = core.findCurrentSection(document, mainScope);
        const sectionId = core.idFromUrl(document.location.href, document.location.href);
        if (sectionScope) {
          modules = core.scanModules(sectionScope, document, errors, sectionId);
          currentSection = modules.find((module) => module.id === sectionId) || core.currentSectionFromUrl(document);
          activities = core.scanActivities(sectionScope, document, errors);
          sectionNavigation = core.inspectSectionNavigation(document, sectionScope);
        } else {
          currentSection = core.currentSectionFromUrl(document);
          modules = currentSection ? [currentSection] : [];
          activities = core.scanActivities(mainScope, document, errors);
          sectionNavigation = core.inspectSectionNavigation(document, mainScope);
        }
      }
    } catch (_) { core.captureError(errors, "modules"); }
    try {
      if (pageType === "AREA_PERSONAL") activities = core.scanActivities(core.findDashboardScope(document), document, errors);
      if (pageType === "COURSE" && mainScope) activities = core.scanActivities(mainScope, document, errors);
      if (pageType === "FEEDBACK" && mainScope) {
        feedbackPage = core.feedbackPageContext(document, mainScope);
        activities = feedbackPage ? [{ id: feedbackPage.id, name: feedbackPage.name, type: "feedback", url: feedbackPage.url, completionState: feedbackPage.completionState, available: feedbackPage.available, restrictionText: null, position: 1, required: null }] : [];
      }
    } catch (_) { core.captureError(errors, "activities"); }
    try { feedback = core.findFeedback(activities, document, errors); } catch (_) { core.captureError(errors, "feedback"); }
    try {
      if (core.isFeedbackResponsePage(document)) {
        feedbackForm = core.inspectFeedbackForm(document);
        feedbackSubmission = core.inspectFeedbackSubmission(document);
      }
      if (pageType === "FEEDBACK") feedbackResult = core.inspectFeedbackResult(document, mainScope, feedbackPage);
    } catch (_) { core.captureError(errors, "feedback-state"); }
    const completedFeedback = feedback.filter((item) => item.completionState === "completed").length;
    return {
      scannerVersion: core.VERSION, pageType,
      sessionApparentlyNotStarted: core.isApparentlyLoggedOut(document),
      course: core.currentCourse(document, pageType), currentSection, feedbackPage, feedbackForm, feedbackSubmission, feedbackResult, sectionNavigation, courses, modules, activities, feedback,
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
