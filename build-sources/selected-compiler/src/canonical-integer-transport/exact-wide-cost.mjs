/** Immutable source-work certificate, not caller-supplied instruction metadata.
 * Baseline literal helper has 58 straight-line local integer rows then RET.
 * Original trailing unreachable RET is not charged. Native row charges 58;
 * unchanged function RET charges 1. Compiler verifies baseline bytecode hash. */
export const EXACT_WIDE_COST = Object.freeze({sourceSHA256:'69c454d3af33f6400d3746a3e4679d2c373effeaf8ac3559fa0dbf71d9216e39',baselineRowsSHA256:'d9af0b11976cbc2a9b801dffe5d050f5d97b149f74c5b54b6c7be5ce8c134dbb',originalReachableRows:59,nativeCost:58});
export const MAX_CANONICAL_OPCODE_COST=EXACT_WIDE_COST.nativeCost;
