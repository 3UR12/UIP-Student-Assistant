<!-- ========================================================= -->
<!--              UIP STUDENT ASSISTANT · README               -->
<!-- ========================================================= -->

<div align="center">

# UIP Student Assistant

<a href="https://git.io/typing-svg">
  <img
    src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=21&pause=1200&color=1F6F5F&center=true&vCenter=true&width=900&lines=Automatizaci%C3%B3n+de+Feedback+para+Moodle+UIP;Materia+%E2%86%92+M%C3%B3dulos+%E2%86%92+Valoraci%C3%B3n+%E2%86%92+Ejecutar;Edge+%2B+Chrome+%7C+Manifest+V3;Sin+backend+%7C+Sin+credenciales+%7C+Sin+APIs+externas"
    alt="UIP Student Assistant"
  />
</a>

<br>

<img src="https://img.shields.io/badge/version-0.5.0-1F6F5F?style=flat-square" />
<img src="https://img.shields.io/badge/Manifest-V3-0D1117?style=flat-square&logo=googlechrome&logoColor=white" />
<img src="https://img.shields.io/badge/Microsoft%20Edge-compatible-0D1117?style=flat-square&logo=microsoftedge&logoColor=0AA0F4" />
<img src="https://img.shields.io/badge/Google%20Chrome-compatible-0D1117?style=flat-square&logo=googlechrome&logoColor=4285F4" />
<img src="https://img.shields.io/badge/estado-beta-D29922?style=flat-square" />

<br><br>

**Extensión independiente para automatizar el recorrido de encuestas Feedback en Moodle UIP.**

Selecciona una materia, los módulos que quieres procesar y una valoración.  
Después de una sola confirmación, la extensión se encarga del recorrido automáticamente.

</div>

---

## Inicio rápido

```text
Abrir extensión
      ↓
Seleccionar materia
      ↓
Seleccionar módulos
      ↓
Elegir valoración
      ↓
Confirmar una vez
      ↓
Procesamiento automático
      ↓
Resumen final
```

La extensión abre y administra su propia pestaña de trabajo de Moodle. **No necesitas colocarte manualmente en Área personal, Mis cursos ni dentro de una materia antes de usarla.**

### Uso normal

1. Inicia sesión en Moodle UIP normalmente desde tu navegador.
2. Abre **UIP Student Assistant** desde el icono de extensiones.
3. Espera a que cargue la lista de materias.
4. Selecciona una materia.
5. Selecciona los módulos que deseas procesar.
6. Selecciona una valoración: `Excelente`, `Muy Bueno`, `Bueno`, `Satisfactorio` o `Puede mejorar`.
7. Pulsa **Procesar N módulos**.
8. Revisa el resumen y pulsa **Ejecutar recorrido**.
9. Desde ese punto no necesitas ir abriendo módulos, encuestas ni formularios manualmente.

Durante el recorrido el dashboard muestra el módulo actual, la encuesta detectada, el estado de Moodle, el progreso, la actividad reciente y los elementos que requieren revisión manual.

---

## Qué hace

<table>
<tr>
<td width="50%" valign="top">

### Automatización

- Descubre las materias visibles en Moodle.
- Carga los módulos de la materia seleccionada.
- Excluye la sección general del plan normal.
- Abre módulos y Feedback automáticamente.
- Abre formularios compatibles.
- Aplica la valoración seleccionada a preguntas compatibles sin respuesta.
- Conserva respuestas que ya existían.
- Envía únicamente formularios que pasan las validaciones del motor.
- Verifica el resultado en Moodle después del envío.
- Continúa al siguiente Feedback o módulo sin intervención manual.

</td>
<td width="50%" valign="top">

### Recuperación y control

- Usa una pestaña Moodle dedicada como worker.
- No redirige una pestaña Moodle personal que ya estés usando.
- Permite pausar, reanudar y cancelar.
- Reanuda el descubrimiento después de un inicio de sesión normal.
- Detecta módulos no disponibles y los omite de forma segura.
- Evita repetir un submit ya disparado.
- Usa watchdogs y reintentos acotados para evitar esperas infinitas.
- Permite iniciar un nuevo recorrido después de finalizar otro.

</td>
</tr>
</table>

---

## Instalación

UIP Student Assistant todavía se distribuye como **extensión unpacked**. No está publicada en Chrome Web Store ni Microsoft Edge Add-ons.

### Microsoft Edge

1. Descarga o recibe la carpeta de la extensión.
2. Si recibiste un `.zip`, extráelo primero.
3. Abre `edge://extensions`.
4. Activa **Modo para desarrolladores**.
5. Pulsa **Cargar descomprimida**.
6. Selecciona la carpeta que contiene `manifest.json`.
7. Opcional: fija UIP Student Assistant en la barra del navegador.

### Google Chrome

1. Descarga o recibe la carpeta de la extensión.
2. Si recibiste un `.zip`, extráelo primero.
3. Abre `chrome://extensions`.
4. Activa **Developer mode / Modo de desarrollador**.
5. Pulsa **Load unpacked / Cargar descomprimida**.
6. Selecciona la carpeta que contiene `manifest.json`.

> La guía detallada está en [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

---

## Compartir la extensión

El repositorio actualmente es privado, así que la forma más simple de compartir la extensión con un compañero es generar un paquete `.zip` y enviárselo directamente.

### Generar el ZIP en Windows

Desde la raíz del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

Se generará:

```text
dist/UIP-Student-Assistant-v0.5.0.zip
```

Ese ZIP contiene la extensión con `manifest.json` en la raíz. Tu compañero sólo debe:

```text
Recibir ZIP
→ Extraer
→ edge://extensions o chrome://extensions
→ Activar modo desarrollador
→ Cargar descomprimida
→ Seleccionar la carpeta extraída
```

También existe un workflow manual de GitHub Actions que genera el mismo paquete como artifact para el propietario del repositorio.

> Consulta [`docs/SHARING.md`](docs/SHARING.md) para el flujo completo de distribución.

---

## Privacidad y límites de seguridad

UIP Student Assistant trabaja sobre la sesión de Moodle que ya existe en el navegador.

**No almacena ni solicita:**

- usuario o contraseña;
- cookies;
- `sesskey`;
- tokens de autenticación;
- respuestas completas del formulario;
- HTML de páginas;
- datos en un backend externo.

**No utiliza:**

- `storage.local`;
- `localStorage`;
- IndexedDB;
- `fetch` o XHR para fabricar acciones de Moodle;
- APIs de IA;
- servicios remotos propios.

El estado temporal del recorrido se limita a metadata permitida en `chrome.storage.session`.

---

## Estado actual

| Área | Estado |
|---|---|
| Descubrimiento de materias | ✅ Validado en Moodle UIP |
| Descubrimiento de módulos | ✅ Validado en Moodle UIP |
| Worker Moodle dedicado | ✅ Implementado |
| Recorrido automático multi-módulo | ✅ Implementado |
| Prefill de Feedback | ✅ Validado |
| Submit + verificación post-submit | ✅ Validado |
| Continue automático | ✅ Implementado |
| Módulos bloqueados/no disponibles | ✅ Manejo seguro |
| Nuevo recorrido después de DONE | ✅ Corregido y cubierto por regresión |
| Validación con múltiples estudiantes/cursos | 🧪 En expansión |
| Chrome Web Store / Edge Add-ons | ⏳ No publicado |

La versión `0.5.0` se considera **beta**. Ya se completó una validación autenticada real con un recorrido funcional en Moodle UIP, pero todavía se están ampliando las pruebas con otras materias y otros estudiantes.

---

## Arquitectura

```text
Dashboard
   │
   ▼
Background Service Worker
   │
   ├── Discovery
   ├── Workflow state machine
   ├── Watchdog / recovery
   └── Dedicated Moodle worker tab
                    │
                    ▼
              Content Script
                    │
                    ▼
                Moodle UIP
```

El dashboard configura y muestra el progreso. El background es la fuente de verdad del recorrido. El content script observa el DOM actual de Moodle y ejecuta únicamente acciones acotadas y revalidadas.

Documentación técnica:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/AUTOMATION.md`](docs/AUTOMATION.md)
- [`docs/MOODLE-FLOW.md`](docs/MOODLE-FLOW.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/TESTING.md`](docs/TESTING.md)

<details>
<summary><b>Estructura principal del proyecto</b></summary>

```text
UIP-Student-Assistant/
├── extension/
│   ├── background/
│   ├── content/
│   ├── core/
│   ├── dashboard/
│   └── manifest.json
├── tests/
├── docs/
├── scripts/
├── .github/workflows/
└── README.md
```

</details>

---

## Desarrollo y pruebas

<details>
<summary><b>Suite de validación</b></summary>

<br>

```powershell
Get-ChildItem extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json')); console.log('manifest JSON valid')"
node tests/core-smoke.test.js
node tests/my-courses-discovery.test.js
node tests/automation-engine.test.js
node tests/workflow-service.test.js
node tests/dashboard-ux.test.js
node tests/dashboard-modules-ready.test.js
node tests/dashboard-start-lifecycle.test.js
node tests/automation-e2e.test.js --repeat=20
node tests/lifecycle-idempotency.test.js
node tests/recovery-service-worker.test.js
node tests/event-pump-race.test.js --repeat=50
node tests/blocked-section-redirect.test.js --repeat=50
node tests/discovery-lifecycle.test.js --repeat=50
node tests/discovery-settlement-content.test.js
```

</details>

---

## Historial

| Versión | Etapa |
|---|---|
| `v0.1` | Moodle Scanner |
| `v0.2` | Feedback Assistant |
| `v0.3` | Controlled Feedback Navigator |
| `v0.4` | Controlled Multi-Module Processor |
| `v0.5` | Automated Multi-Module Feedback Processor |

Consulta [`CHANGELOG.md`](CHANGELOG.md) para los cambios principales.

---

## Aviso

UIP Student Assistant es un proyecto independiente y **no está afiliado, patrocinado ni mantenido por la Universidad Interamericana de Panamá ni por Moodle**.

El repositorio continúa sin una licencia pública seleccionada. No se concede permiso general de redistribución o reutilización del código fuente mientras no exista un archivo `LICENSE`. Consulta [`docs/LICENSE-DECISION.md`](docs/LICENSE-DECISION.md).

---

<div align="center">

### `Moodle · Automation · Browser Extensions`

Desarrollado por [**3UR12**](https://github.com/3UR12)

</div>
