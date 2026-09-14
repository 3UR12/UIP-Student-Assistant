# Compartir UIP Student Assistant

El repositorio es privado y todavía no existe una publicación en Chrome Web Store o Microsoft Edge Add-ons.

Por eso, la forma más práctica de compartir la extensión con otro estudiante es generar un ZIP de la carpeta `extension/` y enviarlo directamente.

---

## Opción recomendada — Generar ZIP con PowerShell

Desde la raíz del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

El script:

- lee automáticamente la versión desde `extension/manifest.json`;
- valida que exista `manifest.json`;
- crea `dist/` si no existe;
- genera un ZIP limpio con `manifest.json` en la raíz;
- no incluye tests, documentación, Git ni archivos privados del repositorio.

Resultado esperado:

```text
dist/UIP-Student-Assistant-v0.5.0.zip
```

---

## Qué enviar a otra persona

Envía únicamente:

```text
UIP-Student-Assistant-v0.5.0.zip
```

No es necesario compartir:

- el repositorio completo;
- `.git/`;
- tests;
- documentación técnica;
- capturas privadas;
- diagnósticos;
- archivos de Moodle.

---

## Instrucciones cortas para el receptor

Puedes copiar y enviar este texto junto con el ZIP:

> 1. Extrae el ZIP en una carpeta permanente.  
> 2. Abre `edge://extensions` o `chrome://extensions`.  
> 3. Activa el modo para desarrolladores.  
> 4. Pulsa **Cargar descomprimida / Load unpacked**.  
> 5. Selecciona la carpeta extraída donde está `manifest.json`.  
> 6. Inicia sesión normalmente en Moodle UIP.  
> 7. Abre UIP Student Assistant, selecciona materia, módulos y valoración, y confirma el recorrido.

---

## GitHub Actions

El repositorio incluye un workflow manual para empaquetar la extensión.

Desde GitHub:

1. Abre **Actions**.
2. Selecciona **Package browser extension**.
3. Pulsa **Run workflow**.
4. Espera a que termine.
5. Descarga el artifact generado.
6. Envía el ZIP al usuario final.

Los artifacts de un repositorio privado no son un enlace público de distribución. El propietario o un colaborador debe descargar el paquete y compartirlo por otro medio.

---

## Si se quiere una distribución más sencilla en el futuro

Hay tres niveles posibles:

### 1. ZIP manual

Es la opción actual. No requiere publicar el código ni pasar revisión de tiendas.

### 2. Release de GitHub

Adecuado si el repositorio se vuelve público o si los usuarios tienen acceso al repositorio. Permitiría adjuntar un ZIP versionado a cada release.

### 3. Chrome Web Store / Microsoft Edge Add-ons

Es la opción más simple para usuarios finales: instalar con un clic y recibir actualizaciones automáticas. Requiere preparar publicación, política de privacidad, iconografía, capturas, descripción de permisos y revisión de la tienda.

---

## Nota sobre licencia y redistribución

El repositorio todavía no tiene una licencia pública seleccionada. Compartir una copia con personas específicas para prueba o uso autorizado no equivale a publicar el código bajo una licencia open source.

Antes de hacer público el repositorio o permitir redistribución general, se debe elegir una licencia de forma explícita. Consulta `docs/LICENSE-DECISION.md`.

---

## Recomendación actual

Para las pruebas con amigos o compañeros:

```text
package-extension.ps1
→ enviar ZIP
→ instalar unpacked
→ probar
→ reportar captura del dashboard + estado de Moodle si ocurre un fallo
```

Es el flujo más simple sin exponer el repositorio privado ni añadir infraestructura innecesaria.
