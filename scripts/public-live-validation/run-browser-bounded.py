import subprocess,time,json,os,signal,pathlib
harness=pathlib.Path(__file__).resolve().parent;base=pathlib.Path(os.environ['RUN_OUT']);base.mkdir(parents=True,exist_ok=True);start=time.monotonic();peak=0;stop=None;owned={}
registry=base/'browser-owned-pid.json';registry.unlink(missing_ok=True)
def snapshot():
 table={}
 for item in pathlib.Path('/proc').iterdir():
  if not item.name.isdigit():continue
  try:
   fields=(item/'stat').read_text().rsplit(') ',1)[1].split();rss=int(next(l.split()[1] for l in (item/'status').read_text().splitlines() if l.startswith('VmRSS:')))
   table[int(item.name)]={'starttime':fields[19],'parent':int(fields[1]),'group':int(fields[2]),'rss':rss}
  except (ProcessLookupError,FileNotFoundError,PermissionError,StopIteration):pass
 return table
def discover():
 table=snapshot()
 try:
  registered=json.loads(registry.read_text());pid=registered['pid']
  if pid in table and table[pid]['starttime']==registered['starttime']:owned[pid]=registered['starttime']
 except (FileNotFoundError,json.JSONDecodeError):pass
 changed=True
 while changed:
  changed=False
  for pid,info in table.items():
   p=info['parent']
   if p in owned and p in table and table[p]['starttime']==owned[p] and pid not in owned:owned[pid]=info['starttime'];changed=True
 return {pid:info for pid,info in table.items() if owned.get(pid)==info['starttime']}
def kill_owned(sig):
 active=discover();groups=set()
 for pid,info in active.items():
  # Only signal a group when its leader is a tracked same-identity process.
  group=info['group']
  if group in active:groups.add(group)
 for group in groups:
  try:os.killpg(group,sig)
  except ProcessLookupError:pass
 for pid in active:
  try:os.kill(pid,sig)
  except ProcessLookupError:pass
with open(base/'browser.log','w') as out,open(base/'browser.stderr','w') as err:
 child=subprocess.Popen(['node','--max-old-space-size=1024',str(harness/'run-browser.cjs')],stdout=out,stderr=err,start_new_session=True)
 owned[child.pid]=snapshot()[child.pid]['starttime']
 while child.poll() is None:
  rss=sum(i['rss'] for i in discover().values());peak=max(peak,rss)
  if time.monotonic()-start>245 or rss>1572864:
   stop='deadline' if time.monotonic()-start>245 else 'RSS';kill_owned(signal.SIGTERM);break
  time.sleep(.02)
 if stop:
  try:child.wait(timeout=5)
  except subprocess.TimeoutExpired:kill_owned(signal.SIGKILL)
 child.wait()
 kill_owned(signal.SIGTERM)
 end=time.monotonic()+5
 while discover() and time.monotonic()<end:time.sleep(.02)
 if discover():kill_owned(signal.SIGKILL)
 end=time.monotonic()+5
 while discover() and time.monotonic()<end:time.sleep(.02)
 remaining=list(discover())
receipt={'exit':child.returncode,'elapsedSeconds':time.monotonic()-start,'sampledPeakOwnedTreeRSSKiB':peak,'stop':stop,'deadlineSeconds':245,'searchObservationSeconds':150,'rssLimitKiB':1572864,'trackedProcesses':len(owned),'remainingLiveOwnedProcesses':remaining,'liveProcessCleanupVerified':not remaining,'passed':child.returncode==0 and stop is None and not remaining,'gpuComputeRequested':False,'chromiumSandbox':True}
(base/'browser-timing.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));print((base/'browser.log').read_text());print((base/'browser.stderr').read_text()[-2000:]);raise SystemExit(child.returncode or (1 if remaining or stop else 0))
