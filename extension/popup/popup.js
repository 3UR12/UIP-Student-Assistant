(() => {
  const scanButton = document.querySelector("#scan");
  const status = document.querySelector("#status");
  const summary = document.querySelector("#summary");
  const assistant = document.querySelector("#assistant");
  const assistantSummary = document.querySelector("#assistant-summary");
  const preference = document.querySelector("#preference");
  const prefillButton = document.querySelector("#prefill");
  const prefillStatus = document.querySelector("#prefill-status");
  const submission = document.querySelector("#submission");
  const submissionSummary = document.querySelector("#submission-summary");
  const reviewSubmitButton = document.querySelector("#review-submit");
  const submitConfirmation = document.querySelector("#submit-confirmation");
  const submitConfirmationText = document.querySelector("#submit-confirmation-text");
  const confirmSubmitButton = document.querySelector("#confirm-submit");
  const submitStatus = document.querySelector("#submit-status");
  const navigation = document.querySelector("#navigation");
  const navigationSummary = document.querySelector("#navigation-summary");
  const inspectNavigationButton = document.querySelector("#inspect-navigation");
  const continueNavigationButton = document.querySelector("#continue-navigation");
  const navigationStatus = document.querySelector("#navigation-status");
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
    prefillButton.disabled = !form.canPrefill || !form.signature || !preference.value;
    prefillStatus.textContent = "";
    show(assistant);
  }
  function renderSubmission(submissionState) {
    hide(submitConfirmation);
    if (!submissionState) { hide(submission); return; }
    const answered = `${submissionState.answeredSupportedQuestions}/${submissionState.supportedQuestions}`;
    if (submissionState.readyToSubmit) {
      submissionSummary.textContent = `Formulario listo para enviar · ${answered} preguntas respondidas · ${submissionState.unsupportedQuestions} preguntas manuales · Control de Moodle validado.`;
    } else {
      submissionSummary.textContent = `Formulario incompleto o no verificable · ${answered} preguntas respondidas · ${submissionState.unsupportedQuestions} preguntas manuales · Bloqueos: ${(submissionState.blockers || []).join(", ") || "desconocidos"}.`;
    }
    reviewSubmitButton.disabled = submissionState.readyToSubmit !== true;
    submitStatus.textContent = "";
    show(submission);
  }
  function renderNavigation(scan) {
    const feedbackResult = scan.feedbackResult;
    const sectionNavigation = scan.sectionNavigation;
    if (!feedbackResult && !sectionNavigation) { hide(navigation); return; }
    const resultText = feedbackResult ? `Resultado: ${feedbackResult.state}. Verificación: ${feedbackResult.submissionVerified === true ? "confirmada" : feedbackResult.submissionVerified === false ? "aún editable" : "no verificable"}.` : "";
    const sectionText = sectionNavigation ? ` Sección actual: ${sectionNavigation.currentSectionId || "desconocida"}; anterior: ${sectionNavigation.previous && sectionNavigation.previous.id || "no detectada"}; siguiente: ${sectionNavigation.next && sectionNavigation.next.id || "no detectado"}.` : "";
    navigationSummary.textContent = `${resultText}${sectionText}`.trim();
    const action = feedbackResult && feedbackResult.continueAction;
    if (action && action.detected && action.unique && action.url && action.signature) show(continueNavigationButton);
    else hide(continueNavigationButton);
    navigationStatus.textContent = "";
    show(navigation);
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
    renderSubmission(scan.feedbackSubmission);
    renderNavigation(scan);
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
    prefillButton.disabled = !lastScan || !lastScan.feedbackForm || !lastScan.feedbackForm.canPrefill || !lastScan.feedbackForm.signature || !preference.value;
    if (!prefillButton.disabled) {
      const preview = globalThis.UIPScannerCore.feedbackPrefillPreview(lastScan.feedbackForm, preference.value);
      const labels = preview.details.filter((item) => item.status === "changed").map((item) => item.label || item.id).filter(Boolean);
      prefillStatus.textContent = labels.length ? `Se modificarían ${labels.length}: ${labels.join(", ")}.` : "No hay preguntas nuevas compatibles para modificar.";
    }
  });

  prefillButton.addEventListener("click", () => {
    if (!lastScan || !lastScan.feedbackForm || !lastScan.feedbackForm.signature || !preference.value) return;
    prefillButton.disabled = true;
    prefillStatus.textContent = "Preseleccionando radios compatibles…";
    activeTab((tab) => {
      if (!tab || !tab.id) { prefillStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_PREFILL_FEEDBACK", feedbackId: lastScan.feedbackForm.id, expectedQuestionCount: lastScan.feedbackForm.questions.length, expectedSignature: lastScan.feedbackForm.signature, preference: preference.value }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok || !globalThis.UIPScannerCore.isCompatibleScan(response.scan)) {
          prefillStatus.textContent = "No se pudo preseleccionar. Recarga Moodle y vuelve a revisar.";
          return;
        }
        render(response.scan);
        const result = response.prefillResult;
        if (result.staleForm) {
          prefillStatus.textContent = "El formulario cambió desde el análisis. Vuelve a revisar antes de preseleccionar.";
          return;
        }
        prefillStatus.textContent = `${result.changed} respuestas preseleccionadas. ${result.skippedExisting} se dejaron intactas por respuestas existentes.`;
      });
    });
  });

  reviewSubmitButton.addEventListener("click", () => {
    reviewSubmitButton.disabled = true;
    submitStatus.textContent = "Revalidando el formulario antes de confirmar…";
    activeTab((tab) => {
      if (!tab || !tab.id) { submitStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_INSPECT_FEEDBACK_SUBMISSION" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok || !globalThis.UIPScannerCore.isCompatibleScan(response.scan)) {
          submitStatus.textContent = "No se pudo revisar el envío. Recarga Moodle y vuelve a analizar.";
          return;
        }
        render(response.scan);
        if (!response.submission || !response.submission.readyToSubmit) {
          submitStatus.textContent = "El formulario ya no está listo para enviar.";
          return;
        }
        submitConfirmationText.textContent = `Feedback: ${response.submission.feedbackId}. Preguntas respondidas: ${response.submission.answeredSupportedQuestions}/${response.submission.supportedQuestions}. Las valoraciones existentes no serán modificadas. Tras confirmar, Moodle recibirá las respuestas actuales del formulario.`;
        show(submitConfirmation);
        submitStatus.textContent = "Confirmación pendiente: Moodle aún no ha recibido un envío.";
      });
    });
  });

  confirmSubmitButton.addEventListener("click", () => {
    const submissionState = lastScan && lastScan.feedbackSubmission;
    if (!submissionState || !submissionState.readyToSubmit || !submissionState.formSignature) return;
    confirmSubmitButton.disabled = true;
    submitStatus.textContent = "Solicitando el envío real de Moodle…";
    activeTab((tab) => {
      if (!tab || !tab.id) { submitStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_SUBMIT_FEEDBACK", expected: { feedbackId: submissionState.feedbackId, formSignature: submissionState.formSignature, supportedQuestions: submissionState.supportedQuestions } }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          submitStatus.textContent = "Moodle puede estar navegando. Vuelve a abrir la extensión y escanea para verificar el resultado.";
          return;
        }
        if (!response.submitResult || !response.submitResult.submitTriggered) {
          submitStatus.textContent = response.submitResult && response.submitResult.reason === "form-changed" ? "El formulario cambió. No se envió nada." : "El formulario no está listo. No se envió nada.";
          return;
        }
        submitStatus.textContent = "Envío iniciado en Moodle; aún no está verificado. Vuelve a escanear después de la navegación.";
      });
    });
  });

  inspectNavigationButton.addEventListener("click", () => {
    inspectNavigationButton.disabled = true;
    navigationStatus.textContent = "Revisando enlaces de Moodle…";
    activeTab((tab) => {
      if (!tab || !tab.id) { navigationStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_INSPECT_NAVIGATION" }, (response) => {
        inspectNavigationButton.disabled = false;
        if (chrome.runtime.lastError || !response || !response.ok || !globalThis.UIPScannerCore.isCompatibleScan(response.scan)) {
          navigationStatus.textContent = "No se pudo revisar la navegación.";
          return;
        }
        render(response.scan);
        navigationStatus.textContent = response.navigation && response.navigation.feedbackResult && response.navigation.feedbackResult.continueAction && response.navigation.feedbackResult.continueAction.unique ? "Continuación disponible; requiere otro clic explícito." : "Sin continuación segura.";
      });
    });
  });

  continueNavigationButton.addEventListener("click", () => {
    const feedbackResult = lastScan && lastScan.feedbackResult;
    const action = feedbackResult && feedbackResult.continueAction;
    if (!feedbackResult || !action || !action.unique || !action.url || !action.signature) return;
    continueNavigationButton.disabled = true;
    navigationStatus.textContent = "Revalidando continuación…";
    activeTab((tab) => {
      if (!tab || !tab.id) { navigationStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_NAVIGATE_CONTINUE", expected: { feedbackId: feedbackResult.feedbackId, url: action.url, signature: action.signature } }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          navigationStatus.textContent = "Moodle puede estar navegando. Vuelve a escanear al terminar.";
          return;
        }
        navigationStatus.textContent = response.navigationResult && response.navigationResult.navigationTriggered ? "Navegación iniciada; vuelve a escanear al terminar." : "El enlace cambió. No se navegó.";
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
