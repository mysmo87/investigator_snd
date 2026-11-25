# HOMEPAGE_V4_CANDIDATE: minimal premium homepage

**Status: candidate for review, not approved.** The restore point from before this work is `PRE_V4_FULL_APP` (commit `ccda35f`); see `versions/README.md`.

| File | What it shows |
|---|---|
| `V4_REFERENCE.png` | the approved V4 design, as supplied |
| `REFERENCE_vs_CANDIDATE.png` | the reference and the live render, side by side |
| `BEFORE_AFTER_home.png` | `PRE_V4_FULL_APP` against the candidate |
| `HOME_1920x1080.png` … `HOME_1024x768.png` | the homepage at the five test sizes |
| `EXPERIENCES_*.png`, `AI_ASSISTANT_1920x1080.png`, `ABOUT_1920x1080.png` | the destination pages |

## What changed
- **Header**
  - The official GDRFA logo sits on the left and links to Home.
  - The navigation is centred over the content: **Agentic AI** (Home), **Experiences**, **AI Assistant** and **About**. The current page is marked with a gold underline.
  - The **GITEX 2026** badge sits on the right.
  - The old title, clock, date and "AI Assistant Ready" chip are gone.
- **Rail**
  - The wide sidebar is replaced by the slim icon rail from V4: Home, Experiences, AI Assistant and About.
  - **Reset experience** stays at the foot of the rail.
  - Below 760 px the rail becomes a bottom bar with labels.
- **Home**
  - **Copy:** the eyebrow "GDRFA | Agentic AI Experience", the headline "Cleared for **Takeoff.**" with "Takeoff." in gold, and the line "Explore how Agentic AI is shaping the future of government services."
  - **Actions:** exactly two, **Talk to AI** (gold) and **Explore Experiences** (navy). Every element is real HTML; no part of the reference image is used as a background.
  - **Globe:** a canvas globe with dotted continents drawn from Natural Earth land data (`shared/globe-land.js`).
    - **Dubai:** the gold marker and label.
    - **Details:** gold flight routes from Dubai, a gold orbit ring, a faint blue orbit, and a blue atmospheric rim.
    - **Motion:** it turns gently. It is drawn once, without animation, when the visitor prefers reduced motion.
  - **Skyline:** a drawn Dubai skyline, with the Burj Khalifa under the globe, the Museum of the Future, lit windows, a dusk glow and reflections in the water.
- **Typography:** Inter, self-hosted under the SIL Open Font License (`fonts/`), replaces the condensed Rajdhani in the interface. Page headings are now in title case.

## Where the old homepage content went
Nothing was deleted from the app. Only the homepage composition changed.

| Was on the homepage | Now |
|---|---|
| Persistent AI chat sidebar | **AI Assistant** page: a spacious conversation with a 48rem reading width and larger type. It keeps suggested questions, topic groups, New conversation and the same answers. |
| Three navigation cards (News, Demos, Start Your AI Journey) | **Explore Experiences**, plus the journey card on Experiences and in the Assistant |
| Popular Learning Tracks carousel | **Experiences → Learning tracks** (all six tracks, with filters) |
| Today at the Booth panel | **Experiences** overview (the same component, with live, next, later and demo stations) |
| Agentic AI Passport promo card | the **My AI Journey** card on Experiences and in the Assistant; the assistant's welcome message still offers Start My AI Journey |
| Four statistics | removed (decorative). The real counts now appear on the Experiences cards. |
| Reset Experience (sidebar) | the rail, and the privacy section of **About** |

- **Experiences:** a new overview page, built only from existing data and copy.
  - Four destination cards, with counts taken from the content and the existing Sample and Illustrative labels.
  - Today at the booth, and the My AI Journey card.
  - Section tabs (Overview, Demos, Learning tracks, AI news, Live sessions) on all five pages.
- **About:** a new page built from the assistant's existing answers: What is Agentic AI, Generative AI and Agentic AI, GDRFA at GITEX, and privacy. No new claims were written.

## Checks (Chromium, `npm start`)
- **Layout:** at 1920×1080, 1600×900, 1440×900, 1280×800 and 1024×768.
  - Home fits the screen with no scrolling.
  - None of the nine pages scrolls sideways, and `overflow-x: hidden` is not used.
  - No text is clipped.
  - The globe stays at least 20 px clear of the headline and actions (24 px at 1280 and 1024).
  - The header navigation stays clear of the logo and badge.
  - Touch targets are at least 44 px.
- **Matches the reference at 1920×1080:** the eyebrow, headline cap height, lede width, button sizes and positions, and globe centre and radius are each within a few pixels.
- **Functional checks:** 33 checks pass at every size. They cover:
  - **Navigation:** header, rail and logo.
  - **Hero actions:** both buttons, including keyboard Enter.
  - **Assistant:** a chip, a typed question, a topic question, New conversation and the journey card.
  - **Experiences:** the cards and tabs; the booth's sessions, demo stations and Full schedule.
  - **Pages:** a news story, a demo, a track and course with QR, and marking a session attended.
  - **Journey:** the builder to a roadmap, and the passport with its QR.
  - **About:** its sections, actions and Reset.
  - **Reset:** the rail Reset, and the idle reset.
- **Console:** no errors.
- **Tests:** `npm test` passes, 23 of 23.

## Differences from the reference
1. **Skyline:** the reference uses a photograph. The candidate draws a skyline in the same position, so it is more stylised and a little dimmer. A licensed night photo of Dubai could replace the drawn layer if you supply one.
2. **Logo:** the reference shows a different lockup. The candidate uses the existing official asset, as instructed, at the same height.
3. **Navigation:** the brief asks for an AI Assistant entry, so the header has a fourth link (**AI Assistant**) and the rail a fourth icon. Reset sits at the foot of the rail. The labels "Agentic AI" and "About" follow the reference.
4. **Globe:** it is drawn from real coastline data. The flight routes, glow and city lights are interpretations of the reference rather than copies of it.
5. **Lede:** set at 36 px on 45 px lines, so it wraps after "future" as in the reference. At 1100 px and below the copy column scales to 85% so the globe keeps its size.

## Not verified here
- **Claude-powered course recommendations:** they need `ANTHROPIC_API_KEY`. The tests used the offline rules, which give the same journey shape. The recommendation code is unchanged.
- **Big-screen welcome animation:** its code is unchanged, but it wasn't re-run in this pass.
- **Real kiosk hardware:** touchscreens and the kiosk browser weren't tested. Neither was opening the page from disk (file://).
- **Phone sizes (≤ 760 px):** one sanity check at 390×844 only. The pre-existing `html,body{overflow-x:hidden}` rule for phones is unchanged.
