# CPU research only; requires optional mpmath. Not a release gate.
import json,mpmath as mp,sys
from pathlib import Path
input_dir=Path(sys.argv[1])
mp.mp.dps=int(sys.argv[2]) if len(sys.argv)>2 else 60
assert 30<=mp.mp.dps<=120
Q=mp.mpf(2)**24;T=mp.mpf(2)**20

def rhs(y,F,K):
 x,z,vx,vz,qx,qz=y;ux=vx+qz;uz=vz-qx;un=mp.sqrt(ux*ux+uz*uz);qn=mp.sqrt(qx*qx+qz*qz)
 if not un or not qn: raise ArithmeticError('singular vector requires explicit regime event')
 fx=F*ux/un;fz=F*uz/un
 return [vx,vz,-fx,-fz,mp.mpf('2.5')*fz-K*qx/qn,-mp.mpf('2.5')*fx-K*qz/qn]
def rk(y,h,n,F,K):
 dt=h/n
 for _ in range(n):
  a=rhs(y,F,K);b=rhs([v+dt*k/2 for v,k in zip(y,a)],F,K);c=rhs([v+dt*k/2 for v,k in zip(y,b)],F,K);d=rhs([v+dt*k for v,k in zip(y,c)],F,K)
  y=[v+dt*(aa+2*bb+2*cc+dd)/6 for v,aa,bb,cc,dd in zip(y,a,b,c,d)]
 return y

def collinear(y,h,F,K):
 x,z,vx,vz,qx,qz=y;su=mp.sign(vx+qz);sq=mp.sign(qz);a=-F*su;b=-mp.mpf('2.5')*F*su-K*sq;cross=-qz/b if b else -1
 if 0<cross<h:qend=(-mp.mpf('2.5')*F*su+K*sq)*(h-cross)
 else:qend=qz+b*h
 vend=vx+a*h
 if mp.sign(vend+qend)!=su:raise ArithmeticError('slip transition needs separate phase')
 return [x+vx*h+a*h*h/2,z,vend,0,0,qend]

for case in json.load(open(input_dir/'qt-reference-input.json')):
 row=case['row'];y=[mp.mpf(v)/Q for v in row[8:14]];F=mp.mpf(row[4])/Q;K=mp.mpf(row[5])/Q;S=mp.mpf(row[6])/Q;out={k:case[k] for k in ['speed','x','step','tick']};out['endpoints']={}
 for label in ['smooth','qt']:
  receipt=case[label];h=mp.mpf(receipt[5 if label=='smooth' else 4])/T
  if y[3]==0 and y[4]==0:
   ref=collinear(y,h,F,K);method=f'{mp.mp.dps}-digit piecewise analytic';delta=mp.mpf(0);n=0
  else:
   old=rk(y,h,128,F,K);n=256
   while True:
    ref=rk(y,h,n,F,K);delta=max(abs(a-b)*Q for a,b in zip(ref,old))
    if delta<mp.mpf('.01') or n>=8192:break
    old=ref;n*=2
   method=f'{mp.mp.dps}-digit RK4 step doubling'
  spin=mp.sign(row[14])*max(mp.mpf(0),abs(mp.mpf(row[14])/Q)-S*h);ref.append(spin)
  errs=[abs(mp.mpf(v)-a*Q) for v,a in zip(receipt[16:23],ref)]
  out['endpoints'][label]={'ticks':int(h*T),'method':method,'substeps':n,'convergenceDeltaQuanta':float(delta),'converged':delta<mp.mpf('.01'),'absoluteErrorQuanta':[float(v) for v in errs],'receiptBounds':receipt[24:31],'withinReceipt':all(e<=b for e,b in zip(errs,receipt[24:31]))}
 print(json.dumps(out),flush=True)
