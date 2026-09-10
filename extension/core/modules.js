/* Moodle section extraction. Availability is only set when restriction evidence exists. */
(function attachModules(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  core.sectionNumberFrom = function sectionNumberFrom(section) {
    if (!section) return null;
    const value = section.getAttribute("data-sectionid") || section.getAttribute("data-section-number");
    if (value && /^\d+$/.test(value)) return Number(value);
    const match = String(section.id || "").match(/^section-(\d+)$/i);
    return match ? Number(match[1]) : null;
  };

  core.isMoodleSection = function isMoodleSection(section, document) {
    if (!section || core.isExcludedRegion(section)) return false;
    const link = section.querySelector(core.selectors.sectionLinks);
    return Boolean(
      (link && core.isMoodlePathWithId(link.getAttribute("href"), document.location.href, "/course/section.php")) ||
      section.getAttribute("data-sectionid") ||
      section.getAttribute("data-for") === "course_section" ||
      /^section-\d+$/i.test(String(section.id || ""))
    );
  };

  core.sectionNameFrom = function sectionNameFrom(section, link) {
    const title = section && section.querySelector('.sectionname, [data-for="section_title"], h2, h3, h4');
    const value = core.text(title || link, 160);
    return value && !/^(perfilado de sección|ir a sección|seleccionar sección)(?:\s|$)/i.test(value) ? value : null;
  };

  core.findCurrentSection = function findCurrentSection(document, courseScope) {
    if (!courseScope) return null;
    const currentId = core.idFromUrl(document.location.href, document.location.href);
    const candidates = (core.isMoodleSection(courseScope, document) ? [courseScope] : []).concat(
      Array.from(courseScope.querySelectorAll(core.selectors.sectionContainers))
        .filter((section) => core.isMoodleSection(section, document))
    );
    const matching = candidates.find((section) => {
      const link = section.querySelector(core.selectors.sectionLinks);
      return link && core.idFromUrl(link.getAttribute("href"), document.location.href) === currentId;
    });
    if (matching) return matching;
    return candidates.length === 1 ? candidates[0] : null;
  };

  core.scanModules = function scanModules(scope, document, errors, currentSectionId) {
    if (!scope) return [];
    const found = new Map();
    const candidates = (core.isMoodleSection(scope, document) ? [scope] : []).concat(
      Array.from(scope.querySelectorAll(core.selectors.sectionContainers))
        .filter((section) => core.isMoodleSection(section, document))
    );
    const independentLinks = [];
    scope.querySelectorAll(core.selectors.sectionLinks).forEach((link) => {
      if (core.isExcludedRegion(link) || !core.canonicalMoodleUrl(link.getAttribute("href"), document.location.href, "/course/section.php")) return;
      const container = core.closest(link, core.selectors.sectionContainers);
      if (container && core.isMoodleSection(container, document) && !candidates.includes(container)) candidates.push(container);
      if (!container || !core.isMoodleSection(container, document)) independentLinks.push(link);
    });
    candidates.forEach((section, index) => {
      try {
        const link = section.querySelector(core.selectors.sectionLinks);
        const linkedUrl = link ? core.canonicalMoodleUrl(link.getAttribute("href"), document.location.href, "/course/section.php") : null;
        const id = currentSectionId || core.idFromUrl(linkedUrl, document.location.href);
        const sectionNumber = core.sectionNumberFrom(section);
        const key = id || `section-${sectionNumber || index}`;
        if (found.has(key)) return;
        const navigable = Boolean(linkedUrl) && core.isDomVisible(link) && core.isDomVisible(section);
        const restriction = core.restriction(section, { navigable });
        const module = { id: id || null, sectionNumber, name: core.sectionNameFrom(section, link), url: linkedUrl, available: restriction.available, locked: restriction.locked, restrictionText: restriction.restrictionText, completionState: core.completionFor(section) };
        if (!module.id && module.sectionNumber === null && !module.name && !module.url) return;
        found.set(key, module);
      } catch (_) { core.captureError(errors, "module"); }
    });
    independentLinks.forEach((link, index) => {
      try {
        const url = core.canonicalMoodleUrl(link.getAttribute("href"), document.location.href, "/course/section.php");
        const id = core.idFromUrl(url, document.location.href);
        if (!id || found.has(id)) return;
        const restriction = core.restriction(link.parentElement || link, { navigable: core.isDomVisible(link) });
        found.set(id, { id, sectionNumber: null, name: core.sectionNameFrom(null, link), url, available: restriction.available, locked: restriction.locked, restrictionText: restriction.restrictionText, completionState: "unknown", position: index + 1 });
      } catch (_) { core.captureError(errors, "section-link"); }
    });
    return Array.from(found.values());
  };
})(globalThis);
