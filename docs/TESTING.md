# Manual testing

An authenticated Moodle UIP session is required for meaningful real-world validation. The repository contains no real Moodle data or captures.

## Load the extension

1. Open `edge://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select this repository's `extension` folder.
5. Confirm that no manifest error is shown.
6. Open `https://moodle.uip.edu.pa/` and sign in normally; the extension never supplies login details.

## Scan paths

1. Go to **Área personal** (`/my/`) and select **Escanear página actual**. Confirm its page type and only the currently rendered course cards are reported.
2. Open one course (`/course/view.php?id=…`) yourself and scan again. Confirm visible sections and activities are summarized.
3. Open a module/section (`/course/section.php?id=…`) yourself and scan again. Confirm the result remains stable even where states are unknown.
4. Open a Feedback activity yourself (`/mod/feedback/…`) and scan. Confirm it is recognized, without any form change or submission.
5. Where a section contains multiple Feedback activities, confirm each appears in the detail JSON separately.
6. Select **Copiar diagnóstico sanitizado**, paste it into a local text editor, and verify it has no raw HTML, cookies, `sesskey`, tokens, login fields, messages, or student profile data.
7. Open a non-Moodle tab and scan; the popup should say that it is not on Moodle.

## Developer tools

- **Popup:** on the extension card, select **Inspect views** next to the popup while it is open; alternatively right-click inside the popup and choose Inspect.
- **Moodle content script:** open Moodle, press `F12`, and use the page's **Console**. Content-script errors are associated with that page's extension context.
- **Feedback inspection (first v0.3 real test):** manually open `/mod/feedback/complete.php?id=…`, scan, preselect a visible rating, and confirm **Listo para enviar** with the expected counts. Copy the sanitized diagnostic and inspect the detected submit metadata. Do not select **Confirmar y enviar** during this first test.
- **Controlled submit (only after diagnostic review):** select **Revisar envío**, verify the confirmation counts, then use **Confirmar y enviar** only for one intentionally controlled test. Reopen the popup and scan after Moodle navigates; do not treat the click itself as success.
- **Continue:** if a result page exposes **Continuar**, select **Revisar navegación** and use the separate Continue button only after confirming its detected type, path, and GET method. Moodle may expose this action as a form button without a visible destination ID; do not infer one.
- **Extension:** in `edge://extensions` or `chrome://extensions`, use the extension card to reload the package and inspect any reported manifest errors. v0.3.0 has no service worker.
- **Manifest errors:** reload the extension from its card after source changes and read the error text shown on that card.

The extension has no automated authenticated test because it must not receive or store a user's Moodle session. Run the static validation commands below before a manual test.

```powershell
Get-ChildItem extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json')); console.log('manifest JSON valid')"
node tests/core-smoke.test.js
```
