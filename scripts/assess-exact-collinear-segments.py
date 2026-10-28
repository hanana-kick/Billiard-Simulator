# Optional mpmath research assessment, independent of the BigInt implementation.
import json,sys,mpmath as mp
mp.mp.dps=int(sys.argv[2]) if len(sys.argv)>2 else 60
assert 30<=mp.mp.dps<=120
Q=mp.mpf(2)**24;T=mp.mpf(2)**20

def reference(row,h):
 axis=0 if row[11]==row[12]==0 else 1
 assert (axis==0 and row[11]==row[12]==0) or (axis==1 and row[10]==row[13]==0)
 p=mp.mpf(row[8+axis]);v=mp.mpf(row[10+axis]);w=mp.mpf(row[13] if axis==0 else -row[12]);F=mp.mpf(row[4]);K=mp.mpf(row[5]);left=mp.mpf(h)/T
 su=mp.sign(v+w);sw=mp.sign(w) or -su;a=-F*su;b=-mp.mpf('2.5')*F*su-K*sw
 tq=-w/b if w*b<0 else mp.inf;tu=-(v+w)/(a+b)
 # At most one qt crossing, followed by slip zero, then rolling stop.
 if tq<tu and tq<=left:
  p+=v*tq+a*tq*tq/2;v+=a*tq;w=0;left-=tq
  b=-mp.mpf('2.5')*F*su+K*su;tu=-v/(a+b)
 if tu<=left:
  p+=v*tu+a*tu*tu/2;v+=a*tu;w=-v;left-=tu
  if v:
   ar=-mp.sign(v)*2*K/7;stop=-v/ar;d=min(stop,left);p+=v*d+ar*d*d/2
   v=0 if stop<=left else v+ar*d
  w=-v
 else:p+=v*left+a*left*left/2;v+=a*left;w+=b*left
 spin=mp.sign(row[14])*max(0,abs(mp.mpf(row[14]))-mp.mpf(row[6])*h/T)
 result=[mp.mpf(row[8]),mp.mpf(row[9]),mp.mpf(0),mp.mpf(0),mp.mpf(0),mp.mpf(0),spin];result[axis]=p;result[2+axis]=v;result[5 if axis==0 else 4]=w if axis==0 else -w
 return result

for item in json.load(open(sys.argv[1]))['proofs']:
 proof=item['proof'];ref=reference(proof['source'],proof['durationTicks']);exact=[mp.mpf(x['numerator'])/mp.mpf(x['denominator']) for x in proof['exact']];reference_delta=max(abs(x-y) for x,y in zip(exact,ref));error=[abs(mp.mpf(x)-y) for x,y in zip(proof['endpoint'],ref)]
 assert reference_delta<mp.mpf(10)**(-mp.mp.dps+12)
 assert all(e<=mp.mpf('.5')+mp.mpf(10)**(-mp.mp.dps+12) for e in error)
 assert all(e<=bound+mp.mpf(10)**(-mp.mp.dps+12) for e,bound in zip(error,proof['errors']))
 print(json.dumps({'precisionDigits':mp.mp.dps,'tick':item['tick'],'durationTicks':proof['durationTicks'],'phaseKinds':[x['kind'] for x in proof['phases']],'maximumReferenceRationalDeltaQuanta':float(reference_delta),'absoluteErrorQuanta':[float(x) for x in error],'withinReceipt':True}),flush=True)
