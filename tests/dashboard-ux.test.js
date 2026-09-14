/* Contract-level UI test without a browser dependency. */
const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("extension/dashboard/dashboard.html", "utf8");
const script = fs.readFileSync("extension/dashboard/dashboard.js", "utf8");
const css = fs.readFileSync("extension/dashboard/dashboard.css", "utf8");
const has = (value) => assert.ok(html.includes(value), `missing dashboard element ${value}`);

assert.equal(html.includes("Feedback sin recorridos manuales"), false);
assert.ok(html.includes("Procesamiento automático de encuestas"));
assert.ok(html.includes("Herramienta independiente para uso personal."));

// SETUP: observed course/modules/rating and a single primary pre-confirmation CTA.
["id=\"setup-view\"", "id=\"course-select\"", "id=\"module-list\"", "id=\"rating-select\"", "id=\"prepare-run\"", "id=\"confirm-run\""].forEach(has);
const setupMarkup = html.slice(html.indexOf('id="setup-view"'), html.indexOf('id="running-view"'));
assert.equal((setupMarkup.match(/id="prepare-run"/g) || []).length, 1);
assert.ok(setupMarkup.includes('class="primary" type="button">Procesar'));

// RUNNING: meaningful progress, current module, semantic action, and only safe controls.
["id=\"running-view\"", "id=\"progress-bar\"", "id=\"progress-label\"", "id=\"current-module\"", "id=\"current-feedback\"", "id=\"current-action\"", "id=\"moodle-connection\"", "id=\"last-activity\"", "id=\"step-elapsed\"", "id=\"activity-log\"", "id=\"module-summary\"", "id=\"pause-run\"", "id=\"cancel-run\""].forEach(has);
const runningMarkup = html.slice(html.indexOf('id="running-view"'), html.indexOf('id="paused-view"'));
["Escanear", "Abrir Feedback", "Abrir formulario", "Revisar envío", "Revisar navegación", "Continuar"].forEach((label) => assert.equal(runningMarkup.includes(label), false, `internal control leaked into running UI: ${label}`));

// PAUSED, DONE, and ERROR each expose an understandable recovery route.
["id=\"paused-view\"", "id=\"paused-reason\"", "id=\"resume-run\"", "id=\"cancel-paused\"", "id=\"restart-run\"", "id=\"done-view\"", "id=\"done-summary\"", "id=\"new-run\""].forEach(has);
assert.ok(script.includes('workflow.status === "ERROR"'));
assert.ok(script.includes('UIP_AUTOMATION_NEW_RUN'));
assert.ok(script.includes('workflow.semantic'));
assert.ok(script.includes("module.selectable === true"));
assert.ok(script.includes("Sección general no incluida."));
assert.ok(script.includes('item.status === "blocked" ? "No disponible"'));
assert.ok(script.includes("WAIT_SECTION"));
assert.ok(script.includes("phaseLabel"));
assert.ok(script.includes("initializeDashboard"));
assert.ok(script.includes("refreshRunning"));
assert.ok(script.includes("Cargando materias desde Moodle…"));
assert.ok(script.includes("No se encontraron materias disponibles."));
assert.ok(script.includes("No se pudieron cargar las materias."));
assert.ok(script.includes('"Reintentar"'));
assert.ok(script.includes("Cargando módulos de la materia…"));
assert.ok(script.includes("Módulos cargados. Configura el recorrido."));
assert.ok(script.includes("No se encontraron módulos disponibles."));
assert.ok(script.includes("visibleModules"));
assert.ok(script.includes("safeRender"));
assert.ok(script.includes("startRequestRunning"));
assert.ok(script.includes("canStartConfiguredRun"));
assert.ok(script.includes("resetTransientSetup"));
assert.ok(script.includes("beginNewRun"));
assert.ok(script.includes("No se pudo actualizar la interfaz."));
assert.ok(script.includes("renderProgressClock"));
assert.ok(script.includes("discoveryStatus"));
assert.ok(script.includes("discoveryRequestId"));
assert.ok(script.includes("discoverySource"));
assert.ok(script.includes("discoveryFallbackUsed"));
assert.ok(script.includes("courseDiscovery"));
const refreshStateSource = script.slice(script.indexOf("async function refreshState"), script.indexOf("async function requestCourseDiscovery"));
assert.equal(refreshStateSource.includes("UIP_AUTOMATION_DISCOVER_COURSES"), false, "state refresh must remain read-only");
assert.equal(script.includes("setInterval(refresh"), false, "timer must not poll the background");
assert.equal(script.includes("setInterval(() => { render(); renderNotice();"), false, "timer must not rebuild setup controls");

// The layout remains responsive and status changes remain visible to assistive tech.
assert.ok(html.includes('aria-live="polite"'));
assert.ok(html.includes("Las materias se cargan automáticamente desde Moodle."));
assert.equal(html.includes("Área personal de Moodle"), false);
assert.ok(css.includes('@media'));
assert.ok(!html.includes('popup'));
console.log("dashboard UX tests passed");
