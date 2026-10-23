# Development constraints

- Keep a genuine 3D rigid-body simulation. Do not hardcode billiards outcomes or successful trajectories.
- Use actual shadcn/ui Base UI components and @base-ui/react, not look-alike local primitives.
- Keep the shot/routes/settings tabs in one persistent inspector. Never reset the world or settings on tab changes.
- Preserve rear-aim/front-pull gestures, fine angles, cue hiding during motion, continuous play, and safe mobile cancellation.
- Keep runtime dependencies bundled; no CDN fetch is permitted in the deployed build.
- Run the full real-app browser tests, including narrow screens and settings. Harness tests are not substitutes.
- Publish only after the build, physics tests, and full UI tests pass. Report any unverified behavior precisely.
- Work in the agent container or GitHub Actions. Do not access the user's Windows or remote desktop environment.
