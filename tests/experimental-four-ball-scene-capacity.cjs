'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const Scene = require('../src/experimental-scene-activation');
const f = Math.fround, copy = x => structuredClone(x), U = 0xffffffff, h = index => ({index, generation: 0});
const link = (edge_id, a, b) => ({edge_id, body1: h(a), body2: h(b)});
function synthetic({members = 4, links = [], dirty = 0, pending = null, timer = 0, threshold = 1} = {}) {
    const activation = () => ({normalized_linear_threshold: f(threshold), angular_threshold: f(.5), time_until_sleep: f(.5), time_since_can_sleep: f(timer), sleeping: false,
        sleep_prev_pose: {translation: [0, 0, 0], rotation: [0, 0, 0, 1], padding: 0}});
    const bodies = Array.from({length: members}, (_, i) => ({handle: h(i + 1), type: 'Dynamic', enabled: true, changes: 0,
        ids: {active_island_id: 0, active_set_id: i, island_id: 0, island_index: i}, activation: activation(), maxExtent: f(.03), jointAdjacency: []}));
    bodies.unshift({handle: h(0), type: 'Fixed', enabled: true, changes: 0, ids: {active_island_id: U, active_set_id: U, island_id: U, island_index: U}, activation: activation(), maxExtent: 1, jointAdjacency: []});
    const locations = []; links.forEach((l, index) => { while (locations.length <= l.edge_id) locations.push([U, U]); locations[l.edge_id] = [0, index]; });
    return {kind: 'source-scene-activation', phase: 'post-world-step-post-application', noOtherPendingChanges: true,
        manager: {active_set_epoch: 7, islands: {n: 1, v: [{bodies: bodies.slice(1).map(b => b.handle)}]}, awake_island: 0, free_islands: [],
            persistent: {islands: {n: 1, v: [{bodies: bodies.slice(1).map(b => b.handle), contact_links: copy(links), joint_links: [], constraint_remove_count: dirty, split_denied_until: 0, sleeping: false}, null, null]},
                free_islands: [2, 1], contact_link_locs: locations, joint_link_locs: [], removal_journal: [], split_island: pending, sleep_scan_stamp: 10, bootstrapped: true}},
        bodies, modifiedBodies: [], consumedModifiedBodies: []};
}
function cueScene() {
    const s = synthetic({links: [link(0, 0, 1), link(1, 0, 2), link(2, 0, 3), link(3, 0, 4)]}), p = s.manager.persistent;
    const cue = {bodies: [h(5), h(6)], contact_links: [], joint_links: [
        {key: {variant: 'Impulse', value: h(0)}, body1: h(5), body2: h(6)},
        {key: {variant: 'Impulse', value: h(1)}, body1: h(7), body2: h(5)}], constraint_remove_count: 2, split_denied_until: 0, sleeping: false};
    p.islands.v[1] = cue; p.islands.n = 2; p.free_islands = [2]; p.joint_link_locs = cue.joint_links.map((l, i) => [copy(l.key), [1, i]]);
    for (let i = 5; i <= 6; i++) { const b = copy(s.bodies[1]); b.handle = h(i); b.activation.normalized_linear_threshold = -1;
        b.ids = {active_island_id: 0, active_set_id: i - 1, island_id: 1, island_index: i - 5};
        b.jointAdjacency = i === 5 ? [h(0), h(1)] : [h(0)]; s.bodies.push(b); s.manager.islands.v[0].bodies.push(h(i)); }
    const fixed = copy(s.bodies[0]); fixed.handle = h(7); fixed.jointAdjacency = [h(1)]; s.bodies.push(fixed); return s;
}
const physical = s => s.bodies.filter(b => b.type === 'Dynamic' && !b.activation.sleeping).map(b => ({handle: b.handle,
    translation: [0, 0, 0], rotation: [0, 0, 0, 1], linear: [0, 0, 0], angular: [0, 0, 0], userForce: [0, 0, 0], userTorque: [0, 0, 0], gravity: [0, 0, 0], invMass: [1, 1, 1], gravityScale: 1}));
async function one(initial, operations = [], parameters = {}, removedBodies = []) {
    const stage = Scene.createReferenceStage(initial), token = {}; stage.claim(token);
    try { const prepared = stage.beginFrame({apiCalls: [], removedBodies}, token);
        const out = await stage.observe(physical(prepared), {dt: f(1 / 960), lengthUnit: 1, ...parameters}, operations, token);
        const final = stage.postApplication([], token); stage.commit(token); Scene.validate(final); return out;
    } finally { stage.abort(token); stage.release(token); stage.dispose(); }
}
function graph(s, inactive) {
    const edges = s.manager.persistent.islands.v[0].contact_links.map(l => ({collider1: h(l.body1.index + 10), collider2: h(l.body2.index + 10), body1: l.body1, body2: l.body2, active: l.edge_id !== inactive}));
    return {kind: 'owned-rigid-contact-connectivity', bodyColliders: s.bodies.map(b => ({body: b.handle, colliders: [h(b.handle.index + 10)]})),
        colliders: s.bodies.map(b => ({handle: h(b.handle.index + 10), body: b.handle})), edges,
        adjacency: s.bodies.map(b => ({collider: h(b.handle.index + 10), outgoing: edges.flatMap((e, i) => e.body1.index === b.handle.index ? [i] : []).reverse(), incoming: edges.flatMap((e, i) => e.body2.index === b.handle.index ? [i] : []).reverse()}))};
}
test('scene six-body capacity is separate from the unchanged five-body global and four-body local split bounds', () => {
    assert.equal(Scene.CAPABILITY.maxDynamicBodies, 6); assert.equal(Scene.CAPABILITY.maxGlobalSplitBodies, 5); assert.equal(Scene.CAPABILITY.maxJointFreeLocalSplitBodies, 4);
    assert.equal(Scene.CAPABILITY.wholeWorld, false); assert.equal(Scene.CAPABILITY.preparedPhaseOnly, true);
    const s = cueScene(); assert.doesNotThrow(() => Scene.validate(s));
    for (const mutate of [x => x.bodies.find(b => b.handle.index === 6).jointAdjacency = [],
        x => x.manager.persistent.islands.v[1].joint_links[1].body1 = h(0),
        x => x.manager.persistent.islands.v[1].joint_links[0].body2 = h(4),
        x => { x.manager.persistent.islands.v[1].joint_links[0].body2 = h(5); x.manager.persistent.islands.v[1].joint_links[1].body2 = h(6); x.bodies[5].jointAdjacency = [h(0)]; x.bodies[6].jointAdjacency = [h(1)]; },
        x => x.manager.islands.v[0].bodies.pop()]) { const bad = copy(s); mutate(bad); assert.throws(() => Scene.validate(bad)); }
    assert.throws(() => Scene.validate(synthetic({members: 6})), /disconnected original cue/);
    assert.throws(() => Scene.validate(synthetic({members: 7})), /four balls plus cue/);
});
test('optional role labels cannot bypass or redefine six-body structural membership and withdrawal', async () => {
    const s = cueScene(); s.roles = {head: h(1), shaft: h(2), guide: h(0)};
    await assert.rejects(one(s, [], {}, [h(1), h(2), h(0)]), /Only atomic original/);
    delete s.roles; const out = await one(s, [], {}, [h(6), h(5), h(7)]);
    assert.deepEqual(out.context.bodies.map(b => b.handle.index), [0, 1, 2, 3, 4]);
    assert.equal(out.context.manager.persistent.islands.n, 1); assert.deepEqual(out.context.manager.persistent.joint_link_locs, []);
    assert.deepEqual(out.context.manager.persistent.free_islands, [2, 1]); assert.equal(out.context.manager.active_set_epoch, 10);
});
test('six-body scene rejects a contact mutation that couples the cue and ball islands transactionally', async () => {
    const s = cueScene(); await assert.rejects(one(s, [{type: 'link', edgeId: 4, body1: h(5), body2: h(1)}]), /coupled cue\/ball/);
    assert.equal(s.manager.persistent.islands.n, 2);
});
test('four-body local split uses source dual-frontier, collider adjacency, allocator and swap order', async () => {
    const links = [link(0, 0, 1), link(1, 0, 2), link(2, 0, 3), link(3, 0, 4), link(4, 1, 2), link(5, 2, 3), link(6, 3, 4)];
    const s = synthetic({links}), connectivity = graph(s, 5);
    await assert.rejects(one(s, [{type: 'unlink', edgeId: 5}]), /complete owned contact adjacency/);
    const out = await one(s, [{type: 'unlink', edgeId: 5}], {connectivity}), p = out.context.manager.persistent;
    assert.deepEqual(out.effects.localSplits, [{island: 0, created: 1, members: [h(2), h(1)]}]);
    assert.deepEqual(p.islands.v[0].bodies, [h(3), h(4)]); assert.deepEqual(p.islands.v[1].bodies, [h(2), h(1)]);
    assert.deepEqual(p.islands.v[1].contact_links.map(l => l.edge_id), [4, 1, 0]);
    assert.equal(out.context.manager.active_set_epoch, 7); assert.deepEqual(p.free_islands, [2]);
});
test('four-body connected alternate path avoids false split and rejects a partial graph', async () => {
    const s = synthetic({links: [link(0, 1, 2), link(1, 2, 3), link(2, 3, 4), link(3, 4, 1)]}), connectivity = graph(s, 0);
    const out = await one(s, [{type: 'unlink', edgeId: 0}], {connectivity}); assert.deepEqual(out.effects.localSplits, []);
    assert.equal(out.context.manager.persistent.islands.n, 1); assert.equal(out.context.manager.persistent.islands.v[0].constraint_remove_count, 0);
    const incomplete = copy(connectivity); incomplete.adjacency[1].outgoing = [];
    await assert.rejects(one(s, [{type: 'unlink', edgeId: 0}], {connectivity: incomplete}), /Missing directional graph edge/);
});
test('four-ball source link operations retain unsorted registration and exact edge location order', async () => {
    const s = synthetic(), p = s.manager.persistent;
    p.islands = {n: 4, v: s.bodies.slice(1).map((b, i) => {
        b.ids.island_id = i; b.ids.island_index = 0;
        return {bodies: [b.handle], contact_links: [], joint_links: [], constraint_remove_count: 0, split_denied_until: 0, sleeping: false};
    })}; p.free_islands = [];
    const operations = [[0, 1], [1, 3], [2, 2], [5, 4]].map(([edgeId, member]) => ({type: 'link', edgeId, body1: h(0), body2: h(member)}));
    const out = await one(s, operations);
    assert.deepEqual(out.context.manager.persistent.contact_link_locs, [[0, 0], [2, 0], [1, 0], [U, U], [U, U], [3, 0]]);
    assert.deepEqual(out.context.manager.persistent.islands.v.map(c => c.contact_links[0].edge_id), [0, 2, 1, 5]);
});
test('local split rejects forged endpoints even when graph edge IDs and incidence counts agree', async () => {
    const s = synthetic({links: [link(0, 1, 2), link(1, 2, 3), link(2, 3, 4), link(3, 4, 1)]}), connectivity = graph(s, 0);
    connectivity.edges[1].body2 = h(0); connectivity.edges[1].collider2 = h(10);
    connectivity.adjacency[3].incoming = []; connectivity.adjacency[0].incoming.push(1);
    await assert.rejects(one(s, [{type: 'unlink', edgeId: 0}], {connectivity}), /endpoints disagree with source link registry/);
});
test('four-body dirty split and sleep preserve pending-step semantics and active chunk allocator order', async () => {
    const s = synthetic({links: [link(0, 0, 1), link(1, 0, 2), link(2, 0, 3), link(3, 0, 4)], dirty: 1, timer: .5});
    const first = await one(s); assert.equal(first.context.manager.persistent.split_island, 0); assert.equal(first.effects.sleptBodies.length, 0);
    const second = await one({...first.context, phase: 'post-world-step-post-application'});
    assert.equal(second.context.manager.persistent.islands.n, 4); assert.equal(second.effects.sleptBodies.length, 4);
    assert.equal(second.context.manager.active_set_epoch, 11); assert.equal(second.context.manager.persistent.split_island, null);
    assert.deepEqual(second.context.manager.islands.v.map(c => c?.bodies.map(b => b.index)), [[], [1], [2], [3], [4]]);
});
module.exports = {synthetic, cueScene, physical, graph};
