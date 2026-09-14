<!-- ========================================================= -->
<!--              UIP STUDENT ASSISTANT · README               -->
<!-- ========================================================= -->

<div align="center">

# UIP Student Assistant

<a href="https://git.io/typing-svg">
  <img
    src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=21&pause=1200&color=1F6F5F&center=true&vCenter=true&width=900&lines=Automatizaci%C3%B3n+de+Feedback+para+Moodle+UIP;Materia+%7C+M%C3%B3dulos+%7C+Valoraci%C3%B3n+%7C+Ejecutar;Edge+%2B+Chrome+%7C+Manifest+V3;Flujo+local+%7C+Sin+backend+%7C+Sin+credenciales"
    alt="UIP Student Assistant"
  />
</a>

<br>

<img src="https://img.shields.io/badge/version-0.5.0-1F6F5F?style=flat-square" />
<img src="https://img.shields.io/badge/estado-beta-D29922?style=flat-square" />
<img src="https://img.shields.io/badge/Manifest-V3-0D1117?style=flat-square&logo=googlechrome&logoColor=white" />
<img src="https://img.shields.io/badge/Microsoft%20Edge-compatible-0D1117?style=flat-square&logo=microsoftedge&logoColor=0AA0F4" />
<img src="https://img.shields.io/badge/Google%20Chrome-compatible-0D1117?style=flat-square&logo=googlechrome&logoColor=4285F4" />
<img src="https://img.shields.io/badge/license-MIT-0D1117?style=flat-square" />

<br><br>

**Extensión de navegador para automatizar encuestas Feedback en Moodle UIP.**

Selecciona una materia, los módulos que deseas procesar y una valoración. La extensión utiliza una pestaña Moodle dedicada para ejecutar el recorrido y mostrar el progreso desde un dashboard independiente.

</div>

---

## Uso

1. Inicia sesión normalmente en Moodle UIP.
2. Abre **UIP Student Assistant** desde el menú de extensiones del navegador.
3. Espera a que se carguen las materias disponibles.
4. Selecciona una materia.
5. Selecciona los módulos que deseas procesar.
6. Elige una valoración: `Excelente`, `Muy Bueno`, `Bueno`, `Satisfactorio` o `Puede mejorar`.
7. Pulsa **Procesar N módulos**.
8. Revisa el resumen y pulsa **Ejecutar recorrido**.

La extensión gestiona automáticamente la navegación necesaria. No es necesario abrir previamente Área personal, Mis cursos, una materia, un módulo o una encuesta.

Durante la ejecución, el dashboard muestra el módulo actual, la encuesta detectada, el estado de Moodle, el progreso y los elementos que requieren revisión manual.

---

## Funcionalidad

<table>
<tr>
<td width="50%" valign="top">

### Procesamiento

- Descubrimiento automático de materias y módulos.
- Selección de módulos disponibles.
- Aplicación de una valoración común a preguntas compatibles sin respuesta.
- Conservación de respuestas existentes.
- Verificación previa al envío.
- Verificación del resultado después del envío.
- Procesamiento de múltiples Feedback dentro de un mismo módulo.
- Continuación automática entre encuestas y módulos.

</td>
<td width="50%" valign="top">

### Control y recuperación

- Pestaña Moodle dedicada al recorrido.
- Pausa, reanudación y cancelación.
- Recuperación después de volver a iniciar sesión en Moodle.
- Manejo de módulos no disponibles o bloqueados.
- Protección frente a envíos duplicados.
- Reintentos acotados y watchdog para estados de espera.
- Soporte para recorridos consecutivos sin reiniciar la extensión.

</td>
</tr>
</table>

---

## Instalación

Actualmente la extensión se instala de forma manual mediante **Load unpacked / Cargar descomprimida**.

### Desde GitHub

1. Descarga el repositorio con **Code → Download ZIP** o clónalo con Git.
2. Extrae el archivo si utilizaste la descarga ZIP.
3. Abre `edge://extensions` o `chrome://extensions`.
4. Activa el modo para desarrolladores.
5. Pulsa **Cargar descomprimida / Load unpacked**.
6. Selecciona la carpeta `extension/`, donde se encuentra `manifest.json`.
7. Opcional: fija UIP Student Assistant en la barra del navegador.

> Consulta [`docs/INSTALLATION.md`](docs/INSTALLATION.md) para instrucciones detalladas y solución de problemas.

---

## Privacidad y seguridad

UIP Student Assistant utiliza únicamente la sesión de Moodle ya iniciada en el navegador.

No solicita ni almacena:

- usuario o contraseña;
- cookies;
- `sesskey`;
- tokens de autenticación;
- HTML completo de Moodle;
- contenido completo de formularios;
- datos en un backend externo.

El estado temporal del recorrido se guarda en `chrome.storage.session`. La extensión no fabrica solicitudes HTTP para enviar formularios de Moodle y limita sus permisos al dominio `https://moodle.uip.edu.pa/*`.

Consulta [`docs/SECURITY.md`](docs/SECURITY.md) para el modelo de seguridad completo.

---

## Estado del proyecto

| Componente | Estado |
|---|---|
| Descubrimiento de materias | Validado en Moodle UIP |
| Descubrimiento de módulos | Validado en Moodle UIP |
| Worker Moodle dedicado | Implementado |
| Recorrido automático multi-módulo | Implementado |
| Prefill y verificación de formularios | Validado |
| Submit y verificación post-submit | Validado |
| Manejo de módulos no disponibles | Implementado |
| Recorridos consecutivos | Implementado |
| Validación con múltiples cursos y usuarios | En pruebas |
| Chrome Web Store / Edge Add-ons | No publicado |

`v0.5.0` se mantiene como versión beta mientras se amplían las pruebas en más cursos y cuentas de Moodle UIP.

---

## Arquitectura

```text
Dashboard
   |
   v
Background Service Worker
   |
   +-- Course discovery
   +-- Workflow state machine
   +-- Watchdog / recovery
   +-- Dedicated Moodle worker tab
                         |
                         v
                    Content Script
                         |
                         v
                     Moodle UIP
```

El dashboard configura el recorrido y presenta su estado. El service worker mantiene la máquina de estados y la sesión de trabajo. El content script observa el DOM actual de Moodle y ejecuta únicamente acciones acotadas y revalidadas.

Documentación técnica:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/MOODLE-FLOW.md`](docs/MOODLE-FLOW.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/TESTING.md`](docs/TESTING.md)
- [`CHANGELOG.md`](CHANGELOG.md)

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
├── LICENSE
└── README.md
```

</details>

---

## Desarrollo

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
node tests/terminal-outcomes.test.js
node tests/automation-e2e.test.js --repeat=20
node tests/lifecycle-idempotency.test.js
node tests/recovery-service-worker.test.js
node tests/event-pump-race.test.js --repeat=50
node tests/blocked-section-redirect.test.js --repeat=50
node tests/discovery-lifecycle.test.js --repeat=50
node tests/discovery-settlement-content.test.js
```

</details>

Para generar un paquete local de la extensión:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

---

## Licencia

Distribuido bajo la [MIT License](LICENSE).

Copyright © 2026 Euris J. Rodríguez V.

---

## Aviso

UIP Student Assistant es un proyecto independiente. No está afiliado, patrocinado ni mantenido por la Universidad Interamericana de Panamá ni por Moodle.

---

<div align="center">

### `Moodle · Automation · Browser Extensions`

Desarrollado por [**3UR12**](https://github.com/3UR12)

</div>
