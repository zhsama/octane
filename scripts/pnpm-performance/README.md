# pnpm 11 / 12 comparison on the current Octane graph

Agent-authored experiment. Base: `09707df629c170a878e1f238921e09b86a9662a4` (upstream `2a952b87d1da1ce6f9a115173126fed2904c444b` plus removal of unused `esrap_common`). The dependency graph has 333 workspace projects. This supersedes the earlier 233-project experiment for upgrade decisions.

The candidate pins pnpm 12.5.1. Both benchmark arms use the same application lock document and combined lockfile. Its first YAML document adds 4,560 bytes of pnpm tool integrity metadata; the application lock document is byte-identical. See `lockfile-comparison.json`.

## Method

Run `python3 run.py cold warm developer summary` from the artifact directory. The sibling `octane` must be a disposable Git worktree; `BENCH_WORKTREE` overrides that location. Install the official exact releases under `tools/pnpm11` and `tools/pnpm12`. The v12 package's `install.js` must run to install the native binary. The script verifies each executable reports the expected version after setting the root packageManager pin.

All arms run serially, with independent initially empty store/XDG cache directories and `CI=true`. Node is held constant at 24.19.0 in CI. The script removes only worktree node_modules directories, outside the timer. It leaves the user's global store and primary checkout untouched. It verifies lockfile SHA-256 after every command and retains installed package name/version multisets after every reinstall, comparing each against the first installation. Package inventories and disk sizing run outside the timer after each pair of install/no-op commands. The packageManager pin is only rewritten when its value changes, so repeated no-op commands do not change its mtime.

- Cold download: one sample per version with empty store/cache; network/CDN noise and fixed version order make this descriptive only.
- Warm offline reinstall: one warmup excluded, then five samples per version, alternating AB/BA. `--frozen-lockfile --offline --ignore-scripts` isolates install/linking overhead.
- No-op install: immediately after each measured warm reinstall.
- Normal offline reinstall: one warmup excluded, then three samples with allowed lifecycle scripts. Completed dependency builds may be cached normally. Both arms use their normal default cache policy.
- Normal no-op installs: two after each normal reinstall; the two warmup samples are excluded, leaving six measured samples per version.
- Build and repository tooling tests: one warmup excluded, then three samples per version. These show the end-to-end impact on actual developer commands rather than claiming application runtime improvements.

After every successful build, outside the timer, the harness records every regular file under `packages/octane/dist` by relative path and content SHA-256. Every build must match the first output inventory byte-for-byte. A changed artifact fails the experiment instead of being included as a speed result for different output.

Python monotonic wall time is the reported duration. `/usr/bin/time -l` on macOS or GNU time on Linux records maximum process RSS, not the aggregate concurrent memory of the process tree. Report medians plus ranges and raw samples. Do not interpret ratios within observed variance as improvement. Each directory gets a separate `du -sk` call in `sizes-*.txt` so hardlinks in another directory cannot suppress its count. These per-directory allocated-block counts cannot be summed as exclusive physical use: hardlinks and APFS clones can share blocks. `sizes-union-*.txt` separately records a joint call across node_modules/store/cache that deduplicates hardlinks across operands; its total still does not deduplicate APFS clone extents. OS page caches are not cleared; local measurements run on an active desktop. The build command deletes its dist directory and rebuilds it every time. Disk availability and system load are recorded with every sample. The runner must start with at least 16 GiB free.

CI must execute this same script on a single GitHub-hosted Ubuntu runner with both versions, and retain JSONL, environment, lock comparison, package inventories, timing and command logs as artifacts. Whole-job timings from unrelated runners or different workloads are contextual, not a controlled speed comparison. The copied full validation workflow checks correctness separately. No result is inferred from local data.
