# Original active CCD boundary

These numerical fixtures are captured from the original, unchanged Rapier physics engine. They are reference test data, not state injected into an ongoing GPU shot.

- Original three-ball constructor layout, selected object 0.
- Cue input: horizontal angle 0 degrees, elevation 35 degrees, tipX 0.25, tipY 0, speed 10.
- Application substep 389, outer step 200. Cue removed at substep 163.
- Rapier source revision: b716d375efc0201003f0cd9ef7168eee0b62c177; Parry 0.31.1.
- Original WASM pre-snapshot SHA256: 2ed2cb463a24c876de89e67ce6ee4c8208067d0a014c563802f2c7fa7493e6b7.
- Original WASM post-snapshot SHA256: d011fdd1404c77b684499bf894bd80288d3b05f775d0f04dcd42cee26c7344db.
- Unmodified native direct-query executable SHA256: d688f62ebcf7a9cc836a1d1026a85c1e0d0bfa2c8276f50a1ae45da0b8fe1d3c.

The cloth query hits at fraction zero and therefore does not shorten the CCD interval. The right cushion query hits at fraction 0.4004574120044708. Source timestep selection yields 0.0005732740391977131 and 0.0004683926817961037 seconds. There is no post-solve pose clamp in this particular case: the split intervals make post-solve activation inactive. This fixture does not establish general active-clamp or whole-world parity.

Instrumented and unmodified native post-snapshot bytes agree. Original WASM and native output agree on every body field; three warm-start cache zero signs differ. This is not a claim of complete snapshot bit identity.

The prediction fixture records pre-force state and source endpoint. Sphere geometric CCD has zero local COM and a one-point local-zero proxy; rotation must not be approximated for arbitrary shapes. Generic exponential rotation remains a separate implementation boundary.
