/* Moodle section extraction. Availability is only set when restriction evidence exists. */
(function attachModules(global) {
  const core = global.UIPScannerCore = global.UIPScannerCore || {};
  core.scanModules = function scanModules(document, errors) {
    const found = new Map();
    const candidates = Array.from(document.querySelectorAll(core.selectors.sectionContainers));
    document.querySelectorAll(core.selectors.sectionLinks).forEach((link) => {
      const container = core.closest(link, core.selectors.sectionContainers);
      if (container && !candidates.includes(container)) candidates.push(container);
    });
    candidates.forEach((section, index) => {
      try {
        const link = section.querySelector(core.selectors.sectionLinks);
        const url = link ? core.absoluteUrl(link.getAttribute("href"), document.location.href) : null;
        const id = core.idFromUrl(url, document.location.href) || section.getAttribute("data-sectionid") || section.id || null;
        const key = id || `position-${index}`;
        if (found.has(key)) return;
        const title = section.querySelector('.sectionname, [data-for="section_title"], h2, h3, h4') || link;
        const navigable = core.isMoodlePathWithId(url, document.location.href, "/course/section.php") && core.isDomVisible(link) && core.isDomVisible(section);
        const restriction = core.restriction(section, { navigable });
        found.set(key, { id, name: core.text(title, 300), url, available: restriction.available, locked: restriction.locked, restrictionText: restriction.restrictionText, completionState: core.completionFor(section) });
      } catch (_) { core.captureError(errors, "module"); }
    });
    return Array.from(found.values());
  };
})(globalThis);
