(() => {
  const scanButton = document.querySelector("#scan");
  const status = document.querySelector("#status");
  const summary = document.querySelector("#summary");
  const assistant = document.querySelector("#assistant");
  const assistantSummary = document.querySelector("#assistant-summary");
  const preference = document.querySelector("#preference");
  const prefillButton = document.querySelector("#prefill");
  const prefillStatus = document.querySelector("#prefill-status");
  const details = document.querySelector("#details");
  const result = document.querySelector("#result");
  const copyButton = document.querySelector("#copy");
  let lastScan = null;

  const labels = { AREA_PERSONAL: "Área personal", COURSE: "Curso", SECTION: "Módulo", FEEDBACK: "Feedback", OTHER: "Página no reconocida" };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const show = (element) => element.classList.remove("hidden");
  const hide = (element) => element.classList.add("hidden");

  function setStatus(message) { status.textContent = message; }
  function activeTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => callback(tabs[0]));
  }
  function renderAssistant(form) {
    if (!form || !form.detected) { hide(assistant); return; }
    assistantSummary.textContent = `Feedback detectado · Preguntas: ${form.questions.length} · Obligatorias: ${form.questions.filter((item) => item.required === true).length} / ${form.questions.filter((item) => item.required === null).length} desconocidas · Compatibles: ${form.supportedQuestions} · Respondidas: ${form.questions.filter((item) => item.answered).length}`;
    preference.innerHTML = '<option value="">Sin seleccionar</option>';
    form.preferenceOptions.forEach((label) => {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      preference.append(option);
    });
    preference.disabled = !form.canPrefill;
    prefillButton.disabled = !form.canPrefill || !preference.value;
    prefillStatus.textContent = "";
    show(assistant);
  }
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
    renderAssistant(scan.feedbackForm);
  }

  scanButton.addEventListener("click", () => {
    scanButton.disabled = true;
    setStatus("Analizando la página actual…");
    activeTab((tab) => {
      if (!tab || !tab.id) { setStatus("No se pudo acceder a la pestaña actual."); scanButton.disabled = false; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_SCAN_CURRENT_DOCUMENT" }, (response) => {
        scanButton.disabled = false;
        if (chrome.runtime.lastError || !response || !response.ok) {
          setStatus("No estás en Moodle o la página aún no está lista.");
          return;
        }
        if (!globalThis.UIPScannerCore.isCompatibleScan(response.scan)) {
          setStatus("La extensión fue actualizada. Recarga la pestaña de Moodle y vuelve a escanear.");
          return;
        }
        render(response.scan);
      });
    });
  });

  preference.addEventListener("change", () => {
    prefillButton.disabled = !lastScan || !lastScan.feedbackForm || !lastScan.feedbackForm.canPrefill || !preference.value;
    if (!prefillButton.disabled) {
      const preview = globalThis.UIPScannerCore.feedbackPrefillPreview(lastScan.feedbackForm, preference.value);
      const labels = preview.details.filter((item) => item.status === "changed").map((item) => item.label || item.id).filter(Boolean);
      prefillStatus.textContent = labels.length ? `Se modificarían ${labels.length}: ${labels.join(", ")}.` : "No hay preguntas nuevas compatibles para modificar.";
    }
  });

  prefillButton.addEventListener("click", () => {
    if (!lastScan || !lastScan.feedbackForm || !preference.value) return;
    prefillButton.disabled = true;
    prefillStatus.textContent = "Preseleccionando radios compatibles…";
    activeTab((tab) => {
      if (!tab || !tab.id) { prefillStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_PREFILL_FEEDBACK", feedbackId: lastScan.feedbackForm.id, expectedQuestionCount: lastScan.feedbackForm.questions.length, preference: preference.value }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok || !globalThis.UIPScannerCore.isCompatibleScan(response.scan)) {
          prefillStatus.textContent = "No se pudo preseleccionar. Recarga Moodle y vuelve a revisar.";
          return;
        }
        render(response.scan);
        const result = response.prefillResult;
        prefillStatus.textContent = `${result.changed} respuestas preseleccionadas. ${result.skippedExisting} se dejaron intactas por respuestas existentes.`;
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
