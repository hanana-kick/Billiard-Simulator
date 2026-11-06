import json,glob,statistics,pathlib
root=pathlib.Path(__file__).parent
rows=[json.load(open(p)) for p in glob.glob(str(root/'comparison/verify-publication-comparison/[0-9]*.json'))]
def cpu(r):
 last={};total=0
 for s in r['cpu']:
  for p in s['processInfo']:
   if p['id'] in last:total+=max(0,p['cpuTime']-last[p['id']])
   last[p['id']]=p['cpuTime']
 return total
out={'attempts':len(rows),'passed':sum(r['status']=='passed' for r in rows),'fullRestReplays':sum(len(r['replay']) for r in rows),'allReplayPassed':all(x['score']==1 and x['rested'] for r in rows for x in r['replay']),'chrome':rows[0]['chrome'],'groups':[]}
for f in ['default3','default4','moved3','moved4']:
 g={'fixture':f}
 for arm in ['baseline','candidate']:
  rs=sorted([r for r in rows if r['fixture']==f and r['arm']==arm],key=lambda r:r['repeat']);first=[min(v['at'] for v in r['verify'] if v['verified'] and v['success']) for r in rs]
  values={'firstDOMMs':[r['result']['firstDOMMs'] for r in rs],'completedToVisibleDOMMs':[r['result']['firstDOMMs']-(at-r['result']['started']) for r,at in zip(rs,first)],'wholeSearchCPUSecondsLowerBound':[cpu(r) for r in rs],'returnedRoutes':[len(r['replay']) for r in rs]}
  g[arm]={'attemptIds':[r['index'] for r in rs],'values':values,'median':{k:statistics.median(v) for k,v in values.items()}}
 out['groups'].append(g)
print(json.dumps(out,indent=2))
