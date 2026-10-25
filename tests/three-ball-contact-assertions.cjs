'use strict';
// Expected snapshots are assertions only, never inputs to the owned world.
const assert = require('node:assert/strict');
const F = require('./three-ball-scene-fixture.cjs');
const O = require('./three-ball-pair-oracle.cjs');
const same = F.same, copy = x => structuredClone(x), U = 0xffffffff;
function inspect(raw, decoded) {
  const d = decoded ?? F.decode({post: raw}, 'post');
  const field = F.D.field;
  const graph = F.plain(field(field(field(d.state, 'narrow_phase'), 'contact_graph'), 'graph'));
  const broad = F.plain(field(d.state, 'broad_phase'));
  const adjacency = raw.colliders.map(c => {
    const node = graph.nodes.find(n => same(n.weight, c.handle));
    const row = {collider: copy(c.handle), outgoing: [], incoming: []};
    if (node) for (let side = 0; side < 2; side++) {
      let at = node.next[side];
      const seen = new Set();
      while (at !== U) {
        assert.ok(graph.edges[at] && !seen.has(at), 'Valid native directional graph chain');
        seen.add(at);
        row[side ? 'incoming' : 'outgoing'].push(at);
        at = graph.edges[at].next[side];
      }
    }
    return row;
  });
  const proxies = [];
  for (const node of broad.tree.nodes) for (const side of ['left', 'right']) {
    const leaf = node[side];
    if ((leaf.data & 0x3fffffff) === 1) proxies.push({
      collider: copy(raw.colliders.find(c => c.handle.index === leaf.children).handle),
      min: copy(leaf.mins), max: copy(leaf.maxs)
    });
  }
  return {edges: O.globalEdges(raw, d), adjacency, proxies,
    liveColliders: raw.colliders.map(c => copy(c.handle))};
}
function compare(out, expected, seed, close, stats) {
  assert.deepEqual(out.globalEdges, expected.edges, 'Exact complete dense graph');
  assert.deepEqual(out.contactGraph.adjacency, expected.adjacency, 'Exact complete directional adjacency');
  assert.deepEqual(out.contactGraph.liveColliders, expected.liveColliders, 'Exact live collider registry');
  assert.equal(out.contactGraph.sequence, out.frame, 'Every source pipeline has a graph sequence');
  const ownProxies = seed.staticProxies.map(p => ({collider: p.colliderHandle, min: p.min, max: p.max}));
  for (let i = 0; i < 3; i++) for (const collider of [seed.balls[i].collider, seed.balls[i].pairCollider])
    ownProxies.push({collider, ...out.contactGraph.proxies[i]});
  ownProxies.push(...out.contactGraph.cueProxies);
  assert.equal(ownProxies.length, expected.proxies.length, 'All live source fat proxies');
  for (const p of ownProxies) {
    const want = expected.proxies.find(x => same(x.collider, p.collider));
    assert.ok(want, 'Generation-bearing source fat proxy identity');
    for (const k of ['min', 'max']) close(p[k], want[k], 2e-6, 'proxy.' + p.collider.index + '.' + k, stats);
  }
}
module.exports = {inspect, compare};
