# Development constraints

- Keep a genuine 3D rigid-body simulation. Do not hardcode billiards outcomes or successful trajectories.
- Use actual shadcn/ui Base UI components and @base-ui/react, not look-alike local primitives.
- Keep the shot/routes/settings tabs in one persistent inspector. Never reset the world or settings on tab changes.
- Use the forward line from the cue ball as the continuous aim handle, empty-table tap/click aiming, and optional rear-of-cue aiming. Empty cloth dragging is not aiming; floor dragging rotates the view. Classify each gesture once on pointerdown with balls taking priority. Do not restore the removed front-pull gesture, aim/pull overlay handles, or fullscreen/focus buttons. Preserve fine angles, cue hiding during motion, continuous play, and safe mobile cancellation.
- Ball dragging works without a placement mode. One completed drag is one undoable action; cancellation restores the original position, and a new action invalidates redo.
- Keep JavaScript and WASM runtime dependencies bundled. The explicitly requested, version-pinned Pretendard Variable CDN font is the only external runtime asset exception. Verify actual Korean font loading before screenshots.
- Run the full real-app browser tests, including narrow screens and settings. Harness tests are not substitutes.
- Publish only after the build, physics tests, and full UI tests pass. Report any unverified behavior precisely.
- Work in the agent container or GitHub Actions. Do not access the user's Windows or remote desktop environment.

- Keep all numeric/manual settings in the manual tab, and the strike action in the table content area. The visible app title is 당구 연습.
- Four-ball search and gameplay prohibit opponent cue contact independently of kisses, through full physical rest after the goal; optional three-cushion scoring is frozen at the second distinct red first hit.
