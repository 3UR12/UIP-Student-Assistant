# UIP Student Assistant

## v0.5.0 Automated Multi-Module Feedback Processor

UIP Student Assistant is a Manifest V3 extension for the Moodle UIP site. It discovers the courses and modules that Moodle visibly renders, lets the student choose a course, modules, and one exact rating, then executes the confirmed Feedback route in a dedicated Moodle worker tab.

The v0.5 dashboard is a persistent extension page, not a popup. It is opened from the extension icon and remains useful while Moodle navigates. The background service worker owns the machine state, execution order, pause/resume/cancel controls, session recovery and watchdog. The content script only reports the current rendered Moodle state and executes narrowly scoped, revalidated DOM actions requested by the background owner.

## What It Does

- Discovers real Moodle courses and modules after login.
- Allows only observed, available modules to be selected.
- Requires one final confirmation showing the course, module count, and exact rating.
- Traverses the configured modules automatically and records Feedback as submitted, completed, unavailable, blocked, manual-required, or failed.
- Rechecks Moodle after submission before treating a Feedback as submitted.
- Pauses safely, resumes after a normal Moodle login, and never repeats a Feedback already verified in the current run.

## Safety Boundary

The extension never handles usernames, passwords, cookies, session keys, hidden inputs, raw HTML, arbitrary URLs, or custom network requests. It uses the browser's existing Moodle session and only sends messages to `https://moodle.uip.edu.pa/*`. Workflow metadata is stored only in `chrome.storage.session` and is allow-listed before every write. It does not use `storage.local`, analytics, remote APIs, a backend, `fetch`, `submit()`, or `requestSubmit()`.

An action is executed only after fresh page-state verification by the content script. If Moodle is not on the expected course, module, Feedback, or form, the run pauses or routes the item to manual review instead of guessing.

## Install For Development

1. Open `edge://extensions` or `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose the repository's [`extension`](extension) directory.
4. Sign into Moodle UIP normally.
5. Select the extension icon to open the dashboard, then choose **Actualizar materias** if the course list is not visible yet.

The dashboard can be closed during a run. The background workflow remains active for the browser session and the extension icon can reopen its current state.

## Verification

Run the dependency-free checks before loading an updated build:

```powershell
Get-ChildItem extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json')); console.log('manifest JSON valid')"
node tests/core-smoke.test.js
node tests/automation-engine.test.js
node tests/workflow-service.test.js
node tests/dashboard-ux.test.js
node tests/automation-e2e.test.js --repeat=20
node tests/lifecycle-idempotency.test.js
node tests/recovery-service-worker.test.js
node tests/event-pump-race.test.js --repeat=50
```

Read the [manual runbook](docs/TESTING.md), [architecture](docs/ARCHITECTURE.md), [Moodle workflow](docs/MOODLE-FLOW.md), and [security model](docs/SECURITY.md) before an authenticated validation.

## Version History

- v0.1: Moodle Scanner
- v0.2: Feedback Assistant
- v0.3: Controlled Feedback Navigator
- v0.4: Controlled Multi-Module Processor
- v0.5: Automated Multi-Module Feedback Processor

## License

The repository is private and no license has been selected. See [docs/LICENSE-DECISION.md](docs/LICENSE-DECISION.md) before adding one.
