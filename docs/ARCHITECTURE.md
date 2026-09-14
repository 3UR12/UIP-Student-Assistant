# Architecture: v0.5 Automated Multi-Module Feedback Processor

## Boundaries

`extension/core/` is the browser-independent Moodle scanner. It accepts a DOM `Document`, returns structured observed state, and does not reference Chrome APIs, storage, network APIs, credentials, or UI.

`extension/content/content.js` is the Moodle executor. On every page it emits `UIP_MOODLE_PAGE_READY` with a structured scan and scanner version. It receives a narrow allow-list of actions: scan, inspect, prefill compatible radio questions, click one revalidated visible submit control, and activate a revalidated Continue action. It never owns the workflow or persistent state.

`extension/background/automation-engine.js` is a pure state machine. It validates canonical Moodle URLs, creates safe workflow state, decides the next effect, and never touches Chrome or DOM APIs. It models discovery, ready, running, paused, login-required, done, cancelled, error, and per-module outcomes.

`extension/background/workflow-service.js` is the Manifest V3 owner. It persists allow-listed state in `chrome.storage.session`, owns the Moodle worker tab, schedules the watchdog alarm, serializes DOM effects, and exposes the dashboard message API. A read-after-write check protects every workflow-state transition.

`extension/dashboard/` is a persistent extension page opened from the action icon. It displays setup, one final confirmation, live progress, terminal summary, and pause/recovery controls. It never clicks Moodle controls or writes workflow state directly.

Course discovery has a separate persisted lifecycle: `idle`, `loading-courses`, `courses-ready`, `loading-modules`, `modules-ready`, `login-required`, or `error`, with a request ID, worker-tab ID, settlement marker, start time, source, fallback flag, and safe extraction counters. Dashboard state refreshes are read-only and single-flight. Only the one-time dashboard bootstrap and an explicit user update action can start discovery. The service coalesces concurrent requests, retains known courses while refreshing, opens `/my/courses.php` as the primary source, and uses `/my/` only once when the primary source settles empty or redirects. A persisted timeout ends a missing response rather than retrying indefinitely.

`UIP_MOODLE_PAGE_READY` means only that Moodle rendered a route. For an empty My Courses, dashboard, or course scan, the service retains the loading state and asks the content script to start one bounded `MutationObserver`. Course extraction scans canonical visible `/course/view.php?id=` links across known Moodle regions and the document fallback, excluding only specific navigation and drawer regions. It emits `UIP_MOODLE_DISCOVERY_SETTLED` when observed items appear or after one final empty scan at its 10-second limit. The service accepts settlement only when its request ID, expected page, source, and worker tab still match; duplicate or stale observer messages are ignored.

## Execution Flow

```text
Dashboard configuration and one confirmation
        ↓
Background validates selected observed modules and persists READY_TO_START
        ↓
Background starts RUNNING and navigates its Moodle worker tab
        ↓
Content script emits page-ready scan
        ↓
Pure engine validates current state and produces one next effect
        ↓
Background executes that effect through the content script or tab navigation
        ↓
Fresh Moodle result scan proves completion, then the engine rechecks section
```

No effect is authorized by stale storage alone. Every operation is guarded by the current `runId` and transition counter, one origin, expected course/module/Feedback IDs, and the current rendered Moodle DOM.

## Event Pump

Moodle can emit a content-script page-ready message, a tab-complete event, and an action response while another transition is still resolving. The background service therefore uses a serialized scan pump instead of dropping scans behind a boolean lock. It coalesces identical observations only while one is active or pending in the current pump; it does not retain a historical fingerprint, so the same DOM can be evaluated again after the workflow advances. Each distinct DOM state stays queued and drains after the current effect completes. A prefill response includes its fresh scan; that scan is immediately enqueued for form verification rather than waiting for another navigation or watchdog alarm. The watchdog remains a fallback for genuinely missing observations, never the normal happy-path driver.

## State And Recovery

The workflow stores version, run ID, status/phase, worker tab ID, canonical course/module IDs and URLs, selected rating, module states, aggregate counts, safe last-event/retry metadata, a step timestamp, and a bounded activity log. Each log item contains only timestamp, safe action label, module/Feedback IDs, and observed names. It intentionally excludes DOM fragments, hidden fields, form values, submission bodies, tokens, cookies, diagnostics, and credentials.

At most one watchdog retry navigates to the expected safe route for a stalled section, Feedback, or form; a second timeout marks the current module manual-required and continues without repeating a verified submission. An unexpected route never triggers immediate repeat navigation. If Moodle redirects a selected section back to the same course and the visible page warning identifies it as unavailable, the engine requires either the full observed module name or a matching structured `Módulo#N` reference before recording it as `blocked`; a generic warning never skips a module. It then adds an activity entry and proceeds to the next selected module. Closing the worker tab pauses safely. Reopening Moodle binds and persists the new tab ID before Resume is allowed. A login page moves the run to `LOGIN_REQUIRED`; the extension never attempts authentication and can resume only after the normal Moodle session is visible again. The service worker restores the watchdog with the persisted workflow and requests a fresh scan when it wakes during an active run.

## API And Click Audit

The extension uses only `chrome.runtime`, `chrome.tabs`, `chrome.alarms`, and `chrome.storage.session`. It has no `fetch`, XHR, backend, remote endpoint, cookie API, or local persistence.

The only real Moodle clicks are inside `content.js` after a fresh exact match: compatible radio-option prefill dispatches `input` and `change`; a visible enabled submit control uses `click()`; a validated Continue anchor or GET form control uses `click()`. The extension does not invoke `form.submit()`, `requestSubmit()`, synthetic credential input, or arbitrary script injection.
