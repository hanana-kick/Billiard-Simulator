import {EXACT_WIDE_COST} from './exact-wide-cost.mjs';
import {EXACT_DIVIDE_COST} from './exact-divide-cost.mjs';
export const MAX_CANONICAL_OPCODE_COST=Math.max(EXACT_WIDE_COST.nativeCost,EXACT_DIVIDE_COST.validCost);
