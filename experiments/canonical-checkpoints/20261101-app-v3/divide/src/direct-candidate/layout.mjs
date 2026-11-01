// Direct physical state, not a native-engine memory image or an instruction VM.
export const DIRECT_CUE_PROFILE = Object.freeze({
  name: 'native-f32-direct-compliant-tip-component-v1',
  source: 'physics.js:174-209',
  nativeF32: true, applicationJsNumberApproximation: true,
  rawParameters: false, worldStep: false, terminalAuthority: false,
  hardwareQualified: false, productionEnabled: false,
});
export const CUE_LAYOUT = Object.freeze({
  words: 256, bytes: 1024, headerWords: 32,
  bodyOffset: 32, bodyStride: 32, bodyCapacity: 6, headIndex: 4, shaftIndex: 5,
  body: Object.freeze({position: 0, worldCom: 4, linear: 8, angular: 12,
    invMass: 16, invInertia: 20, radius: 26, id: 27}),
  contactOffset: 224, contactStride: 8, contactCapacity: 4,
  contact: Object.freeze({tangent: 0, active: 3, normalForce: 4, compression: 5, sliding: 6}),
  header: Object.freeze({id: 0, status: 1, reason: 2, pass: 3, cuePresent: 4,
    contacted: 5, ballCount: 6, birthMask: 7, obstructionMask: 8, removeCue: 9,
    ambiguousMask: 10, selectedIndex: 11, axis: 12, h: 16}),
});
export const CUE_SHARED = Object.freeze({words: 16, bytes: 64,
  fields: Object.freeze(['tipRadius', 'normalStiffness', 'normalDamping',
    'tangentStiffness', 'tangentDamping', 'friction', 'lateralStiffness', 'lateralDamping']),
});
export const DIRECT_STATUS = Object.freeze({pending: 0, unsupported: 4, incomplete: 5});
export const DIRECT_REASON = Object.freeze({numeric: 5, physicsScope: 6, threshold: 13, malformed: 14});
export const NO_PASS = 0xffffffff;
const f = Math.fround;
const check = (ok, why) => { if (!ok) throw new RangeError('Direct cue component: ' + why); };
const toWord = x => new Uint32Array(Float32Array.of(x).buffer)[0];
const fromWord = x => new Float32Array(Uint32Array.of(x).buffer)[0];
export function packCueShared(material) {
  const result = new Uint32Array(CUE_SHARED.words);
  CUE_SHARED.fields.forEach((name, i) => {
    const value = material?.[name];
    check(Number.isFinite(value) && value >= 0 && Number.isFinite(f(value)), name);
    check(name !== 'tipRadius' || value > 0, 'positive tip radius');
    result[i] = toWord(value);
  });
  return result;
}
export function packCueComponents(rows) {
  check(Array.isArray(rows) && rows.length > 0 && rows.length <= 4096, '1..4096 component rows');
  const result = new Uint32Array(rows.length * CUE_LAYOUT.words), ids = new Set();
  rows.forEach((r, index) => {
    check(Number.isInteger(r.id) && r.id >= 0 && r.id < NO_PASS && !ids.has(r.id), 'unique candidate id'); ids.add(r.id);
    check(Array.isArray(r.balls) && r.balls.length === 4, 'four real ball records; not three-ball emulation');
    check(Number.isInteger(r.selectedIndex) && r.selectedIndex >= 0 && r.selectedIndex < 4, 'selected ball');
    check(typeof r.contacted === 'boolean' && typeof r.cuePresent === 'boolean', 'cue lifecycle');
    check(Number.isFinite(r.h) && r.h > 0 && Number.isFinite(f(r.h)), 'positive source h');
    check(Array.isArray(r.axis) && r.axis.length === 3 && r.axis.every(Number.isFinite), 'source cue axis');
    const start = index * CUE_LAYOUT.words, put = (at, values) => {
      for (const [j, value] of values.entries()) {
        check(Number.isFinite(value) && Number.isFinite(f(value)), 'finite semantic value'); result[start + at + j] = toWord(value);
      }
    };
    result.set([r.id, 0, 0, NO_PASS, +r.cuePresent, +r.contacted, 4, 0, 0, 0, 0, r.selectedIndex], start);
    put(12, r.axis); put(16, [r.h]);
    [...r.balls, r.head, r.shaft].forEach((body, i) => {
      const base = 32 + i * 32;
      for (const [name, count] of [['position',3],['worldCom',3],['linear',3],['angular',3],['invMass',3],['invInertia',6]]) {
        check(Array.isArray(body?.[name]) && body[name].length === count, 'body ' + name);
        // Actual native body inputs are f32. Refuse hidden rounding on this boundary.
        check(body[name].every(x => Number.isFinite(x) && Object.is(f(x),x)), 'original f32 body ' + name);
        put(base + CUE_LAYOUT.body[name], body[name]);
      }
      check(body.invMass.every(x => x >= 0), 'nonnegative inverse mass');
      if (i < 4) { check(Number.isFinite(body.radius) && body.radius > 0, 'ball radius'); put(base + 26, [body.radius]); }
      result[start + base + 27] = i;
    });
    check(Array.isArray(r.contacts) && r.contacts.length === 4, 'persistent per-ball tangent states');
    r.contacts.forEach((c,i) => {
      check(typeof c.active === 'boolean' && (!c.active || r.contacted), 'consistent contact lifecycle');
      check(Array.isArray(c.tangent) && c.tangent.length === 3, 'tangent vector');
      put(224 + i * 8, c.tangent); result[start + 227 + i * 8] = +c.active;
    });
  });
  return result;
}
export function decodeCueComponent(words, index = 0) {
  check(words instanceof Uint32Array && words.length % CUE_LAYOUT.words === 0 && Number.isInteger(index) && index >= 0 && index < words.length / CUE_LAYOUT.words, 'whole component bank');
  const start = index * 256, vector = (at,n=3) => Array.from(words.subarray(start+at,start+at+n),fromWord);
  const body = i => Object.fromEntries(['position','worldCom','linear','angular','invMass','invInertia'].map(k => [k,vector(32+i*32+CUE_LAYOUT.body[k],k==='invInertia'?6:3)]));
  return {id: words[start], status: words[start+1], reason: words[start+2], pass: words[start+3] === NO_PASS ? null : words[start+3],
    cuePresent: !!words[start+4], contacted: !!words[start+5], birthMask: words[start+7], obstructionMask: words[start+8],
    removeCue: !!words[start+9], ambiguousMask: words[start+10], balls: [0,1,2,3].map(body), head: body(4), shaft: body(5),
    contacts: [0,1,2,3].map(i => ({tangent: vector(224+i*8), active: !!words[start+227+i*8], normalForce: vector(228+i*8,1)[0], compression: vector(229+i*8,1)[0], sliding: !!words[start+230+i*8]}))};
}
export function cueComponentMemory(count) {
  check(Number.isInteger(count) && count > 0 && count <= 4096, 'candidate count');
  return Object.freeze({count, sharedBytes: 64, componentBytesPerCandidate: 1024,
    persistentBytes: 64 + count * 1024, compactBytes: count * 16,
    diagnosticReadbackBytes: count * 1024, diagnosticRequiredInProduction: false,
    wholeWorldMemoryEstimate: false, measuredDeviceMemory: false});
}
