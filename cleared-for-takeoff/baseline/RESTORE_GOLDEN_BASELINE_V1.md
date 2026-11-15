# GOLDEN_BASELINE_V1 — how to restore it

`GOLDEN_BASELINE_V1` is the approved design and behaviour of **Agentic AI: Cleared for Takeoff** before the Home hero refinement. It's a complete, working version: all source code, styles, assets, data, server, configuration and the dependency lockfiles.

| | |
|---|---|
| Git tag | `golden-baseline-v1` (on GitHub, repository `mysmo87/investigator_snd`) |
| Application code identical to | commit `2acec53` ("Revalidate static files on every load and report the deployed commit") |
| Reference screenshot | `baseline/GOLDEN_BASELINE_V1.png`, at 1920 × 1080 with device scale factor 1 |

Never move or delete the tag. Later work goes on new commits, so the tag always points at this baseline.

## Look at the baseline (nothing changes on your branch)

```bash
git fetch origin --tags
git checkout golden-baseline-v1        # detached HEAD at the baseline
npm ci && npm start                    # from the repository root, then open http://localhost:3000
git switch -                           # go back to your branch afterwards
```

## Restore it

**Option A: restore the app files on the current branch (keeps history; recommended).**
```bash
git fetch origin --tags
git checkout golden-baseline-v1 -- cleared-for-takeoff package.json package-lock.json railway.json
git commit -m "Restore GOLDEN_BASELINE_V1"
git push
```
Railway redeploys the baseline from the new commit.

**Option B: start a fresh branch from the baseline.**
```bash
git fetch origin --tags
git switch -c restore-golden-baseline-v1 golden-baseline-v1
git push -u origin restore-golden-baseline-v1
```
Then point the Railway service at that branch (Settings → Source → Branch).

**Option C: undo only the hero refinement.** Revert the commit or commits that came after the tag:
```bash
git log --oneline golden-baseline-v1..HEAD   # lists what changed since the baseline
git revert <commit>                          # one revert per commit you want to undo
```

## Check the restore

1. `npm test` passes.
2. Open the app at 1920 × 1080 and compare it with `baseline/GOLDEN_BASELINE_V1.png`. The globe animation, clock and session times move, so expect small differences in those areas only.
