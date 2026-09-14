# Moodle UIP Flow Assumptions

The v0.5 processor follows the normal Moodle route using one background-owned worker tab. The user signs in normally; the extension does not supply credentials or attempt a login.

1. On `/my/courses.php`, the content script observes canonical visible course links currently rendered by Moodle across its known course regions and the document fallback. If that primary page settles empty or redirects, the background may use `/my/` once as a fallback. It stores only observed course IDs, names, and canonical course URLs for dashboard selection.
2. The background navigates the worker to an explicitly selected `/course/view.php?id=…`. The content script reports only modules rendered in Moodle's scoped course content. Availability is preserved as observed, not guessed.
3. The engine navigates each selected `/course/section.php?id=…`, rechecks that exact section and scans its visible Feedback activities.
4. A completed, unavailable, unknown, or unsupported Feedback becomes a safe recorded outcome. An incomplete, available Feedback may proceed to its observed `/mod/feedback/view.php?id=…` route.
5. The Feedback view must expose either a verified submitted result or one structurally valid response URL. The response form must expose compatible question options for the selected exact rating.
6. Before submit, the content script re-inspects the form signature, question count, supported controls, and uniquely visible enabled Moodle submit control. The background then waits for fresh Moodle post-submit evidence.
7. Once a Moodle result verifies the submission, the engine records that Feedback and rechecks the original section. A Feedback already marked submitted in the run is never scheduled again.
8. A visible Continue action is used only when Moodle exposes a unique validated link or GET form control. Otherwise the worker returns directly to the known section URL and rechecks there.

Moodle themes, availability rules, course layouts, and Feedback wording can vary. The scanner treats route paths and DOM structure as evidence, not guarantees. If any expected evidence is absent or inconsistent, the workflow pauses or marks the smallest affected item manual-required; it never invents a route, a completion state, or a submission result.
