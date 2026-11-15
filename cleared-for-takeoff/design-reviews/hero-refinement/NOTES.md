# Home hero refinement

Scope: the central Home hero only. Header, sidebar, assistant panel, Today at the Booth, Learning Tracks, routes, data and APIs are unchanged.

- Before: `baseline/GOLDEN_BASELINE_V1.png` (restore guide: `baseline/RESTORE_GOLDEN_BASELINE_V1.md`)
- After: `AFTER_1920x1080.png`
- Side by side (hero only): `BEFORE_AFTER_hero.png`

## Changes
- **Hierarchy**
  - A soft left-side shade sits behind the copy column, so the globe and skyline can't compete with the headline.
  - The eyebrow is quieter: smaller, less letter-spacing, and a static dot with no pulse.
  - "Welcome to" is now a lead-in rather than a second headline.
- **Headline:** same words and the same blue-to-cyan gradient. The blue glow is gone, letter-spacing is slightly tighter, and the rhythm runs eyebrow → headline → tagline → statistics.
- **Tagline:** higher contrast, with no letter-spacing.
- **Statistics:** same values, set as a data row with hairline dividers, tabular numbers and sentence-case labels in higher contrast.
- **Action cards:**
  - **Consistency:** the three cards share one component with the same height, padding, 2.75rem icon tiles and type.
  - **Restraint:** hairline borders, a near-solid surface, and no glow or sheen animation. Hover lifts the card 2px and brightens the border; the arrow nudges forward.
  - **Primary action:** Start Your AI Journey keeps a restrained gold border, a gold top accent, and a gold icon and title.
  - **Behaviour:** navigation is unchanged.
- **Globe**
  - **Size:** the radius is about 16% smaller and the globe sits slightly further right.
  - **Removed:** the drifting background network.
  - **Radar sweep:** fainter, slower, and kept inside one range ring, so it no longer crosses the statistics.
  - **Simpler:** 6 flight arcs instead of 12, with fewer and dimmer dots, a fainter graticule and one ring with 12 ticks.
  - **Focal point:** Dubai keeps its gold marker and label.
- **Skyline:** the same drawing, with lower-contrast outlines, windows and Ain Dubai spokes, the whole layer at 74% opacity, and a slightly lower top edge.

## Checks
- **Viewports:** 1920×1080, 1600×900, 1366×768, 1280×800, 1024×768 and 390×844. No clipping, no overlap between the copy and the cards, and the three cards are the same height at every size.
- **Overflow:** at 1024 px the page is wider than the screen, but that comes from the right-hand panel and was already in the baseline.
- **Cards:** Latest AI News opens News, Explore Our Demos opens Demos, and Start Your AI Journey opens the journey wizard. Keyboard Enter works too.
- **Outside the hero:** a pixel comparison with the baseline found differences only in elements that move on their own: the clock, the status dot, the chat icon and the booth countdown.
