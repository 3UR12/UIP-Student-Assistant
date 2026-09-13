# Security And Privacy

UIP Student Assistant v0.5.0 is a local, background-owned Moodle workflow. It can execute a single user-confirmed sequence of revalidated Feedback actions, but it does not authenticate, fabricate requests, or communicate with any system outside Moodle UIP.

## What It Does Not Do

- It never asks for, stores, reads, or transmits credentials.
- It does not use cookies, tokens, `sesskey`, login form values, private messages, avatars, screenshots, or raw Moodle HTML.
- It does not call `fetch`, XHR, remote APIs, AI services, analytics, telemetry, a backend, cloud storage, or a database.
- It does not use `form.submit()`, `requestSubmit()`, arbitrary script injection, or arbitrary URLs.
- It does not use `chrome.storage.local` or retain workflow state after the browser session ends.

The browser's normal Moodle session renders the page. The content script reports scoped structural metadata when Moodle reaches a page; the background service decides the next allow-listed effect. Every form prefill, submit, or Continue click is re-inspected immediately before it is activated.

## Persisted Data

`chrome.storage.session` contains only sanitized workflow and discovery metadata: version, run ID, status/phase, worker tab ID, canonical Moodle IDs and URLs, truncated course/module names, selected rating, per-module outcome counts, retry state, and a safe error reason. It excludes DOM fragments, hidden inputs, response values, form signatures, tokens, cookies, credentials, message content, and diagnostics. Every workflow write is sanitized and verified by an immediate read-back.

## Manifest Permissions

| Permission | Reason |
| --- | --- |
| `https://moodle.uip.edu.pa/*` host permission | Limits the passive Moodle content bridge and executor to UIP Moodle. |
| `storage` | Keeps allow-listed discovery and workflow metadata only for the browser session. |
| `alarms` | Wakes a bounded watchdog to re-scan one stalled run safely. |

There are no permissions for `<all_urls>`, cookies, identity, webRequest, scripting, downloads, notifications, or clipboard APIs.

## Failure Handling

Missing evidence does not grant permission to act. Wrong course, stale form, missing submit control, unsupported question, closed worker tab, unexpected route, timeout, or expired Moodle session results in pause, retry-once, or manual-required status. A submission is counted only after a later Moodle result scan verifies it, and a verified Feedback ID is excluded from future scheduling in that run.

Do not add real Moodle captures, copied diagnostics, screenshots, or student data to the repository. `.gitignore` excludes the local directories intended for such material.
