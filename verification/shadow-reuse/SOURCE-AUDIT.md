# Shadow reuse source audit
Baseline d21e9ec2260f7c23e220a2e17baed81a5cf39380. Renderer is custom WebGL2, not Three.js.

`src/renderer.js` depth shader reads aPosition, uModel and uVP only. render constructs the same ordered commands for both passes; the light matrix is fixed by init and unrelated to camera. All mesh buffers are private, created once by mesh()/convexMesh()/cushionMesh(); no in-place vertex mutation exists in repository production code. Static object replacement creates a distinct VAO.

Exact reuse signature: context/init/mesh generation, depth program, shadow texture/framebuffer, canvas pixel size, all light matrix scalars, command order and each VAO/buffer/count plus all model matrix scalars. Reject nonfinite values. Snapshot arrays, never retain mutable model/light references. Command color/material/selection and line overlays do not enter the depth shader. Camera changes alter main pass only. Any changed depth input recomputes full pass, preserving order and operations.

Conservative invalidation on init/mesh allocation, resize, context lost/restored. Existing application does not recreate GL resources on context restoration; the candidate will not invent a partial recovery path or call preventDefault. Tests must distinguish invalidation from resource recovery, and explicitly recreate renderer resources for resumed pixels. Private GL resources cannot be externally mutated through supported app APIs; this is not a cache for arbitrary external raw WebGL writes.

No physics, worker queue, deadline, quality, resolution, or main-pass changes.
