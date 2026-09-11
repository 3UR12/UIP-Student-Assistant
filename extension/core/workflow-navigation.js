/* Pure planning, classification, and revalidated anchor navigation for v0.4 workflows. */
(function attachWorkflowNavigation(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const moodleOrigin = "https://moodle.uip.edu.pa";
  const statuses = new Set(["pending", "visiting", "needs-review", "completed", "no-feedback", "blocked", "unknown"]);
  const paths = {
    section: "/course/section.php",
    feedback: "/mod/feedback/view.php",
    "response-form": "/mod/feedback/complete.php",
    "course-breadcrumb": "/course/view.php"
  };
  const validId = (value) => typeof value === "string" && /^\d+$/.test(value);
  const text = (value, length) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, length || 160) : null;

  const canonicalTarget = (value, base, pathname, expectedId) => {
    try {
      const url = new URL(value, base);
      const id = url.searchParams.get("id");
      if (url.protocol !== "https:" || url.origin !== moodleOrigin || url.pathname !== pathname || !validId(id) || (expectedId && id !== expectedId)) return null;
      return { id, url: `${moodleOrigin}${pathname}?id=${encodeURIComponent(id)}` };
    } catch (_) { return null; }
  };
  const signatureFor = (kind, target) => JSON.stringify({ kind, pathname: paths[kind], id: target.id });
  const ownerFor = (link) => core.closest(link, core.selectors.activityContainers) || core.closest(link, core.selectors.sectionContainers) || link.parentElement || link;
  const restricted = (link) => core.restriction(ownerFor(link), { navigable: core.isDomVisible(link) });
  const inScope = (scope, link) => !scope || typeof scope.contains !== "function" || scope.contains(link);

  core.workflowPlanCandidates = function workflowPlanCandidates(course, modules) {
    const courseId = course && validId(course.id) ? course.id : null;
    if (!courseId || !Array.isArray(modules)) return [];
    return modules.map((module, index) => {
      const target = module && canonicalTarget(module.url, module.url, paths.section, module.id);
      const name = text(module && module.name, 160);
      const selectable = Boolean(target && module.available === true && module.locked !== true);
      return {
        id: target ? target.id : null,
        url: target ? target.url : null,
        name,
        selectable,
        autoSelected: selectable && Boolean(name),
        reason: selectable ? null : module && module.locked === true ? "locked" : module && module.available === false ? "unavailable" : "unverified",
        position: index
      };
    }).filter((item) => item.id && item.url);
  };

  core.createWorkflowPlan = function createWorkflowPlan(courseId, preference, candidates, selectedIds) {
    if (!validId(courseId) || !text(preference, 160) || !Array.isArray(candidates) || !Array.isArray(selectedIds)) return null;
    const selected = new Set(selectedIds.filter(validId));
    const sections = candidates.filter((item) => item && item.selectable === true && selected.has(item.id)).map((item) => ({ id: item.id, url: item.url, name: item.name, status: "pending" }));
    return sections.length ? { version: 1, active: true, courseId, preference: text(preference, 160), sections, currentSectionId: null } : null;
  };

  core.classifyWorkflowSection = function classifyWorkflowSection(feedback) {
    const items = Array.isArray(feedback) ? feedback : [];
    if (!items.length) return "no-feedback";
    if (items.every((item) => item && item.completionState === "completed")) return "completed";
    if (items.some((item) => item && item.completionState === "unknown")) return "unknown";
    if (items.some((item) => item && item.available === false)) return "blocked";
    if (items.some((item) => item && item.completionState === "incomplete" && item.available === true)) return "needs-review";
    return "unknown";
  };

  core.workflowNextSection = function workflowNextSection(workflow) {
    if (!workflow || !Array.isArray(workflow.sections)) return null;
    const current = workflow.sections.findIndex((item) => item.id === workflow.currentSectionId);
    const start = current < 0 ? 0 : current + 1;
    return workflow.sections.slice(start).find((item) => item.status === "pending") || null;
  };
  core.workflowIsFinal = function workflowIsFinal(workflow) {
    return Boolean(workflow && Array.isArray(workflow.sections) && workflow.sections.length && workflow.sections.every((item) => item.status === "completed" || item.status === "no-feedback"));
  };
  core.workflowStatusAllowed = (value) => statuses.has(value);

  const workflowLinks = (document, scope, expected) => {
    const kind = expected && expected.kind;
    const pathname = paths[kind];
    const targetId = expected && expected.targetId;
    const searchScope = kind === "course-breadcrumb" ? document : scope;
    if (!pathname || !validId(targetId) || !searchScope || !searchScope.querySelectorAll) return [];
    const selector = kind === "course-breadcrumb" ? core.selectors.courseBreadcrumbLinks : "a[href]";
    return Array.from(searchScope.querySelectorAll(selector)).filter((link) => {
      if (!inScope(searchScope, link) || !core.isDomVisible(link)) return false;
      if (!canonicalTarget(link.getAttribute("href"), document.location.href, pathname, targetId)) return false;
      if (kind === "course-breadcrumb") return true;
      const availability = restricted(link);
      return availability.available === true && availability.locked !== true;
    });
  };

  core.inspectWorkflowNavigation = function inspectWorkflowNavigation(document, scope, expected) {
    const kind = expected && expected.kind;
    const pathname = paths[kind];
    const targetId = expected && expected.targetId;
    if (!pathname || !validId(targetId) || !document || !document.location) return { detected: false, unique: false, action: null };
    const candidates = workflowLinks(document, scope, expected);
    if (candidates.length !== 1) return { detected: candidates.length > 0, unique: false, action: null };
    const target = canonicalTarget(candidates[0].getAttribute("href"), document.location.href, pathname, targetId);
    return { detected: true, unique: true, action: { kind, id: target.id, pathname, signature: signatureFor(kind, target) } };
  };

  core.navigateWorkflow = function navigateWorkflow(document, scope, expected) {
    const initial = core.inspectWorkflowNavigation(document, scope, expected);
    if (!initial.unique || !initial.action) return { navigationTriggered: false, reason: "navigation-unavailable" };
    const initialLinks = workflowLinks(document, scope, expected);
    const initialHref = initialLinks.length === 1 ? initialLinks[0].getAttribute("href") : null;
    if (!initialHref) return { navigationTriggered: false, reason: "navigation-changed" };
    const current = core.inspectWorkflowNavigation(document, scope, expected);
    if (!current.unique || !current.action || current.action.signature !== initial.action.signature) return { navigationTriggered: false, reason: "navigation-changed" };
    const link = workflowLinks(document, scope, expected);
    if (link.length !== 1 || link[0].getAttribute("href") !== initialHref) return { navigationTriggered: false, reason: "navigation-changed" };
    link[0].click();
    return { navigationTriggered: true, kind: expected.kind, id: expected.targetId };
  };
})(globalThis);
