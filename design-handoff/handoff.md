# Shikkha Squared — Rebranding prototype

Created 9 October 2026 as a developer reference. This is a static, presentation-led website with working browser-local interactions.

Official brand motto: **Elevate Your Potential**. Use this wording for the homepage headline and page title.

## Open locally

Extract the prototype archive. From its root, run any static HTTP server, for example `python3 -m http.server 8000`, then open `http://localhost:8000`. No package installation or build is required.

## Files

- `index.html`: marketing page, catalogue container, native course/classroom/admissions dialogs.
- `styles.css`: design tokens, self-hosted fonts, Liquid Glass styling, responsive layouts, reduced motion.
- `motion.css`: six-face 3D cube, orbital graphics, animated light trails, cursor lighting, scroll scenes and responsive motion rules.
- `motion.js`: optional native scroll/wheel controller, delegated card tilt, section reveals and visitor motion preferences.
- `app.js`: catalogue, filters, shortlist, course dialogs and deep links, learning-mode tabs, sample lesson, practice question and WhatsApp draft generation.
- `developer.html`: visual handoff, asset inventory and integration contracts.
- `design-tokens.json`: reusable design values and outstanding content inputs.
- `assets/`: extracted logo, seven complete banner images, supplied PDFs, Inter fonts and Inter licence.

## Typography

All live headings specify Helvetica Now Bold, weight 700. The CSS detects installed Helvetica Now fonts and falls back to Helvetica/Arial. No commercial webfont was supplied; the PDF contains outlined Type 3 lettering rather than a reusable webfont. Add a licensed Helvetica Now Bold WOFF2 file and update the existing `@font-face` sources to guarantee consistent rendering. Body copy and controls use self-hosted Inter. Raster course covers retain their original PDF typography.

## 3D and motion system

The homepage adds a real six-face CSS 3D cube, illuminated orbital rings, animated SVG light trails, a perspective grid, and layered classroom parallax. The story emblem has rotating globe rings, and the contact graphic rotates with its section's scroll progress. Mouse movement adds a soft spotlight and bounded tilt on course cards and feature panels. Section headings and panels reveal as they enter the viewport; the supplied logo and course covers remain intact.

`motion.js` uses native scrolling and passive wheel listeners. Wheel input adds a short, bounded rotational impulse without changing scroll position or cancelling browser gestures. Browser zoom, horizontal gestures, form controls, course-filter rails and modal scrolling are excluded. Scene progress is eased through `requestAnimationFrame`, which stops when values settle. Touch devices use smaller parallax distances and omit cursor effects. No animation library, WebGL renderer or external network dependency is required.

The visible Motion on/off control persists the visitor's preference under `shikkha-motion-paused`. The OS reduced-motion preference disables the effects and keeps all content visible. Hidden tabs, off-screen 3D scenes and open dialogs suspend decorative animation. Without JavaScript, the page and artwork remain readable with static 3D decoration. `data-tilt` on generated course cards uses delegated pointer handling, so filters can replace cards without rebinding listeners.

## Authoritative assets

`Shikkha Squared Logo.pdf`: 2 pages, white-and-orange logo on black, full lockup and symbol.

`Copy of NEW FORMAT OF COURSE BANNER.pdf`: 7 landscape pages, Physics with Bappi Sir. Pages 1–3 are CAIE O Levels full/crash/question-paper variations. Pages 4–7 are IGCSE full/alternate-full/crash/question-paper variations. Page 5 changes the Pearson logo treatment and is preserved as an alternate asset rather than a duplicate course.

The catalogue uses six Physics variants from these PDFs. Two A Level entries reference titles and instructors from existing Shikkha Squared website URLs. Their abstract artwork is illustrative, and current availability must be confirmed. Topic outlines and sample classroom material demonstrate UI behaviour; they are not a published course syllabus.

## Interaction contract

- Search and board/format filters combine locally.
- Shortlisted course IDs persist in `localStorage` under `shikkha-shortlist`. They are specific to the browser and this site origin.
- Course dialogs support `#course-ID` links; closing restores the preceding page hash.
- Native dialogs provide modal focus behaviour, Escape dismissal and explicit close buttons.
- Learning-mode tabs use up/down keyboard navigation; lesson resource tabs use left/right navigation.
- The sample lesson uses F = m × a, three steps and session-only completion. The practice answer is 12 N for a 4 kg object accelerating at 3 m/s² under a resultant force.
- The admissions form creates a WhatsApp draft addressed to +8801787668201. It does not send a message or store contact details. The visitor opens WhatsApp to review and send.
- The current login and policy links open on shikkhasquared.com. Payments and account creation are not implemented in the prototype.
- Empty search and saved-course states remain navigable.
- Reduced motion disables ambient animation, hover movement and smooth scrolling. Glass has an opaque fallback.

## Production tasks

1. Import approved content and exact section order from the Canva template. The supplied short link redirects to a sign-in page and could not be read. A public view link or PDF export is needed.
2. Supply the licensed heading webfont.
3. Connect the course catalogue, published syllabus, prices, availability and current sessions to a CMS/API.
4. Implement authentication, enrolment, payments, video access and live classrooms.
5. Connect progress and assessment data to student accounts.
6. Confirm legal policy routes and contact information. Add a CRM and consent handling if required.
7. Perform desktop/mobile browser QA, assistive-technology review, contrast review, performance checks and production cross-browser testing.

No student counts, learning outcomes, endorsements, teacher revenue terms or partner claims have been invented. Third-party marks within the course banners remain part of the user-supplied artwork; the page does not add independent partnership claims.

## References

- Visual direction: https://nextcreatorwave.com/
- Existing content: https://www.shikkhasquared.com/
- Requested content template: https://canva.link/i5edk2zalhw3ir6
- A Level Business catalogue reference: https://www.shikkhasquared.com/courses/business-caie-a-level-9609-with-nayeem-sir-mayjune-2026
- A Level Chemistry catalogue reference: https://www.shikkhasquared.com/courses/chemistry-edexcel-a-level-with-mobarak-sir

## Verification status

The PDFs were rendered and all pages visually inspected. Local source checks cover JavaScript syntax, CSS parsing, HTML references, duplicate IDs, fragment targets, fonts and assets. All 24 existing scripted DOM interaction checks passed: combined filters and empty states, browser-local shortlist, course details and deep links, enquiry prefill and safe WhatsApp draft generation, lesson progress and answer feedback, keyboard tabs, mobile menu state and catalogue export. Another 27 checks passed for scene progress, non-blocking wheel movement and decay, cursor tilt after filtering, modal suspension, pause persistence, OS reduced motion, touch behavior, hidden-tab suspension, idle frame termination and blocked local storage. These DOM tests simulate geometry, observers, media queries and native dialog methods; they do not verify real GPU rendering or visual layout. Browser layout QA was unavailable in this environment; the responsive layouts and 3D graphics still require visual verification in production browsers.
