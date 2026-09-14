# v0.5 Test Runbook

An authenticated Moodle UIP session is required for a real validation. This repository has no Moodle credentials, data captures, or automated authenticated test. Use a controlled course and Feedback activity when possible.

## Install

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable **Developer mode** and select **Load unpacked**.
3. Choose this repository's `extension` directory.
4. Confirm no manifest error appears and sign into Moodle normally.
5. Select the extension icon. It opens `dashboard/dashboard.html`; no popup should open.

## Automated Checks

Run these from the repository root:

```powershell
Get-ChildItem extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json')); console.log('manifest JSON valid')"
node tests/core-smoke.test.js
node tests/my-courses-discovery.test.js
node tests/automation-engine.test.js
node tests/workflow-service.test.js
node tests/dashboard-ux.test.js
node tests/automation-e2e.test.js --repeat=20
node tests/lifecycle-idempotency.test.js
node tests/recovery-service-worker.test.js
node tests/event-pump-race.test.js --repeat=50
node tests/blocked-section-redirect.test.js --repeat=50
node tests/discovery-lifecycle.test.js --repeat=50
node tests/discovery-settlement-content.test.js
```

`core-smoke.test.js` retains scanner regression checks, including visible Moodle warning extraction. `my-courses-discovery.test.js` verifies My Courses recognition, multi-scope extraction, valid cards in an aside, navigation exclusions, document fallback, and safe counters. The retired v0.4 popup-hydration test was intentionally removed because popup orchestration no longer exists. `automation-engine.test.js` covers state transitions, login, timeout, pause, cancel, duplicate-submission protection, activity metadata, and storage sanitization. `workflow-service.test.js` covers the MV3 message boundary, discovery, exclusion of unnamed general sections, persisted run creation, alarms, dashboard closure, worker-tab rebinding, and duplicate page-ready/tab events with a deterministic Chrome mock. `dashboard-ux.test.js` enforces the dashboard's visible state/control contract. `automation-e2e.test.js --repeat=20` simulates a two-module fully automatic run twenty times, including a worker-tab close/rebind/resume run. `lifecycle-idempotency.test.js` covers restart boundaries, duplicate events, worker loss, login recovery, and bounded watchdog behavior. `recovery-service-worker.test.js` proves that a restarted service worker re-arms its watchdog, survives a missing initial scan, and reuses an already-open dashboard tab. `event-pump-race.test.js --repeat=50` reproduces post-submit Moodle completion arriving while prefill/submit is still active, with synthetic jitter and no watchdog recovery. `blocked-section-redirect.test.js --repeat=50` simulates course 8169 redirecting Módulo #2 to the course with “no disponible”, verifies that the module is blocked and omitted, confirms same-DOM coalescing only within one transition, and asserts the two-navigation recovery cap. `discovery-lifecycle.test.js --repeat=50` simulates primary My Courses discovery, async cards, a one-time dashboard fallback after a terminal empty primary scan, stale observers, stale-while-revalidate, login, and timeout. `discovery-settlement-content.test.js` proves the bounded content-script `MutationObserver` emits a terminal discovery event only after async cards appear.

## Dashboard Discovery

1. Open the dashboard while logged out. Select **Actualizar materias** and confirm the screen asks you to sign into Moodle instead of showing fabricated courses.
2. Sign in, reopen the dashboard, and update courses. Confirm the listed names match visible Moodle course cards.
3. Choose one course. Confirm Moodle opens that exact course and the dashboard displays only its observed modules.
4. Confirm locked, unavailable, or unknown modules cannot be selected.
5. Select two available modules, choose a rating, open the confirmation panel, and verify the course, module count, and exact rating. Cancel once and confirm nothing navigates or submits.

## Controlled Run

1. Start with one known low-risk module. Confirm the running view identifies the current module and phase.
2. Test **Pausar** while Moodle is navigating. Confirm the dashboard changes to Paused only at the next safe scan boundary.
3. Test **Reanudar**. Confirm the worker returns to the observed section rather than using a guessed URL.
4. Test **Cancelar**. Confirm the run is terminal and no later navigation or submission occurs.
5. Start a fresh one-module run containing a known incomplete Feedback. Observe the exact sequence: section, Feedback, form, prefill, submit, Moodle confirmation, recheck section.
6. Confirm a Feedback counts as submitted only after Moodle visibly presents a verified result. Refresh or reopen the dashboard after completion and confirm it never schedules that Feedback again.
7. Test a section with no Feedback, a completed Feedback, an unavailable Feedback, and an unsupported form. Confirm each is counted and none is silently submitted.
8. Open a section that Moodle redirects to the parent course with a visible “Módulo#N no disponible” notice. Confirm the dashboard records **No disponible**, moves to the next selected module, and does not retry that section repeatedly.
9. From an empty dashboard, wait for Moodle to load the course list and confirm it opens `/my/courses.php` first. If that page settles empty, it may use `/my/` once as the only fallback. During **Actualizar materias**, the existing list must remain visible; if Moodle requests login or times out, use the visible **Abrir Moodle** or **Reintentar** action instead of expecting automatic retries.

## Recovery And Safety

1. During a run, sign out of Moodle or let the session expire. Confirm the dashboard shows **Necesitas iniciar sesión** and no hidden re-login is attempted.
2. Log in normally. Confirm resume continues only after the content script observes the renewed Moodle page.
3. Close the Moodle worker tab during a run. Confirm the workflow pauses with an actionable reason.
4. Reload the extension from its card while a run is active. Reopen the dashboard and confirm the session state is restored or safely requires attention; it must not duplicate a submission.
5. Open DevTools and verify the extension does not call `fetch`, `submit()`, `requestSubmit()`, or an arbitrary navigation API.
6. Inspect `chrome.storage.session` through the service-worker console. Confirm the workflow contains IDs, canonical URLs, state, counts, and minimal names only; no raw HTML, tokens, cookies, hidden fields, answers, or credentials.

## Developer Tools

- **Dashboard:** on the extension card choose **Inspect views** for the dashboard.
- **Service worker:** use the extension card's service-worker inspect link to view alarms, messages, and session storage.
- **Content script:** open Moodle DevTools. Page-specific content-script errors appear in that extension context.
- **Manifest:** reload the extension card after source changes. Check errors immediately before using Moodle.
