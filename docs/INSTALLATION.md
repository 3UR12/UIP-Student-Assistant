# Instalación de UIP Student Assistant

UIP Student Assistant se distribuye actualmente como una extensión **unpacked** para Microsoft Edge y Google Chrome.

No está publicada todavía en Chrome Web Store ni Microsoft Edge Add-ons.

---

## Requisitos

- Microsoft Edge o Google Chrome basado en Chromium.
- Acceso normal a Moodle UIP.
- Una sesión iniciada en `https://moodle.uip.edu.pa/`.
- La carpeta de la extensión o el ZIP generado desde este repositorio.

La extensión no necesita Python, Node.js, Docker ni ningún backend para ejecutarse en el navegador.

---

## Opción A — Instalar desde un ZIP compartido

Esta es la opción recomendada para compañeros que sólo quieren usar la extensión.

1. Recibe `UIP-Student-Assistant-v0.5.0.zip`.
2. Extrae el ZIP en una carpeta permanente, por ejemplo:

```text
C:\Users\TU_USUARIO\Documents\UIP-Student-Assistant-v0.5.0\
```

3. Comprueba que dentro de esa carpeta exista directamente:

```text
manifest.json
background/
content/
core/
dashboard/
```

No selecciones una carpeta superior que sólo contenga otra carpeta con esos archivos.

---

## Microsoft Edge

1. Abre:

```text
edge://extensions
```

2. Activa **Modo para desarrolladores**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona la carpeta extraída donde se encuentra `manifest.json`.
5. UIP Student Assistant aparecerá en la lista de extensiones.
6. Opcional: abre el menú de extensiones y fija UIP Student Assistant en la barra del navegador.

---

## Google Chrome

1. Abre:

```text
chrome://extensions
```

2. Activa **Modo de desarrollador / Developer mode**.
3. Pulsa **Cargar descomprimida / Load unpacked**.
4. Selecciona la carpeta extraída donde se encuentra `manifest.json`.
5. Opcional: fija la extensión en la barra del navegador.

---

## Primer uso

1. Inicia sesión en Moodle UIP normalmente.
2. Pulsa el icono de **UIP Student Assistant**.
3. La extensión abrirá su dashboard y preparará una pestaña Moodle dedicada para trabajar.
4. Espera a que aparezcan tus materias.
5. Selecciona una materia.
6. Espera a que aparezcan sus módulos.
7. Selecciona los módulos que deseas procesar.
8. Selecciona una valoración.
9. Pulsa **Procesar N módulos**.
10. Revisa la confirmación y pulsa **Ejecutar recorrido**.

A partir de la confirmación, el recorrido debe continuar automáticamente hasta terminar o encontrar un caso que requiera revisión manual.

---

## No necesitas preparar Moodle manualmente

No es necesario colocarte previamente en:

- Área personal;
- Mis cursos;
- una materia;
- un módulo;
- una encuesta.

UIP Student Assistant utiliza una pestaña Moodle dedicada y navega automáticamente hacia las rutas necesarias.

---

## Actualizar la extensión

Cuando recibas una versión nueva:

1. Reemplaza la carpeta anterior por la nueva carpeta extraída.
2. Abre `edge://extensions` o `chrome://extensions`.
3. Pulsa **Volver a cargar / Reload** en UIP Student Assistant.

Si cambiaste la ubicación de la carpeta por completo y el navegador reporta un error, elimina la extensión y vuelve a cargar la nueva carpeta como unpacked.

---

## Desinstalar

En `edge://extensions` o `chrome://extensions` pulsa **Quitar / Remove**.

El estado de los recorridos se almacena únicamente en `chrome.storage.session`, por lo que no existe una base de datos externa ni una cuenta independiente que borrar.

---

## Problemas comunes

### No aparecen materias

- Confirma que tu sesión de Moodle sigue activa.
- Espera a que finalice el estado de carga.
- Usa **Actualizar materias** una sola vez si es necesario.
- Si aparece **Necesitas iniciar sesión en Moodle**, pulsa **Abrir Moodle**, inicia sesión normalmente y vuelve al dashboard.

### No aparecen módulos

- Espera a que la materia termine de cargar.
- Algunos cursos pueden tener secciones bloqueadas o todavía no disponibles.

### El recorrido se pausa

El dashboard debe indicar el motivo. Los casos no verificables se dejan para revisión manual en lugar de intentar acciones dudosas.

### El navegador muestra “Errores” en la extensión

Anota el mensaje y la etapa del dashboard. Para depuración, abre **Detalles técnicos** y comparte únicamente el diagnóstico sanitizado; no compartas cookies, credenciales ni datos privados de Moodle.

---

## Compatibilidad actual

| Entorno | Estado |
|---|---|
| Microsoft Edge Chromium | Compatible |
| Google Chrome Chromium | Compatible |
| Manifest V3 | Sí |
| Moodle UIP | Objetivo actual |
| Firefox | No soportado actualmente |
| Safari | No soportado actualmente |

---

## Seguridad

UIP Student Assistant usa la sesión que ya está iniciada en Moodle. No solicita ni almacena usuario, contraseña, cookies, tokens, `sesskey` ni contenido HTML completo.
