import glob,json,statistics,sys,os
root=sys.argv[1];rows=[json.load(open(p)) for p in glob.glob(root+'/[0-9]*.json')]
def cpu(r):
 last={};total=0
 for s in r.get('cpu',[]):
  for p in s['processInfo']:
   if p['id'] in last:total+=max(0,p['cpuTime']-last[p['id']])
   last[p['id']]=p['cpuTime']
 return total
summary=[]
for fixture,arm in sorted(set((r['fixture'],r.get('arm','baseline')) for r in rows)):
 rs=[r for r in rows if r['fixture']==fixture and r.get('arm','baseline')==arm];group={'fixture':fixture,'arm':arm,'n':len(rs),'passed':sum(r['status']=='passed' for r in rs),'attempts':[]}
 for r in sorted(rs,key=lambda r:r['repeat']):
  events=r.get('result',{}).get('events',[]);start=r.get('result',{}).get('started',0);pub=next((e['at']-start for e in events if e['type']=='reported' and e['identities']),None)
  successes=[v for v in r.get('verify',[]) if v.get('verified') and v.get('success')];first=min(successes,key=lambda v:v['at']) if successes else {}
  group['attempts'].append({'index':r['index'],'status':r['status'],'firstPublishedMs':pub,'firstDOMMs':r.get('result',{}).get('firstDOMMs'),'firstVerifyWaitMs':first.get('completedToPublishedMs'),'firstVerifyQueueMs':first.get('queueMs'),'cpuSecondsLowerBound':cpu(r),'elapsedMs':r.get('result',{}).get('elapsedMs'),'recall':len(r.get('replay',[])),'allReplayPassed':all(x['score']==1 and x['rested'] for x in r.get('replay',[])),'failure':r.get('failure')})
 summary.append(group)
print(json.dumps({'groups':summary,'totalReplays':sum(len(r.get('replay',[])) for r in rows)},indent=2))
