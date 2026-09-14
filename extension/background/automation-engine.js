/* Pure, deterministic workflow decisions for the v0.5 automated processor. */
(function attachAutomationEngine(global) {
  const api = global.UIPAutomationEngine = global.UIPAutomationEngine || {};
  const ORIGIN = "https://moodle.uip.edu.pa";
  const STATUSES = new Set(["IDLE", "DISCOVERING_COURSES", "DISCOVERING_MODULES", "READY_TO_START", "RUNNING", "PAUSED", "LOGIN_REQUIRED", "DONE", "CANCELLED", "ERROR"]);
  const PHASES = new Set([
    "IDLE", "DISCOVER_COURSES", "DISCOVER_MODULES", "READY", "OPEN_SECTION", "WAIT_SECTION", "SCAN_SECTION",
    "OPEN_FEEDBACK", "WAIT_FEEDBACK", "SCAN_FEEDBACK", "OPEN_FORM", "WAIT_FORM", "PREFILL", "VERIFY_FORM", "SUBMIT",
    "VERIFY_SUBMISSION", "CONTINUE", "RECHECK_SECTION", "NEXT_MODULE", "PAUSED", "DONE", "CANCELLED", "LOGIN_REQUIRED", "ERROR"
  ]);
  const MODULE_STATUSES = new Set(["pending", "running", "completed", "no-feedback", "blocked", "manual-required", "failed", "cancelled"]);
  const OUTCOME_REASONS = new Set(["no-feedback", "completed", "module-blocked", "feedback-blocked", "feedback-unknown", "response-form-unavailable", "form-not-compatible", "prefill-unverified", "submit-not-triggered", "submission-verified", "step-timeout"]);
  const TERMINAL_OUTCOMES = new Set(["SUCCESS", "COMPLETED_WITH_ISSUES"]);
  const validId = (value) => typeof value === "string" && /^\d+$/.test(value);
  const text = (value, limit = 180) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) || null : null;
  const now = () => Date.now();
  const canonical = (value, pathname, expectedId) => {
    try {
      const url = new URL(value);
      const id = url.searchParams.get("id");
      if (url.protocol !== "https:" || url.origin !== ORIGIN || url.pathname !== pathname || !validId(id) || (expectedId && id !== expectedId)) return null;
      if (Array.from(url.searchParams.keys()).some((key) => key !== "id")) return null;
      return `${ORIGIN}${pathname}?id=${encodeURIComponent(id)}`;
    } catch (_) { return null; }
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const message = (code, fallback) => ({ code, message: fallback });
  const outcomeReason = (value) => OUTCOME_REASONS.has(value) ? value : null;

  function emptyProgress(total) {
    return { total, reviewed: 0, submitted: 0, alreadyCompleted: 0, noFeedback: 0, skipped: 0, manualRequired: 0, failed: 0 };
  }
  function normalizeModule(item) {
    const id = item && item.id;
    const url = canonical(item && item.url, "/course/section.php", id);
    if (!validId(id) || !url) return null;
    return { id, url, name: text(item.name), status: MODULE_STATUSES.has(item.status) ? item.status : "pending", outcomeReason: outcomeReason(item.outcomeReason), feedbackSummary: Array.isArray(item.feedbackSummary) ? item.feedbackSummary.slice(0, 30).map((feedback) => ({ id: validId(feedback && feedback.id) ? feedback.id : null, name: text(feedback && feedback.name), status: text(feedback && feedback.status, 40) || "unknown", reason: outcomeReason(feedback && feedback.reason) })).filter((feedback) => feedback.id) : [] };
  }
  function recomputeProgress(workflow) {
    const progress = emptyProgress(workflow.modules.length);
    workflow.modules.forEach((module) => {
      if (["completed", "no-feedback", "blocked", "manual-required", "failed"].includes(module.status)) progress.reviewed += 1;
      if (module.status === "no-feedback") progress.noFeedback += 1;
      if (module.status === "blocked") progress.skipped += 1;
      if (module.status === "manual-required") progress.manualRequired += 1;
      if (module.status === "failed") progress.failed += 1;
      module.feedbackSummary.forEach((feedback) => {
        if (feedback.status === "submitted") progress.submitted += 1;
        if (feedback.status === "completed") progress.alreadyCompleted += 1;
      });
    });
    workflow.progress = progress;
    return workflow;
  }
  function safeActivity(item) {
    if (!item || typeof item !== "object") return null;
    const timestamp = Number.isFinite(item.timestamp) ? item.timestamp : null;
    const type = text(item.type, 80);
    const label = text(item.label, 180);
    if (!timestamp || !type || !label) return null;
    return { timestamp, type, moduleId: validId(item.moduleId) ? item.moduleId : null, moduleName: text(item.moduleName), feedbackId: validId(item.feedbackId) ? item.feedbackId : null, feedbackName: text(item.feedbackName), label };
  }
  function appendActivity(workflow, patch, timestamp) {
    const module = currentModule(workflow);
    const feedback = module && workflow.currentFeedbackId && module.feedbackSummary.find((item) => item.id === workflow.currentFeedbackId);
    const label = text(patch.semantic, 180) || text(patch.lastSafeEvent, 180) || "Actualización de recorrido";
    const type = text(patch.lastSafeEvent, 80) || text(patch.phase, 80) || "state-change";
    const activity = { timestamp, type, moduleId: module && module.id || null, moduleName: module && module.name || null, feedbackId: workflow.currentFeedbackId, feedbackName: feedback && feedback.name || null, label };
    return (workflow.activityLog || []).concat([activity]).slice(-30);
  }
  function touch(workflow, patch) {
    const timestamp = now();
    const phaseChanged = patch.phase && patch.phase !== workflow.phase;
    const next = { ...workflow, ...patch, transition: (workflow.transition || 0) + 1, updatedAt: timestamp, lastActivityAt: timestamp, stepStartedAt: phaseChanged ? timestamp : workflow.stepStartedAt, activityLog: appendActivity(workflow, patch, timestamp) };
    return recomputeProgress(next);
  }
  function currentModule(workflow) { return workflow.modules[workflow.currentModuleIndex] || null; }
  function allFinished(workflow) { return workflow.modules.every((module) => module.status !== "pending" && module.status !== "running"); }
  function updateModule(workflow, moduleId, patch) {
    return { ...workflow, modules: workflow.modules.map((module) => module.id === moduleId ? { ...module, ...patch } : module) };
  }
  function recordFeedback(workflow, feedback, status, reason) {
    const module = currentModule(workflow);
    if (!module || !feedback || !validId(feedback.id)) return workflow;
    const previous = module.feedbackSummary.find((item) => item.id === feedback.id);
    const summary = module.feedbackSummary.filter((item) => item.id !== feedback.id).concat([{ id: feedback.id, name: text(feedback.name) || previous && previous.name || null, status, reason: outcomeReason(reason) }]);
    return updateModule(workflow, module.id, { feedbackSummary: summary });
  }
  function safeFeedback(feedback) {
    const id = feedback && feedback.id;
    const url = canonical(feedback && feedback.url, "/mod/feedback/view.php", id);
    if (!validId(id) || !url) return null;
    return { id, url, name: text(feedback.name), completionState: ["completed", "incomplete", "unknown"].includes(feedback.completionState) ? feedback.completionState : "unknown", available: feedback.available === true ? true : feedback.available === false ? false : null };
  }
  function moduleReference(value) {
    const source = text(value, 260);
    const match = source && source.match(/m[oó]dulo\s*#?\s*(\d+)/i);
    return match ? { reference: `Módulo#${match[1]}`, number: match[1] } : null;
  }
  function hasBlockedNotice(scan, module) {
    if (!scan || scan.pageType !== "COURSE" || !scan.course || !Array.isArray(scan.pageNotices)) return false;
    const blocked = /\b(no disponible|not available|restringido|restricted)\b/i;
    const moduleName = text(module && module.name, 120);
    return scan.pageNotices.some((notice) => {
      const value = text(notice && notice.text, 260);
      if (!value || !blocked.test(value)) return false;
      // A generic course warning must not block whichever module happens to be current.
      const compactNotice = value.toLocaleLowerCase().replace(/\s+/g, "");
      const compactModule = moduleName && moduleName.toLocaleLowerCase().replace(/\s+/g, "");
      const noticeReference = moduleReference(value);
      const currentReference = moduleReference(moduleName);
      // Structured references prevent #1 from matching an unrelated #10 warning.
      if (currentReference || noticeReference) return Boolean(currentReference && noticeReference && currentReference.number === noticeReference.number);
      return Boolean(compactModule && compactNotice.includes(compactModule));
    });
  }
  function effect(type, payload) { return { type, ...payload }; }
  function wait(workflow, phase, semantic, extra) {
    return { workflow: touch(workflow, { status: "RUNNING", phase, semantic, ...extra }), effect: null };
  }
  function stopModule(workflow, module, status, reason) {
    const safeReason = outcomeReason(reason);
    const repeatedIssue = ["manual-required", "failed"].includes(status) && safeReason;
    const sameReason = repeatedIssue && workflow.consecutiveIssueReason === safeReason;
    const consecutiveIssueReason = repeatedIssue ? safeReason : null;
    const consecutiveIssueCount = repeatedIssue ? (sameReason ? workflow.consecutiveIssueCount + 1 : 1) : 0;
    let next = updateModule(workflow, module.id, { status, outcomeReason: safeReason });
    next = touch(next, { phase: "NEXT_MODULE", semantic: "Pasando al siguiente módulo…", currentFeedbackId: null, lastSafeEvent: reason, lastError: status === "failed" || status === "manual-required" ? message(reason, "Este módulo requiere revisión manual.") : null });
    next = { ...next, consecutiveIssueReason, consecutiveIssueCount };
    if (consecutiveIssueCount >= 3) return { workflow: touch(next, { status: "PAUSED", phase: "PAUSED", semantic: "Se detectó el mismo problema en varios módulos consecutivos.", lastSafeEvent: "repeated-manual-issue", lastError: message("repeated-manual-issue", "Se detectó el mismo problema en varios módulos consecutivos. Revisa Moodle antes de continuar.") }), effect: null };
    return advanceModule(next);
  }
  function blockModule(workflow, module) {
    let next = updateModule(workflow, module.id, { status: "blocked", outcomeReason: "module-blocked" });
    next = touch(next, { phase: "NEXT_MODULE", semantic: `${module.name || `Módulo #${module.id}`} no está disponible en Moodle. Se omitirá.`, currentFeedbackId: null, lastSafeEvent: "module-blocked", lastError: null });
    next = { ...next, consecutiveIssueReason: null, consecutiveIssueCount: 0 };
    return advanceModule(next);
  }
  function finishWorkflow(workflow) {
    const terminalOutcome = workflow.modules.some((module) => ["manual-required", "failed"].includes(module.status)) ? "COMPLETED_WITH_ISSUES" : "SUCCESS";
    return { workflow: touch(workflow, { status: "DONE", phase: "DONE", semantic: terminalOutcome === "SUCCESS" ? "Recorrido completado" : "Recorrido finalizado con incidencias", currentModuleIndex: workflow.modules.length, currentFeedbackId: null, lastSafeEvent: "completed", terminalOutcome }), effect: null };
  }
  function advanceModule(workflow) {
    const nextIndex = workflow.currentModuleIndex + 1;
    if (nextIndex >= workflow.modules.length) return finishWorkflow(workflow);
    return { workflow: touch(workflow, { currentModuleIndex: nextIndex, phase: "WAIT_SECTION", semantic: "Abriendo módulo…", currentFeedbackId: null, waitRetries: 0, lastSafeEvent: "next-module" }), effect: effect("NAVIGATE", { url: workflow.modules[nextIndex].url }) };
  }

  api.create = function create(configuration) {
    const course = configuration && configuration.course;
    const courseId = course && course.id;
    const courseUrl = canonical(course && course.url, "/course/view.php", courseId);
    const preference = text(configuration && configuration.preference, 160);
    const selected = Array.isArray(configuration && configuration.modules) ? configuration.modules.map(normalizeModule).filter(Boolean) : [];
    if (!validId(courseId) || !courseUrl || !preference || !selected.length) return null;
    const workflow = {
      version: 2,
      runId: `run-${now()}-${Math.random().toString(36).slice(2, 10)}`,
      status: "READY_TO_START",
      phase: "READY",
      semantic: "Listo para ejecutar",
      transition: 0,
      workerTabId: Number.isInteger(configuration.workerTabId) ? configuration.workerTabId : null,
      course: { id: courseId, url: courseUrl, name: text(course.name) },
      preference,
      modules: selected,
      currentModuleIndex: 0,
      currentFeedbackId: null,
      progress: emptyProgress(selected.length),
      terminalOutcome: null,
      consecutiveIssueReason: null,
      consecutiveIssueCount: 0,
      activityLog: [],
      stepStartedAt: now(),
      lastActivityAt: now(),
      rules: { maxWaitRetries: 1, revalidateBeforeAction: true, requireVerifiedSubmission: true },
      waitRetries: 0,
      pauseRequested: false,
      lastSafeEvent: "configured",
      lastError: null,
      updatedAt: now()
    };
    return recomputeProgress(workflow);
  };
  api.sanitize = function sanitize(value) {
    if (!value || value.version !== 2 || !STATUSES.has(value.status) || !PHASES.has(value.phase) || !value.course || !validId(value.course.id)) return null;
    const courseUrl = canonical(value.course.url, "/course/view.php", value.course.id);
    const preference = text(value.preference, 160);
    const modules = Array.isArray(value.modules) ? value.modules.map(normalizeModule).filter(Boolean) : [];
    if (!courseUrl || !preference || !modules.length || !Number.isInteger(value.currentModuleIndex) || value.currentModuleIndex < 0 || value.currentModuleIndex > modules.length) return null;
    const result = {
      version: 2,
      runId: text(value.runId, 80), status: value.status, phase: value.phase, semantic: text(value.semantic, 180) || "Preparando recorrido…",
      transition: Number.isInteger(value.transition) && value.transition >= 0 ? value.transition : 0,
      workerTabId: Number.isInteger(value.workerTabId) ? value.workerTabId : null,
      course: { id: value.course.id, url: courseUrl, name: text(value.course.name) }, preference, modules,
      currentModuleIndex: value.currentModuleIndex, currentFeedbackId: validId(value.currentFeedbackId) ? value.currentFeedbackId : null,
      progress: emptyProgress(modules.length), terminalOutcome: TERMINAL_OUTCOMES.has(value.terminalOutcome) ? value.terminalOutcome : null, consecutiveIssueReason: outcomeReason(value.consecutiveIssueReason), consecutiveIssueCount: Number.isInteger(value.consecutiveIssueCount) && value.consecutiveIssueCount >= 0 && value.consecutiveIssueCount <= 3 ? value.consecutiveIssueCount : 0, activityLog: Array.isArray(value.activityLog) ? value.activityLog.slice(-30).map(safeActivity).filter(Boolean) : [], stepStartedAt: Number.isFinite(value.stepStartedAt) ? value.stepStartedAt : now(), lastActivityAt: Number.isFinite(value.lastActivityAt) ? value.lastActivityAt : now(), rules: { maxWaitRetries: 1, revalidateBeforeAction: true, requireVerifiedSubmission: true }, waitRetries: Number.isInteger(value.waitRetries) && value.waitRetries >= 0 && value.waitRetries <= 1 ? value.waitRetries : 0, pauseRequested: value.pauseRequested === true,
      lastSafeEvent: text(value.lastSafeEvent, 100), lastError: value.lastError && { code: text(value.lastError.code, 80), message: text(value.lastError.message, 300) },
      updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : now()
    };
    if (!result.runId) return null;
    return recomputeProgress(result);
  };
  api.metadata = function metadata(value) {
    const workflow = api.sanitize(value);
    if (!workflow) return null;
    const module = currentModule(workflow);
    const feedback = module && workflow.currentFeedbackId && module.feedbackSummary.find((item) => item.id === workflow.currentFeedbackId);
    const moduleOutcomes = workflow.modules.map((item) => ({ id: item.id, name: item.name, status: item.status, reason: item.outcomeReason, feedbacks: item.feedbackSummary.map((feedback) => ({ id: feedback.id, name: feedback.name, status: feedback.status, reason: feedback.reason })) }));
    return { runId: workflow.runId, transition: workflow.transition, status: workflow.status, phase: workflow.phase, semantic: workflow.semantic, course: workflow.course, currentModule: module && { id: module.id, name: module.name, status: module.status, reason: module.outcomeReason }, currentFeedback: workflow.currentFeedbackId && { id: workflow.currentFeedbackId, name: feedback && feedback.name || null, reason: feedback && feedback.reason || null }, modules: workflow.modules.map((item) => ({ id: item.id, name: item.name, status: item.status, reason: item.outcomeReason })), moduleOutcomes, progress: workflow.progress, terminalOutcome: workflow.terminalOutcome, activityLog: workflow.activityLog, workerConnected: Number.isInteger(workflow.workerTabId), workerTabId: workflow.workerTabId, waitRetries: workflow.waitRetries, consecutiveIssueReason: workflow.consecutiveIssueReason, consecutiveIssueCount: workflow.consecutiveIssueCount, lastSafeEvent: workflow.lastSafeEvent, stepStartedAt: workflow.stepStartedAt, lastActivityAt: workflow.lastActivityAt, lastError: workflow.lastError, updatedAt: workflow.updatedAt };
  };
  api.start = function start(value) {
    const workflow = api.sanitize(value);
    if (!workflow || workflow.status !== "READY_TO_START") return { workflow, effect: null };
    const first = currentModule(workflow);
    const next = touch(workflow, { status: "RUNNING", phase: "WAIT_SECTION", semantic: "Abriendo módulo…", waitRetries: 0, lastSafeEvent: "start" });
    return { workflow: updateModule(next, first.id, { status: "running" }), effect: effect("NAVIGATE", { url: first.url }) };
  };
  api.pause = function pause(value) {
    const workflow = api.sanitize(value);
    if (!workflow || workflow.status !== "RUNNING") return workflow;
    return touch(workflow, { pauseRequested: true, semantic: "Se pausará al terminar el paso seguro actual." });
  };
  api.resume = function resume(value) {
    const workflow = api.sanitize(value);
    if (!workflow || !["PAUSED", "LOGIN_REQUIRED"].includes(workflow.status)) return { workflow, effect: null };
    if (!Number.isInteger(workflow.workerTabId) || workflow.workerTabId <= 0) return { workflow, effect: null };
    const phase = workflow.phase === "LOGIN_REQUIRED" || workflow.phase === "PAUSED" ? "WAIT_SECTION" : workflow.phase;
    const next = touch(workflow, { status: "RUNNING", phase, semantic: "Reanudando recorrido…", pauseRequested: false, lastError: null });
    return { workflow: next, effect: effect("NAVIGATE", { url: phase === "WAIT_SECTION" ? currentModule(next).url : next.course.url }) };
  };
  api.bindWorker = function bindWorker(value, tabId) {
    const workflow = api.sanitize(value);
    if (!workflow || ["DONE", "CANCELLED", "ERROR"].includes(workflow.status) || !Number.isInteger(tabId) || tabId <= 0) return workflow;
    return touch(workflow, { workerTabId: tabId, semantic: "Pestaña de Moodle lista para continuar.", lastError: null, lastSafeEvent: "worker-bound" });
  };
  api.cancel = function cancel(value) {
    const workflow = api.sanitize(value);
    if (!workflow || ["DONE", "CANCELLED"].includes(workflow.status)) return workflow;
    return touch(workflow, { status: "CANCELLED", phase: "CANCELLED", semantic: "Recorrido cancelado. Los envíos ya realizados se conservan.", pauseRequested: false, lastSafeEvent: "cancelled" });
  };
  api.workerClosed = function workerClosed(value) {
    const workflow = api.sanitize(value);
    if (!workflow || !["RUNNING", "READY_TO_START", "LOGIN_REQUIRED"].includes(workflow.status)) return workflow;
    return touch(workflow, { status: "PAUSED", phase: "PAUSED", semantic: "La pestaña de Moodle se cerró.", workerTabId: null, lastError: message("worker-tab-closed", "La pestaña de Moodle se cerró. Reábrela para continuar.") });
  };
  api.timeout = function timeout(value) {
    const workflow = api.sanitize(value);
    if (!workflow || workflow.status !== "RUNNING") return { workflow, effect: null };
    const module = currentModule(workflow);
    if (!module) return { workflow: touch(workflow, { status: "ERROR", phase: "ERROR", semantic: "El recorrido quedó inconsistente.", lastError: message("workflow-inconsistent", "No se pudo recuperar el recorrido de forma segura.") }), effect: null };
    const retries = Number.isInteger(workflow.waitRetries) ? workflow.waitRetries : 0;
    if (retries < 1) {
      const retry = touch(workflow, { waitRetries: retries + 1, semantic: "Reintentando el último paso…", lastSafeEvent: "watchdog-retry" });
      if (["OPEN_SECTION", "WAIT_SECTION", "SCAN_SECTION", "RECHECK_SECTION"].includes(retry.phase)) return { workflow: retry, effect: effect("NAVIGATE", { url: module.url }) };
      if (["OPEN_FEEDBACK", "WAIT_FEEDBACK", "SCAN_FEEDBACK"].includes(retry.phase) && validId(retry.currentFeedbackId)) return { workflow: retry, effect: effect("NAVIGATE", { url: `${ORIGIN}/mod/feedback/view.php?id=${encodeURIComponent(retry.currentFeedbackId)}` }) };
      if (["OPEN_FORM", "WAIT_FORM"].includes(retry.phase) && validId(retry.currentFeedbackId)) return { workflow: retry, effect: effect("NAVIGATE", { url: `${ORIGIN}/mod/feedback/complete.php?id=${encodeURIComponent(retry.currentFeedbackId)}` }) };
      return { workflow: retry, effect: effect("SCAN", {}) };
    }
    return stopModule(touch(workflow, { waitRetries: 0 }), module, "manual-required", "step-timeout");
  };
  api.onScan = function onScan(value, scan) {
    const workflow = api.sanitize(value);
    if (!workflow || workflow.status !== "RUNNING") return { workflow, effect: null };
    if (!scan || typeof scan !== "object") return api.timeout(workflow);
    if (scan.sessionApparentlyNotStarted === true) return { workflow: touch(workflow, { status: "LOGIN_REQUIRED", phase: "LOGIN_REQUIRED", semantic: "Necesitas iniciar sesión en Moodle.", lastError: message("login-required", "Tu sesión de Moodle terminó. Inicia sesión para continuar.") }), effect: null };
    if (workflow.pauseRequested) return { workflow: touch(workflow, { status: "PAUSED", phase: "PAUSED", semantic: "Recorrido pausado.", pauseRequested: false, lastSafeEvent: "paused" }), effect: null };
    const module = currentModule(workflow);
    if (!module) return finishWorkflow(workflow);
    if (scan.course && scan.course.id && scan.course.id !== workflow.course.id) return { workflow: touch(workflow, { status: "PAUSED", phase: "PAUSED", semantic: "La pestaña cambió de materia.", lastError: message("course-mismatch", "La pestaña Moodle abrió otra materia. Reabre el recorrido para continuar de forma segura.") }), effect: null };

    // A service-worker restart may observe the page after the real click but
    // before Moodle redirects. Reconcile it as verification, never re-submit.
    if (workflow.phase === "SUBMIT") {
      if (scan.feedbackResult && scan.feedbackResult.submissionVerified === true) return api.onVerifiedSubmission(workflow, scan);
      return { workflow: touch(workflow, { phase: "VERIFY_SUBMISSION", semantic: "Confirmando envío…", lastSafeEvent: "submit-recovery" }), effect: null };
    }

    if (["OPEN_SECTION", "WAIT_SECTION", "RECHECK_SECTION", "SCAN_SECTION"].includes(workflow.phase)) {
      if (scan.pageType === "COURSE" && scan.course && scan.course.id === workflow.course.id && hasBlockedNotice(scan, module)) return blockModule(workflow, module);
      if (scan.pageType !== "SECTION" || !scan.currentSection || scan.currentSection.id !== module.id) return wait(workflow, "WAIT_SECTION", "Esperando apertura del módulo…");
      const feedback = (Array.isArray(scan.feedback) ? scan.feedback : []).map(safeFeedback).filter(Boolean);
      if (!feedback.length) return stopModule(workflow, module, "no-feedback", "no-feedback");
      let next = updateModule(workflow, module.id, { feedbackSummary: feedback.map((item) => {
        const existing = module.feedbackSummary.find((summary) => summary.id === item.id);
        const preserved = existing && ["submitted", "manual-required", "blocked"].includes(existing.status) ? existing.status : null;
        return { id: item.id, name: item.name, status: preserved || (item.completionState === "completed" ? "completed" : item.available === false ? "blocked" : item.completionState === "unknown" ? "manual-required" : "pending"), reason: preserved ? existing.reason : item.completionState === "completed" ? "completed" : item.available === false ? "feedback-blocked" : item.completionState === "unknown" ? "feedback-unknown" : null };
      }) });
      const pending = feedback.find((item) => next.modules[workflow.currentModuleIndex].feedbackSummary.find((summary) => summary.id === item.id).status === "pending");
      if (!pending) {
        const summary = next.modules[workflow.currentModuleIndex].feedbackSummary;
        const unresolved = summary.find((item) => item.status === "manual-required");
        const blocked = summary.find((item) => item.status === "blocked");
        const status = unresolved ? "manual-required" : blocked ? "blocked" : "completed";
        return stopModule(next, next.modules[workflow.currentModuleIndex], status, unresolved && unresolved.reason || blocked && blocked.reason || status);
      }
      next = touch(next, { phase: "OPEN_FEEDBACK", semantic: "Abriendo encuesta…", currentFeedbackId: pending.id, waitRetries: 0 });
      return { workflow: next, effect: effect("NAVIGATE", { url: pending.url }) };
    }

    if (["OPEN_FEEDBACK", "WAIT_FEEDBACK", "SCAN_FEEDBACK"].includes(workflow.phase)) {
      const feedbackPage = scan.feedbackPage;
      if (scan.pageType !== "FEEDBACK" || !feedbackPage || feedbackPage.id !== workflow.currentFeedbackId) return wait(workflow, "WAIT_FEEDBACK", "Esperando apertura de la encuesta…");
      if (scan.feedbackResult && scan.feedbackResult.submissionVerified === true) return api.onVerifiedSubmission(workflow, scan);
      if (scan.feedbackForm && scan.feedbackForm.detected === true) return api.onScan(touch(workflow, { phase: "PREFILL", semantic: "Aplicando valoración…" }), scan);
      if (feedbackPage.canRespond === true && canonical(feedbackPage.responseUrl, "/mod/feedback/complete.php", feedbackPage.id)) return { workflow: touch(workflow, { phase: "OPEN_FORM", semantic: "Abriendo formulario…" }), effect: effect("NAVIGATE", { url: canonical(feedbackPage.responseUrl, "/mod/feedback/complete.php", feedbackPage.id) }) };
      if (workflow.phase === "WAIT_FEEDBACK" && workflow.waitRetries >= 1) return api.markCurrentFeedback(workflow, "manual-required", "response-form-unavailable");
      return wait(workflow, "WAIT_FEEDBACK", "Esperando disponibilidad del formulario…");
    }

    if (["OPEN_FORM", "WAIT_FORM", "PREFILL", "VERIFY_FORM"].includes(workflow.phase)) {
      const form = scan.feedbackForm;
      if (!form || form.detected !== true || form.id !== workflow.currentFeedbackId) return wait(workflow, "WAIT_FORM", "Esperando apertura del formulario…");
      if (["OPEN_FORM", "WAIT_FORM", "PREFILL"].includes(workflow.phase) && form.canPrefill === true && (form.preferenceOptions || []).includes(workflow.preference)) return { workflow: touch(workflow, { phase: "VERIFY_FORM", semantic: "Aplicando valoración…" }), effect: effect("PREFILL", { feedbackId: form.id, expectedQuestionCount: form.questions.length, expectedSignature: form.signature, preference: workflow.preference }) };
      const submission = scan.feedbackSubmission;
      if (submission && submission.readyToSubmit === true) return { workflow: touch(workflow, { phase: "SUBMIT", semantic: "Enviando Feedback…" }), effect: effect("SUBMIT", { expected: { feedbackId: submission.feedbackId, formSignature: submission.formSignature, supportedQuestions: submission.supportedQuestions } }) };
      if (["OPEN_FORM", "WAIT_FORM"].includes(workflow.phase)) {
        if (workflow.phase === "WAIT_FORM" && workflow.waitRetries >= 1) return api.markCurrentFeedback(workflow, "manual-required", "form-not-compatible");
        return wait(workflow, "WAIT_FORM", "Esperando carga completa del formulario…");
      }
      return api.markCurrentFeedback(workflow, "manual-required", "form-not-compatible");
    }

    if (workflow.phase === "VERIFY_SUBMISSION") return api.onVerifiedSubmission(workflow, scan);
    return { workflow, effect: effect("SCAN", {}) };
  };
  api.onPrefill = function onPrefill(value, result) {
    const workflow = api.sanitize(value);
    if (!workflow || workflow.status !== "RUNNING" || workflow.phase !== "VERIFY_FORM") return { workflow, effect: null };
    if (!result || result.ok !== true || !result.prefillResult || result.prefillResult.staleForm === true) return api.markCurrentFeedback(workflow, "manual-required", "prefill-unverified");
    const next = touch(workflow, { phase: "VERIFY_FORM", semantic: "Verificando respuestas…", lastSafeEvent: "prefill-completed" });
    return { workflow: next, effect: result.scan && typeof result.scan === "object" ? effect("PROCESS_SCAN", { scan: result.scan }) : effect("SCAN", {}) };
  };
  api.onSubmit = function onSubmit(value, result) {
    const workflow = api.sanitize(value);
    if (!workflow || workflow.status !== "RUNNING" || workflow.phase !== "SUBMIT") return { workflow, effect: null };
    if (!result || result.ok !== true || !result.submitResult || result.submitResult.submitTriggered !== true) return api.markCurrentFeedback(workflow, "manual-required", "submit-not-triggered");
    return { workflow: touch(workflow, { phase: "VERIFY_SUBMISSION", semantic: "Confirmando envío…", lastSafeEvent: "submit-triggered" }), effect: null };
  };
  api.onVerifiedSubmission = function onVerifiedSubmission(value, scan) {
    const workflow = api.sanitize(value);
    if (!workflow) return { workflow, effect: null };
    const result = scan && scan.feedbackResult;
    // Do not recursively scan the same document here. Moodle may still be
    // navigating after submit; the page-ready event or watchdog will re-check it.
    if (!result || result.feedbackId !== workflow.currentFeedbackId || result.submissionVerified !== true) return { workflow: touch(workflow, { phase: "VERIFY_SUBMISSION", semantic: "Confirmando envío…" }), effect: null };
    let next = api.markCurrentFeedback(workflow, "submitted", "submission-verified", true).workflow;
    const action = result.continueAction;
    if (action && action.unique === true && ["link", "form-submit"].includes(action.kind) && action.signature) return { workflow: touch(next, { phase: "CONTINUE", semantic: "Continuando en Moodle…" }), effect: effect("CONTINUE", { expected: { feedbackId: result.feedbackId, kind: action.kind, signature: action.signature } }) };
    return { workflow: touch(next, { phase: "RECHECK_SECTION", semantic: "Verificando módulo…", currentFeedbackId: null }), effect: effect("NAVIGATE", { url: currentModule(next).url }) };
  };
  api.onContinue = function onContinue(value, result) {
    const workflow = api.sanitize(value);
    if (!workflow || workflow.status !== "RUNNING" || workflow.phase !== "CONTINUE") return { workflow, effect: null };
    const module = currentModule(workflow);
    if (!result || result.ok !== true || !result.navigationResult || result.navigationResult.navigationTriggered !== true) return { workflow: touch(workflow, { phase: "RECHECK_SECTION", semantic: "Verificando módulo…", currentFeedbackId: null }), effect: effect("NAVIGATE", { url: module.url }) };
    return { workflow: touch(workflow, { phase: "RECHECK_SECTION", semantic: "Verificando módulo…", currentFeedbackId: null }), effect: null };
  };
  api.markCurrentFeedback = function markCurrentFeedback(value, status, reason, keepFeedback) {
    const workflow = api.sanitize(value);
    const module = workflow && currentModule(workflow);
    if (!workflow || !module || !validId(workflow.currentFeedbackId)) return { workflow, effect: null };
    const next = recordFeedback(workflow, { id: workflow.currentFeedbackId, name: null }, status, reason);
    return { workflow: touch(next, { phase: "RECHECK_SECTION", semantic: "Verificando módulo…", currentFeedbackId: keepFeedback ? workflow.currentFeedbackId : null, lastSafeEvent: reason }), effect: effect("NAVIGATE", { url: module.url }) };
  };
  api.clone = clone;
})(globalThis);
