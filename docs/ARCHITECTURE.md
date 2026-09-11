# Architecture

## Boundaries

`extension/core/` is the generic scanner. Its modules accept a DOM `Document`, use only standard browser DOM APIs, and publish a structured result through `UIPScannerCore`. They do not reference `chrome`, browser storage, network APIs, credentials, or UI elements.

`extension/content/content.js` is a thin integration layer. It separates scan, prefill, submission inspection, real-submit activation, navigation inspection, Continue activation, and workflow-anchor inspection/activation into distinct messages. `extension/popup/` presents the result, preview, two-step submission confirmation, and copies only an allow-listed diagnostic. `background/workflow-service.js` is the sole Chrome-storage owner and uses `chrome.storage.session` for an allow-listed, ephemeral plan; the popup communicates with it only through workflow messages.

`extension/core/feedback-form.js` owns Feedback `complete.php` detection, scoped question inspection, exact-label matching, preview generation, and local radio prefill. `submission.js` re-inspects the same form and permits only one visible, enabled, in-form `type=submit` control. `navigation.js` identifies safe Moodle Continue anchors or visible GET form-submit controls, plus structural previous/next section links. `workflow-navigation.js` is also pure: it validates a workflow plan, classifies only scanned Feedback evidence, and revalidates one visible real Moodle anchor for section, Feedback, response-form, or breadcrumb navigation. These modules have no Chrome APIs.

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

The popup runs one refresh pipeline with an epoch: it requests the current DOM scan and workflow state in parallel, waits for both with bounded timeouts, reconciles a matching SECTION before rendering, then paints once. An absent workflow is distinct from a storage error, and stale results cannot replace a later refresh. The service worker sanitizes every save, performs a read-after-write verification, and is the only code that touches session storage. Storage never authorizes navigation: a verified save is required before a section transition, and the current DOM must then provide one visible, unrestricted, same-origin anchor with the exact target ID. The content script reinspects it immediately before `click()`. On an already-open Feedback `complete.php` page, explicit prefill may set compatible unanswered radio controls and dispatch `input`/`change`. A separate review and confirmation sequence may invoke `click()` only on the revalidated real submit control. Neither path uses `submit`, `requestSubmit`, `fetch`, or manual navigation.

## Detection approach

URLs identify core page types first. Stable Moodle-oriented anchors, data attributes, classes, and semantic containers provide secondary extraction. Activity type comes from the canonical `/mod/<type>/view.php?id=<cmid>` URL, so action endpoints such as `complete.php` and auxiliary plugin pages are not separate activities. Activity identity is `type:cmid`; a semantic Moodle activity name is preferred over action-link text.

Scanning is page-aware. The dashboard never scans modules; course scans use the outer main region before a nested course-content region; section scans use the current Moodle section and fall back to that outer main region when Moodle omits a self wrapper; and a Feedback page produces one read-only `feedbackPage` context, including an optional detected response URL. Navigation, drawers, sidebars, breadcrumbs, footers, and auxiliary blocks are excluded. When a safe content scope cannot be found, the scanner returns an empty relevant collection rather than scanning the full document.

Each scan carries the content-script scanner version. The popup rejects a result from a different scanner version and asks the user to reload the Moodle tab, preventing a stale injected script from being presented as a valid scan.

Course labels are kept as the observed `rawName`; `displayName` remains `null` unless a future version has reliable display-name evidence. No UIP-specific course-name parsing is performed.
