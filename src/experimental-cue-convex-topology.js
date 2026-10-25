/* SPDX-License-Identifier: Apache-2.0
 * Source-derived initial SharedShape geometry export for Parry3d 0.31.1.
 * No stepping, triangle reconstruction, contact cache, or contact oracle.
 * See docs/cue-convex-topology-export.md for the deliberately bounded scope.
 */
(function (G) {
  'use strict';

  const FORMAT = 'parry-0.31.1-native-convex-topology-v1';
  const SOURCE = Object.freeze({
    rapierVersion: '0.21.0',
    rapierRevision: 'b716d375efc0201003f0cd9ef7168eee0b62c177',
    engineSha256: 'fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4',
    parryVersion: '0.31.1',
    parryRevision: '3383f51cbbe9af70565427e7a66c605e1557c1fc',
    parryCrateSha256: '7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e',
  });
  const LIMITS = Object.freeze({ points: 32, faces: 64, edges: 96, adjacency: 256 });
  // A structurally plausible object, JSON copy, or cross-realm clone is not an
  // admitted export. Admission only follows all checks in exportNativeHull.
  const admitted = new WeakSet();

  function fail(code, message) {
    throw Object.assign(new RangeError(message), { code });
  }
  function unsupported(message) {
    throw Object.assign(new RangeError(message), { code: 'unsupported-native-hull', unsupported: true });
  }
  function requireThat(condition, message) {
    if (!condition) fail('invalid-native-topology', message);
  }
  function deepFreeze(value) {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) deepFreeze(child);
      Object.freeze(value);
    }
    return value;
  }
  function isDeepFrozen(value) {
    return !value || typeof value !== 'object' ||
      (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));
  }
  function handleParts(handle) {
    if (typeof handle !== 'number' || !Number.isFinite(handle)) {
      unsupported('An exact finite Rapier numeric collider handle is required');
    }
    // Rapier bindings/typescript/src/utils.rs uses f64::to_bits(), NOT a
    // numeric integer conversion. The low word is index, high is generation.
    const bytes = new DataView(new ArrayBuffer(8));
    bytes.setFloat64(0, handle, true);
    const index = bytes.getUint32(0, true), generation = bytes.getUint32(4, true);
    return { index, generation, bitsHex: generation.toString(16).padStart(8, '0') + index.toString(16).padStart(8, '0') };
  }
  function checkProvenanceMetadata(decoded, decoder) {
    if (!decoder || decoder.SOURCE_REVISION !== SOURCE.rapierRevision ||
        decoder.ENGINE_VERSION !== SOURCE.rapierVersion || decoder.ENGINE_SHA256 !== SOURCE.engineSha256 ||
        typeof decoder.field !== 'function' || typeof decoder.floatValue !== 'function' ||
        typeof decoder.encodeLosslessTree !== 'function') {
      fail('native-hull-decoder', 'The pinned source-derived snapshot decoder is required');
    }
    if (!decoded || decoded.schemaVersion !== 1 || decoded.sourceRevision !== SOURCE.rapierRevision ||
        decoded.engineVersion !== SOURCE.rapierVersion || decoded.engineSha256 !== SOURCE.engineSha256 ||
        decoded.parryVersion !== SOURCE.parryVersion ||
        decoded.verification?.nativeBincodeByteIdentical !== true ||
        decoded.verification?.javascriptTypedReencodeByteIdentical !== true) {
      fail('native-hull-provenance', 'Pinned source/engine identity and both byte-roundtrip verifications are required');
    }
    if (!Number.isSafeInteger(decoded.byteLength) || decoded.byteLength < 1 || decoded.byteLength > 32 * 1024 * 1024 ||
        typeof decoded.inputSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(decoded.inputSha256)) {
      fail('native-hull-provenance', 'Verified snapshot byte length and SHA256 are required');
    }
  }
  function checkProvenance(decoded, decoder) {
    checkProvenanceMetadata(decoded, decoder);
    if (typeof module === 'undefined' || !module.exports || typeof require !== 'function') {
      unsupported('Native topology export requires the Node snapshot decoder; packing admitted exports does not');
    }
    // The decoder result is mutable. Flags alone would incorrectly admit a
    // tree edited AFTER decodeSnapshot's full native/JavaScript verification.
    const bytes = decoder.encodeLosslessTree(decoded.state);
    const hash = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== decoded.byteLength || hash !== decoded.inputSha256) {
      fail('native-hull-snapshot-mutated', 'Decoded source tree changed after byte-roundtrip verification');
    }
  }
  function makeReader(decoder) {
    const struct = (node, name) => {
      if (node?.kind !== 'struct' || node.name !== name || !Array.isArray(node.fields)) {
        fail('native-hull-schema', 'Expected source struct ' + name);
      }
      return node;
    };
    const field = (node, name) => {
      if (!Array.isArray(node?.fields) || node.fields.filter(pair => Array.isArray(pair) && pair[0] === name).length !== 1) {
        fail('native-hull-schema', 'Expected one source field ' + name);
      }
      return decoder.field(node, name);
    };
    const u32 = (node, label) => {
      if (node?.kind !== 'integer' || node.width !== 'u32' || typeof node.value !== 'string' ||
          !/^(0|[1-9][0-9]*)$/.test(node.value)) fail('native-hull-schema', label + ' must be a source u32');
      const value = Number(node.value);
      if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) fail('native-hull-schema', label + ' is outside u32');
      return value;
    };
    const list = (node, label, min, max) => {
      if (node?.kind !== 'seq' || !Array.isArray(node.items)) fail('native-hull-schema', label + ' must be a source Vec');
      if (node.items.length < min || node.items.length > max) unsupported(label + ' requires ' + min + '..' + max + ' elements');
      return node.items;
    };
    const vector = (node, label) => {
      if (node?.kind !== 'tuple_struct' || node.name !== 'Vec3' || !Array.isArray(node.items) || node.items.length !== 3) {
        fail('native-hull-schema', label + ' must be a source glam Vec3');
      }
      return node.items.map(component => {
        if (component?.kind !== 'float' || component.width !== 'f32') fail('native-hull-schema', label + ' must contain f32 components');
        const value = decoder.floatValue(component);
        if (!Number.isFinite(value)) unsupported(label + ' contains a non-finite component');
        return value;
      });
    };
    const pair = (node, label) => {
      if (node?.kind !== 'tuple' || !Array.isArray(node.items) || node.items.length !== 2) {
        fail('native-hull-schema', label + ' must be a source [u32; 2]');
      }
      return node.items.map(value => u32(value, label));
    };
    return { struct, field, u32, list, vector, pair };
  }

  function validateTopology(hull) {
    const { points, vertices, faces, edges, verticesAdjToFace: fv, edgesAdjToFace: fe,
      facesAdjToVertex: vf, edgesAdjToVertex: ve } = hull;
    requireThat(vertices.length === points.length, 'Vertex records must retain every original point index');
    requireThat(fv.length === fe.length && vf.length === ve.length && fv.length === vf.length,
      'Native face/vertex adjacency lengths disagree');
    const vertexRows = vertices.map(() => []), edgeFaces = edges.map(() => []);
    let faceOffset = 0;
    for (let fid = 0; fid < faces.length; fid++) {
      const face = faces[fid];
      requireThat(face.first === faceOffset && face.count >= 3 && face.count <= points.length &&
        face.first + face.count <= fv.length, 'Invalid or noncontiguous native face adjacency range');
      const seenVertices = new Set(), seenEdges = new Set();
      for (let i = 0; i < face.count; i++) {
        const at = face.first + i, vid = fv[at], eid = fe[at], nextVid = fv[face.first + (i + 1) % face.count];
        requireThat(vid < points.length && eid < edges.length, 'Face adjacency index out of bounds');
        requireThat(!seenVertices.has(vid) && !seenEdges.has(eid), 'Repeated vertex/edge in native face loop');
        seenVertices.add(vid); seenEdges.add(eid);
        const edge = edges[eid];
        requireThat(!edge.deleted, 'Deleted native edge appears in live face adjacency');
        requireThat(edge.faces.includes(fid), 'Face/edge incidence does not agree');
        requireThat((edge.vertices[0] === vid && edge.vertices[1] === nextVid) ||
          (edge.vertices[1] === vid && edge.vertices[0] === nextVid), 'Native edge does not join consecutive face vertices');
        vertexRows[vid].push([fid, eid]);
        edgeFaces[eid].push(fid);
      }
      faceOffset += face.count;
    }
    requireThat(faceOffset === fv.length, 'Unreferenced native face adjacency entries');
    let vertexOffset = 0;
    for (let vid = 0; vid < vertices.length; vid++) {
      const vertex = vertices[vid], expected = vertexRows[vid];
      requireThat(vertex.first === vertexOffset && vertex.num === expected.length && vertex.first + vertex.num <= vf.length,
        'Invalid native vertex adjacency range');
      // ConvexPolyhedron::from_convex_mesh fills these rows by ascending face
      // order, pairing each face's outgoing original edge with its vertex.
      for (let i = 0; i < vertex.num; i++) {
        requireThat(vf[vertex.first + i] === expected[i][0] && ve[vertex.first + i] === expected[i][1],
          'Native vertex/face/edge inverse adjacency does not agree');
      }
      vertexOffset += vertex.num;
    }
    requireThat(vertexOffset === vf.length, 'Unreferenced native vertex adjacency entries');
    for (let eid = 0; eid < edges.length; eid++) {
      const edge = edges[eid], adjacent = edgeFaces[eid];
      requireThat(edge.vertices.every(vid => vid < points.length) && edge.faces.every(fid => fid < faces.length),
        'Native edge vertex/face index out of bounds');
      if (edge.deleted) {
        requireThat(adjacent.length === 0, 'Deleted native edge must retain its index without live adjacency');
      } else {
        requireThat(edge.vertices[0] !== edge.vertices[1] && edge.faces[0] !== edge.faces[1] && adjacent.length === 2 &&
          adjacent.includes(edge.faces[0]) && adjacent.includes(edge.faces[1]), 'Live native edge must join two vertices and two faces');
      }
    }
    return hull;
  }

  function exportNativeHull(decoded, numericColliderHandle, decoder) {
    checkProvenance(decoded, decoder);
    return extractNativeHull(decoded, numericColliderHandle, decoder);
  }

  // Same private topology authority as the Node path. Copy before the first
  // await: caller mutation cannot alter the tree whose bytes were hashed.
  async function exportNativeHullBrowser(input, numericColliderHandle, decoder) {
    checkProvenanceMetadata(input, decoder);
    const decoded = structuredClone(input);
    const bytes = new Uint8Array(decoder.encodeLosslessTree(decoded.state));
    if (bytes.length !== decoded.byteLength) {
      fail('native-hull-snapshot-mutated', 'Decoded source tree byte length changed after verification');
    }
    if (!globalThis.crypto?.subtle) fail('native-hull-crypto', 'Web Crypto SHA-256 is required');
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    const hash = Array.from(digest, x => x.toString(16).padStart(2, '0')).join('');
    if (hash !== decoded.inputSha256) {
      fail('native-hull-snapshot-mutated', 'Decoded source tree changed after byte-roundtrip verification');
    }
    return extractNativeHull(decoded, numericColliderHandle, decoder);
  }

  function extractNativeHull(decoded, numericColliderHandle, decoder) {
    const handle = handleParts(numericColliderHandle);
    const r = makeReader(decoder), F = r.field;
    const root = r.struct(decoded.state, 'SnapshotWorld');
    const colliders = r.struct(F(root, 'colliders'), 'ColliderSet');
    const arena = r.struct(F(colliders, 'colliders'), 'Arena');
    const itemsNode = F(arena, 'items');
    if (itemsNode?.kind !== 'seq' || !Array.isArray(itemsNode.items)) fail('native-hull-schema', 'Arena.items must be a source Vec');
    const entry = itemsNode.items[handle.index];
    if (!entry || entry.kind !== 'struct_variant' || entry.name !== 'Entry' || entry.variant !== 'Occupied' || entry.index !== 1) {
      fail('native-hull-collider-missing', 'Exact collider handle does not identify an occupied native arena slot');
    }
    if (r.u32(F(entry, 'generation'), 'Arena generation') !== handle.generation) {
      fail('native-hull-handle-generation', 'Collider handle generation does not match the occupied native arena slot');
    }
    const collider = r.struct(F(entry, 'value'), 'Collider'), shape = F(collider, 'shape');
    // SharedShape serializes directly as TypedShape, not as a nested hull
    // search. In this pinned dim3/alloc source ConvexPolyhedron is variant 11.
    if (shape?.kind !== 'newtype_variant' || shape.name !== 'TypedShape' ||
        shape.variant !== 'ConvexPolyhedron' || shape.index !== 11) {
      unsupported('The selected collider SharedShape must be an unrounded ConvexPolyhedron');
    }
    const native = r.struct(shape.value, 'ConvexPolyhedron');
    const points = r.list(F(native, 'points'), 'points', 4, LIMITS.points).map(point => r.vector(point, 'point'));
    const vertices = r.list(F(native, 'vertices'), 'vertices', 4, LIMITS.points).map(node => {
      r.struct(node, 'Vertex');
      return { first: r.u32(F(node, 'first_adj_face_or_edge'), 'vertex first'), num: r.u32(F(node, 'num_adj_faces_or_edge'), 'vertex num') };
    });
    const faces = r.list(F(native, 'faces'), 'faces', 4, LIMITS.faces).map(node => {
      r.struct(node, 'Face');
      return { first: r.u32(F(node, 'first_vertex_or_edge'), 'face first'), count: r.u32(F(node, 'num_vertices_or_edges'), 'face count'), normal: r.vector(F(node, 'normal'), 'face normal') };
    });
    const edges = r.list(F(native, 'edges'), 'edges', 6, LIMITS.edges).map(node => {
      r.struct(node, 'Edge');
      const deleted = F(node, 'deleted');
      if (deleted?.kind !== 'bool' || typeof deleted.value !== 'boolean') fail('native-hull-schema', 'Edge.deleted must be a source bool');
      return { vertices: r.pair(F(node, 'vertices'), 'edge vertices'), faces: r.pair(F(node, 'faces'), 'edge faces'), dir: r.vector(F(node, 'dir'), 'edge dir'), deleted: deleted.value };
    });
    const adjacency = name => r.list(F(native, name), name, 0, LIMITS.adjacency).map(node => r.u32(node, name));
    const hull = {
      format: FORMAT, source: { ...SOURCE }, handle,
      snapshot: { inputSha256: decoded.inputSha256, byteLength: decoded.byteLength },
      verification: { nativeBincodeByteIdentical: true, javascriptTypedReencodeByteIdentical: true },
      points, vertices, faces, edges,
      verticesAdjToFace: adjacency('vertices_adj_to_face'),
      edgesAdjToFace: adjacency('edges_adj_to_face'),
      facesAdjToVertex: adjacency('faces_adj_to_vertex'),
      edgesAdjToVertex: adjacency('edges_adj_to_vertex'),
    };
    validateTopology(hull);
    deepFreeze(hull);
    admitted.add(hull);
    return hull;
  }

  function assertNativeHull(hull) {
    if (!hull || typeof hull !== 'object' || !admitted.has(hull) || hull.format !== FORMAT || !isDeepFrozen(hull)) {
      fail('native-hull-not-admitted', 'An unchanged, deep-frozen exportNativeHull result from this module instance is required');
    }
    return validateTopology(hull);
  }

  const api = Object.freeze({ FORMAT, SOURCE, LIMITS, exportNativeHull, exportNativeHullBrowser, assertNativeHull });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.LabCueConvexTopologyExperimental = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
