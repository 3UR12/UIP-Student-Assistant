# Security and privacy

UIP Student Assistant v0.4.0 is a local DOM scanner with limited Feedback radio-prefill, controlled submission, controlled Continue actions, and a controlled multi-module workflow.

## What it does not do

- It never asks for, stores, reads, or transmits credentials.
- It does not read cookies, tokens, `sesskey`, login form values, private messages, avatars, or full Moodle HTML.
- It does not write text, fabricate requests, or modify Moodle outside the response form currently open. With an explicit popup action it may set only compatible unanswered radios. Only after a separate review and confirmation may it click one visible, enabled, uniquely identified Moodle `type=submit` control in that same revalidated form. A detected Moodle Continue anchor or GET form-submit control similarly needs its own explicit, revalidated action; hidden form fields are never inspected.
- It does not use `fetch`, external services, AI APIs, analytics, telemetry, a backend, cloud storage, or a database.
- It does not take screenshots or save scans locally.

The browser's normal Moodle session renders the page. The extension inspects visible structural metadata only after the user presses the scan button. v0.4 may keep a single active workflow only in `chrome.storage.session`: version, active flag, course ID, selected rating, ordered `{id, url, name, status}` sections, and current section ID. It explicitly discards signatures, answers, hidden values, tokens, raw DOM, and every unlisted field before saving or using a stored value. It never uses `chrome.storage.local`.

## Manifest permissions

| Permission | Reason |
| --- | --- |
| `https://moodle.uip.edu.pa/*` host permission | Limits the passive content bridge to Moodle UIP and lets it receive the requested scan message there. |
| `storage` | Persists only the allow-listed active workflow in `chrome.storage.session` for the current browser session. |

There are no permissions for `<all_urls>`, cookies, identity, webRequest, scripting, or `storage.local`. Clipboard writing uses the browser's popup user gesture when the user presses the copy button.

## Diagnostic export

`sanitizeDiagnostic` is an explicit allow-list step run before display and before copying. It permits only scanner metadata, safe Feedback submission readiness, result state, and structural navigation metadata; Moodle URLs are stripped to their `id` parameter. It excludes form signatures, hidden inputs, radio values, text-input values, session/cookie/token data, form actions, raw HTML, and page text. Email-shaped text is redacted defensively.

Do not add real Moodle captures, copied diagnostics, screenshots, or student data to the repository. `.gitignore` excludes the local directories intended for such material.
