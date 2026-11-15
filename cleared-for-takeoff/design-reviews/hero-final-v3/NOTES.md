# Home hero: final polish (HERO_FINAL_V3)

Scope: the central Home hero only. This pass starts from `HERO_REFINEMENT_V2`. The header and GDRFA logo, sidebar, AI Assistant panel, Today at the Booth, Learning Tracks, routes, data and APIs are unchanged, and so are the hero's wording, typography and statistics.

- **Before:** `versions/HERO_REFINEMENT_V2.png`
- **After:** `AFTER_1920x1080.png`, the same image as `versions/HERO_FINAL_V3.png`
- **Side by side (hero only):** `V2_vs_V3_hero.png`, with V2 on the left and V3 on the right

## Changes (11 lines across `styles.css` and `app.js`)
- **Globe**
  - **Size:** the radius is 10% larger, 167.0 → 183.7 px at 1920 × 1080. The phone layout scales the same way.
  - **Position:** the globe moves right by 1% of the hero width (72% → 73%), so the larger globe keeps its clearance from the headline. It stays at the same height, with Dubai at the focal point.
- **Atmosphere**
  - **Bloom:** a soft blue bloom (two-stop radial, 20% → 0) replaces the flat halo.
  - **Background tint:** the hero's background tint is re-centred on the globe and is slightly stronger (.20 → .24).
  - **Decorations:** no new decorations, and no glow, noise or animation from V1 comes back.
  - **Pulse rings:** the CSS pulse rings scale with the globe (24 → 26.4 rem).
- **Action cards**
  - **Skyline separation:** a bottom fade in the hero's existing shade layer dissolves the skyline before it reaches the cards, so the ground line no longer runs between them.
  - **Breathing room:** the card row sits 0.25 rem higher (bottom 1.5 → 1.75 rem). The hero's height is unchanged.
  - **Unchanged:** heights, padding, borders, hover and the gold accent on Start Your AI Journey are the same as V2.

## Checks
- **Viewports:** 1920×1080, 1600×900, 1366×768, 1280×800, 1024×768 and 390×844.
  - **Clipping and overlap:** nothing is clipped, and the copy, the statistics and the cards don't overlap.
  - **Card heights:** the three cards are the same height at every size.
- **Clearance from the globe:**

  | Viewport | Globe to headline | Globe to cards | Range ring to statistics |
  |---|---|---|---|
  | 1920 × 1080 | 77 px | 55 px | — |
  | 1600 × 900 | 64 px | 45 px | — |
  | 1366 × 768 | 85 px | 49 px | — |
  | 1280 × 800 | 45 px | 59 px | 7 px to the edge of the statistics box, about 20 px to the text |

- **Cards:** Latest AI News opens News, Explore Our Demos opens Demos, and Start Your AI Journey opens the journey wizard. Keyboard Enter works, and the console shows no errors.
- **Outside the hero:** a pixel comparison with V2 found differences only in elements that move on their own: the clock, the status dot, the chat icon and the booth countdown.
- **Tests:** `npm test` passes, 23 of 23.

## Known, not changed here
- **1024 px overflow:** at 1024 px the page is wider than the screen. The cause is the right-hand assistant column, and the same overflow is in V1 and V2.
- **Range ring at 1280 × 800:** the faint ring passes close to the last statistic. It doesn't overlap the statistic.
