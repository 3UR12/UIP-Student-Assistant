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
- **Extension:** in `edge://extensions` or `chrome://extensions`, use the extension card to reload the package and inspect any reported manifest errors. v0.1.0 has no service worker.
- **Manifest errors:** reload the extension from its card after source changes and read the error text shown on that card.

The extension has no automated authenticated test because it must not receive or store a user's Moodle session. Run the static validation commands below before a manual test.

```powershell
Get-ChildItem extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json')); console.log('manifest JSON valid')"
node tests/core-smoke.test.js
```
