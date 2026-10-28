# CPU research only: exact collinear regime phases + independent finite triangle geometry.
import json,mpmath as mp,sys
from pathlib import Path
input_dir=Path(sys.argv[1])
mp.mp.dps=int(sys.argv[2]) if len(sys.argv)>2 else 60
assert 30<=mp.mp.dps<=120;Q=mp.mpf(2)**24;T=mp.mpf(2)**20
inp=json.load(open(input_dir/'contact-reference-input.json'));c=json.load(open(input_dir/'qt-reference-input.json'))[0];row=c['row'];assert c['speed']==2 and c['x']==0
assert row[9]==row[11]==row[12]==0, 'collinear x-only source'
assert row[4]>0 and mp.mpf('2.5')*row[4]>row[5]>0, 'nonsticking qt crossing'
assert inp['commonState'][5]==c['tick'], 'same physical source anchor'
hull=inp['hulls'][1];R=mp.mpf(inp['original'][0]['state'][86])/Q;Y=mp.mpf(inp['original'][0]['state'][89])/Q
add=lambda a,b:[x+y for x,y in zip(a,b)]
sub=lambda a,b:[x-y for x,y in zip(a,b)]
mul=lambda a,s:[x*s for x in a]
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
tris=[]
for i in range(hull[3]):
 b=16+64*i
 if hull[b]==1:tris.append([[mp.mpf(v)/Q for v in hull[b+16+12*j:b+19+12*j]] for j in range(3)])
def dsq(p,tri):
 a,b,c=tri;ab=sub(b,a);ac=sub(c,a);n=cross(ab,ac);ap=sub(p,a);nn=dot(n,n);proj=sub(p,mul(n,dot(ap,n)/nn));v=sub(proj,a);aa=dot(ab,ab);bb=dot(ab,ac);cc=dot(ac,ac);dd=dot(v,ab);ee=dot(v,ac);den=aa*cc-bb*bb;u=(cc*dd-bb*ee)/den;w=(aa*ee-bb*dd)/den
 vals=[]
 if u>=0 and w>=0 and u+w<=1:vals.append(dot(ap,n)**2/nn)
 for a,b in [(a,b),(b,c),(c,a)]:
  e=sub(b,a);t=min(1,max(0,dot(sub(p,a),e)/dot(e,e)));v=sub(p,add(a,mul(e,t)));vals.append(dot(v,v))
 return min(vals)
def gap(x):return min(dsq([x,Y,0],tri) for tri in tris)-R*R
lo=mp.mpf(hull[9])/Q;hi=0
assert gap(lo)<0 and gap(hi)>0
for _ in range(220):
 mid=(lo+hi)/2
 if gap(mid)>0:hi=mid
 else:lo=mid
wall=(lo+hi)/2
# Prove all non-target objects are separated from this monotone x-only path.
start=mp.mpf(row[8])/Q
path_lo=[wall,Y,mp.mpf(0)];path_hi=[start,Y,mp.mpf(0)]
for index,asset in enumerate(inp['hulls']):
 if index==1:continue
 assert any(path_hi[k]+R<mp.mpf(asset[8+2*k])/Q or path_lo[k]-R>mp.mpf(asset[9+2*k])/Q for k in range(3)), 'other hull may precede target'
state=inp['commonState']
for i in range(1,state[3]):
 b=64+i*48;rb=mp.mpf(state[b+22])/Q
 # Input Uint32 words must be interpreted signed for negative coordinates.
 signed=lambda v:v-2**32 if v>=2**31 else v
 assert all(signed(v)==0 for v in state[b+27:b+30]), 'other ball must be stationary'
 assert abs(mp.mpf(signed(state[b+26]))/Q)>R+rb, 'other ball may intersect path'

x,z,vx,vz,qx,qz=[mp.mpf(v)/Q for v in row[8:14]];F=mp.mpf(row[4])/Q;K=mp.mpf(row[5])/Q;su=mp.sign(vx+qz);sq=mp.sign(qz);a=-F*su;b=-mp.mpf('2.5')*F*su-K*sq;tc=-qz/b
assert tc>0
x1=x+vx*tc+a*tc**2/2;v1=vx+a*tc;q1=0
b2=-mp.mpf('2.5')*F*su+K*sq;ts=-(v1+q1)/(a+b2)
assert ts>0
assert wall<x1<start and v1<0, 'qt crossing precedes target monotonically'
x2=x1+v1*ts+a*ts**2/2;v2=v1+a*ts
assert wall<x2<x1 and v2<0, 'slip crossing precedes target monotonically'
ar=-mp.sign(v2)*2*K/7
# first positive root of x2+v2*t+ar*t*t/2 = wall
roots=[(-v2+sgn*mp.sqrt(v2*v2-2*ar*(x2-wall)))/ar for sgn in [-1,1]]
tr=min(t for t in roots if t>0)
assert tr<abs(v2/ar)
contact=mp.mpf(c['tick'])+(tc+ts+tr)*T
print(json.dumps({'precisionDigits':mp.mp.dps,'sourceTick':c['tick'],'otherObjectsExcluded':True,'sharedPhysicalSourceVerified':True,'geometry':'independent closest-point to all packed finite hull triangles, 220 bisections','contactCenterXQuanta':float(wall*Q),'referenceContactTick':float(contact),'qtCrossTicks':float(tc*T),'slipToRollingTicks':float((tc+ts)*T),'originalContactTick':inp['original'][1]['tick'],'earlyContactTick':inp['early'][1]['tick'],'originalErrorTicks':float(inp['original'][1]['tick']-contact),'earlyErrorTicks':float(inp['early'][1]['tick']-contact)}))
