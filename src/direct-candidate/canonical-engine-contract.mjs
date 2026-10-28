/**
 * Opt-in contract only: NO physics, scene truncation, Rapier fallback, gameplay
 * migration, trace synthesis, or release qualification is implemented here.
 * Admission is a necessary metadata/domain gate, not proof that every event is
 * supported. A physics producer must still admit raw clearance and each event.
 */
import {packRuleConfig} from './deterministic-rules.mjs';
import {STRIKE_CAPABILITY, STRIKE_MATERIAL_PROFILE} from './deterministic-raw-strike.mjs';

const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
function copy(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, copy);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  }
  throw new TypeError('Contract data must be finite plain structured data');
}
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
// Exact canonical strings, not a collision-prone hash used as authority.
const identity = (kind, value) => kind + ':' + stable(value);
const uint = x => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;
const finiteVector = (x, keys = ['x', 'y', 'z']) => x && keys.every(k => Number.isFinite(x[k]));
const vector = x => ({x: x.x, y: x.y, z: x.z});
const quaternion = x => ({x: x.x, y: x.y, z: x.z, w: x.w});
const zeroVector = x => finiteVector(x) && x.x === 0 && x.y === 0 && x.z === 0;
const identityRotation = x => finiteVector(x, ['x', 'y', 'z', 'w']) && x.x === 0 && x.y === 0 && x.z === 0 && Math.abs(x.w) === 1;
const issue = (code, path, message) => ({code, path, message});

export const CANONICAL_CONTRACT_VERSION = 1;
export const CANONICAL_CLOCK_MAX = 0x7fffffff;
export const CANONICAL_BUDGET_SEMANTICS = freeze({timeScale: 2 ** 20, maximumTicks: 'total elapsed simulated Q20 ticks from declared raw-start, INCLUDING raw strike', clockMaximum: CANONICAL_CLOCK_MAX, sessionTime: 'independent of UI session time', workAndEvents: 'separate cumulative caps; a duration budget is not execution-completion evidence'});
export const CANONICAL_DEFAULT_PARAMETERS = freeze({
  gravity: 9.81, clothFriction: .20, ballFriction: .04, ballRestitution: .93,
  cushionFriction: .15, cushionRestitution: .82, clothRestitution: .20,
  tipFriction: .70, tipNormalStiffness: 1000000, tipTangentialStiffness: 400000,
  tipNormalDamping: 110, tipTangentialDamping: 10, cueLateralStiffness: 1200,
  cueLateralDamping: 1, rollingLength: .00045, spinLength: .00035,
});
export const CANONICAL_RAW_INPUT_LIMITS = freeze({speedRange: [...STRIKE_CAPABILITY.speedRange], maximumTipRadius: STRIKE_CAPABILITY.maximumTipRadius, maximumElevation: STRIKE_CAPABILITY.maximumElevation, maximumAbsoluteAngle: 3600});
export const CANONICAL_MODEL = freeze({
  id: 'canonical-equal-solid-sphere-event-model-v1',
  contractVersion: CANONICAL_CONTRACT_VERSION, budgetSemantics: CANONICAL_BUDGET_SEMANTICS,
  bodyCounts: [3, 4], radius: .03075, mass: .210,
  inertia: 'solid-isotropic-sphere:2/5*m*r^2',
  stateEncoding: 'Q24-position-velocity-q; q=R*omega; Q20-time',
  quantization: 'nearest integer using Math.round; overflow is unsupported; never saturate',
  rawMaterialProfile: STRIKE_MATERIAL_PROFILE,
  rawInitializerProfile: STRIKE_CAPABILITY.profile, rawInputDomain: CANONICAL_RAW_INPUT_LIMITS,
  geometry: 'complete finite cloth, four actual cushion hulls, all other statics',
  sphereOrientation: 'visual-only; excluded from physical identity',
  boxes: 'unsupported until orientation-dependent rigid-body physics exists',
  sourceRapierEquivalent: false,
  executionImplementedByThisModule: false,
  productionEnabled: false,
});
export const CANONICAL_PROFILES = freeze({
  'canonical-local-v1': {id: 'canonical-local-v1', modelId: CANONICAL_MODEL.id, receiptPolicy: 'local canonical evolution; global certificate diagnostic only'},
  'strict-carried-v1': {id: 'strict-carried-v1', modelId: CANONICAL_MODEL.id, receiptPolicy: 'carried enclosure and unchanged budgets'},
});
const SCENE_KEYS = new Set(['world', 'lastStroke', 'strokeSubsteps', 'time', 'steps', 'dt', 'shots', 'nextId', 'revision', 'params', 'events', 'statics', 'objects']);
const BODY_KEYS = new Set(['id', 'shape', 'radius', 'half', 'mass', 'kind', 'label', 'color', 'trail', 'maxHeight', 'distance', 'lastPos', 'bodyHandle', 'colliderHandle', 'pairColliderHandle', 'pos', 'rot', 'v', 'w']);
const trustedScenes = new WeakSet(), trustedRequests = new WeakSet(), trustedCandidates = new WeakSet();
const STATIC_KEYS = new Set(['shape', 'half', 'kind', 'color', 'label', 'pos', 'vertices', 'indices', 'bodyHandle', 'colliderHandle', 'pairColliderHandle', 'rot', 'v', 'w', 'trail', 'lastPos']);

/**
 * Snapshot adapter. The manifest must come from the SAME live scene/epoch as
 * PhysicsLab.snapshot(), not from a selected subset. The opaque Rapier world is
 * intentionally not decoded or resumed: this is a NEW explicitly named model.
 * Every body's actual p/v/w/shape/mass and every static geometry is retained.
 * Invalid/unrepresentable input returns reasons; it is never clipped or padded.
 */
export function encodeCanonicalScene(snapshot, manifest) {
  const reasons = [];
  const add = (code, path, message) => reasons.push(issue(code, path, message));
  if (!snapshot || !Array.isArray(snapshot.objects) || !Array.isArray(snapshot.statics) || !snapshot.params) {
    return freeze({kind: 'canonical-scene-admission-v1', admitted: false, scene: null, reasons: [issue('MISSING_SCENE', 'snapshot', 'Complete PhysicsLab snapshot metadata is required')]});
  }
  for (const key of Object.keys(snapshot)) if (!SCENE_KEYS.has(key)) add('UNKNOWN_SCENE_FIELD', key, 'Unknown scene metadata cannot be silently ignored');
  const ids = snapshot.objects.map(o => o?.id);
  const expected = manifest?.objectIds;
  if (!Array.isArray(expected) || !uint(manifest?.staticCount) || !expected.every(uint) || new Set(expected).size !== expected.length || stable([...expected].sort((a, b) => a - b)) !== stable([...ids].sort((a, b) => a - b)) || manifest.staticCount !== snapshot.statics.length) {
    add('INCOMPLETE_ROSTER', 'manifest', 'Full object-ID roster and static count must exactly match the snapshot');
  }
  if (![3, 4].includes(ids.length)) add('BODY_COUNT_UNSUPPORTED', 'objects', 'This model admits the complete 3- or 4-body roster only');
  if (!ids.every(uint) || new Set(ids).size !== ids.length) add('INVALID_OBJECT_IDS', 'objects', 'Object IDs must be distinct u32 values');
  for (const key of Object.keys(snapshot.params)) if (!Object.hasOwn(CANONICAL_DEFAULT_PARAMETERS, key)) add('UNKNOWN_PARAMETER', 'params.' + key, 'Unknown material parameter cannot be ignored');
  for (const [key, value] of Object.entries(CANONICAL_DEFAULT_PARAMETERS)) if (snapshot.params[key] !== value) add('PARAMETER_UNSUPPORTED', 'params.' + key, 'Current raw material capability requires the exact declared default value');
  if (snapshot.dt !== 1 / 960) add('SOURCE_TIMESTEP_UNSUPPORTED', 'dt', 'Changed source timestep requires explicit model admission');
  if (snapshot.strokeSubsteps !== 64) add('SOURCE_STROKE_SUBSTEPS_UNSUPPORTED', 'strokeSubsteps', 'Changed source stroke substeps require explicit model admission');
  const bodies = snapshot.objects.map((body, index) => {
    const unknown = Object.entries(body || {}).filter(([key]) => !BODY_KEYS.has(key));
    const path = 'objects[' + index + ']';
    for (const key of Object.keys(body || {})) if (!BODY_KEYS.has(key)) add('UNKNOWN_BODY_FIELD', path + '.' + key, 'Unknown body setting cannot be ignored');
    if (body?.kind !== 'ball') add('BODY_MATERIAL_UNSUPPORTED', path + '.kind', 'Dynamic body material must be the declared ball material');
    if (body?.shape !== 'sphere') add('SHAPE_UNSUPPORTED', path + '.shape', 'Boxes and other orientation-dependent shapes are not supported');
    if (body?.mass !== CANONICAL_MODEL.mass || body?.radius !== CANONICAL_MODEL.radius) add('UNEQUAL_SPHERE_UNSUPPORTED', path, 'The current model requires the declared equal solid-sphere mass and radius');
    for (const field of ['pos', 'v', 'w']) if (!finiteVector(body?.[field])) add('INVALID_BODY_STATE', path + '.' + field, 'Every physical state component must be finite');
    if (finiteVector(body?.pos) && Object.values(vector(body.pos)).some(x => Math.abs(x) > 4)) add('POSITION_DOMAIN_UNSUPPORTED', path + '.pos', 'Position is outside the bounded canonical domain; no clipping is permitted');
    if (finiteVector(body?.v) && Math.hypot(...Object.values(vector(body.v))) > 8) add('VELOCITY_DOMAIN_UNSUPPORTED', path + '.v', 'Linear velocity exceeds the canonical state domain');
    if (finiteVector(body?.w) && Math.hypot(...Object.values(vector(body.w))) * body.radius > 16) add('SPIN_DOMAIN_UNSUPPORTED', path + '.w', 'R*omega exceeds the canonical state domain');
    if (body?.shape !== 'sphere' && !finiteVector(body?.rot, ['x', 'y', 'z', 'w'])) add('INVALID_ORIENTATION', path + '.rot', 'Non-sphere physical orientation must be retained');
    return {id: body?.id, kind: body?.kind, shape: body?.shape, radius: body?.radius ?? null, half: body?.half ?? null, mass: body?.mass, pos: body?.pos, v: body?.v, w: body?.w, ...(unknown.length ? {unsupportedFields: Object.fromEntries(unknown)} : {}), ...(body?.shape !== 'sphere' ? {rotation: body?.rot} : {})};
  });
  const statics = snapshot.statics.map((item, index) => {
    const unknown = Object.entries(item || {}).filter(([key]) => !STATIC_KEYS.has(key));
    const path = 'statics[' + index + ']';
    for (const key of Object.keys(item || {})) if (!STATIC_KEYS.has(key)) add('UNKNOWN_STATIC_FIELD', path + '.' + key, 'Unknown static setting cannot be ignored');
    if (!['box', 'convex'].includes(item?.shape) || !['cloth', 'cushion', 'wood', 'floor'].includes(item?.kind)) add('STATIC_UNSUPPORTED', path, 'Unknown static geometry or material');
    if (!finiteVector(item?.pos) || !finiteVector(item?.rot, ['x', 'y', 'z', 'w'])) add('INVALID_STATIC_POSE', path, 'Static geometry requires its full finite pose');
    if (!identityRotation(item?.rot)) add('STATIC_ROTATION_UNSUPPORTED', path + '.rot', 'Rotated static geometry requires a genuine transformed-hull adapter');
    if (!zeroVector(item?.v) || !zeroVector(item?.w)) add('MOVING_STATIC_UNSUPPORTED', path, 'A moving environment is not a fixed static roster');
    if (item?.shape === 'box' && (!finiteVector(item.half) || Object.values(vector(item.half)).some(x => x <= 0))) add('INVALID_STATIC_GEOMETRY', path + '.half', 'Positive box half extents are required');
    if (item?.shape === 'convex' && (!Array.isArray(item.vertices) || item.vertices.length < 12 || item.vertices.length % 3 || !item.vertices.every(Number.isFinite) || !Array.isArray(item.indices) || item.indices.length < 12 || item.indices.length % 3 || !item.indices.every(x => uint(x) && x < item.vertices.length / 3))) add('INVALID_STATIC_GEOMETRY', path, 'Complete finite triangle hull geometry is required');
    return {kind: item?.kind, shape: item?.shape, pos: item?.pos, rotation: item?.rot, v: item?.v, w: item?.w, ...(unknown.length ? {unsupportedFields: Object.fromEntries(unknown)} : {}), ...(item?.shape === 'box' ? {half: item.half} : {vertices: item?.vertices, indices: item?.indices})};
  });
  if (statics.filter(x => x.kind === 'cloth').length !== 1 || statics.filter(x => x.kind === 'cushion').length !== 4) add('STATIC_ROSTER_UNSUPPORTED', 'statics', 'One finite cloth and four complete cushion hulls are required');
  if (statics.filter(x => !['cloth', 'cushion'].includes(x.kind)).length > 16) add('STATIC_COUNT_UNSUPPORTED', 'statics', 'Current static-bound capability is limited to 16 other objects');
  // Retain unsupported but representable inputs too, so the caller can explain
  // exactly which scene/settings were refused. NaN/missing state has no scene ID.
  let physical;
  try {
    const unknown = Object.entries(snapshot).filter(([key]) => !SCENE_KEYS.has(key));
    physical = copy({...(unknown.length ? {unsupportedSceneFields: Object.fromEntries(unknown)} : {}), modelId: CANONICAL_MODEL.id, parameters: snapshot.params, sourceSettings: {dt: snapshot.dt, strokeSubsteps: snapshot.strokeSubsteps}, bodies, statics});
  } catch {
    add('UNREPRESENTABLE_SCENE', 'snapshot', 'Non-finite, missing, or non-plain physical data has no canonical identity');
    return freeze({kind: 'canonical-scene-admission-v1', admitted: false, scene: null, reasons});
  }
  physical.bodies.sort((a, b) => a.id - b.id);
  // Keep visual metadata aligned with the canonical geometry order without
  // making colors/labels part of physical identity or admission.
  const staticOrder = physical.statics.map((item, index) => ({item, index}));
  staticOrder.sort((a, b) => stable(a.item) < stable(b.item) ? -1 : stable(a.item) > stable(b.item) ? 1 : 0);
  physical.statics = staticOrder.map(({item}) => item);
  const slotToId = physical.bodies.map(o => o.id);
  const scene = {kind: 'canonical-scene-v1', modelId: CANONICAL_MODEL.id, sceneId: identity('scene-v1', physical), admitted: reasons.length === 0, physical,
    slotToId, idToSlot: Object.fromEntries(slotToId.map((id, slot) => [id, slot])),
    sourceRevision: uint(snapshot.revision) ? snapshot.revision : null,
    staticPresentation: staticOrder.map(({index}) => ({color: snapshot.statics[index].color ?? '', label: snapshot.statics[index].label ?? ''})),
    presentation: snapshot.objects.map(o => ({id: o.id, label: o.label ?? '', color: o.color ?? '', rotation: finiteVector(o.rot, ['x', 'y', 'z', 'w']) ? quaternion(o.rot) : null})),
  };
  freeze(scene); trustedScenes.add(scene);
  return freeze({kind: 'canonical-scene-admission-v1', admitted: scene.admitted, scene, reasons});
}

/** Revalidate a structured-cloned scene; transport's admitted flag is not authority. */
export function validateCanonicalScene(scene) {
  if (trustedScenes.has(scene)) return scene;
  if (scene?.kind !== 'canonical-scene-v1' || scene.modelId !== CANONICAL_MODEL.id || scene.physical?.modelId !== CANONICAL_MODEL.id || !Array.isArray(scene.physical.bodies) || !Array.isArray(scene.physical.statics)) throw new RangeError('Invalid canonical scene schema');
  const p = scene.physical;
  const source = {...p.unsupportedSceneFields, params: p.parameters, ...p.sourceSettings,
    objects: p.bodies.map(body => ({...Object.fromEntries(Object.entries(body).filter(([key]) => !['rotation', 'unsupportedFields'].includes(key))), ...body.unsupportedFields, rot: body.rotation ?? {x: 0, y: 0, z: 0, w: 1}})),
    statics: p.statics.map(item => ({...Object.fromEntries(Object.entries(item).filter(([key]) => !['rotation', 'unsupportedFields'].includes(key))), ...item.unsupportedFields, rot: item.rotation})),
  };
  const checked = encodeCanonicalScene(source, {objectIds: p.bodies.map(o => o.id), staticCount: p.statics.length});
  if (!checked.scene || checked.scene.sceneId !== scene.sceneId || identity('scene-v1', p) !== scene.sceneId || stable(checked.scene.physical) !== stable(p) || checked.admitted !== scene.admitted || stable(scene.slotToId) !== stable(checked.scene.slotToId) || stable(scene.idToSlot) !== stable(checked.scene.idToSlot)) throw new RangeError('Canonical scene admission/identity/roster mismatch');
  const owned = freeze(copy(scene)); trustedScenes.add(owned); return owned;
}

export function canonicalSlotForId(scene, id) {
  if (!uint(id) || !Object.hasOwn(scene.idToSlot, id)) throw new RangeError('Object ID is absent from the complete scene roster');
  return scene.idToSlot[id];
}
export function canonicalIdForSlot(scene, slot) {
  if (!uint(slot) || slot >= scene.slotToId.length) throw new RangeError('Slot is absent from the complete scene roster');
  return scene.slotToId[slot];
}

const RULE_KEYS = ['game', 'firstId', 'secondId', 'opponentId', 'threeCushion', 'search', 'method', 'minCushions', 'allowKiss', 'kissFacts', 'conditionOnly'];
/** No hidden budget/profile defaults; request identity covers all execution and rule settings. */
export function createCanonicalRequest({scene, epoch, requestId, selectedId, purpose, rules, executionProfile, budget}) {
  scene = validateCanonicalScene(scene);
  if (!scene || scene.kind !== 'canonical-scene-v1' || !scene.admitted || scene.modelId !== CANONICAL_MODEL.id) throw new RangeError('An admitted complete canonical scene is required');
  if (!uint(epoch) || !uint(requestId) || !['manual', 'forecast', 'search'].includes(purpose)) throw new RangeError('Explicit u32 epoch/request ID and request purpose required');
  if (!Object.hasOwn(CANONICAL_PROFILES, executionProfile)) throw new RangeError('Explicit canonical execution profile required');
  if (!rules || RULE_KEYS.some(k => !Object.hasOwn(rules, k)) || Object.keys(rules).some(k => !RULE_KEYS.includes(k))) throw new RangeError('Complete explicit ID-based rule configuration required');
  if (rules.game !== scene.slotToId.length || (rules.conditionOnly && purpose !== 'search')) throw new RangeError('Rule game must match the whole roster; early condition failure is search-only');
  const cueSlot = canonicalSlotForId(scene, selectedId), first = canonicalSlotForId(scene, rules.firstId), second = canonicalSlotForId(scene, rules.secondId);
  const opponent = rules.game === 4 ? canonicalSlotForId(scene, rules.opponentId) : cueSlot;
  if (first === cueSlot || second === cueSlot || first === second || (rules.game === 4 && new Set([cueSlot, first, second, opponent]).size !== 4) || (rules.game === 3 && rules.opponentId !== null)) throw new RangeError('Distinct cue/target/opponent IDs must account for the exact game roster');
  const ruleWords = Array.from(packRuleConfig({...Object.fromEntries(RULE_KEYS.filter(k => !['firstId', 'secondId', 'opponentId'].includes(k)).map(k => [k, rules[k]])), first, second, opponent}));
  if (!budget || Object.keys(budget).sort().join(',') !== 'maximumEvents,maximumTicks,maximumWorkItems' || !Object.values(budget).every(x => uint(x) && x > 0)) throw new RangeError('Explicit bounded event/time/work budgets required');
  const basis = copy({modelId: CANONICAL_MODEL.id, profileId: executionProfile, sceneId: scene.sceneId, epoch, requestId, selectedId, purpose, rules, budget});
  const request = freeze({...basis, kind: 'canonical-request-v1', requestKey: identity('request-v1', basis), cueSlot, ruleWords, slotToId: [...scene.slotToId], scene});
  trustedRequests.add(request); return request;
}

/** Structured-clone boundary: derive and compare identities, then own immutable data. */
export function validateCanonicalRequest(request) {
  if (trustedRequests.has(request)) return request;
  if (request?.kind !== 'canonical-request-v1') throw new TypeError('Canonical request required');
  const checked = createCanonicalRequest({...request, executionProfile: request.profileId});
  for (const key of ['modelId', 'profileId', 'sceneId', 'requestKey', 'cueSlot', 'ruleWords', 'slotToId']) if (stable(checked[key]) !== stable(request[key])) throw new CanonicalContractError('REQUEST_IDENTITY_MISMATCH', 'Cloned request metadata does not match its exact immutable identity');
  return checked;
}

/**
 * Bind a shot's relative-duration budget to its declared absolute raw-start.
 * Do this before initialization. The immutable binding is carried through every
 * phase: continuation must not restart the duration allowance after the strike.
 */
export function createCanonicalShotClock(request, startingTick) {
  request = validateCanonicalRequest(request);
  const maximumTicks = request.budget.maximumTicks;
  if (!uint(startingTick) || startingTick > CANONICAL_CLOCK_MAX || startingTick + maximumTicks > CANONICAL_CLOCK_MAX) throw new CanonicalContractError('CLOCK_OVERFLOW', 'Declared raw-start plus total shot duration must fit the canonical signed-range Q20 clock; never wrap');
  const basis = {modelId: request.modelId, profileId: request.profileId, requestKey: request.requestKey, epoch: request.epoch, startingTick, maximumTicks, deadlineTick: startingTick + maximumTicks};
  return freeze({...basis, kind: 'canonical-shot-clock-v1', clockKey: identity('shot-clock-v1', basis)});
}
export function validateCanonicalShotClock(request, clock) {
  if (clock?.kind !== 'canonical-shot-clock-v1') throw new TypeError('Declared canonical raw-start clock binding required');
  const checked = createCanonicalShotClock(request, clock.startingTick);
  if (stable(checked) !== stable(clock)) throw new CanonicalContractError('CLOCK_IDENTITY_MISMATCH', 'A continuation must retain the original request-bound raw-start and total duration budget');
  return checked;
}
/** Pure resource admission, NOT a producer result, checkpoint, or completion proof. */
export function inspectCanonicalPhaseBudget(request, clock, currentTick, requiredTicks) {
  clock = validateCanonicalShotClock(request, clock);
  if (!uint(currentTick) || currentTick < clock.startingTick || currentTick > clock.deadlineTick) throw new CanonicalContractError('CLOCK_BUDGET_EXCEEDED', 'Current producer clock is outside the declared total shot duration');
  if (!uint(requiredTicks) || requiredTicks === 0) throw new RangeError('Explicit positive next-phase duration required');
  const elapsedTicks = currentTick - clock.startingTick, remainingTicks = clock.deadlineTick - currentTick, canAdvance = requiredTicks <= remainingTicks;
  return freeze({scope: 'resource-admission-only', canAdvance, elapsedTicks, remainingTicks, nextTick: canAdvance ? currentTick + requiredTicks : null, reason: canAdvance ? null : 'TIME_HORIZON'});
}

/** Preserves every raw value in identity; never normalizes angle, snaps height, or clamps a UI setting. */
export function createCanonicalCandidate(request, candidateId, settings) {
  request = validateCanonicalRequest(request);
  if (request?.kind !== 'canonical-request-v1' || !uint(candidateId)) throw new RangeError('Canonical request and u32 candidate ID required');
  const keys = ['angle', 'elevation', 'speed', 'tipX', 'tipY'];
  if (!settings || Object.keys(settings).length !== keys.length || keys.some(k => !Number.isFinite(settings[k]))) throw new RangeError('Exactly five finite raw strike settings required');
  const reasons = [];
  if (settings.speed < CANONICAL_RAW_INPUT_LIMITS.speedRange[0] || settings.speed > CANONICAL_RAW_INPUT_LIMITS.speedRange[1]) reasons.push(issue('RAW_SPEED_UNSUPPORTED', 'settings.speed', 'Raw initializer speed capability is narrower than the UI; values are not clamped'));
  if (settings.elevation < 0 || settings.elevation > CANONICAL_RAW_INPUT_LIMITS.maximumElevation) reasons.push(issue('RAW_ELEVATION_UNSUPPORTED', 'settings.elevation', 'Elevation exceeds the raw initializer capability'));
  if (Math.hypot(settings.tipX, settings.tipY) > CANONICAL_RAW_INPUT_LIMITS.maximumTipRadius) reasons.push(issue('RAW_TIP_UNSUPPORTED', 'settings', 'The raw initializer has no complete high-offset/miscue model'));
  if (Math.abs(settings.angle) > CANONICAL_RAW_INPUT_LIMITS.maximumAbsoluteAngle) reasons.push(issue('RAW_ANGLE_UNSUPPORTED', 'settings.angle', 'Angle exceeds the raw initializer encoding domain; it is not normalized'));
  for (const body of request.scene.physical.bodies) if (!zeroVector(body.v) || !zeroVector(body.w)) reasons.push(issue('INITIAL_MOTION_UNSUPPORTED', 'objects.' + body.id, 'A raw shot starts from the full resting roster, not a velocity reset'));
  const basis = copy({modelId: request.modelId, profileId: request.profileId, sceneId: request.sceneId, requestKey: request.requestKey, epoch: request.epoch, candidateId, settings});
  const candidate = freeze({...basis, kind: 'canonical-candidate-v1', candidateKey: identity('candidate-v1', basis), admitted: reasons.length === 0, reasons,
    requiredProducerAdmission: ['complete raw cue clearance against the same roster', 'actual cloth/flight height and coupling; no snap to support', 'every subsequent contact/regime event and unresolved-event guard'],
  });
  trustedCandidates.add(candidate); return candidate;
}

export function validateCanonicalCandidate(request, candidate) {
  request = validateCanonicalRequest(request);
  if (trustedCandidates.has(candidate) && candidate.requestKey === request.requestKey) return candidate;
  if (candidate?.kind !== 'canonical-candidate-v1') throw new TypeError('Canonical candidate required');
  const checked = createCanonicalCandidate(request, candidate.candidateId, candidate.settings);
  for (const key of ['modelId', 'profileId', 'sceneId', 'requestKey', 'epoch', 'candidateKey', 'admitted', 'reasons']) if (stable(checked[key]) !== stable(candidate[key])) throw new CanonicalContractError('CANDIDATE_IDENTITY_MISMATCH', 'Candidate settings/admission must match its exact identity');
  return checked;
}

export function canonicalResultIdentity(candidate) {
  if (candidate?.kind !== 'canonical-candidate-v1') throw new TypeError('Canonical candidate required');
  return freeze(Object.fromEntries(['modelId', 'profileId', 'sceneId', 'requestKey', 'epoch', 'candidateId', 'candidateKey'].map(k => [k, candidate[k]])));
}

/** Transfer ONLY fresh owned copies, never caller arrays or frozen model state. */
export function cloneCanonicalWords(words) {
  if (!(words instanceof Uint32Array) || !words.length || (typeof SharedArrayBuffer !== 'undefined' && words.buffer instanceof SharedArrayBuffer)) throw new TypeError('Nonempty, attached, non-shared Uint32Array required');
  return words.slice();
}
export function createCanonicalSceneTransfer(scene) {
  scene = validateCanonicalScene(scene);
  if (scene?.kind !== 'canonical-scene-v1') throw new TypeError('Canonical scene required');
  // This is a transport encoding of the complete contract, NOT a GPU physics ABI.
  const bytes = new TextEncoder().encode(stable(scene));
  return {kind: 'canonical-scene-transfer-v1', sceneId: scene.sceneId, bytes, transfer: [bytes.buffer]};
}
export function readCanonicalSceneTransfer(payload, expectedSceneId) {
  if (payload?.kind !== 'canonical-scene-transfer-v1' || !(payload.bytes instanceof Uint8Array) || !payload.bytes.length || (typeof SharedArrayBuffer !== 'undefined' && payload.bytes.buffer instanceof SharedArrayBuffer)) throw new TypeError('Owned attached scene transfer required');
  const scene = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(payload.bytes));
  if (scene.kind !== 'canonical-scene-v1' || scene.modelId !== CANONICAL_MODEL.id || scene.sceneId !== expectedSceneId || payload.sceneId !== expectedSceneId || identity('scene-v1', scene.physical) !== expectedSceneId) throw new RangeError('Scene transfer identity mismatch');
  if (stable(scene.slotToId) !== stable(scene.physical.bodies.map(x => x.id)) || stable(scene.idToSlot) !== stable(Object.fromEntries(scene.slotToId.map((id, slot) => [id, slot])))) throw new RangeError('Scene transfer roster mapping mismatch');
  return validateCanonicalScene(scene);
}

export class CanonicalContractError extends Error {
  constructor(code, message) { super(message); this.name = 'CanonicalContractError'; this.code = code; }
}
/** Cancellation is cooperative. Every post-await/readback/apply boundary MUST validate again. */
export function createCanonicalEpochGate() {
  let epoch = 0, controller = null, requestKey = null, activeRequest = null;
  const candidates = new Map();
  const validate = value => {
    if (!controller) return {ok: false, reason: 'NO_ACTIVE_EPOCH'};
    if (value?.epoch !== epoch) return {ok: false, reason: 'STALE_EPOCH'};
    if (controller.signal.aborted) return {ok: false, reason: 'CANCELLED'};
    if (value.requestKey !== requestKey) return {ok: false, reason: 'STALE_REQUEST'};
    if (candidates.get(value.candidateId) !== stable(value)) return {ok: false, reason: 'STALE_CANDIDATE'};
    return {ok: true};
  };
  return Object.freeze({
    begin() {
      if (epoch === 0xffffffff) throw new RangeError('Epoch exhausted; create a new owner, never wrap an epoch');
      controller?.abort('superseded'); controller = new AbortController(); epoch++; requestKey = null; activeRequest = null; candidates.clear();
      return Object.freeze({epoch, signal: controller.signal});
    },
    bind(request) {
      request = validateCanonicalRequest(request);
      if (!controller || controller.signal.aborted || request?.epoch !== epoch || request.kind !== 'canonical-request-v1') throw new CanonicalContractError('STALE_EPOCH', 'Cannot bind a stale/cancelled request');
      if (requestKey && requestKey !== request.requestKey) throw new CanonicalContractError('EPOCH_REUSE', 'Changed scene/settings/rules need a new epoch');
      requestKey = request.requestKey; activeRequest = request;
    },
    register(candidate) {
      if (!activeRequest) throw new CanonicalContractError('STALE_REQUEST', 'Bind a current request before registering candidates');
      candidate = validateCanonicalCandidate(activeRequest, candidate);
      const id = canonicalResultIdentity(candidate);
      if (!controller || controller.signal.aborted || id.epoch !== epoch || id.requestKey !== requestKey) throw new CanonicalContractError('STALE_REQUEST', 'Candidate does not belong to the active request');
      if (candidates.has(id.candidateId) && candidates.get(id.candidateId) !== stable(id)) throw new CanonicalContractError('CANDIDATE_ID_REUSE', 'Candidate ID cannot be reused for changed raw settings within an epoch');
      candidates.set(id.candidateId, stable(id)); return id;
    },
    validate,
    assertCurrent(value) { const result = validate(value); if (!result.ok) throw new CanonicalContractError(result.reason, 'Discard stale/cancelled output before application'); return true; },
    cancel(reason = 'cancelled') { controller?.abort(reason); },
  });
}

export function canonicalBatchIdentity(request) {
  if (request?.kind !== 'canonical-request-v1') throw new TypeError('Canonical request required');
  return freeze(Object.fromEntries(['modelId', 'profileId', 'sceneId', 'requestKey', 'epoch', 'requestId'].map(k => [k, request[k]])));
}
/** One immutable model/scene/request envelope per batch, not per numeric row. */
export function createCanonicalBatchEnvelope(request, candidates) {
  request = validateCanonicalRequest(request);
  if (!Array.isArray(candidates) || !candidates.length) throw new TypeError('Nonempty canonical candidate batch required');
  const seen = new Set();
  const entries = candidates.map(candidate => {
    candidate = validateCanonicalCandidate(request, candidate);
    if (candidate?.kind !== 'canonical-candidate-v1' || candidate.requestKey !== request.requestKey || candidate.epoch !== request.epoch || candidate.modelId !== request.modelId || candidate.sceneId !== request.sceneId || candidate.profileId !== request.profileId || seen.has(candidate.candidateId)) throw new CanonicalContractError('BATCH_IDENTITY_MISMATCH', 'Each distinct candidate must belong to the same immutable request');
    seen.add(candidate.candidateId);
    return {candidateId: candidate.candidateId, candidateKey: candidate.candidateKey};
  });
  return freeze({kind: 'canonical-batch-envelope-v1', identity: canonicalBatchIdentity(request), candidates: entries});
}

export const CANONICAL_RESULT_STATUS = freeze({PASS: 1, FAIL: 2, INCOMPLETE: 3, UNSUPPORTED: 4});
// Codes 0..7 are unchanged from deterministic-candidate-finalizer.mjs.
export const CANONICAL_RESULT_REASON = freeze({PASS: 0, GAMEPLAY_FAILURE: 1, SEARCH_FAILURE: 2, WORK_BUDGET: 3, UNSUPPORTED_PHYSICS: 4, UNSUPPORTED_SEARCH: 5, UNSUPPORTED_GAMEPLAY: 6, CONDITION_FAILURE: 7, CANCELLED: 8, TIME_HORIZON: 9, NUMERIC_FAILURE: 10, UNRESOLVED_EVENT: 11, NOT_IMPLEMENTED: 12});
export const CANONICAL_SCORE_UNAVAILABLE = 0x80000000;
export const CANONICAL_RESULT_WORDS = 4;
/**
 * Existing four u32 words: candidate ID, status, reason, signed score bits.
 * Legacy wire status 5 is normalized to semantic FAIL only with explicit early
 * condition evidence. Mandatory evidence is obtained from the trusted physical
 * producer, never inferred from these four words, absent buffers, or diagnostics.
 * This is consistency validation, NOT a physical proof factory or release gate.
 */
export function decodeCanonicalResult(words, {request, candidate, batchEnvelope, evidence, diagnostics = null, gate = null}) {
  request = validateCanonicalRequest(request); candidate = validateCanonicalCandidate(request, candidate);
  const packet = cloneCanonicalWords(words);
  if (packet.length !== CANONICAL_RESULT_WORDS) throw new RangeError('Exactly four canonical result words required');
  const candidateIdentity = canonicalResultIdentity(candidate);
  if (batchEnvelope?.kind !== 'canonical-batch-envelope-v1' || stable(batchEnvelope.identity) !== stable(canonicalBatchIdentity(request)) || candidate.requestKey !== request.requestKey || !Array.isArray(batchEnvelope.candidates) || batchEnvelope.candidates.filter(x => x.candidateId === candidate.candidateId && x.candidateKey === candidate.candidateKey).length !== 1) throw new CanonicalContractError('IDENTITY_MISMATCH', 'Result/candidate/batch/request identities must match exactly');
  if (batchEnvelope.candidates.some(x => !uint(x.candidateId) || typeof x.candidateKey !== 'string' || Object.keys(x).sort().join(',') !== 'candidateId,candidateKey') || new Set(batchEnvelope.candidates.map(x => x.candidateId)).size !== batchEnvelope.candidates.length) throw new CanonicalContractError('IDENTITY_MISMATCH', 'Batch candidate registry must have unique exact IDs');
  gate?.assertCurrent(candidateIdentity);
  const [id, wireStatus, reason, scoreBits] = packet;
  const status = wireStatus === 5 ? CANONICAL_RESULT_STATUS.FAIL : wireStatus;
  const score = scoreBits === CANONICAL_SCORE_UNAVAILABLE ? null : scoreBits | 0;
  if (id !== candidate.candidateId || !Object.values(CANONICAL_RESULT_STATUS).includes(status) || !Object.values(CANONICAL_RESULT_REASON).includes(reason)) throw new RangeError('Invalid canonical compact result header');
  if (!evidence || Object.keys(evidence).sort().join(',') !== 'restMask,rosterMask,termination,unresolvedEvent' || !['MODEL_REST', 'CONDITION_FAILURE', 'INCOMPLETE', 'UNSUPPORTED'].includes(evidence.termination) || !uint(evidence.rosterMask) || !uint(evidence.restMask) || typeof evidence.unresolvedEvent !== 'boolean') throw new TypeError('Explicit complete physical-producer termination/roster evidence is required');
  const {rosterMask, restMask, unresolvedEvent} = evidence, fullMask = (1 << request.slotToId.length) - 1;
  if ((rosterMask & ~fullMask) || (restMask & ~rosterMask)) throw new RangeError('Result contains an unknown or unadmitted body slot');
  const modelRest = evidence.termination === 'MODEL_REST', conditionOnly = evidence.termination === 'CONDITION_FAILURE';
  const final = status === CANONICAL_RESULT_STATUS.PASS || status === CANONICAL_RESULT_STATUS.FAIL;
  if ((!candidate.admitted || !request.scene.admitted) && status !== CANONICAL_RESULT_STATUS.UNSUPPORTED) throw new RangeError('Unadmitted inputs cannot produce an accepted physical outcome');
  if (modelRest && (!candidate.admitted || !request.scene.admitted || unresolvedEvent || rosterMask !== fullMask || restMask !== fullMask || ![0, 1, 2, 3, 5, 6].includes(reason) || wireStatus === 5)) throw new RangeError('MODEL_REST requires the complete admitted resting roster and no unresolved event');
  if (final && !modelRest && !(status === CANONICAL_RESULT_STATUS.FAIL && conditionOnly && request.purpose === 'search' && request.rules.conditionOnly && !unresolvedEvent && reason === CANONICAL_RESULT_REASON.CONDITION_FAILURE && rosterMask === fullMask)) throw new RangeError('No PASS or gameplay miss before model rest; only explicit irreversible condition FAIL is allowed');
  if (conditionOnly && (!final || status !== CANONICAL_RESULT_STATUS.FAIL || (wireStatus !== 2 && wireStatus !== 5))) throw new RangeError('Condition-only termination is an early negative proof, not gameplay completion');
  if (status === CANONICAL_RESULT_STATUS.PASS && (reason !== 0 || scoreBits !== 1)) throw new RangeError('PASS requires a positive final gameplay score and the passing reason');
  if (status === CANONICAL_RESULT_STATUS.FAIL && modelRest && ![1, 2].includes(reason)) throw new RangeError('Completed FAIL must distinguish gameplay and search failure');
  if (status === CANONICAL_RESULT_STATUS.FAIL && reason === 2 && !request.rules.search) throw new RangeError('Search failure requires an explicit search rule configuration');
  if (status === CANONICAL_RESULT_STATUS.INCOMPLETE && (modelRest ? !(request.rules.search && reason === 3) : (evidence.termination !== 'INCOMPLETE' || ![3, 8, 9, 10, 11].includes(reason)))) throw new RangeError('Budget/cancel/horizon/numeric/unresolved termination is INCOMPLETE, never a miss');
  if (status === CANONICAL_RESULT_STATUS.UNSUPPORTED && (modelRest ? !((reason === 5 && request.rules.search) || reason === 6) : (evidence.termination !== 'UNSUPPORTED' || ![4, 5, 6, 12].includes(reason)))) throw new RangeError('Unsupported result must retain an unsupported reason');
  if (reason === CANONICAL_RESULT_REASON.UNRESOLVED_EVENT && !unresolvedEvent) throw new RangeError('Unresolved event reason requires unresolved producer evidence');
  const gameplayComplete = modelRest && (final || status === CANONICAL_RESULT_STATUS.INCOMPLETE || reason === CANONICAL_RESULT_REASON.UNSUPPORTED_SEARCH);
  if (gameplayComplete ? ![-1, 0, 1].includes(score) : score !== null) throw new RangeError('Score is available only after complete model-rest gameplay; -1 is distinct from unavailable');
  if (status === CANONICAL_RESULT_STATUS.FAIL && reason === 1 && score === 1) throw new RangeError('A gameplay failure cannot carry a positive gameplay score');
  if (diagnostics !== null && (!diagnostics || Object.keys(diagnostics).some(k => !['physicalRestCertified', 'globalReceiptCertified', 'globalBudgetWithin'].includes(k)) || Object.values(diagnostics).some(x => x !== null && typeof x !== 'boolean'))) throw new TypeError('Optional global certificate diagnostics are booleans or unknown(null), never termination authority');
  return freeze({identity: candidateIdentity, candidateId: id, status: Object.keys(CANONICAL_RESULT_STATUS).find(k => CANONICAL_RESULT_STATUS[k] === status), reason: Object.keys(CANONICAL_RESULT_REASON).find(k => CANONICAL_RESULT_REASON[k] === reason), score, modelRest, conditionOnly, unresolvedEvent, rosterMask, restMask,
    gameplayApplicable: gameplayComplete, diagnostics: diagnostics === null ? null : copy(diagnostics)});
}

/** CPU fallback may change device only; changing this identity changes the model. */
export function assertCanonicalBackendCompatibility(request, backend) {
  if (!backend || !['cpu', 'webgpu'].includes(backend.backend) || backend.modelId !== request.modelId || backend.profileId !== request.profileId || backend.contractVersion !== CANONICAL_CONTRACT_VERSION) throw new CanonicalContractError('BACKEND_MODEL_MISMATCH', 'Fallback must execute exactly the same canonical model/profile/ABI; Rapier is not a fallback');
  return true;
}
export const SELECTED_SHOT_REQUIREMENTS = freeze({
  trace: ['exact result/candidate/scene/profile/epoch identities', 'all admitted IDs and common monotonic Q20 clock', 'p/v/q at accepted boundaries; visual sphere quaternion is presentation only', 'actual event order and brackets, no interpolation through an unresolved collision', 'same canonical producer, not a second Rapier simulation', 'epoch/cancellation validation after every await and before presentation'],
  checkpoint: ['exact model/profile/scene/candidate/epoch identities and checkpoint schema version', 'full roster integer p/v/q and clock', 'all physical rule/contact-episode ledgers and pending-event brackets', 'all recurrence regime/history/resume scratch needed for identical continuation', 'owned buffers with clone/transfer semantics; no detached or shared alias', 'validated restore, never a partial positions-only restart'],
  implemented: false,
});
export function createSelectedShotTraceRequest(candidate, {sampleEveryTicks, maximumFrames, checkpoints}) {
  if (candidate?.kind !== 'canonical-candidate-v1' || !candidate.admitted || !uint(sampleEveryTicks) || !sampleEveryTicks || !uint(maximumFrames) || !maximumFrames || typeof checkpoints !== 'boolean') throw new RangeError('Admitted selected candidate and explicit trace sampling bounds required');
  return freeze({kind: 'canonical-selected-trace-request-v1', identity: canonicalResultIdentity(candidate), sampleEveryTicks, maximumFrames, checkpoints, requirements: SELECTED_SHOT_REQUIREMENTS});
}
export class CanonicalInterfaceNotImplementedError extends Error {
  constructor(method) { super(method + ' has no canonical engine adapter yet; no synthetic physics/trace/checkpoint is returned'); this.name = 'CanonicalInterfaceNotImplementedError'; this.code = 'NOT_IMPLEMENTED'; }
}
export function executeCanonicalBatch() { throw new CanonicalInterfaceNotImplementedError('executeCanonicalBatch'); }
export function hydrateSelectedShotTrace() { throw new CanonicalInterfaceNotImplementedError('hydrateSelectedShotTrace'); }
export function exportCanonicalCheckpoint() { throw new CanonicalInterfaceNotImplementedError('exportCanonicalCheckpoint'); }
export function restoreCanonicalCheckpoint() { throw new CanonicalInterfaceNotImplementedError('restoreCanonicalCheckpoint'); }
