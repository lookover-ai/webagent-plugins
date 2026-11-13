<!-- hub D80 (hub/GIT-FLOW.md). Base branch: development. The merge queue ranks and holds PRs by these fields: fill every one. -->

## What and why
<!-- 2-4 lines: what changes for the user/system, and why now. -->

## Queue fields
- **Task:** <!-- A64 / W112 / none -->
- **Type:** <!-- feat | fix | hotfix | refactor | perf | test | docs | chore -->
- **Priority:** <!-- P0 production broken | P1 current roadmap task | P2 next | P3 nice to have -->
- **Staging:** <!-- yes (promote when green) | no (development only) | after #<PR> -->
- **Depends on:** <!-- none | lookover-ai/<repo>#<PR>, contracts vX.Y.Z -->
- **Shared files:** <!-- none | contracts barrel/events/sessions, api schema/migrations/module wiring/config, ... -->
- **Migration:** <!-- no | yes: <file>, reversible? -->
- **Risk:** <!-- low | medium | high: one line on what could break -->

## Checks run
<!-- Commands you ran and their result, e.g. `pnpm typecheck` → pass, `pnpm vitest run src/x` → 14 passed. -->

## Rollback
<!-- How to undo if staging or production breaks: revert this commit / feature flag / data step. -->
