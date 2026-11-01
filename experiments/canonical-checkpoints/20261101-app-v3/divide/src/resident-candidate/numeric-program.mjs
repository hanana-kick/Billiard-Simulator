/* SPDX-License-Identifier: Apache-2.0
 * Storage-register lowering for the existing source-ordered f32 graphs.
 * This is numerical instruction transport, NOT a world solver or CPU fallback.
 * All nodes (including unused nodes and eager select operands) still execute.
 */
import '../experimental-arithmetic-graph.js';
import {generateSourceNumberWGSL} from './source-number.mjs';

const Graph = globalThis.LabArithmeticGraphExperimental;
const OPS = Object.freeze(['const', 'add', 'sub', 'mul', 'div', 'min', 'max', 'sqrt',
  'inv', 'cap', 'choose', 'lt', 'le', 'gt', 'signbitSign', 'negate']);
const ARITIES = Object.freeze([0, 2, 2, 2, 2, 2, 2, 1, 1, 2, 3, 2, 2, 2, 1, 1]);
const MAGIC = 0x52434e50, VERSION = 1, HEADER_WORDS = 12, INSTRUCTION_WORDS = 5;
export const NUMERIC_STATUS = Object.freeze({INCOMPLETE: 0, COMPLETE: 1, MALFORMED: 2, NONFINITE: 3, DOMAIN: 4});
export const NUMERIC_ABI = Object.freeze({magic: MAGIC, version: VERSION, headerWords: HEADER_WORDS,
  instructionWords: INSTRUCTION_WORDS,
  header: Object.freeze({magic: 0, version: 1, totalWords: 2, inputCount: 3, outputCount: 4,
    registerCount: 5, nodeCount: 6, instructionOffset: 7, outputOffset: 8, instructionWords: 9,
    statusSlot: 10, reserved: 11})});

function bits(value) { return new Uint32Array(new Float32Array([value]).buffer)[0]; }
function finiteWord(word) { return (word & 0x7f800000) !== 0x7f800000; }
function reject(status, message) { const error = new RangeError(message); error.numericStatus = status; throw error; }

/**
 * Compile without folding, pruning, reordering or reassociating any operation.
 * Inputs enter scratchBase+[0,inputCount). Read all operands BEFORE overwriting
 * a destination: a destination may reuse an operand at that operand's last use.
 * Outputs stay in outputSlots; they must NOT be gathered destructively into the
 * input prefix. Duplicate and input-valued outputs are legal and remain pinned.
 * scratchWords = registerCount+1; the final word is the completion/error status.
 * A program is relocatable/concatenable, with all offsets relative to its header.
 */
export function compileGraph(plan, {boundaries = []} = {}) {
  if (!Graph || Graph.OPS.join(',') !== OPS.join(',')) throw new Error('Original arithmetic opcode ABI changed');
  Graph.validatePlan(plan);
  const inputCount = plan.inputFloats, nodeCount = plan.nodes.length, outputCount = plan.outputs.length;
  if (!Array.isArray(boundaries) || boundaries.some(i => !Number.isSafeInteger(i) || i < 0 || i > nodeCount))
    throw new RangeError('Boundary indexes must be node offsets in [0,nodeCount]');
  const requestedBoundaries = new Set(boundaries), boundaryStates = [];
  const uses = new Uint32Array(inputCount + nodeCount), slots = new Int32Array(uses.length).fill(-1);
  for (const node of plan.nodes) if (node.kind !== 'const') for (const arg of node.args) uses[arg]++;
  for (const index of plan.outputs) uses[index]++;
  const free = [];
  for (let i = 0; i < inputCount; i++) { slots[i] = i; if (uses[i] === 0) free.push(i); }
  let registerCount = inputCount;
  const snapshotBoundary = nodeIndex => {
    if (!requestedBoundaries.has(nodeIndex)) return;
    const live = [];
    for (let id = 0; id < inputCount + nodeIndex; id++) if (uses[id] > 0) live.push(id);
    boundaryStates.push(Object.freeze({nodeIndex, liveValueIds: Uint32Array.from(live),
      slots: Uint32Array.from(live, id => slots[id])}));
  };
  const outputOffset = HEADER_WORDS + nodeCount * INSTRUCTION_WORDS;
  const program = new Uint32Array(outputOffset + outputCount);
  for (let i = 0; i < nodeCount; i++) {
    snapshotBoundary(i);
    const node = plan.nodes[i], opcode = OPS.indexOf(node.kind), at = HEADER_WORDS + i * INSTRUCTION_WORDS;
    const args = node.kind === 'const' ? [bits(node.args[0])] : node.args.map(index => slots[index]);
    // The instruction reads these slots into local words before its destination
    // write, so final-use operands may safely donate storage to this node.
    if (node.kind !== 'const') for (const index of node.args) if (--uses[index] === 0) free.push(slots[index]);
    const destination = free.length ? free.pop() : registerCount++;
    slots[inputCount + i] = destination;
    program.set([opcode, destination, args[0] ?? 0, args[1] ?? 0, args[2] ?? 0], at);
    if (uses[inputCount + i] === 0) free.push(destination);
  }
  snapshotBoundary(nodeCount);
  const outputSlots = Uint32Array.from(plan.outputs, index => slots[index]);
  program.set(outputSlots, outputOffset);
  program.set([MAGIC, VERSION, program.length, inputCount, outputCount, registerCount, nodeCount,
    HEADER_WORDS, outputOffset, INSTRUCTION_WORDS, registerCount, 0]);
  return Object.freeze({program, inputCount, outputCount, registerCount, nodeCount, outputSlots,
    scratchWords: registerCount + 1, statusSlot: registerCount, instructionOffset: HEADER_WORDS,
    outputOffset, originalScratchWords: inputCount + nodeCount, boundaries: Object.freeze(boundaryStates),
    precision: 'source-ordered-f32; device arithmetic still requires an independent numerical gate'});
}

/** Compile a contiguous source stage without pruning any node in [start,end).
 * inputValueIds maps slice input slots to original SSA IDs; outputValueIds maps
 * outputs back. If outputs is omitted, retain all values crossing the end
 * boundary, including untouched inputs. An independent constant-only stage has
 * a single unused zero padding input (ID 0xffffffff); paddingInputCount marks it.
 * The caller owns the semantic stage boundary and gather/scatter. This function
 * never infers topology, solver order, persistent state, or world transitions.
 */
export function compileGraphSlice(plan, {start = 0, end = plan?.nodes?.length, outputs} = {}) {
  Graph.validatePlan(plan);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > plan.nodes.length)
    throw new RangeError('Contiguous source node range required');
  const first = plan.inputFloats + start, stop = plan.inputFloats + end;
  let outputIds;
  if (outputs === undefined) {
    const live = new Set(plan.outputs.filter(id => id < stop));
    for (let i = end; i < plan.nodes.length; i++) {
      const node = plan.nodes[i];
      if (node.kind !== 'const') for (const id of node.args) if (id < stop) live.add(id);
    }
    outputIds = [...live].sort((a, b) => a - b);
  } else {
    if (!Array.isArray(outputs) || outputs.some(id => !Number.isSafeInteger(id) || id < 0 || id >= stop))
      throw new RangeError('Slice outputs must be source values defined by the end boundary');
    outputIds = outputs.slice();
  }
  if (!outputIds.length) throw new RangeError('Slice has no live outputs; supply an explicit source output');
  const external = new Set(outputIds.filter(id => id < first));
  for (let i = start; i < end; i++) {
    const node = plan.nodes[i];
    if (node.kind !== 'const') for (const id of node.args) if (id < first) external.add(id);
  }
  const inputIds = [...external].sort((a, b) => a - b), paddingInputCount = inputIds.length ? 0 : 1;
  if (paddingInputCount) inputIds.push(0xffffffff);
  if (inputIds.length > Graph.MAX_INPUTS) throw new RangeError('Source slice live-in exceeds existing graph input bound');
  const inputMap = new Map(inputIds.map((id, i) => [id, i])), inputFloats = inputIds.length;
  const remap = id => id >= first ? inputFloats + id - first : inputMap.get(id);
  const sliced = {inputFloats, nodes: plan.nodes.slice(start, end).map(node => ({kind: node.kind,
    args: node.kind === 'const' ? node.args.slice() : node.args.map(remap)})), outputs: outputIds.map(remap)};
  const compiled = compileGraph(sliced);
  return Object.freeze({...compiled, sourceStart: start, sourceEnd: end,
    inputValueIds: Uint32Array.from(inputIds), outputValueIds: Uint32Array.from(outputIds),
    paddingInputCount, plan: sliced});
}

function readHeader(program, base) {
  if (!(program instanceof Uint32Array) || !Number.isSafeInteger(base) || base < 0 || base > program.length || program.length - base < HEADER_WORDS)
    reject(NUMERIC_STATUS.MALFORMED, 'Incomplete numeric program header');
  const h = program.subarray(base, base + HEADER_WORDS);
  const [magic, version, length, inputs, outputs, registers, nodes, instructionOffset, outputOffset, stride, statusSlot, reserved] = h;
  if (magic !== MAGIC || version !== VERSION || stride !== INSTRUCTION_WORDS || reserved !== 0 ||
      length < HEADER_WORDS || length > program.length - base || inputs < 1 || inputs > Graph.MAX_INPUTS ||
      outputs < 1 || outputs > Graph.MAX_NODES || nodes > Graph.MAX_NODES || registers < inputs ||
      registers > inputs + nodes || statusSlot !== registers || instructionOffset !== HEADER_WORDS ||
      outputOffset !== HEADER_WORDS + nodes * INSTRUCTION_WORDS || length !== outputOffset + outputs)
    reject(NUMERIC_STATUS.MALFORMED, 'Invalid numeric program header');
  return {length, inputs, outputs, registers, nodes, instructionOffset, outputOffset, statusSlot};
}

/** TEST-ONLY differential oracle. Never call from a production simulation path.
 * Explicit opt-in prevents accidentally presenting a host result as GPU output.
 * Throws with numericStatus; success returns raw-bit-preserving Float32Array.
 */
export function executeLowered(compilation, input, {testOnly = false, programBase = 0} = {}) {
  if (testOnly !== true) throw new TypeError('executeLowered is TEST-ONLY; explicit testOnly:true required');
  const program = compilation instanceof Uint32Array ? compilation : compilation?.program;
  const h = readHeader(program, programBase);
  if (!(input instanceof Float32Array) || input.length !== h.inputs) throw new TypeError('Exact Float32Array input width required');
  const words = new Uint32Array(h.registers + 1), floats = new Float32Array(words.buffer);
  words.set(new Uint32Array(input.buffer, input.byteOffset, input.length));
  words[h.statusSlot] = NUMERIC_STATUS.INCOMPLETE;
  const fail = (status, message) => { words[h.statusSlot] = status; reject(status, message); };
  for (let i = 0; i < h.inputs; i++) if (!finiteWord(words[i])) fail(NUMERIC_STATUS.NONFINITE, 'Nonfinite numeric input');
  let initialized = h.inputs;
  for (let i = 0; i < h.nodes; i++) {
    const at = programBase + h.instructionOffset + i * INSTRUCTION_WORDS;
    const [opcode, destination, aSlot, bSlot, cSlot] = program.subarray(at, at + INSTRUCTION_WORDS);
    if (opcode >= OPS.length || destination >= h.registers || destination > initialized)
      fail(NUMERIC_STATUS.MALFORMED, 'Invalid numeric instruction at node ' + i);
    const arity = ARITIES[opcode], operands = [aSlot, bSlot, cSlot];
    if (operands.slice(0, arity).some(slot => slot >= initialized)) fail(NUMERIC_STATUS.MALFORMED, 'Uninitialized numeric operand at node ' + i);
    let word;
    if (opcode === 0) word = aSlot;
    else {
      // Load all arguments before the reused destination is written.
      const a = floats[aSlot], b = arity >= 2 ? floats[bSlot] : 0, c = arity === 3 ? floats[cSlot] : 0;
      if (opcode === 4 && b === 0 || opcode === 7 && a < 0) fail(NUMERIC_STATUS.DOMAIN, 'Arithmetic domain error at node ' + i);
      if (opcode === 15) word = (words[aSlot] ^ 0x80000000) >>> 0;
      else if (opcode === 14) word = (0x3f800000 | (words[aSlot] & 0x80000000)) >>> 0;
      else if (opcode === 10) word = words[a !== 0 ? bSlot : cSlot];
      else word = bits(Graph.OPERATIONS[opcode].cpu(...[a, b, c].slice(0, arity)));
    }
    if (!finiteWord(word)) fail(NUMERIC_STATUS.NONFINITE, 'Nonfinite arithmetic intermediate at node ' + i);
    words[destination] = word;
    if (destination === initialized) initialized++;
  }
  if (initialized !== h.registers) fail(NUMERIC_STATUS.MALFORMED, 'Incomplete numeric register assignment');
  const outputWords = new Uint32Array(h.outputs);
  for (let i = 0; i < h.outputs; i++) {
    const slot = program[programBase + h.outputOffset + i];
    if (slot >= initialized) fail(NUMERIC_STATUS.MALFORMED, 'Invalid numeric output slot');
    if (!finiteWord(words[slot])) fail(NUMERIC_STATUS.NONFINITE, 'Nonfinite numeric output');
    outputWords[i] = words[slot];
  }
  words[h.statusSlot] = NUMERIC_STATUS.COMPLETE;
  return new Float32Array(outputWords.buffer);
}

/**
 * No bindings or entry point: caller declares rc_program:array<u32> read-only
 * storage and rc_scratch:array<u32> read_write storage. One invocation owns one
 * nonoverlapping scratch slice. No barrier is necessary or inserted. The caller
 * must not read outputs unless rc_num_eval returns COMPLETE (1u).
 * Integer words protect transfers/select/negation and explicit zero signs, not
 * every hardware f32 edge: subnormal handling and div/sqrt accuracy need device
 * gates. This is NOT a binary64 emulator or a cross-device bit-parity claim.
 */
export function generateNumericLibraryWGSL({preserveSubnormals=false,includeSourceNumberLibrary=true}={}) {
  let code = `
fn rc_num_finite(w:u32)->bool { return (w & 0x7f800000u) != 0x7f800000u; }
fn rc_num_zero(w:u32)->bool { return (w & 0x7fffffffu) == 0u; }
fn rc_num_fail(base:u32, slot:u32, status:u32)->u32 {
  rc_scratch[base+slot]=status; return status;
}
fn rc_num_eval(programBase:u32, scratchBase:u32)->u32 {
  let programLength=arrayLength(&rc_program);
  if (programBase>programLength || programLength-programBase<12u) { return 2u; }
  let total=rc_program[programBase+2u];
  let inputs=rc_program[programBase+3u]; let outputs=rc_program[programBase+4u];
  let registers=rc_program[programBase+5u]; let nodes=rc_program[programBase+6u];
  let instructions=rc_program[programBase+7u]; let outputOffset=rc_program[programBase+8u];
  if (rc_program[programBase]!=${MAGIC}u || rc_program[programBase+1u]!=1u ||
      total<12u || total>programLength-programBase || inputs<1u || inputs>65536u ||
      outputs<1u || outputs>1000000u || nodes>1000000u || registers<inputs ||
      registers>inputs+nodes || instructions!=12u || outputOffset!=12u+nodes*5u ||
      total!=outputOffset+outputs || rc_program[programBase+9u]!=5u ||
      rc_program[programBase+10u]!=registers || rc_program[programBase+11u]!=0u) { return 2u; }
  let scratchLength=arrayLength(&rc_scratch);
  if (scratchBase>scratchLength || scratchLength-scratchBase<registers+1u) { return 2u; }
  rc_scratch[scratchBase+registers]=0u;
  for(var i=0u;i<inputs;i++) {
    if (!rc_num_finite(rc_scratch[scratchBase+i])) { return rc_num_fail(scratchBase,registers,3u); }
  }
  var initialized=inputs;
  for(var i=0u;i<nodes;i++) {
    let at=programBase+instructions+i*5u;
    let opcode=rc_program[at]; let destination=rc_program[at+1u];
    let aa=rc_program[at+2u]; let bb=rc_program[at+3u]; let cc=rc_program[at+4u];
    if (opcode>15u || destination>=registers || destination>initialized) {
      return rc_num_fail(scratchBase,registers,2u);
    }
    var arity=2u;
    if (opcode==0u) { arity=0u; }
    if (opcode==7u || opcode==8u || opcode==14u || opcode==15u) { arity=1u; }
    if (opcode==10u) { arity=3u; }
    if ((arity>0u && aa>=initialized) || (arity>1u && bb>=initialized) || (arity>2u && cc>=initialized)) {
      return rc_num_fail(scratchBase,registers,2u);
    }
    var aw=0u; var bw=0u; var cw=0u;
    if (arity>0u) { aw=rc_scratch[scratchBase+aa]; }
    if (arity>1u) { bw=rc_scratch[scratchBase+bb]; }
    if (arity>2u) { cw=rc_scratch[scratchBase+cc]; }
    let a=bitcast<f32>(aw); let b=bitcast<f32>(bw);
    var result=0.0; var word=0u; var wordResult=false;
    switch opcode {
      case 0u: { word=aa; wordResult=true; }
      case 1u: { result=a+b; }
      case 2u: { result=a-b; }
      case 3u: { result=a*b; }
      case 4u: { if (b==0.0) { return rc_num_fail(scratchBase,registers,4u); } result=a/b; }
      case 5u: {
        word=select(bw,aw,a<b); if (a==b) { word=aw|bw; } wordResult=true;
      }
      case 6u: {
        word=select(bw,aw,a>b); if (a==b) { word=aw&bw; } wordResult=true;
      }
      case 7u: { if (a<0.0) { return rc_num_fail(scratchBase,registers,4u); } result=sqrt(a); }
      case 8u: { let epsilon=bitcast<f32>(${bits(Math.fround(1e-20))}u); if (!(a > -epsilon && a < epsilon)) { result=1.0/a; } }
      case 9u: { result=1.0; if (a>b) { result=b/a; } }
      case 10u: { word=select(cw,bw,a!=0.0); wordResult=true; }
      case 11u: { result=select(0.0,1.0,a<b); }
      case 12u: { result=select(0.0,1.0,a<=b); }
      case 13u: { result=select(0.0,1.0,a>b); }
      case 14u: { word=0x3f800000u|(aw&0x80000000u); wordResult=true; }
      case 15u: { word=aw^0x80000000u; wordResult=true; }
      default: { return rc_num_fail(scratchBase,registers,2u); }
    }
    if (!wordResult) {
      word=bitcast<u32>(result);
      // Explicit IEEE zero signs; do not rely on shader min/max's signed-zero
      // choice. Nonzero arithmetic still follows the device's f32 contract.
      if (rc_num_zero(word)) {
        switch opcode {
          case 1u: { word=select(0u,0x80000000u,aw==0x80000000u && bw==0x80000000u); }
          case 2u: { word=select(0u,0x80000000u,aw==0x80000000u && bw==0u); }
          case 3u,4u: { word=(aw^bw)&0x80000000u; }
          case 7u: { word=aw&0x80000000u; }
          case 8u: { word=0u; let epsilon=bitcast<f32>(${bits(Math.fround(1e-20))}u); if (!(a > -epsilon && a < epsilon)) { word=aw&0x80000000u; } }
          case 9u: { word=(aw^bw)&0x80000000u; }
          default: {}
        }
      }
    }
    if (!rc_num_finite(word)) { return rc_num_fail(scratchBase,registers,3u); }
    rc_scratch[scratchBase+destination]=word;
    if (destination==initialized) { initialized++; }
  }
  if (initialized!=registers) { return rc_num_fail(scratchBase,registers,2u); }
  for(var i=0u;i<outputs;i++) {
    let slot=rc_program[programBase+outputOffset+i];
    if (slot>=initialized) { return rc_num_fail(scratchBase,registers,2u); }
    if (!rc_num_finite(rc_scratch[scratchBase+slot])) { return rc_num_fail(scratchBase,registers,3u); }
  }
  rc_scratch[scratchBase+registers]=1u;
  return 1u;
}
`;
  if(!preserveSubnormals)return code;
  code=code.replace('if (b==0.0)', 'if (rc_num_zero(bw))')
    .replace('if (a<0.0)', 'if ((aw&0x80000000u)!=0u && !rc_num_zero(aw))')
    .replace('select(bw,aw,a<b); if (a==b)', 'select(bw,aw,rc_num_lt_bits(aw,bw)); if (rc_num_eq_bits(aw,bw))')
    .replace('select(bw,aw,a>b); if (a==b)', 'select(bw,aw,rc_num_lt_bits(bw,aw)); if (rc_num_eq_bits(aw,bw))')
    .replace('if (a>b) { result=b/a; }', 'if (rc_num_lt_bits(bw,aw)) { result=b/a; }')
    .replace('select(cw,bw,a!=0.0)', 'select(cw,bw,!rc_num_zero(aw))')
    .replace('select(0.0,1.0,a<b)', 'select(0.0,1.0,rc_num_lt_bits(aw,bw))')
    .replace('select(0.0,1.0,a<=b)', 'select(0.0,1.0,rc_num_lt_bits(aw,bw)||rc_num_eq_bits(aw,bw))')
    .replace('select(0.0,1.0,a>b)', 'select(0.0,1.0,rc_num_lt_bits(bw,aw))')
    .replace('word=bitcast<u32>(result);', 'word=bitcast<u32>(result);\n      if(rc_num_soft_required(opcode,aw,bw,word)){word=rc_num_soft_arithmetic(opcode,aw,bw);}')
    .replaceAll('!(a > -epsilon && a < epsilon)', '!(rc_num_lt_bits(bitcast<u32>(-epsilon),aw) && rc_num_lt_bits(aw,bitcast<u32>(epsilon)))');
  return (includeSourceNumberLibrary?generateSourceNumberWGSL():'')+SUBNORMAL_WGSL+code;
}

/** Exact source profile for denormals. This is NOT an arbitrary binary64 ->
 * binary32 double-rounding claim. For finite binary32 operands:
 * - products have <=48 significant bits; sums close enough to a binary32
 *   rounding midpoint have <=49 significant bits. Binary64 retains them.
 * - normalized division is a/b (or 2a/b), b<2^24. A binary32 midpoint has
 *   denominator <=2^24, so any nonzero distance exceeds 2^-49. Binary64's
 *   rounding error is <=2^-53. Exact midpoint quotients are dyadic and exactly
 *   representable; subnormal binary32 destinations only reduce precision.
 * - normalized sqrt input is in [1,4). A binary32 midpoint m has <=25 bits;
 *   a nonzero x-m*m is >=2^-48, hence |sqrt(x)-m|>2^-50. An exact midpoint
 *   square would require >=49 significant bits, impossible for a binary32 x.
 *   sqrt(nonzero binary32) is always normal binary32.
 * Thus correctly rounded binary64 primitives followed by RN-even binary32
 * conversion preserve direct binary32 rounding, including midpoint underflow.
 * Finite binary32 quotient/product ranges cannot under/overflow binary64.
 * Independent test-only BigInt rational/sqrt oracles cover these bounds.
 */
const SUBNORMAL_WGSL=`
fn rc_num_eq_bits(a:u32,b:u32)->bool{return a==b || ((a|b)&0x7fffffffu)==0u;}
fn rc_num_lt_bits(a:u32,b:u32)->bool{
 if(rc_num_eq_bits(a,b)){return false;}let sa=a>>31u;let sb=b>>31u;if(sa!=sb){return sa!=0u;}return select((a < b),(a > b),sa!=0u);
}
fn rc_num_subnormal(a:u32)->bool{let v=a&0x7fffffffu;return v!=0u && v<0x00800000u;}
fn rc_num_soft_required(op:u32,a:u32,b:u32,result:u32)->bool{
 let sub=rc_num_subnormal(a)||rc_num_subnormal(b);let az=(a&0x7fffffffu)==0u;let bz=(b&0x7fffffffu)==0u;let tiny=(result&0x7fffffffu)<0x00800000u;
 switch op{
  case 1u:{return sub || (tiny&&!az&&!bz&&(a^b)!=0x80000000u);}
  case 2u:{return sub || (tiny&&!az&&!bz&&a!=b);}
  case 3u:{return !az&&!bz&&(sub||tiny);}
  case 4u:{return sub || (!az&&tiny);}
  case 7u:{return rc_num_subnormal(a);}
  case 8u:{let eps=${bits(Math.fround(1e-20))}u;return tiny && !(rc_num_lt_bits(eps|0x80000000u,a)&&rc_num_lt_bits(a,eps));}
  case 9u:{return rc_num_lt_bits(b,a) && (sub || (!bz&&tiny));}
  default:{return false;}
 }
}
// Constant-time exact widening of finite f32 bit words, preserving signed zero.
fn rc_num_widen(a:u32)->RcF64{
 let sign=a&0x80000000u;let field=(a>>23u)&255u;let fraction=a&0x7fffffu;
 if(field==255u){return RcF64(0u,sign|0x7ff00000u|select(0u,0x80000u,fraction!=0u));}
 if(field==0u){if(fraction==0u){return RcF64(0u,sign);}let shift=countLeadingZeros(fraction)-8u;let normalized=(fraction<<shift)&0x7fffffu;return RcF64(normalized<<29u,sign|((897u-shift)<<20u)|(normalized>>3u));}
 return RcF64(fraction<<29u,sign|((field+896u)<<20u)|(fraction>>3u));
}
fn rc_num_soft_arithmetic(op:u32,aw:u32,bw:u32)->u32{
 let a=rc_num_widen(aw);let b=rc_num_widen(bw);var result=RcF64(0u);
 switch op{
  case 1u:{result=rc_f64_add(a,b);}case 2u:{result=rc_f64_sub(a,b);}case 3u:{result=rc_f64_mul(a,b);}case 4u:{result=rc_f64_div(a,b);}
  case 7u:{result=rc_f64_sqrt(a);}case 8u:{result=rc_f64_div(RcF64(0u,0x3ff00000u),a);}case 9u:{result=rc_f64_div(b,a);}default:{}
 }
 return rc_f64_to_f32_bits(result);
}
`;
