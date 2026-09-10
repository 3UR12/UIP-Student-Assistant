# Moodle UIP flow assumptions

This scanner is designed around the normal, student-driven Moodle navigation flow:

1. The student signs in normally and opens `https://moodle.uip.edu.pa/my/`.
2. On **Área personal**, the scanner reads only course links and any canonical activity links currently present in the rendered overview. It never scans modules there, loads more cards, or changes filters.
3. On `/course/view.php?id=…`, the scanner limits sections and activities to a Moodle course-content/main region and excludes navigation and sidebars.
4. On `/course/section.php?id=…`, it identifies the current section from structural evidence and scans only that section. The page URL ID remains the canonical section ID; a separately exposed Moodle section number is kept only as `sectionNumber`.
5. On `/mod/feedback/view.php`, it exposes one read-only Feedback activity and may detect a structural `complete.php` response URL.
6. On `/mod/feedback/complete.php`, it inspects only the scoped Feedback form. The student may choose a detected rating and explicitly preselect compatible unanswered radio controls locally; the extension never writes text, submits, or navigates.

Moodle themes, versions, availability rules, course layouts, and labels can vary. The scanner therefore treats URL paths and structural hints as evidence, not guarantees. It does not assume a fixed number or name of modules, that every course is rendered on the dashboard, or that a module has exactly one Feedback activity.
