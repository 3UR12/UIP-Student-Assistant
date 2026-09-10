# UIP Student Assistant

UIP Student Assistant is a small browser extension for inspecting the Moodle UIP page the student already has open. Version 0.3.0 adds a Controlled Feedback Navigator: it can inspect a fully understood Feedback form, require a second explicit confirmation, and activate Moodle's single validated submit control.

It does not log anyone in, fabricate requests, use a backend, or send data anywhere except through Moodle's real visible submit control after two explicit popup actions. It never auto-submits or auto-navigates; the student opens the form, reviews it, confirms submission, and separately confirms any detected Continue link.

## Current scope

The extension works on `https://moodle.uip.edu.pa/*` and scans only the active page when the user selects **Escanear página actual** in the popup. On `/mod/feedback/complete.php`, it can preselect compatible unanswered radios, then permits the real Moodle submit control only when every supported radio is answered, no manual control exists, and the form and submit control pass a fresh revalidation. Post-submit completion is reported only after a later scan observes evidence. Detection is intentionally conservative: unknown or unproven states remain `null` or `unknown` rather than being guessed.

## Development installation

1. Clone this repository and switch to `feature/v0.1-scanner` (or the branch under review).
2. Open `edge://extensions` (or `chrome://extensions`).
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the [`extension`](extension) folder.
5. Sign in to Moodle UIP normally, open a Moodle page, open the extension popup, and select **Escanear página actual**.

See [docs/TESTING.md](docs/TESTING.md) for the complete manual test procedure.

## Privacy

The scanner uses the browser's existing Moodle session only to read the rendered DOM. The Feedback Assistant reads only scoped radio option labels/values needed for local preselection; it does not access passwords, cookies, tokens, hidden fields, text responses, private messages, or full page HTML. Results and the selected preference remain in popup memory only. Diagnostic JSON is explicitly sanitized before it can be copied. There are no analytics, external requests, databases, or servers. Details are in [docs/SECURITY.md](docs/SECURITY.md).

## Architecture

The browser-independent scanner lives in [`extension/core`](extension/core); it receives a `Document` and returns a structured result. [`extension`](extension) contains the Manifest V3 integration, passive content script, and popup. This separation keeps the Moodle analysis portable for a future Android implementation.

Further design notes: [architecture](docs/ARCHITECTURE.md) and [Moodle flow](docs/MOODLE-FLOW.md).

## Roadmap

- v0.1 — Moodle Scanner
- v0.2 — Feedback Assistant
- v0.3 — Controlled Feedback Navigator
- v0.4 — Multi-course Processor
- v0.5 — Android Prototype

The roadmap is directional; later versions are not implemented or promised by this repository.

## License

The repository is private and no license has been selected. See [docs/LICENSE-DECISION.md](docs/LICENSE-DECISION.md) before adding one.
