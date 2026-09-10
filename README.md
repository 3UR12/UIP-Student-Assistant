# UIP Student Assistant

UIP Student Assistant is a small, read-only browser extension for inspecting the Moodle UIP page the student already has open. Version 0.1.2 is a scanner: it identifies the current Moodle page and, where the visible DOM permits it, summarizes courses, sections, activities, and Moodle Feedback activities.

It does not log anyone in, submit forms, click Moodle controls, change Moodle data, use a backend, or send data anywhere.

## Current scope

The extension works on `https://moodle.uip.edu.pa/*` and scans only the active page when the user selects **Escanear página actual** in the popup. Detection is intentionally conservative: unknown or unproven availability/completion states remain `null` or `unknown` rather than being guessed. It does not navigate to courses or load unpublished dashboard items.

## Development installation

1. Clone this repository and switch to `feature/v0.1-scanner` (or the branch under review).
2. Open `edge://extensions` (or `chrome://extensions`).
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the [`extension`](extension) folder.
5. Sign in to Moodle UIP normally, open a Moodle page, open the extension popup, and select **Escanear página actual**.

See [docs/TESTING.md](docs/TESTING.md) for the complete manual test procedure.

## Privacy

The scanner uses the browser's existing Moodle session only to read the rendered DOM. It does not access passwords, cookies, tokens, form values, private messages, or full page HTML; it keeps results in popup memory only. Diagnostic JSON is explicitly sanitized before it can be copied. There are no analytics, external requests, databases, or servers. Details are in [docs/SECURITY.md](docs/SECURITY.md).

## Architecture

The browser-independent scanner lives in [`extension/core`](extension/core); it receives a `Document` and returns a structured result. [`extension`](extension) contains the Manifest V3 integration, passive content script, and popup. This separation keeps the Moodle analysis portable for a future Android implementation.

Further design notes: [architecture](docs/ARCHITECTURE.md) and [Moodle flow](docs/MOODLE-FLOW.md).

## Roadmap

- v0.1 — Moodle Scanner (this release)
- v0.2 — Feedback Assistant
- v0.3 — Multi-course Processor
- v0.4 — Activities Dashboard
- v0.5 — Android Prototype

The roadmap is directional; later versions are not implemented or promised by this repository.

## License

The repository is private and no license has been selected. See [docs/LICENSE-DECISION.md](docs/LICENSE-DECISION.md) before adding one.
