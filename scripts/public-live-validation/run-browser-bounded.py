import subprocess,time,json,os,signal,pathlib
# Never change cgroup limits, OS security, browser flags, or global processes.
# This is a sampled owned-process RSS guard, not an OS hard-memory-limit claim.
harness=pathlib.Path(__file__).resolve().parent;base=pathlib.Path(os.environ['RUN_OUT']);base.mkdir(parents=True,exist_ok=True);start=time.monotonic();peak=0;peakSnapshot=[];stop=None;owned={}
# Fail closed before starting Node or Chrome if the authorized headroom is absent.
def memory_preflight():
 required=3*1024**3
 result={'requiredAvailableBytes':required,'operationalRSSLimitBytes':2*1024**3,'passed':False}
 try:
  available=int(next(line.split()[1] for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:')))*1024
  result['systemMemAvailableBytes']=available
  membership=next(line.split(':',2)[2] for line in pathlib.Path('/proc/self/cgroup').read_text().splitlines() if line.startswith('0::'))
  root=pathlib.Path('/sys/fs/cgroup');current=root/membership.lstrip('/')
  if not current.is_dir():raise RuntimeError('Current cgroup v2 directory is unavailable')
  budgets=[]
  while True:
   # The cgroup v2 root is host-wide and may not expose memory controller limit files.
   # Only that exact root may use the independently measured MemAvailable budget.
   if current==root and not (current/'memory.max').exists() and not (current/'memory.current').exists() and (root/'cgroup.controllers').is_file():
    budgets.append({'scope':'cgroup-v2-root-host-budget','maximumBytes':None,'currentBytes':None,'availableBytes':available});break
   limit=(current/'memory.max').read_text().strip();usage=int((current/'memory.current').read_text().strip())
   maximum=None if limit=='max' else int(limit)
   remaining=None if maximum is None else max(0,maximum-usage)
   budgets.append({'maximumBytes':maximum,'currentBytes':usage,'availableBytes':remaining})
   if current==root:break
   current=current.parent
   if root not in current.parents and current!=root:raise RuntimeError('Unexpected cgroup path')
  finite=[b['availableBytes'] for b in budgets if b['availableBytes'] is not None]
  effective=min([available]+finite)
  result.update({'cgroupBudgets':budgets,'effectiveAvailableBytes':effective,'passed':effective>=required})
 except (OSError,ValueError,StopIteration,RuntimeError) as error:result['error']=str(error)
 (base/'memory-preflight.json').write_text(json.dumps(result,indent=2));print(json.dumps({'memoryPreflight':result}),flush=True)
 if not result['passed']:raise SystemExit('Insufficient or unverifiable memory headroom; browser not launched')
memory_preflight()
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
def process_category(pid):
 try:
  item=pathlib.Path('/proc')/str(pid);name=(item/'comm').read_text().strip();args=(item/'cmdline').read_bytes().split(b'\0');kind=next((a.decode(errors='replace').split('=',1)[1] for a in args if a.startswith(b'--type=')),None)
  return name+(':'+kind if kind else '')
 except (FileNotFoundError,ProcessLookupError,PermissionError):return 'exited'
def kill_owned(sig):
 active=discover();groups=set()
 for pid,info in active.items():
  # Only signal a group when its leader is a tracked same-identity process.
  group=info['group']
  if group in active:groups.add(group)
 for group in groups:
  try:
   identity=(pathlib.Path('/proc')/str(group)/'stat').read_text().rsplit(') ',1)[1].split()[19]
   if identity!=owned.get(group):continue
  except (FileNotFoundError,ProcessLookupError,PermissionError):continue
  try:os.killpg(group,sig)
  except ProcessLookupError:pass
 for pid,info in active.items():
  # Recheck PID start time immediately before every individual signal.
  try:
   identity=(pathlib.Path('/proc')/str(pid)/'stat').read_text().rsplit(') ',1)[1].split()[19]
   if identity!=owned.get(pid):continue
  except (FileNotFoundError,ProcessLookupError,PermissionError):continue
  try:os.kill(pid,sig)
  except ProcessLookupError:pass
child=None
interrupted=None
def interrupted_handler(signum,_frame):
 global interrupted
 interrupted=signum
signal.signal(signal.SIGTERM,interrupted_handler)
signal.signal(signal.SIGINT,interrupted_handler)
error=None
try:
 with open(base/'browser.log','w') as out,open(base/'browser.stderr','w') as err:
  child=subprocess.Popen(['node','--max-old-space-size=1024',str(harness/'run-browser.cjs')],stdout=out,stderr=err,start_new_session=True)
  initial=snapshot()
  if child.pid in initial:owned[child.pid]=initial[child.pid]['starttime']
  elif child.poll() is None:raise RuntimeError('Cannot establish owned Node identity')
  while child.poll() is None:
   active=discover();rss=sum(i['rss'] for i in active.values())
   if rss>peak:
    peak=rss;peakSnapshot=[{'pid':pid,'starttime':info['starttime'],'parent':info['parent'],'group':info['group'],'rssKiB':info['rss'],'category':process_category(pid)} for pid,info in active.items()]
   if interrupted or time.monotonic()-start>245 or rss>2097152:
    stop='signal-'+str(interrupted) if interrupted else 'deadline' if time.monotonic()-start>245 else 'RSS'
    break
   time.sleep(.02)
except BaseException as exception:
 error=str(exception);stop=stop or 'supervisor-error'
finally:
 kill_owned(signal.SIGTERM)
 if child:
  try:child.wait(timeout=5)
  except subprocess.TimeoutExpired:
   kill_owned(signal.SIGKILL)
   try:child.wait(timeout=5)
   except subprocess.TimeoutExpired:stop=stop or 'child-wait-timeout'
 end=time.monotonic()+5
 while discover() and time.monotonic()<end:time.sleep(.02)
 if discover():kill_owned(signal.SIGKILL)
 end=time.monotonic()+5
 while discover() and time.monotonic()<end:time.sleep(.02)
 remaining=list(discover())
 code=child.returncode if child else None
 receipt={'exit':code,'elapsedSeconds':time.monotonic()-start,'sampledPeakOwnedTreeRSSKiB':peak,'sampledPeakOwnedProcesses':peakSnapshot,'stop':stop,'supervisorError':error,'deadlineSeconds':245,'caseSearchObservationSeconds':45,'rssLimitKiB':2097152,'guardType':'sampled owned-process RSS watchdog, no cgroup or security changes','trackedProcesses':len(owned),'remainingLiveOwnedProcesses':remaining,'liveProcessCleanupVerified':not remaining,'passed':code==0 and stop is None and not remaining,'gpuComputeRequested':False,'chromiumSandbox':True}
 (base/'browser-timing.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
 for filename in ['browser.log','browser.stderr']:
  file=base/filename
  if file.exists():print(file.read_text()[-16000:])
raise SystemExit(code or (1 if remaining or stop else 0))
