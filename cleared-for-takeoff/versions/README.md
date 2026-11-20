# Design versions: Agentic AI: Cleared for Takeoff

Every version below is a complete, working copy of the app: code, styles, assets, data, server, configuration and lockfiles. Each one is a commit on the branch `claude/gdrfa-future-radar-prototype-l65veo` of `mysmo87/investigator_snd`. The tags exist in the clone that made them; this session can't push tags, so publish them once from your own clone with the commands at the end.

| Version | Commit | Tag | App code identical to | Screenshot (1920 × 1080) |
|---|---|---|---|---|
| `GOLDEN_BASELINE_V1`: original design | `da63427` | `golden-baseline-v1` | `2acec53` | `baseline/GOLDEN_BASELINE_V1.png` |
| `HERO_REFINEMENT_V2`: first hero refinement | `1c1f45d` | `hero-refinement-v2` | `26ee83b` | `versions/HERO_REFINEMENT_V2.png` |
| `HERO_FINAL_V3`: final hero polish | `0f542af` | `hero-final-v3` | `0f542af` | `versions/HERO_FINAL_V3.png` |
| `PRE_V4_FULL_APP`: full app before the V4 homepage redesign (V3 plus the responsive fix) | `ccda35f` | `pre-v4-full-app` | `900a662` | `versions/PRE_V4_FULL_APP.png` |
| `HOMEPAGE_V4_CANDIDATE`: minimal premium homepage; **candidate for review, not approved** | `8a05c44` | `homepage-v4-candidate` | `8a05c44` | `versions/HOMEPAGE_V4_CANDIDATE.png` |
| **`MASTER_V4`: the master version.** V4 homepage with the new copy, night sky, liquid-glass card, glass header, clock and aligned logo | `ec48b96` | `master-v4` | `ec48b96` | `versions/MASTER_V4.png` |
| `NEWS_TICKER_V1`: MASTER_V4 plus a TV-style news ticker across the top (experiment) | `4be3630` | | `4be3630` | `versions/NEWS_TICKER_V1.png` |
| `FEKRA_OPTION_B`: NEWS_TICKER_V1 plus the Fekra \| Submit a Proposal button under the two main actions | `a754b9e` | | `a754b9e` | `versions/FEKRA_OPTION_B.png` |
| `FEKRA_V1`: FEKRA_OPTION_B plus the Fekra innovation assistant page (conversation, innovation check, proposal) | `b3afc74` | | `b3afc74` | `versions/FEKRA_V1.png` |

Never move or delete these commits or tags. New work goes on new commits.

**`MASTER_V4` is the reference version.** Every later experiment starts from it. To return to the master at any time, restore commit `ec48b96` with the restore commands below.

To go back from the V4 candidate, restore `PRE_V4_FULL_APP` with the restore commands below. The V4 review, with screenshots, differences from the reference and checks, is in `design-reviews/homepage-v4/NOTES.md`.

Fixes made after `HERO_FINAL_V3` keep its approved look:
- **Responsive fix, 1024 px overflow:** a one-line CSS fix that applies only at 1200 px and below; above that, the app looks exactly like V3. Details: `design-reviews/responsive-pass/NOTES.md`. If you restore V3 itself, the 1024 px overflow comes back.

## Look at a version without changing your branch
```bash
git fetch origin
git checkout <commit-or-tag>   # e.g. da63427, 1c1f45d, 0f542af, ccda35f or 8a05c44
npm ci && npm start            # from the repository root, then open http://localhost:3000
git switch -                   # back to your branch
```

## Restore a version on your branch (keeps history)
```bash
git fetch origin
git checkout <commit-or-tag> -- cleared-for-takeoff/public cleared-for-takeoff/server package.json package-lock.json railway.json
git commit -m "Restore <VERSION>"
git push                        # Railway redeploys it
```
This restores the app files only; the screenshots and these notes stay as they are.

## Publish the tags (once, from your own clone)
```bash
git fetch origin
git tag -a golden-baseline-v1 da63427 -m "GOLDEN_BASELINE_V1"
git tag -a hero-refinement-v2 1c1f45d -m "HERO_REFINEMENT_V2"
git tag -a hero-final-v3 0f542af -m "HERO_FINAL_V3"
git tag -a pre-v4-full-app ccda35f -m "PRE_V4_FULL_APP"
git tag -a homepage-v4-candidate 8a05c44 -m "HOMEPAGE_V4_CANDIDATE"
git tag -a master-v4 ec48b96 -m "MASTER_V4"
git push origin golden-baseline-v1 hero-refinement-v2 hero-final-v3 pre-v4-full-app homepage-v4-candidate master-v4
```
