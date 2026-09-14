# Changelog

Los cambios importantes de UIP Student Assistant se documentan en este archivo.

El proyecto continúa en fase beta y todavía no sigue un esquema formal de releases públicas.

---

## 0.5.0 — Automated Multi-Module Feedback Processor

### Añadido

- Dashboard persistente para configuración y seguimiento del recorrido.
- Descubrimiento automático de materias desde Moodle My Courses con fallback controlado.
- Descubrimiento automático de módulos.
- Worker Moodle dedicado para no interrumpir pestañas personales del usuario.
- Máquina de estados automática para recorrer módulos y Feedback sin pasos manuales intermedios.
- Selección de materia, módulos y valoración con una única confirmación antes de comenzar.
- Prefill automático de respuestas compatibles.
- Verificación previa al submit y verificación post-submit.
- Continue automático después de un envío confirmado.
- Manejo de múltiples Feedback por módulo.
- Manejo de módulos bloqueados/no disponibles.
- Pausa, reanudación, cancelación y recuperación tras login.
- Watchdog y navegación acotada para evitar loops infinitos.
- Historial de actividad y progreso visible en el dashboard.
- Soporte para iniciar un segundo recorrido después de completar el primero.
- Packaging local mediante PowerShell.
- Workflow manual de GitHub Actions para generar el ZIP de la extensión.

### Correcciones relevantes durante UAT

- Eliminado el flujo manual de scan → navegación → scan de v0.4.
- Persistencia del workflow movida al background service worker.
- Corregida pérdida de workflow durante la hidratación del dashboard.
- Corregidos scans descartados durante transiciones concurrentes.
- Corregida recuperación del watchdog tras restart del service worker.
- Corregido rebind de la pestaña worker después de cierre.
- Corregido manejo de redirect `SECTION → COURSE` con módulos no disponibles.
- Corregida deduplicación entre transiciones distintas.
- Corregido discovery que reiniciaba `/my/` durante polling del dashboard.
- Añadido settlement del DOM con `MutationObserver` para contenido cargado de forma asíncrona.
- Descubrimiento de materias movido a `/my/courses.php` como fuente primaria.
- Corregido `ReferenceError` del dashboard después de `modules-ready`.
- Corregido estado `disabled` persistente de `Ejecutar recorrido` entre recorridos consecutivos.

### Validación

- Scanner y discovery cubiertos por pruebas de regresión.
- E2E automatizado repetido.
- Stress de event pump, redirects y discovery.
- UAT autenticada real en Moodle UIP con recorrido funcional.

---

## 0.4.0 — Controlled Multi-Module Processor

- Plan de módulos persistido en sesión.
- Navegación controlada entre curso, sección y Feedback.
- Flujo todavía dependiente de interacción manual entre pasos.

---

## 0.3.0 — Controlled Feedback Navigator

- Submit controlado y revalidado.
- Verificación post-submit.
- Continue seguro en Moodle.

---

## 0.2.0 — Feedback Assistant

- Inspección del formulario editable.
- Detección de opciones comunes.
- Prefill explícito sin submit automático.

---

## 0.1.x — Moodle Scanner

- Detección de Área personal, cursos, módulos, actividades y Feedback.
- Lectura no destructiva del DOM de Moodle UIP.
