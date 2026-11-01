// SPDX-License-Identifier: Apache-2.0
// Initial representation only: authentic prestrike history -> accepted stroke.
// No physical h, scorer event, host continuation, or later ring normalization.
import {RULE_LAYOUT as R, binary64Value} from './physical-rules.mjs';
import {APPLICATION_LAYOUT as A} from './application.mjs';
import {packWorldCloneTemplate} from './world-state.mjs';
import {SOURCE_EVENT_HISTORY_PROFILE} from '../source-event-history.mjs';

const need = (ok, message) => { if (!ok) throw new RangeError('World initial history: ' + message); };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
function ring(r, name) {
  need(r && Object.getPrototypeOf(r) === Object.prototype, name + ' plain packed record');
  need(Object.keys(r).sort().join(',') === 'count,head,words', name + ' exact packed fields');
  need(Number.isInteger(r.count) && r.count >= 0 && r.count <= 8 && r.head === r.count % 8, name + ' canonical initial count/head');
  need(r.words instanceof Uint32Array && r.words.length === 32, name + ' complete bounded ring');
  for (let i = 0; i < r.count; i++) {
    const p = i * 4, keyed = r.words[p + 3];
    need(keyed <= 1 && (keyed ? r.words[p] < 729 : r.words[p] === 0), name + ' original keyed/non-key record');
    need(Number.isFinite(binary64Value(r.words[p + 1], r.words[p + 2])), name + ' exact finite source time');
  }
  need(r.words.slice(r.count * 4).every(x => x === 0), name + ' unused initial words are zero');
}

/** This is a separately authenticated new initial-history profile. Absence is
 * not silently interpreted as the known-invalid contact-only raw template. */
export function validateWorldHistoryInitialization(template) {
  const h = template?.historyInitialization;
  need(h?.kind === 'resident-initial-event-history-v1' && h.profile === SOURCE_EVENT_HISTORY_PROFILE, 'explicit full native initial-history profile required');
  need(Object.keys(h).sort().join(',') === 'created,kind,preStrike,profile,strokeTime', 'exact initial-history fields');
  ring(h.preStrike, 'prestrike'); ring(h.created, 'created');
  need(h.strokeTime instanceof Uint32Array && h.strokeTime.length === 2 && Number.isFinite(binary64Value(...h.strokeTime)), 'exact finite stroke clock words');
  const n = Math.min(8, h.preStrike.count + 1), want = new Uint32Array(32);
  const first = h.preStrike.count === 8 ? 4 : 0;
  want.set(h.preStrike.words.slice(first, h.preStrike.count * 4));
  want.set([0, h.strokeTime[0], h.strokeTime[1], 0], (n - 1) * 4);
  need(h.created.count === n && h.created.head === n % 8 && same(h.created.words, want), 'created ring is exactly prestrike plus one non-key stroke with FIFO eviction');
  const state = template.state, r = template.segments?.rules, a = template.segments?.application;
  need(state instanceof Uint32Array && r?.words >= 128 && a?.words > A.header.time + 1, 'complete source rule/application segments');
  need(r.offset >= 0 && r.offset + r.words <= state.length && a.offset >= 0 && a.offset + a.words <= state.length, 'bounded source segments');
  need(state[r.offset + R.ringCount] === h.created.count && state[r.offset + R.ringHead] === h.created.head && same(state.slice(r.offset + R.ring, r.offset + R.ring + 32), h.created.words), 'already-created template carries created history exactly once');
  need(state[a.offset + A.header.time] === h.strokeTime[0] && state[a.offset + A.header.time + 1] === h.strokeTime[1], 'stroke clock equals authenticated creation/application t0');
  need(state[5] === 0 && state[r.offset + R.steps] === 0, 'initial state only; never restore later history');
  return h;
}

/** Keep the created template as an independent created-state expectation. Only
 * the immutable raw clone changes to the genuine prestrike history. */
export function packRawWorldHistoryClone(template) {
  const h = validateWorldHistoryInitialization(template), clone = packWorldCloneTemplate(template), r = template.segments.rules.offset;
  clone[r + R.ringCount] = h.preStrike.count;
  clone[r + R.ringHead] = h.preStrike.head;
  clone.set(h.preStrike.words, r + R.ring);
  return clone;
}

/** Called only after successful numerical creation, before RUNNING is published.
 * The caller's existing creation phase is the exactly-once token. Rejected or
 * unsupported rows return before this helper; repeated finish returns before it.
 * Full-ring shift is forward-safe (destination always precedes source). This
 * canonicalizes t0 only; ordinary per-h ring FIFO/head code is unchanged. */
export function generateInitialStrokeHistoryWGSL(template) {
  const h = validateWorldHistoryInitialization(template), r = template.segments.rules.offset,
    a = template.segments.application.offset;
  const guards = Array.from(h.preStrike.words, (word, i) => `rc_state[ring+${i}u]!=${word}u`).join('||');
  return `
fn rc_world_initial_history_commit(bank:u32)->bool{
 let rule=bank+${r}u;let ring=rule+${R.ring}u;let app=bank+${a}u;
 if(rc_state[bank+2u]!=0u||rc_state[bank+5u]!=0u||rc_state[rule+${R.steps}u]!=0u){return false;}
 if(rc_state[rule+${R.ringCount}u]!=${h.preStrike.count}u||rc_state[rule+${R.ringHead}u]!=${h.preStrike.head}u){return false;}
 if(rc_state[app+${A.header.time}u]!=${h.strokeTime[0]}u||rc_state[app+${A.header.time + 1}u]!=${h.strokeTime[1]}u){return false;}
 if(${guards}){return false;}
 var count=rc_state[rule+${R.ringCount}u];
 if(count==8u){for(var i=0u;i<28u;i++){rc_state[ring+i]=rc_state[ring+i+4u];}}else{count++;}
 let at=ring+(count-1u)*4u;
 rc_state[at]=0u;rc_state[at+1u]=rc_state[app+${A.header.time}u];rc_state[at+2u]=rc_state[app+${A.header.time + 1}u];rc_state[at+3u]=0u;
 rc_state[rule+${R.ringCount}u]=count;rc_state[rule+${R.ringHead}u]=count%8u;
 return true;
}
`;
}
