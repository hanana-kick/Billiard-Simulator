import test from 'node:test';
import assert from 'node:assert/strict';
// All values scaled by 400: no floating-point disk-boundary approximation.
const tipCount = step => {
  let result=0;
  for(let x=-220;x<=220;x+=step)for(let y=-180;y<=180;y+=step)if(x*x+y*y<=240*240)result++;
  return result;
};
test('illustrative grids count disk intersection, not square or projected duplicates', () => {
  assert.equal(tipCount(20),393); assert.equal(tipCount(10),1541);
  const cases=[[72,9,18,393,4583952,4477],[360,41,86,393,498858480,487167],[3600,81,171,1541,76839807600,75038875]];
  for(const[a,s,e,t,total,waves]of cases){assert.equal(a*s*e*t,total);assert.equal(Math.ceil(total/1024),waves);}
});
test('fixed elevation and no-spin reduce dimensions rather than inventing samples', () => {
  assert.equal(72*9*1*393,254664); assert.equal(72*9*18*1,11664); assert.equal(72*9,648);
  assert.equal(360*41*1*393,5800680); assert.equal(360*41*86,1269360); assert.equal(360*41,14760);
});
