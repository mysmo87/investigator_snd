# Responsive pass on HERO_FINAL_V3

This pass is a bug fix, not a design change. The approved V3 hero and everything above 1200 px look exactly as they did before.

## The bug
At 1024 × 768 the page was 1231 px wide, so it scrolled sideways and the "Today at the Booth" panel was squeezed to 163 px, mostly off screen. See `BEFORE_1024x768.png`.

## Root cause
Below 1200 px the right-hand column moves under the hero and splits into two columns: the assistant on the left and the booth on the right.

1. The columns were declared as `1fr 1fr`. A `1fr` column is really `minmax(auto, 1fr)`, so it can't be narrower than its content's minimum width.
2. Inside the assistant panel, the suggestion chips sit in a single row that doesn't wrap. It is a horizontal scroller, about 840 px wide.
3. That forced the assistant column to 866 px.
4. The booth column was left with 163 px and pushed past the right edge of the screen.

## Fix (one line, `styles.css`, inside `@media (max-width:1200px)`)
```diff
- .right-col{display:grid;grid-template-columns:1fr 1fr}
+ .right-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
```
- **Columns:** they can now shrink below their content's minimum width, so the assistant and booth panels share the width equally (404 px each at 1024).
- **Chips:** they scroll inside the assistant panel, as they already do at full size.
- **No overflow workaround:** there is no `overflow-x: hidden`, and no content is removed or hidden.
- **Unchanged:** above 1200 px this rule doesn't apply, so 1920, 1440 and 1280 are untouched.

## Checks
- **Horizontal overflow:** none of the seven views (Home, News, Demos, Tracks, Sessions, Ask, Journey) overflows at 1920 × 1080, 1440 × 900, 1280 × 800 or 1024 × 768.
- **Unchanged at the wide sizes:** at 1920, 1440 and 1280, the position, size and key styles of all 828 elements match V3. The only exceptions are two elements caught mid-animation: the radar pulse ring and the spinning chat icon. At 1920 × 1080 a pixel comparison differs only inside the rotating globe, the clock and the status dot.
- **Functionality, at all four sizes:**
  - **Navigation:** all seven views open.
  - **Assistant:** a suggestion chip gets an answer, a typed question gets an answer, New conversation clears the chat, and Expand opens the full assistant. The last chip can be reached by scrolling.
  - **Booth:** "Full schedule" opens Live Sessions.
  - **Action cards:** the three cards open News, Demos and the journey wizard, and keyboard Enter works.
  - **Console:** no errors.
- **Radar ring:** unchanged. It overlaps no text at any of the four sizes. The closest it comes is 13 px from the end of the headline at 1280 × 800, and 23 px from the statistics.
- **Tests:** `npm test` passes, 23 of 23.

## Screenshots
| File | What |
|---|---|
| `BEFORE_1024x768.png` | V3 at 1024 × 768, full page (1231 px wide) |
| `AFTER_1024x768.png` | after the fix, full page (1024 px wide) |
| `AFTER_1280x800.png`, `AFTER_1440x900.png`, `AFTER_1920x1080.png` | after the fix; identical to V3 |

## Known, not changed here
These are outside the hero and the scope of this fix.
- **Booth panel at 1920 × 1080 and 1280 × 800:** the last row of demo chips sits just below the panel's visible area (41 px and 23 px). The panel scrolls, so nothing is lost. Fixing it would change the approved layout at 1920.
- **Assistant at 1280 × 800:** the conversation area is short (138 px). It scrolls, and the full Ask view is one tap away.
- **Phone layout (≤ 760 px):** it still sets `overflow-x: hidden` on `html` and `body`. This rule predates V1 and is outside the four sizes tested here, so it was not changed.
