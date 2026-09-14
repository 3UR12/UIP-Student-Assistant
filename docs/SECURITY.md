# Seguridad y privacidad

UIP Student Assistant ejecuta un flujo local sobre Moodle UIP utilizando la sesión ya iniciada en el navegador. La extensión no autentica usuarios, no fabrica solicitudes de red y no se comunica con sistemas externos a Moodle UIP.

## Datos que no solicita ni almacena

La extensión no solicita, lee, almacena ni transmite:

- usuario o contraseña;
- cookies;
- tokens de autenticación;
- `sesskey`;
- valores de formularios de inicio de sesión;
- mensajes privados;
- capturas de pantalla;
- HTML completo de Moodle.

Tampoco utiliza un backend, analítica, telemetría, almacenamiento en la nube ni una base de datos externa.

## Persistencia

`chrome.storage.session` contiene únicamente metadata sanitizada necesaria para discovery y ejecución:

- versión del workflow;
- `runId` y estado actual;
- identificador de la pestaña worker;
- IDs y URLs canónicas de Moodle;
- nombres truncados de materias y módulos;
- valoración seleccionada;
- estado por módulo;
- contadores de progreso;
- reintentos y timestamps seguros;
- historial limitado de actividad.

No se guardan fragmentos del DOM, campos ocultos, respuestas completas, cuerpos de envío, cookies, credenciales ni diagnósticos completos.

El estado de ejecución no se conserva de forma permanente después de finalizar la sesión del navegador.

## Permisos del manifiesto

| Permiso | Uso |
|---|---|
| `https://moodle.uip.edu.pa/*` | Limita el content script y las acciones a Moodle UIP. |
| `storage` | Guarda metadata temporal del discovery y del workflow. |
| `alarms` | Permite reactivar un watchdog acotado cuando una transición queda esperando. |

La extensión no solicita permisos para `<all_urls>`, cookies, identidad, `webRequest`, descargas, notificaciones ni portapapeles.

## Envío de formularios

UIP Student Assistant no utiliza `form.submit()`, `requestSubmit()`, `fetch()` ni XHR para fabricar envíos.

Antes de enviar un Feedback, el content script vuelve a comprobar:

- el Feedback esperado;
- el formulario actual;
- la cantidad de preguntas compatibles;
- que las respuestas requeridas estén completas;
- que exista un único control de envío visible y habilitado.

El resultado sólo se considera enviado después de que Moodle muestre evidencia posterior al submit.

## Manejo de errores

La ausencia de evidencia no autoriza una acción. Si la extensión detecta una materia incorrecta, un formulario modificado, una ruta inesperada, una pestaña worker cerrada, un timeout o una sesión expirada, el motor puede pausar el recorrido, realizar un único reintento controlado o dejar el elemento para revisión manual.

Los módulos que Moodle identifica como no disponibles se registran como bloqueados y no detienen el resto del recorrido.

## Reportes y depuración

No deben añadirse al repositorio capturas de Moodle con datos personales, cookies, credenciales, diagnósticos privados ni información académica sensible. `.gitignore` excluye directorios locales destinados a material de prueba y diagnóstico.
