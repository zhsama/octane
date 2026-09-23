# Fixed pnpm evaluation (declared before timed sampling)

- Octane input: e4bb4e0db7b6f36ab017d60eef29c15780f90a5c (current upstream main at setup).
- Baseline: pnpm 11.15.1, the project's committed packageManager.
- Candidate: release build of pnpm commit 90422c7c638c46cc6450c25308b2d42bba3a1dfc. Its version output is 12.6.0, but it is NOT the published 12.6.0 binary.
- Mac: build the exact commit with its pinned Rust toolchain and release profile, Cargo.lock locked.
- Linux: official successful pnpm run 35788821131, HEAD binary artifact 10721341865; verify archive SHA256 1a22e769cc90631bf4a42a5b950bde8f6a4be483dd5fc2524627440566138b31.
- Node fixed at 24.19.0. Same application manifests and lockfiles in both arms. Experiment scripts/workflows only.
- Explicit binary path and PATH, disable automatic package-manager switching for both arms. Candidate pmOnFail=ignore affects tool-version pins only, not dependency peer validation. Keep all peer checks.
- Separate stores/caches; CI=true; force project virtual store for both arms. No timed samples overlap our compilation or other local validation.
- Cold install: n=1 per arm, descriptive only. Warm offline reinstall without scripts: one excluded warmup + n=3 per arm. Normal offline install including lifecycle: one excluded warmup + n=3. No-op install: n=3 without scripts, n=6 with scripts. Build and workflow tooling tests: one excluded warmup + n=3. Vite dev start until real Draftboard canvas rendered in Chromium: one excluded warmup + n=3, browser launch outside timer.
- Alternate AB/BA order by iteration. Compare installed name/version inventories and build hashes. Check lock hash after every command. Record every command, exit, wall, max-process RSS and load averages.
- Report medians and ranges. Overlapping noisy ranges do not establish a speed improvement. RSS is not sum of descendants. Developer startup is not HMR or runtime speed.
- Keep all raw results. No exclusion based on favorable/unfavorable outcomes. If a command fails, retain it, investigate, and do not label an incomplete scenario a performance win. Any protocol correction is documented before new sampling in a separate dataset.
- Full copied Octane CI on the user fork; only runner/tool setup, compatible --prod=false spelling, explicit comparison base and matrix fail-fast behavior are adapted. Preserve test commands and strict validation. Retain the original --lockfile=false Three behavior initially to establish whether that separate bug remains.
- No upstream PR, package publication, merge or deployment in this experiment.
