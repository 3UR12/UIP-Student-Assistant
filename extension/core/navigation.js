/* Read-only Moodle result and navigation inspection, with explicit link activation only. */
(function attachNavigation(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  const allowedPaths = ["/mod/feedback/view.php", "/course/section.php", "/course/view.php"];
  const navigationSignature = (action) => action && action.url && action.label ? JSON.stringify({ url: action.url, label: action.label }) : null;

  const navigationUrl = (href, base) => {
    try {
      const url = new URL(href, base);
      if (url.protocol !== "https:" || url.hostname !== "moodle.uip.edu.pa" || !allowedPaths.includes(url.pathname) || !url.searchParams.get("id")) return null;
      return `${url.origin}${url.pathname}?id=${encodeURIComponent(url.searchParams.get("id"))}`;
    } catch (_) { return null; }
  };

  const linkLabel = (link) => core.text(link, 160) || (link && link.getAttribute && link.getAttribute("aria-label")) || null;
  const continueLabel = (label) => /^(continuar|continue|volver al curso|volver a la actividad|return)$/i.test(typeof label === "string" ? label.replace(/\s+/g, " ").trim() : "");
  const belongsToScope = (link, scope) => !scope || (typeof scope.contains === "function" ? scope.contains(link) : true);

  core.inspectContinueAction = function inspectContinueAction(document, scope) {
    const links = scope && scope.querySelectorAll ? Array.from(scope.querySelectorAll("a[href]")) : [];
    const candidates = links.map((link) => ({ link, url: navigationUrl(link.getAttribute("href"), document.location.href), label: linkLabel(link) }))
      .filter((item) => item.url && item.label && continueLabel(item.label) && core.isDomVisible(item.link) && belongsToScope(item.link, scope));
    const candidate = candidates.length === 1 ? candidates[0] : null;
    const action = candidate ? { id: core.idFromUrl(candidate.url, document.location.href), url: candidate.url, label: candidate.label } : null;
    return {
      detected: candidates.length > 0,
      unique: candidates.length === 1,
      url: action && action.url || null,
      label: action && action.label || null,
      signature: navigationSignature(action)
    };
  };

  core.inspectFeedbackResult = function inspectFeedbackResult(document, scope, feedbackPage) {
    const feedbackId = feedbackPage && feedbackPage.id || core.idFromUrl(document.location.href, document.location.href);
    if (!feedbackId || !/^\/mod\/feedback\/(?:view|complete)\.php$/i.test(document.location.pathname || "")) return null;
    const editable = Boolean(core.findFeedbackResponseForm(document));
    const completionState = feedbackPage && feedbackPage.completionState || core.completionFor(scope, feedbackId);
    const confirmation = !editable && Boolean(scope && scope.querySelector && scope.querySelector('.alert-success, [role="status"].alert-success, [data-region="feedback-complete"], .feedback-complete'));
    const state = completionState === "completed" ? "completed" : editable ? "still-editable" : confirmation ? "confirmation" : "unknown";
    const continueAction = state === "completed" || state === "confirmation" ? core.inspectContinueAction(document, scope) : { detected: false, unique: false, url: null, label: null, signature: null };
    return {
      feedbackId,
      state,
      completionState,
      submissionVerified: state === "completed" || state === "confirmation" ? true : state === "still-editable" ? false : null,
      continueAction
    };
  };

  core.navigateContinue = function navigateContinue(document, scope, expected) {
    const action = core.inspectContinueAction(document, scope);
    const result = { navigationTriggered: false, reason: null, continueAction: action };
    if (!expected || action.unique !== true || action.url !== expected.url || action.signature !== expected.signature) {
      result.reason = "navigation-changed";
      return result;
    }
    const links = Array.from(scope.querySelectorAll("a[href]")).filter((link) => navigationUrl(link.getAttribute("href"), document.location.href) === action.url && linkLabel(link) === action.label && core.isDomVisible(link));
    if (links.length !== 1) {
      result.reason = "navigation-changed";
      return result;
    }
    links[0].click();
    result.navigationTriggered = true;
    return result;
  };

  core.inspectSectionNavigation = function inspectSectionNavigation(document, scope) {
    if (!/^\/course\/section\.php$/i.test(document.location.pathname || "") || !scope || !scope.querySelectorAll) return null;
    const currentSectionId = core.idFromUrl(document.location.href, document.location.href);
    const choices = { previous: [], next: [] };
    Array.from(scope.querySelectorAll('a[href*="/course/section.php"]')).forEach((link) => {
      const url = navigationUrl(link.getAttribute("href"), document.location.href);
      const evidence = [link.getAttribute("rel"), link.getAttribute("aria-label"), core.text(link, 160), link.className].filter(Boolean).join(" ").toLowerCase();
      const direction = /\b(previous|prev|anterior)\b/.test(evidence) ? "previous" : /\b(next|siguiente)\b/.test(evidence) ? "next" : null;
      if (!url || !direction) return;
      const restriction = core.restriction(link.parentElement || link, { navigable: core.isDomVisible(link) });
      choices[direction].push({ id: core.idFromUrl(url, document.location.href), url, available: restriction.available });
    });
    const unique = (items) => items.length === 1 ? items[0] : null;
    return { currentSectionId: currentSectionId || null, previous: unique(choices.previous), next: unique(choices.next) };
  };
})(globalThis);
