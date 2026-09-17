/* Read-only Moodle result/navigation inspection with explicit activation of one validated control. */
(function attachNavigation(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const allowedPaths = ["/mod/feedback/view.php", "/course/section.php", "/course/view.php"];
  const normalize = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().toLocaleLowerCase() : "";
  const continueLabel = (label) => /^(continuar|continue|volver al curso|volver a la actividad|return)$/i.test(typeof label === "string" ? label.replace(/\s+/g, " ").trim() : "");
  const linkLabel = (element) => core.text(element, 160) || (element && element.getAttribute && element.getAttribute("aria-label")) || null;
  const belongsTo = (element, owner) => !owner || (typeof owner.contains === "function" ? owner.contains(element) : true);
  const isSubmit = (button) => String(button && ((button.getAttribute && button.getAttribute("type")) || button.type) || "").toLowerCase() === "submit";

  const safeMoodleDestination = (value, base, requireId) => {
    try {
      const url = new URL(value, base);
      if (url.protocol !== "https:" || url.hostname !== "moodle.uip.edu.pa" || !allowedPaths.includes(url.pathname) || (requireId && !url.searchParams.get("id"))) return null;
      if (Array.from(url.searchParams.keys()).some((key) => key !== "id")) return null;
      return { origin: url.origin, destinationPath: url.pathname, url: url.searchParams.get("id") ? `${url.origin}${url.pathname}?id=${encodeURIComponent(url.searchParams.get("id"))}` : null };
    } catch (_) { return null; }
  };

  const actionSignature = (action) => action ? JSON.stringify({ kind: action.kind, label: normalize(action.label), destinationPath: action.destinationPath, method: action.method, url: action.url || null }) : null;

  const continueCandidates = (document, scope) => {
    if (!scope || !scope.querySelectorAll) return [];
    const anchors = Array.from(scope.querySelectorAll("a[href]")).map((link) => {
      const label = linkLabel(link);
      const destination = safeMoodleDestination(link.getAttribute("href"), document.location.href, true);
      if (!destination || !label || !continueLabel(label) || !core.isDomVisible(link) || !belongsTo(link, scope)) return null;
      const action = { kind: "link", label, destinationPath: destination.destinationPath, method: "get", url: destination.url };
      return { element: link, action: { ...action, signature: actionSignature(action) } };
    }).filter(Boolean);
    const buttons = Array.from(scope.querySelectorAll('button[type="submit"], input[type="submit"]')).map((button) => {
      const form = button.form || core.closest(button, "form");
      const label = linkLabel(button);
      if (!form || !isSubmit(button) || !belongsTo(button, scope) || !belongsTo(button, form) || button.disabled === true || !core.isDomVisible(button) || !label || !continueLabel(label)) return null;
      const method = normalize((button.getAttribute && button.getAttribute("formmethod")) || (form.getAttribute && form.getAttribute("method")));
      const actionValue = (button.getAttribute && button.getAttribute("formaction")) || (form.getAttribute && form.getAttribute("action"));
      const destination = method === "get" && actionValue ? safeMoodleDestination(actionValue, document.location.href, false) : null;
      if (!destination) return null;
      const action = { kind: "form-submit", label, destinationPath: destination.destinationPath, method, url: destination.url };
      return { element: button, action: { ...action, signature: actionSignature(action) } };
    }).filter(Boolean);
    return anchors.concat(buttons);
  };

  core.inspectContinueAction = function inspectContinueAction(document, scope) {
    const candidates = continueCandidates(document, scope);
    const action = candidates.length === 1 ? candidates[0].action : null;
    return { detected: candidates.length > 0, unique: candidates.length === 1, kind: action && action.kind || null, label: action && action.label || null, destinationPath: action && action.destinationPath || null, method: action && action.method || null, url: action && action.url || null, signature: action && action.signature || null };
  };

  core.inspectFeedbackResult = function inspectFeedbackResult(document, scope, feedbackPage) {
    const resolved = core.resolveFeedbackContext(document);
    const feedbackId = feedbackPage && feedbackPage.id || resolved && resolved.id;
    if (!feedbackId || !/^\/mod\/feedback\/(?:view|complete)\.php$/i.test(document.location.pathname || "")) return null;
    const editable = Boolean(core.findFeedbackResponseForm(document));
    const completionState = feedbackPage && feedbackPage.completionState || "unknown";
    const confirmation = !editable && Boolean(scope && scope.querySelector && scope.querySelector('.alert-success, [role="status"].alert-success, [data-region="feedback-complete"], .feedback-complete'));
    // A section completion widget is not proof that this Feedback is complete.
    const state = editable ? "still-editable" : confirmation || feedbackPage && feedbackPage.capability === "completed" ? "completed" : "unknown";
    const continueAction = state === "completed" || state === "confirmation" ? core.inspectContinueAction(document, scope) : { detected: false, unique: false, kind: null, label: null, destinationPath: null, method: null, url: null, signature: null };
    return { feedbackId, state, completionState, submissionVerified: state === "completed" || state === "confirmation" ? true : state === "still-editable" ? false : null, continueAction };
  };

  core.navigateContinue = function navigateContinue(document, scope, expected) {
    const action = core.inspectContinueAction(document, scope);
    const result = { navigationTriggered: false, reason: null, continueAction: action };
    if (!expected || action.unique !== true || action.kind !== expected.kind || action.signature !== expected.signature) {
      result.reason = "navigation-changed";
      return result;
    }
    const candidates = continueCandidates(document, scope);
    if (candidates.length !== 1 || candidates[0].action.signature !== action.signature || candidates[0].action.kind !== action.kind) {
      result.reason = "navigation-changed";
      return result;
    }
    candidates[0].element.click();
    result.navigationTriggered = true;
    return result;
  };

  core.inspectSectionNavigation = function inspectSectionNavigation(document, scope) {
    if (!/^\/course\/section\.php$/i.test(document.location.pathname || "") || !scope || !scope.querySelectorAll) return null;
    const currentSectionId = core.idFromUrl(document.location.href, document.location.href);
    const choices = { previous: [], next: [] };
    Array.from(scope.querySelectorAll('a[href*="/course/section.php"]')).forEach((link) => {
      const destination = safeMoodleDestination(link.getAttribute("href"), document.location.href, true);
      const evidence = [link.getAttribute("rel"), link.getAttribute("aria-label"), core.text(link, 160), link.className].filter(Boolean).join(" ").toLowerCase();
      const direction = /\b(previous|prev|anterior)\b/.test(evidence) ? "previous" : /\b(next|siguiente)\b/.test(evidence) ? "next" : null;
      if (!destination || !direction) return;
      const restriction = core.restriction(link.parentElement || link, { navigable: core.isDomVisible(link) });
      choices[direction].push({ id: core.idFromUrl(destination.url, document.location.href), url: destination.url, available: restriction.available });
    });
    const unique = (items) => items.length === 1 ? items[0] : null;
    return { currentSectionId: currentSectionId || null, previous: unique(choices.previous), next: unique(choices.next) };
  };
})(globalThis);
