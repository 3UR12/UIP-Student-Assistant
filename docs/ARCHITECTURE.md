# Architecture

## Boundaries

`extension/core/` is the generic scanner. Its modules accept a DOM `Document`, use only standard browser DOM APIs, and publish a structured result through `UIPScannerCore`. They do not reference `chrome`, browser storage, network APIs, credentials, or UI elements.

`extension/content/content.js` is a thin, passive integration layer. It scans only after the popup sends an explicit message. `extension/popup/` presents the result and copies only an allow-listed diagnostic. v0.1.0 does not need a background service worker.

The generic core is stored inside `extension/` rather than at repository root because Chromium's **Load unpacked** operation treats the selected `extension/` directory as the extension package and cannot load scripts from its parent directory. This retains the core/extension code boundary without copying source files or adding a bundler.

## Scan flow

```text
User selects Scan in popup
        ↓
Popup sends message to active tab
        ↓
Passive content bridge calls core.scanDocument(document)
        ↓
Core identifies page → extracts visible DOM metadata → records safe errors
        ↓
Popup renders a summary or sanitizes the allow-listed diagnostic for copying
```

No step navigates Moodle, changes a form, or persists the scan result.

## Detection approach

URLs identify core page types first. Stable Moodle-oriented anchors, data attributes, classes, and semantic containers provide secondary extraction. Activity type comes from `/mod/<type>/` in its URL, so Feedback detection is independent of translated or teacher-authored activity labels. A page with unfamiliar DOM is allowed to yield empty lists and `unknown` values.
