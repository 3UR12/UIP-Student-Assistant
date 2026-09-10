# Moodle UIP flow assumptions

This scanner is designed around the normal, student-driven Moodle navigation flow:

1. The student signs in normally and opens `https://moodle.uip.edu.pa/my/`.
2. On **Área personal**, the scanner reads only course links and any canonical activity links currently present in the rendered overview. It never scans modules there, loads more cards, or changes filters.
3. On `/course/view.php?id=…`, the scanner limits sections and activities to a Moodle course-content/main region and excludes navigation and sidebars.
4. On `/course/section.php?id=…`, it identifies the current section from structural evidence and scans only that section. The page URL ID remains the canonical section ID; a separately exposed Moodle section number is kept only as `sectionNumber`.
5. On `/mod/feedback/view.php`, it exposes one read-only Feedback activity and may detect a structural `complete.php` response URL.
6. On `/mod/feedback/complete.php`, it inspects only the scoped Feedback form. The student may choose a rating and explicitly preselect compatible unanswered radios locally. Submission remains blocked unless every supported radio is answered, no manual control is present, and one visible enabled Moodle submit control is uniquely revalidated. A second explicit confirmation may activate only that real control.
7. After Moodle navigates, the student reopens the popup and scans again. If Moodle removed the Feedback ID from `complete.php`, context is recovered only from a unique visible breadcrumb Feedback link. Completion is verified only from post-submit DOM evidence. Continue may be a real visible Moodle link or a visible GET form-submit control; it requires a separate explicit action and no multi-module loop is implemented.

Moodle themes, versions, availability rules, course layouts, and labels can vary. The scanner therefore treats URL paths and structural hints as evidence, not guarantees. It does not assume a fixed number or name of modules, that every course is rendered on the dashboard, or that a module has exactly one Feedback activity.
