# Security and privacy

UIP Student Assistant v0.1.0 is a read-only, local DOM scanner.

## What it does not do

- It never asks for, stores, reads, or transmits credentials.
- It does not read cookies, tokens, `sesskey`, login form values, private messages, avatars, or full Moodle HTML.
- It does not submit forms, click controls, set options, complete activities, navigate pages, or modify Moodle data.
- It does not use `fetch`, external services, AI APIs, analytics, telemetry, a backend, cloud storage, or a database.
- It does not take screenshots or save scans locally.

The browser's normal Moodle session renders the page. The extension inspects visible structural metadata from that rendered DOM only after the user presses the scan button. Results live only in the popup while it is open.

## Manifest permissions

| Permission | Reason |
| --- | --- |
| `https://moodle.uip.edu.pa/*` host permission | Limits the passive content bridge to Moodle UIP and lets it receive the requested scan message there. |

There are no API permissions, nor `<all_urls>`, cookie, storage, identity, webRequest, scripting, or clipboard manifest permissions. Clipboard writing uses the browser's popup user gesture when the user presses the copy button.

## Diagnostic export

`sanitizeDiagnostic` is an explicit allow-list step run before display and before copying. It permits only scanner metadata, structural course/module/activity fields, moodle.uip.edu.pa URLs stripped to their `id` query parameter, fixed error messages, and limited text labels. It excludes session/cookie/token data, form values, raw HTML, and page text. Email-shaped text is redacted defensively.

Do not add real Moodle captures, copied diagnostics, screenshots, or student data to the repository. `.gitignore` excludes the local directories intended for such material.
