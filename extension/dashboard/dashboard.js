(() => {
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    notice: $("#notice"), setup: $("#setup-view"), running: $("#running-view"), paused: $("#paused-view"), done: $("#done-view"),
    course: $("#course-select"), modules: $("#module-list"), fieldset: $("#modules-fieldset"), count: $("#module-count"), rating: $("#rating-select"),
    setupReason: $("#setup-reason"), prepare: $("#prepare-run"), confirmation: $("#confirm-run"), confirmSummary: $("#confirm-summary"),
    progressBar: $("#progress-bar"), progressLabel: $("#progress-label"), runState: $("#run-state"), currentModule: $("#current-module"), currentAction: $("#current-action"), problem: $("#run-problem"),
    technical: $("#technical-output")
  };
  let state = { workflow: null, discovery: { status: "idle", courses: [], modules: [], course: null } };
  let confirmationOpen = false;
  let selectedModuleIds = new Set();
  let refreshRunning = false;
  let refreshQueued = false;
  let discoveryRequestRunning = false;
  let initialized = false;
  const send = (message) => new Promise((resolve) => chrome.runtime.sendMessage(message, (response) => resolve(chrome.runtime.lastError ? { ok: false, error: "background-unavailable" } : response || { ok: false, error: "background-unavailable" })));
  const setNotice = (value) => { ui.notice.textContent = value; };
  const escape = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const selectedIds = () => Array.from(selectedModuleIds);
  const phaseLabel = (phase) => ({ OPEN_SECTION: "Abriendo módulo", WAIT_SECTION: "Esperando apertura del módulo", SCAN_SECTION: "Revisando módulo", OPEN_FEEDBACK: "Abriendo encuesta", WAIT_FEEDBACK: "Esperando apertura de la encuesta", SCAN_FEEDBACK: "Revisando encuesta", OPEN_FORM: "Abriendo formulario", WAIT_FORM: "Esperando apertura del formulario", PREFILL: "Aplicando valoración", VERIFY_FORM: "Verificando respuestas", SUBMIT: "Enviando Feedback", VERIFY_SUBMISSION: "Confirmando envío en Moodle", CONTINUE: "Continuando en Moodle", RECHECK_SECTION: "Verificando el módulo", NEXT_MODULE: "Preparando siguiente módulo" })[phase] || "Procesando recorrido";
  const elapsed = (timestamp) => Math.max(0, Math.floor((Date.now() - Number(timestamp || Date.now())) / 1000));
  const ago = (timestamp) => { const seconds = elapsed(timestamp); return seconds < 2 ? "ahora" : `hace ${seconds} s`; };
  const statusMessage = (code) => ({ "login-required": "Necesitas iniciar sesión en Moodle.", "worker-tab-closed": "La pestaña de Moodle se cerró.", "course-mismatch": "Moodle abrió otra materia.", "workflow-storage-unavailable": "No se pudo guardar el recorrido en esta sesión.", "worker-unavailable": "No se pudo abrir la pestaña Moodle.", "course-not-ready": "Selecciona una materia antes de continuar.", "course-not-observed": "La materia ya no está disponible; actualiza la lista.", "invalid-configuration": "Selecciona módulos disponibles y una valoración.", "run-already-active": "Ya hay un recorrido activo." })[code] || "No se pudo completar esta acción.";
  function show(view) { [ui.setup, ui.running, ui.paused, ui.done].forEach((element) => element.classList.toggle("hidden", element !== view)); }
  function renderCourses() {
    const courses = state.discovery.courses || [];
    const selected = state.discovery.course && state.discovery.course.id || "";
    const discovery = state.discovery || {};
    const emptyLabel = discovery.status === "courses-ready" ? "No se encontraron materias disponibles." : discovery.status === "error" ? "No se pudieron cargar las materias." : "Cargando materias…";
    ui.course.innerHTML = courses.length ? '<option value="">Selecciona una materia</option>' + courses.map((course) => `<option value="${escape(course.id)}">${escape(course.name || "Materia sin nombre")}</option>`).join("") : `<option value="">${emptyLabel}</option>`;
    ui.course.disabled = !courses.length;
    ui.course.value = selected;
  }
  function moduleReason(module) {
    if (module.selectable !== true) return !module.name || /^(general|secci[oó]n general|general section)$/i.test(module.name) ? "Sección general no incluida." : "No disponible para procesamiento automático.";
    if (module.locked === true) return module.restrictionText || "No disponible en Moodle.";
    if (module.available === false) return module.restrictionText || "No disponible en Moodle.";
    if (module.available === null) return "Disponibilidad no verificada.";
    return "Disponible";
  }
  function renderModules() {
    const discovery = state.discovery || {};
    const modules = (state.discovery.modules || []).filter((module) => module.name && !/^(general|secci[oó]n general|general section)$/i.test(module.name));
    const available = modules.filter((module) => module.selectable === true);
    ui.fieldset.disabled = !modules.length;
    ui.modules.innerHTML = modules.map((module) => {
      const selectable = module.selectable === true;
      const id = `module-${module.id}`;
      const checked = selectable && selectedModuleIds.has(String(module.id)) ? "checked" : "";
      return `<label class="module-row${selectable ? "" : " locked"}" for="${id}"><input id="${id}" type="checkbox" value="${escape(module.id)}" ${checked} ${selectable ? "" : "disabled"}><span><strong>${escape(module.name || "Módulo sin nombre")}</strong><span>${escape(moduleReason(module))}</span></span></label>`;
    }).join("");
    ui.count.textContent = modules.length ? `${selectedIds().length} seleccionados de ${available.length} disponibles` : discovery.status === "loading-modules" ? "Cargando módulos de la materia…" : discovery.status === "modules-ready" ? "No se encontraron módulos disponibles." : "Selecciona una materia para cargar sus módulos.";
  }
  function renderSetup() {
    renderCourses(); renderModules();
    const selected = selectedIds(); const hasRating = Boolean(ui.rating.value); const hasCourse = Boolean(ui.course.value); const ready = hasCourse && selected.length > 0 && hasRating;
    ui.prepare.textContent = `Procesar ${selected.length} módulo${selected.length === 1 ? "" : "s"}`;
    ui.prepare.disabled = !ready;
    ui.setupReason.textContent = !hasCourse ? "Selecciona una materia para cargar sus módulos." : state.discovery.status === "loading-modules" ? "Cargando módulos de la materia…" : state.discovery.status === "modules-ready" && !modules.length ? "No se encontraron módulos disponibles." : selected.length === 0 ? "Selecciona al menos un módulo disponible." : !hasRating ? "Selecciona una valoración para continuar." : "El recorrido usará una sola confirmación antes de comenzar.";
    ui.confirmation.classList.toggle("hidden", !confirmationOpen);
  }
  function renderProgress(workflow) {
    const progress = workflow.progress || {}; const total = progress.total || 0; const reviewed = progress.reviewed || 0;
    ui.runState.textContent = workflow.status === "PAUSED" ? "Pausado" : "En curso";
    ui.progressBar.style.width = `${total ? Math.round((reviewed / total) * 100) : 0}%`;
    const percent = total ? Math.round((reviewed / total) * 100) : 0;
    ui.progressLabel.textContent = `Procesando ${Math.min(reviewed + 1, total)} de ${total} módulos · ${percent} % · ${reviewed} revisados`;
    ui.currentModule.textContent = workflow.currentModule && (workflow.currentModule.name || `Módulo #${workflow.currentModule.id}`) || "Finalizando recorrido…";
    $("#current-feedback").textContent = workflow.currentFeedback && (workflow.currentFeedback.name || `Encuesta #${workflow.currentFeedback.id}`) || "Buscando una encuesta compatible…";
    const stepSeconds = elapsed(workflow.stepStartedAt);
    ui.currentAction.textContent = stepSeconds > 10 ? `Moodle está tardando más de lo habitual. ${phaseLabel(workflow.phase)}…` : workflow.semantic || phaseLabel(workflow.phase);
    $("#moodle-connection").textContent = workflow.workerConnected ? "Conectado" : "Pestaña cerrada";
    $("#last-activity").textContent = ago(workflow.lastActivityAt || workflow.updatedAt);
    $("#step-elapsed").textContent = `${stepSeconds} s`;
    $("#metric-submitted").textContent = progress.submitted || 0; $("#metric-completed").textContent = progress.alreadyCompleted || 0; $("#metric-empty").textContent = progress.noFeedback || 0; $("#metric-manual").textContent = (progress.manualRequired || 0) + (progress.failed || 0);
    const problem = workflow.lastError && workflow.lastError.message;
    ui.problem.textContent = problem || ""; ui.problem.classList.toggle("hidden", !problem);
    $("#activity-log").innerHTML = (workflow.activityLog || []).slice(-8).reverse().map((item) => `<li><time>${escape(ago(item.timestamp))}</time><span>${escape(item.label)}</span></li>`).join("") || "<li><span>Iniciando recorrido seguro…</span></li>";
    $("#module-summary").innerHTML = (workflow.modules || []).map((item) => `<li class="module-status ${escape(item.status)}"><span>${item.status === "completed" ? "✓" : item.status === "running" ? "●" : item.status === "manual-required" || item.status === "failed" || item.status === "blocked" ? "!" : "○"}</span><strong>${escape(item.name || `Módulo #${item.id}`)}</strong><em>${escape(item.status === "running" ? "En proceso" : item.status === "manual-required" ? "Revisión necesaria" : item.status === "completed" ? "Completado" : item.status === "no-feedback" ? "Sin Feedback" : item.status === "blocked" ? "No disponible" : "Pendiente")}</em></li>`).join("");
  }
  function renderDone(workflow) {
    const progress = workflow.progress || {};
    $("#done-summary").textContent = `${progress.reviewed || 0} de ${progress.total || 0} módulos revisados. El recorrido se completó sin requerir pasos manuales durante la ejecución.`;
    $("#done-submitted").textContent = progress.submitted || 0; $("#done-completed").textContent = progress.alreadyCompleted || 0; $("#done-empty").textContent = progress.noFeedback || 0; $("#done-manual").textContent = (progress.manualRequired || 0) + (progress.failed || 0) + (progress.skipped || 0);
  }
  function render() {
    const workflow = state.workflow;
    const discovery = state.discovery || {};
    ui.technical.textContent = JSON.stringify({ status: workflow && workflow.status || "SETUP", phase: workflow && workflow.phase || "DISCOVERY", transition: workflow && workflow.transition || null, runId: workflow && workflow.runId && workflow.runId.slice(0, 18) || null, courseId: workflow && workflow.course && workflow.course.id || discovery.course && discovery.course.id || null, workerConnected: workflow && workflow.workerConnected || false, lastEvent: workflow && workflow.lastSafeEvent || null, stepStartedAt: workflow && workflow.stepStartedAt || null, watchdogRetries: workflow && workflow.waitRetries || 0, progress: workflow && workflow.progress || null, lastError: workflow && workflow.lastError || null, discoveryStatus: discovery.status || "idle", discoveryRequestId: discovery.requestId && discovery.requestId.slice(0, 18) || null, discoverySource: discovery.discoverySource || null, discoveryFallbackUsed: discovery.fallbackUsed === true, discoveryWorkerConnected: Number.isInteger(discovery.workerTabId), courseCount: (discovery.courses || []).length, courseDiscovery: discovery.courseDiscovery || null, moduleCount: (discovery.modules || []).length, discoveryStartedAt: discovery.startedAt || null, discoveryError: discovery.error || null }, null, 2);
    if (!workflow || ["READY_TO_START", "CANCELLED"].includes(workflow.status)) { show(ui.setup); renderSetup(); return; }
    if (workflow.status === "DONE") { show(ui.done); renderDone(workflow); return; }
    if (["PAUSED", "LOGIN_REQUIRED", "ERROR"].includes(workflow.status)) {
      show(ui.paused); $("#paused-title").textContent = workflow.status === "LOGIN_REQUIRED" ? "Necesitas iniciar sesión" : workflow.status === "ERROR" ? "El recorrido necesita atención" : "El recorrido está pausado";
      $("#paused-reason").textContent = workflow.lastError && workflow.lastError.message || workflow.semantic || "El recorrido se detuvo de forma segura.";
      $("#resume-run").classList.toggle("hidden", workflow.status === "ERROR");
      $("#restart-run").classList.toggle("hidden", workflow.status !== "ERROR"); return;
    }
    show(ui.running); renderProgress(workflow);
  }
  function renderNotice() {
    const discovery = state.discovery || {};
    if (state.workflow && state.workflow.status === "CANCELLED") setNotice("El recorrido fue cancelado. Puedes configurar uno nuevo.");
    else if (state.workflow && state.workflow.status === "DONE") setNotice("El recorrido finalizó. Revisa el resumen o inicia uno nuevo.");
    else if (state.workflow) setNotice("El recorrido continúa aunque cierres este dashboard.");
    else if (discovery.status === "loading-courses") setNotice((discovery.courses || []).length ? "Actualizando materias…" : "Cargando materias desde Moodle…");
    else if (discovery.status === "loading-modules") setNotice("Cargando módulos desde Moodle…");
    else if (discovery.status === "courses-ready") setNotice((discovery.courses || []).length ? "Materias cargadas." : "No se encontraron materias disponibles.");
    else if (discovery.status === "login-required") setNotice("Necesitas iniciar sesión en Moodle.");
    else if (discovery.status === "error") setNotice("No se pudieron cargar las materias.");
    else setNotice("Conectando con Moodle…");
    const retry = $("#retry-courses");
    retry.textContent = discovery.status === "login-required" ? "Abrir Moodle" : discovery.status === "error" ? "Reintentar" : "Actualizar materias";
    retry.disabled = discovery.status === "loading-courses" || discoveryRequestRunning;
  }
  async function refreshState() {
    if (refreshRunning) { refreshQueued = true; return; }
    refreshRunning = true;
    try {
      const result = await send({ type: "UIP_AUTOMATION_GET_STATE" });
      if (!result.ok) { setNotice(statusMessage(result.error)); return; }
      state = result; render(); renderNotice();
    } finally {
      refreshRunning = false;
      if (refreshQueued) { refreshQueued = false; refreshState(); }
    }
  }
  async function requestCourseDiscovery() {
    if (discoveryRequestRunning || state.discovery && state.discovery.status === "loading-courses") return;
    discoveryRequestRunning = true;
    renderNotice();
    try {
      const result = await send({ type: "UIP_AUTOMATION_DISCOVER_COURSES" });
      if (!result.ok) setNotice(statusMessage(result.error));
      await refreshState();
    } finally {
      discoveryRequestRunning = false;
      renderNotice();
    }
  }
  async function handleCourseAction() {
    if (state.discovery && state.discovery.status === "login-required") {
      await send({ type: "UIP_AUTOMATION_OPEN_MOODLE" });
      return;
    }
    await requestCourseDiscovery();
  }
  async function initializeDashboard() {
    if (initialized) return;
    initialized = true;
    await refreshState();
    if (!state.workflow && state.discovery && state.discovery.status === "idle") await requestCourseDiscovery();
  }
  $("#retry-courses").addEventListener("click", handleCourseAction);
  ui.course.addEventListener("change", async () => { const course = (state.discovery.courses || []).find((item) => item.id === ui.course.value); if (!course) return; selectedModuleIds = new Set(); confirmationOpen = false; setNotice("Abriendo materia y cargando módulos…"); await send({ type: "UIP_AUTOMATION_SELECT_COURSE", course }); });
  ui.modules.addEventListener("change", () => { selectedModuleIds = new Set(Array.from(ui.modules.querySelectorAll("input:checked")).map((input) => input.value)); renderSetup(); });
  ui.rating.addEventListener("change", renderSetup);
  $("#select-all").addEventListener("click", () => { selectedModuleIds = new Set(Array.from(ui.modules.querySelectorAll("input:not(:disabled)")).map((input) => input.value)); renderSetup(); });
  $("#clear-all").addEventListener("click", () => { selectedModuleIds = new Set(); renderSetup(); });
  ui.prepare.addEventListener("click", () => { confirmationOpen = true; ui.confirmSummary.textContent = `Materia: ${state.discovery.course && state.discovery.course.name || "Sin nombre"}. Módulos: ${selectedIds().length}. Valoración: ${ui.rating.value}.`; renderSetup(); });
  $("#dismiss-confirm").addEventListener("click", () => { confirmationOpen = false; renderSetup(); });
  $("#start-run").addEventListener("click", async () => { $("#start-run").disabled = true; const result = await send({ type: "UIP_AUTOMATION_START", moduleIds: selectedIds(), preference: ui.rating.value }); if (!result.ok) setNotice(statusMessage(result.error)); confirmationOpen = false; await refreshState(); });
  $("#pause-run").addEventListener("click", async () => { await send({ type: "UIP_AUTOMATION_PAUSE" }); await refreshState(); });
  $("#cancel-run").addEventListener("click", async () => { await send({ type: "UIP_AUTOMATION_CANCEL" }); await refreshState(); });
  $("#cancel-paused").addEventListener("click", async () => { await send({ type: "UIP_AUTOMATION_CANCEL" }); await refreshState(); });
  $("#resume-run").addEventListener("click", async () => { await send({ type: "UIP_AUTOMATION_RESUME" }); await refreshState(); });
  $("#restart-run").addEventListener("click", async () => { selectedModuleIds = new Set(); await send({ type: "UIP_AUTOMATION_NEW_RUN" }); await refreshState(); });
  $("#open-moodle").addEventListener("click", async () => { await send({ type: "UIP_AUTOMATION_OPEN_MOODLE" }); });
  $("#new-run").addEventListener("click", async () => { selectedModuleIds = new Set(); await send({ type: "UIP_AUTOMATION_NEW_RUN" }); await refreshState(); });
  chrome.runtime.onMessage.addListener((message) => { if (message && message.type === "UIP_AUTOMATION_STATE_CHANGED") refreshState(); });
  setInterval(() => { render(); renderNotice(); }, 1500);
  initializeDashboard();
})();
