# Instalación de UIP Student Assistant

UIP Student Assistant es una extensión Manifest V3 compatible con Microsoft Edge y Google Chrome.

Actualmente se instala manualmente mediante **Cargar descomprimida / Load unpacked**.

---

## Requisitos

- Microsoft Edge o Google Chrome basado en Chromium.
- Acceso a Moodle UIP.
- Una sesión activa en `https://moodle.uip.edu.pa/`.
- El repositorio descargado o clonado localmente.

La extensión no requiere Python, Node.js, Docker, un backend ni servicios externos para ejecutarse en el navegador.

---

## Descargar desde GitHub

### Opción 1 — Download ZIP

1. Abre el repositorio en GitHub.
2. Pulsa **Code**.
3. Selecciona **Download ZIP**.
4. Extrae el archivo descargado.
5. Localiza la carpeta:

```text
UIP-Student-Assistant/extension/
```

Esa es la carpeta que debe cargarse en el navegador. `manifest.json` debe quedar directamente dentro de ella.

### Opción 2 — Git

```powershell
git clone https://github.com/3UR12/UIP-Student-Assistant.git
cd UIP-Student-Assistant
```

La extensión se encuentra en `extension/`.

---

## Microsoft Edge

1. Abre:

```text
edge://extensions
```

2. Activa **Modo para desarrolladores**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona la carpeta `extension/`.
5. Verifica que **UIP Student Assistant** aparezca habilitada.
6. Opcionalmente, fija la extensión en la barra del navegador.

---

## Google Chrome

1. Abre:

```text
chrome://extensions
```

2. Activa **Developer mode / Modo de desarrollador**.
3. Pulsa **Load unpacked / Cargar descomprimida**.
4. Selecciona la carpeta `extension/`.
5. Verifica que **UIP Student Assistant** aparezca habilitada.
6. Opcionalmente, fija la extensión en la barra del navegador.

---

## Primer uso

1. Inicia sesión normalmente en Moodle UIP.
2. Abre **UIP Student Assistant** desde el menú de extensiones.
3. Espera a que se carguen las materias disponibles.
4. Selecciona una materia.
5. Espera a que se carguen sus módulos.
6. Selecciona los módulos que deseas procesar.
7. Selecciona una valoración.
8. Pulsa **Procesar N módulos**.
9. Revisa la confirmación.
10. Pulsa **Ejecutar recorrido**.

La extensión administra una pestaña Moodle dedicada y navega automáticamente por las rutas necesarias. No es necesario abrir manualmente Área personal, Mis cursos, una materia, un módulo o una encuesta antes de iniciar.

---

## Actualizar la extensión

### Si utilizas Git

```powershell
git pull
```

Después abre `edge://extensions` o `chrome://extensions` y pulsa **Volver a cargar / Reload** en UIP Student Assistant.

### Si utilizas Download ZIP

1. Descarga la versión nueva del repositorio.
2. Extrae el contenido.
3. Sustituye la carpeta local anterior.
4. Pulsa **Volver a cargar / Reload** en la página de extensiones.

Si cambia la ubicación de la carpeta local y el navegador deja de reconocerla, elimina la extensión y vuelve a cargar `extension/` mediante **Cargar descomprimida**.

---

## Desinstalar

En `edge://extensions` o `chrome://extensions`, pulsa **Quitar / Remove**.

El estado de ejecución se almacena en `chrome.storage.session`; no existe una cuenta independiente ni una base de datos externa asociada a la extensión.

---

## Solución de problemas

### No aparecen materias

- Confirma que la sesión de Moodle continúe activa.
- Espera a que finalice el proceso de carga.
- Usa **Actualizar materias** una sola vez si es necesario.
- Si aparece **Necesitas iniciar sesión en Moodle**, abre Moodle, inicia sesión y vuelve al dashboard.

### No aparecen módulos

- Espera a que la materia termine de cargar.
- Algunos cursos pueden contener módulos bloqueados o no disponibles.

### El recorrido se pausa

El dashboard indica el motivo. Los elementos que no pueden verificarse de forma segura se dejan para revisión manual.

### El navegador muestra “Errores” en la extensión

Abre **Detalles técnicos** y revisa el diagnóstico sanitizado. No publiques cookies, credenciales ni información privada de Moodle al reportar un problema.

---

## Compatibilidad

| Entorno | Estado |
|---|---|
| Microsoft Edge Chromium | Compatible |
| Google Chrome Chromium | Compatible |
| Manifest V3 | Compatible |
| Moodle UIP | Plataforma objetivo |
| Firefox | No soportado actualmente |
| Safari | No soportado actualmente |

---

## Seguridad

UIP Student Assistant utiliza la sesión de Moodle ya iniciada en el navegador. No solicita ni almacena usuario, contraseña, cookies, tokens, `sesskey` ni HTML completo de las páginas.

Consulta [`SECURITY.md`](SECURITY.md) para detalles técnicos.
