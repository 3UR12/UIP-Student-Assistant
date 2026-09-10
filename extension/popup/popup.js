(() => {
  const scanButton = document.querySelector("#scan");
  const status = document.querySelector("#status");
  const summary = document.querySelector("#summary");
  const details = document.querySelector("#details");
  const result = document.querySelector("#result");
  const copyButton = document.querySelector("#copy");
  let lastScan = null;

  const labels = { AREA_PERSONAL: "Área personal", COURSE: "Curso", SECTION: "Módulo", FEEDBACK: "Feedback", OTHER: "Página no reconocida" };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const show = (element) => element.classList.remove("hidden");

  function setStatus(message) { status.textContent = message; }
  function render(scan) {
    lastScan = scan;
    const type = labels[scan.pageType] || labels.OTHER;
    if (scan.sessionApparentlyNotStarted) setStatus("Sesión aparentemente no iniciada.");
    else if (scan.pageType === "OTHER") setStatus("Moodle detectado · Página no reconocida.");
    else setStatus(`Moodle detectado · Página reconocida: ${type}.`);
    const course = scan.course && scan.course.name ? `<p><strong>Curso:</strong> ${escapeHtml(scan.course.name)}</p>` : "";
    const partial = scan.partial ? "<p><strong>Escaneo parcial:</strong> algunos elementos no pudieron analizarse.</p>" : "";
    summary.innerHTML = `<p><strong>Página:</strong> ${type}</p>${course}<dl><dt>Cursos detectados</dt><dd>${scan.summary.courses}</dd><dt>Módulos detectados</dt><dd>${scan.summary.modules}</dd><dt>Disponibles (confirmados)</dt><dd>${scan.summary.modulesAvailable}</dd><dt>Bloqueados (confirmados)</dt><dd>${scan.summary.modulesLocked}</dd><dt>Actividades</dt><dd>${scan.summary.activities}</dd><dt>Feedback</dt><dd>${scan.summary.feedback}</dd><dt>Feedback completados</dt><dd>${scan.summary.feedbackCompleted}</dd><dt>Feedback pendientes (confirmados)</dt><dd>${scan.summary.feedbackPending}</dd></dl>${partial}`;
    result.textContent = JSON.stringify(globalThis.UIPScannerCore.sanitizeDiagnostic(scan), null, 2);
    show(summary); show(details); show(copyButton);
  }

  scanButton.addEventListener("click", () => {
    scanButton.disabled = true;
    setStatus("Analizando la página actual…");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) { setStatus("No se pudo acceder a la pestaña actual."); scanButton.disabled = false; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_SCAN_CURRENT_DOCUMENT" }, (response) => {
        scanButton.disabled = false;
        if (chrome.runtime.lastError || !response || !response.ok) {
          setStatus("No estás en Moodle o la página aún no está lista.");
          return;
        }
        render(response.scan);
      });
    });
  });

  copyButton.addEventListener("click", async () => {
    if (!lastScan) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(globalThis.UIPScannerCore.sanitizeDiagnostic(lastScan), null, 2));
      setStatus("Diagnóstico sanitizado copiado al portapapeles.");
    } catch (_) { setStatus("No se pudo copiar el diagnóstico."); }
  });
})();
