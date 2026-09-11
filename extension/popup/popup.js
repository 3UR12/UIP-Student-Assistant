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
  const workflow = document.querySelector("#workflow");
  const workflowSummary = document.querySelector("#workflow-summary");
  const workflowPlanner = document.querySelector("#workflow-planner");
  const workflowSections = document.querySelector("#workflow-sections");
  const workflowPreference = document.querySelector("#workflow-preference");
  const startWorkflowButton = document.querySelector("#start-workflow");
  const workflowFeedback = document.querySelector("#workflow-feedback");
  const workflowOpenButton = document.querySelector("#workflow-open");
  const workflowReturnCourseButton = document.querySelector("#workflow-return-course");
  const workflowCancelButton = document.querySelector("#workflow-cancel");
  const workflowStatus = document.querySelector("#workflow-status");
  const details = document.querySelector("#details");
  const result = document.querySelector("#result");
  const copyButton = document.querySelector("#copy");
  let plannerCandidates = [];
  let uiState = { epoch: 0, phase: "ready", scan: null, workflow: null, error: null };

  const labels = { AREA_PERSONAL: "Área personal", COURSE: "Curso", SECTION: "Módulo", FEEDBACK: "Feedback", OTHER: "Página no reconocida" };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const show = (element) => element.classList.remove("hidden");
  const hide = (element) => element.classList.add("hidden");

  function setStatus(message) { status.textContent = message; }
  function diagnosticFor(scan) {
    const diagnostic = globalThis.UIPScannerCore.sanitizeDiagnostic(scan);
    const metadata = globalThis.UIPScannerCore.workflowMetadata(uiState.workflow);
    Object.assign(diagnostic, globalThis.UIPWorkflowUiState.diagnosticState(uiState, metadata));
    return diagnostic;
  }
  function refreshDiagnostic() { if (uiState.scan) result.textContent = JSON.stringify(diagnosticFor(uiState.scan), null, 2); }
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
    if (uiState.workflow && form.preferenceOptions.includes(uiState.workflow.preference)) preference.value = uiState.workflow.preference;
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
    if (action && action.detected && action.unique && ["link", "form-submit"].includes(action.kind) && action.signature) show(continueNavigationButton);
    else hide(continueNavigationButton);
    if (action && action.detected && action.unique && action.signature) navigationSummary.textContent += ` Continuación disponible · Tipo: ${action.kind === "form-submit" ? "formulario Moodle" : "enlace Moodle"} · Destino: ${action.destinationPath || "desconocido"} · Método: ${(action.method || "desconocido").toUpperCase()}.`;
    navigationStatus.textContent = "";
    show(navigation);
  }
  function setWorkflowAction(label, handler) {
    workflowOpenButton.textContent = label;
    workflowOpenButton.onclick = handler || null;
    if (handler) show(workflowOpenButton); else hide(workflowOpenButton);
  }
  function workflowProgress(value) {
    return `${value.sections.filter((item) => item.status === "completed" || item.status === "no-feedback").length} / ${value.sections.length} módulos revisados`;
  }
  function currentWorkflowSection(value) { return value && value.sections.find((item) => item.id === value.currentSectionId) || null; }
  function navigateWorkflow(value, kind, targetId, beforeNavigate) {
    if (!value || !targetId || uiState.phase !== "ready") return;
    workflowOpenButton.disabled = true;
    workflowStatus.textContent = "Revalidando el control real de Moodle…";
    const run = () => activeTab((tab) => {
      if (!tab || !tab.id) { workflowStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      const expected = { kind, targetId, courseId: value.courseId };
      chrome.tabs.sendMessage(tab.id, { type: "UIP_INSPECT_WORKFLOW_NAVIGATION", expected }, (inspection) => {
        if (chrome.runtime.lastError || !inspection || !inspection.ok || !inspection.navigation || !inspection.navigation.unique) {
          workflowStatus.textContent = "No existe un único control visible y autorizado para esta navegación.";
          workflowOpenButton.disabled = false;
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "UIP_NAVIGATE_WORKFLOW", expected }, (response) => {
          if (chrome.runtime.lastError || !response || !response.ok) { workflowStatus.textContent = "Moodle puede estar navegando; vuelve a escanear al terminar."; return; }
          workflowStatus.textContent = response.navigationResult && response.navigationResult.navigationTriggered ? "Navegación iniciada con el anchor revalidado. Vuelve a escanear." : "El control cambió; no se navegó.";
          if (!response.navigationResult || !response.navigationResult.navigationTriggered) workflowOpenButton.disabled = false;
        });
      });
    });
    if (beforeNavigate) {
      Promise.resolve(beforeNavigate()).then((saved) => {
        if (!saved || saved.ok !== true) {
          workflowStatus.textContent = "No se pudo guardar el estado del recorrido. No se navegó.";
          workflowOpenButton.disabled = false;
          return;
        }
        uiState = { ...uiState, workflow: saved.workflow };
        refreshDiagnostic();
        run();
      }).catch(() => { workflowStatus.textContent = "No se pudo guardar el estado del recorrido. No se navegó."; workflowOpenButton.disabled = false; });
    } else run();
  }
  function renderFeedbackList(scan, value) {
    workflowFeedback.replaceChildren();
    (scan.feedback || []).forEach((item) => {
      const row = document.createElement("p");
      const state = item.completionState === "completed" ? "completado" : item.completionState === "incomplete" && item.available === true ? "pendiente" : item.available === false ? "bloqueado" : "no verificable";
      row.textContent = `${item.name || "Feedback"} · ${state}`;
      workflowFeedback.append(row);
      if (item.id && item.completionState === "incomplete" && item.available === true) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Abrir Feedback";
        button.addEventListener("click", () => navigateWorkflow(value, "feedback", item.id));
        workflowFeedback.append(button);
      }
    });
  }
  function renderWorkflow(state) {
    const scan = state.scan;
    const value = state.workflow;
    if (!scan) { hide(workflow); return; }
    if (value && scan.feedbackForm) renderAssistant(scan.feedbackForm);
    workflowFeedback.replaceChildren(); hide(workflowPlanner); hide(workflowReturnCourseButton); hide(workflowCancelButton); setWorkflowAction("", null); workflowStatus.textContent = "";
    if (state.phase === "loading") {
      workflowSummary.textContent = "Cargando estado del recorrido…";
      show(workflow); return;
    }
    if (state.phase === "error") {
      workflowSummary.textContent = state.error || "No se pudo cargar el recorrido. Intenta nuevamente.";
      show(workflow); return;
    }
    if (!value) {
      if (!globalThis.UIPWorkflowUiState.canShowPlanner(scan, state)) { hide(workflow); return; }
      plannerCandidates = globalThis.UIPScannerCore.workflowPlanCandidates(scan.course, scan.modules || []);
      if (!plannerCandidates.length) { hide(workflow); refreshDiagnostic(); return; }
      workflowSections.replaceChildren();
      plannerCandidates.forEach((item) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox"; input.value = item.id; input.checked = item.autoSelected; input.disabled = !item.selectable;
        label.append(input, document.createTextNode(` ${item.name || "Sección sin nombre"}${item.selectable ? "" : ` (${item.reason === "unverified" ? "no verificable" : "no disponible"})`}`));
        workflowSections.append(label);
      });
      workflowPreference.innerHTML = '<option value="">Sin seleccionar</option><option>Excelente</option><option>Muy Bueno</option><option>Bueno</option><option>Satisfactorio</option><option>Puede mejorar</option>';
      workflowSummary.textContent = "Sin recorrido activo. Selecciona módulos verificadamente disponibles y una valoración explícita.";
      show(workflowPlanner); show(workflow); return;
    }
    show(workflowCancelButton); show(workflow);
    const sameCourse = scan.course && scan.course.id === value.courseId;
    if (!sameCourse) {
      workflowSummary.textContent = "Hay un recorrido activo para otro curso. No se modificará ni se navegará automáticamente.";
      if (scan.course) setWorkflowAction("Volver al curso del recorrido", () => navigateWorkflow(value, "course-breadcrumb", value.courseId));
      return;
    }
    workflowSummary.textContent = `Recorrido activo · ${workflowProgress(value)}.`;
    if (scan.pageType === "SECTION") {
      if (!scan.currentSection || scan.currentSection.id !== value.currentSectionId) {
        workflowSummary.textContent = "Estás fuera del recorrido. No se ha modificado su estado.";
        setWorkflowAction("Volver al curso", () => navigateWorkflow(value, "course-breadcrumb", value.courseId));
        refreshDiagnostic(); return;
      }
      const current = value.sections.find((item) => item.id === value.currentSectionId);
      const status = current && current.status;
      workflowSummary.textContent = `Módulo actual: ${status === "needs-review" ? "requiere Feedback" : status === "completed" ? "completado" : status === "no-feedback" ? "sin Feedback" : status === "blocked" ? "bloqueado" : "estado no verificable"} · ${workflowProgress(value)}.`;
      renderFeedbackList(scan, value);
      workflowReturnCourseButton.onclick = () => navigateWorkflow(value, "course-breadcrumb", value.courseId);
      show(workflowReturnCourseButton); return;
    }
    if (scan.pageType === "FEEDBACK") {
      const page = scan.feedbackPage;
      const action = globalThis.UIPWorkflowUiState.feedbackViewAction(scan);
      if (action === "form-open") workflowSummary.textContent += " Formulario de Feedback abierto. Usa Feedback Assistant para revisar las respuestas.";
      else if (action === "open-form") setWorkflowAction("Abrir formulario", () => navigateWorkflow(value, "response-form", page.id));
      else workflowSummary.textContent += " El formulario no está disponible o no es verificable.";
      return;
    }
    if (scan.pageType === "COURSE") {
      if (globalThis.UIPScannerCore.workflowIsFinal(value)) {
        workflowSummary.textContent = `Recorrido finalizado · ${workflowProgress(value)}. Los módulos bloqueados o no verificables no se consideran completados.`;
        return;
      }
      const current = currentWorkflowSection(value);
      const next = current && !["completed", "no-feedback"].includes(current.status) ? current : globalThis.UIPScannerCore.workflowNextSection(value);
      if (!next) { workflowSummary.textContent += " No hay un siguiente módulo pendiente verificable."; return; }
      const label = current && current.id === next.id && current.status !== "pending" ? "Volver a revisar módulo" : "Abrir siguiente módulo";
      setWorkflowAction(label, () => navigateWorkflow(value, "section", next.id, () => globalThis.UIPWorkflowClient.save({ ...value, currentSectionId: next.id, sections: value.sections.map((item) => item.id === next.id ? { ...item, status: "visiting" } : item) })));
      return;
    }
    workflowSummary.textContent += " Abre el curso o el módulo correspondiente para continuar.";
    return;
  }
  function renderView(state) {
    const scan = state.scan;
    if (state.phase === "loading") {
      setStatus("Cargando estado del recorrido…");
      copyButton.disabled = true; hide(details); hide(copyButton);
      renderWorkflow(state);
      return;
    }
    if (!scan) {
      setStatus(state.error || "No se pudo cargar el recorrido. Intenta nuevamente.");
      copyButton.disabled = true; hide(details); hide(copyButton);
      renderWorkflow(state);
      return;
    }
    const type = labels[scan.pageType] || labels.OTHER;
    if (scan.sessionApparentlyNotStarted) setStatus("Sesión aparentemente no iniciada.");
    else if (scan.pageType === "OTHER") setStatus("Moodle detectado · Página no reconocida.");
    else setStatus(`Moodle detectado · Página reconocida: ${type}.`);
    const course = scan.course && scan.course.name ? `<p><strong>Curso:</strong> ${escapeHtml(scan.course.name)}</p>` : "";
    const partial = scan.partial ? "<p><strong>Escaneo parcial:</strong> algunos elementos no pudieron analizarse.</p>" : "";
    summary.innerHTML = `<p><strong>Página:</strong> ${type}</p>${course}<dl><dt>Cursos detectados</dt><dd>${scan.summary.courses}</dd><dt>Módulos detectados</dt><dd>${scan.summary.modules}</dd><dt>Disponibles (confirmados)</dt><dd>${scan.summary.modulesAvailable}</dd><dt>Bloqueados (confirmados)</dt><dd>${scan.summary.modulesLocked}</dd><dt>Actividades</dt><dd>${scan.summary.activities}</dd><dt>Feedback</dt><dd>${scan.summary.feedback}</dd><dt>Feedback completados</dt><dd>${scan.summary.feedbackCompleted}</dd><dt>Feedback pendientes (confirmados)</dt><dd>${scan.summary.feedbackPending}</dd></dl>${partial}`;
    result.textContent = JSON.stringify(diagnosticFor(scan), null, 2);
    copyButton.disabled = !globalThis.UIPWorkflowUiState.canCopy(state);
    show(summary); show(details); show(copyButton);
    renderAssistant(scan.feedbackForm);
    renderSubmission(scan.feedbackSubmission);
    renderNavigation(scan);
    renderWorkflow(state);
  }
  const withTimeout = (promise) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: "timeout" }), 3000);
    Promise.resolve(promise).then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve({ ok: false, error: "timeout" }); });
  });
  const scanCurrent = () => withTimeout(new Promise((resolve) => activeTab((tab) => {
    if (!tab || !tab.id) { resolve({ ok: false }); return; }
    chrome.tabs.sendMessage(tab.id, { type: "UIP_SCAN_CURRENT_DOCUMENT" }, (response) => {
      resolve(chrome.runtime.lastError || !response || !response.ok ? { ok: false } : response);
    });
  })));
  async function reconcileSection(scan, workflow) {
    if (!workflow || scan.pageType !== "SECTION" || !scan.course || scan.course.id !== workflow.courseId || !scan.currentSection || scan.currentSection.id !== workflow.currentSectionId) return { ok: true, workflow };
    const status = globalThis.UIPScannerCore.classifyWorkflowSection(scan.feedback || []);
    const current = workflow.sections.find((item) => item.id === workflow.currentSectionId);
    if (!current || current.status === status) return { ok: true, workflow };
    const saved = await globalThis.UIPWorkflowClient.save({ ...workflow, sections: workflow.sections.map((item) => item.id === workflow.currentSectionId ? { ...item, status } : item) });
    return saved && saved.ok === true ? saved : { ok: false, workflow, error: "No se pudo actualizar el estado del módulo." };
  }
  async function refreshPopup() {
    const epoch = uiState.epoch + 1;
    uiState = { epoch, phase: "loading", scan: null, workflow: null, error: null };
    renderView(uiState);
    const [scanResult, workflowResult] = await Promise.all([scanCurrent(), globalThis.UIPWorkflowClient.load()]);
    if (!globalThis.UIPWorkflowUiState.isCurrentEpoch(uiState, epoch)) return;
    if (!scanResult || !scanResult.ok || !globalThis.UIPScannerCore.isCompatibleScan(scanResult.scan)) {
      uiState = { epoch, phase: "error", scan: null, workflow: null, error: "No se pudo cargar el recorrido. Intenta nuevamente." };
      renderView(uiState); return;
    }
    if (!workflowResult || workflowResult.ok !== true) {
      uiState = { epoch, phase: "error", scan: scanResult.scan, workflow: null, error: "No se pudo cargar el recorrido. Intenta nuevamente." };
      renderView(uiState); return;
    }
    const reconciled = await reconcileSection(scanResult.scan, workflowResult.workflow);
    if (!globalThis.UIPWorkflowUiState.isCurrentEpoch(uiState, epoch)) return;
    if (!reconciled.ok) {
      uiState = { epoch, phase: "error", scan: scanResult.scan, workflow: reconciled.workflow || workflowResult.workflow, error: reconciled.error || "No se pudo actualizar el estado del módulo." };
      renderView(uiState); return;
    }
    uiState = { epoch, phase: "ready", scan: scanResult.scan, workflow: reconciled.workflow, error: null };
    renderView(uiState);
  }

  scanButton.addEventListener("click", () => {
    refreshPopup();
  });

  preference.addEventListener("change", () => {
    const scan = uiState.scan;
    prefillButton.disabled = uiState.phase !== "ready" || !scan || !scan.feedbackForm || !scan.feedbackForm.canPrefill || !scan.feedbackForm.signature || !preference.value;
    if (!prefillButton.disabled) {
      const preview = globalThis.UIPScannerCore.feedbackPrefillPreview(scan.feedbackForm, preference.value);
      const labels = preview.details.filter((item) => item.status === "changed").map((item) => item.label || item.id).filter(Boolean);
      prefillStatus.textContent = labels.length ? `Se modificarían ${labels.length}: ${labels.join(", ")}.` : "No hay preguntas nuevas compatibles para modificar.";
    }
  });

  prefillButton.addEventListener("click", () => {
    if (uiState.phase !== "ready" || !uiState.scan || !uiState.scan.feedbackForm || !uiState.scan.feedbackForm.signature || !preference.value) return;
    prefillButton.disabled = true;
    prefillStatus.textContent = "Preseleccionando radios compatibles…";
    activeTab((tab) => {
      if (!tab || !tab.id) { prefillStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_PREFILL_FEEDBACK", feedbackId: uiState.scan.feedbackForm.id, expectedQuestionCount: uiState.scan.feedbackForm.questions.length, expectedSignature: uiState.scan.feedbackForm.signature, preference: preference.value }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok || !globalThis.UIPScannerCore.isCompatibleScan(response.scan)) {
          prefillStatus.textContent = "No se pudo preseleccionar. Recarga Moodle y vuelve a revisar.";
          return;
        }
        refreshPopup();
        const result = response.prefillResult;
        if (result.staleForm) {
          prefillStatus.textContent = "El formulario cambió desde el análisis. Vuelve a revisar antes de preseleccionar.";
          return;
        }
        prefillStatus.textContent = `${result.changed} respuestas preseleccionadas. ${result.skippedExisting} se dejaron intactas por respuestas existentes.`;
      });
    });
  });

  startWorkflowButton.addEventListener("click", () => {
    if (!globalThis.UIPWorkflowUiState.canShowPlanner(uiState.scan, uiState)) return;
    const selected = Array.from(workflowSections.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
    const plan = globalThis.UIPScannerCore.createWorkflowPlan(uiState.scan.course.id, workflowPreference.value, plannerCandidates, selected);
    if (!plan) { workflowStatus.textContent = "Elige al menos un módulo disponible y una valoración explícita."; return; }
    startWorkflowButton.disabled = true;
    workflowStatus.textContent = "Guardando recorrido…";
    globalThis.UIPWorkflowClient.save(plan).then((saved) => {
      if (!saved || saved.ok !== true) {
        workflowStatus.textContent = "No se pudo guardar el recorrido. No se inició.";
        startWorkflowButton.disabled = false;
        return;
      }
      uiState = { ...uiState, workflow: saved.workflow };
      renderView(uiState);
      workflowStatus.textContent = "Recorrido guardado.";
    });
  });
  workflowCancelButton.addEventListener("click", () => {
    if (uiState.phase !== "ready" || !uiState.workflow || !window.confirm("¿Cancelar este recorrido? Moodle no se modificará.")) return;
    workflowCancelButton.disabled = true;
    globalThis.UIPWorkflowClient.clear().then((cleared) => {
      if (!cleared || cleared.ok !== true) {
        workflowStatus.textContent = "No se pudo cancelar el recorrido.";
        workflowCancelButton.disabled = false;
        return;
      }
      uiState = { ...uiState, workflow: null };
      renderView(uiState);
      workflowStatus.textContent = "Recorrido cancelado.";
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
        refreshPopup();
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
    const submissionState = uiState.phase === "ready" && uiState.scan && uiState.scan.feedbackSubmission;
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
        refreshPopup();
        navigationStatus.textContent = response.navigation && response.navigation.feedbackResult && response.navigation.feedbackResult.continueAction && response.navigation.feedbackResult.continueAction.unique ? "Continuación disponible; requiere otro clic explícito." : "Sin continuación segura.";
      });
    });
  });

  continueNavigationButton.addEventListener("click", () => {
    const feedbackResult = uiState.phase === "ready" && uiState.scan && uiState.scan.feedbackResult;
    const action = feedbackResult && feedbackResult.continueAction;
    if (!feedbackResult || !action || !action.unique || !["link", "form-submit"].includes(action.kind) || !action.signature) return;
    continueNavigationButton.disabled = true;
    navigationStatus.textContent = "Revalidando continuación…";
    activeTab((tab) => {
      if (!tab || !tab.id) { navigationStatus.textContent = "No se pudo acceder a la pestaña actual."; return; }
      chrome.tabs.sendMessage(tab.id, { type: "UIP_NAVIGATE_CONTINUE", expected: { feedbackId: feedbackResult.feedbackId, kind: action.kind, signature: action.signature } }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          navigationStatus.textContent = "Moodle puede estar navegando. Vuelve a escanear al terminar.";
          return;
        }
        navigationStatus.textContent = response.navigationResult && response.navigationResult.navigationTriggered ? "Navegación iniciada; vuelve a escanear al terminar." : "El enlace cambió. No se navegó.";
      });
    });
  });

  copyButton.addEventListener("click", async () => {
    if (!uiState.scan || !globalThis.UIPWorkflowUiState.canCopy(uiState)) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnosticFor(uiState.scan), null, 2));
      setStatus("Diagnóstico sanitizado copiado al portapapeles.");
    } catch (_) { setStatus("No se pudo copiar el diagnóstico."); }
  });
  refreshPopup();
})();
