# Moodle UIP flow assumptions

This scanner is designed around the normal, student-driven Moodle navigation flow:

1. The student signs in normally and opens `https://moodle.uip.edu.pa/my/`.
2. On **Área personal**, the scanner reads only course links currently present in the rendered overview. It does not load more cards or change filters.
3. On `/course/view.php?id=…`, the scanner identifies a course page, then looks for visible Moodle sections and activity links.
4. On `/course/section.php?id=…`, it scans the visible section and any activities rendered there.
5. On `/mod/feedback/…`, it recognizes a Feedback page from the URL but does not answer, submit, or inspect form values.

Moodle themes, versions, availability rules, course layouts, and labels can vary. The scanner therefore treats URL paths and structural hints as evidence, not guarantees. It does not assume a fixed number or name of modules, that every course is rendered on the dashboard, or that a module has exactly one Feedback activity.
