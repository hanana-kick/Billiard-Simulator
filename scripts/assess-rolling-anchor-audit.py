import json,sys,pathlib,mpmath as m
m.mp.dps=80;T=m.mpf(2)**20
for r in json.load(open(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1]/'research/rolling-horizon-audit/anchor-reference-input.json')):
 s=r['source'];t=m.mpf(r['ticks'])/T;v=[m.mpf(s[10]),m.mpf(s[11])];n=m.sqrt(sum(x*x for x in v));d=min(t,7*n/(2*s[3]));p=[s[8+i]+v[i]*(d-s[3]*d*d/(7*n)) for i in range(2)];w=[x*(1-2*s[3]*d/(7*n)) for x in v];ref=p+w+[w[1],-w[0],m.sign(s[14])*max(0,abs(s[14])-s[4]*t)]
 assert r['anchorQualified']
 assert r['sequential'] != r['anchor'], 'This experiment must expose the changed rounding policy'
 assert all(abs(m.mpf(x)-y)<=m.mpf(e)+m.mpf('1e-60') for x,y,e in zip(r['anchor'],ref,r['anchorErrors'])), 'Independent reference must lie within original partial diagnostic errors'
 print(json.dumps({k:r[k] for k in ['vx','vz','steps','ticks','anchorQualified']}|{'sequentialAbsErrorQuanta':[float(abs(x-y)) for x,y in zip(r['sequential'],ref)],'anchorAbsErrorQuanta':[float(abs(x-y)) for x,y in zip(r['anchor'],ref)],'stateEqual':r['sequential']==r['anchor']}))

# The experiment deliberately changes integer reanchoring policy; no event authority.
