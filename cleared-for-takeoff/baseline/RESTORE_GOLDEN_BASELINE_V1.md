# GOLDEN_BASELINE_V1 — how to restore it

`GOLDEN_BASELINE_V1` is the approved design and behaviour of **Agentic AI: Cleared for Takeoff** before the Home hero refinement. It's a complete, working version: all source code, styles, assets, data, server, configuration and the dependency lockfiles.

| | |
|---|---|
| Baseline commit | `da63427` (full: `da634279f23466ed95eb7008279e006587463349`), on branch `claude/gdrfa-future-radar-prototype-l65veo` of `mysmo87/investigator_snd` |
| Git tag | `golden-baseline-v1`, which points at that commit. The session that made it could not push tags, so publish it once from your own clone: `git fetch origin && git tag -a golden-baseline-v1 da63427 -m "GOLDEN_BASELINE_V1" && git push origin golden-baseline-v1` |
| Application code identical to | commit `2acec53` ("Revalidate static files on every load and report the deployed commit") |
| Reference screenshot | `baseline/GOLDEN_BASELINE_V1.png`, at 1920 × 1080 with device scale factor 1 |

Never move or delete the tag. Later work goes on new commits, so the commit and tag always point at this baseline. Every command below uses `golden-baseline-v1`; if the tag isn't published yet, use `da63427` instead.

## Look at the baseline (nothing changes on your branch)

```bash
git fetch origin --tags   # the tag, if published; the commit comes with the branch
git checkout golden-baseline-v1        # detached HEAD at the baseline
npm ci && npm start                    # from the repository root, then open http://localhost:3000
git switch -                           # go back to your branch afterwards
```

## Restore it

**Option A: restore the app files on the current branch (keeps history; recommended).**
```bash
git fetch origin --tags   # the tag, if published; the commit comes with the branch
git checkout golden-baseline-v1 -- cleared-for-takeoff package.json package-lock.json railway.json
git commit -m "Restore GOLDEN_BASELINE_V1"
git push
```
Railway redeploys the baseline from the new commit.

**Option B: start a fresh branch from the baseline.**
```bash
git fetch origin --tags   # the tag, if published; the commit comes with the branch
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
