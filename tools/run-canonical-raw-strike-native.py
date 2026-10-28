import os,sys,time,json,signal,subprocess,resource
from pathlib import Path
# Invoke under /usr/bin/flock -x -w300 /tmp/billiard-native-gpu.lock.
root=Path(__file__).resolve().parent.parent;out=root/'artifacts/canonical-raw-strike';out.mkdir(exist_ok=True)
def mem():
 for p in ['/sys/fs/cgroup/memory.events','/sys/fs/cgroup/memory/memory.failcnt']:
  try:return {'path':p,'contents':Path(p).read_text()}
  except (FileNotFoundError,PermissionError,OSError):pass
 return {'available':False}
env=dict(os.environ,GPU_NATIVE_MODULE=os.environ.get('GPU_NATIVE_MODULE','/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js'),REQUIRE_WEBGPU='1',VK_ICD_FILENAMES='/usr/lib/chromium/vk_swiftshader_icd.json',RAW_STRIKE_RECEIPT=str(out/'native-receipt.json'))
before=mem();start=time.monotonic();timedout=False;rssLimited=False;peakOwnedRSS=0
with (out/'native.log').open('w') as f:
 p=subprocess.Popen(['node','--test','--test-reporter=tap','tests/deterministic-raw-strike.mjs'],cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
 while p.poll() is None:
  rss=0
  for path in Path('/proc').glob('[0-9]*/status'):
   try:
    pid=int(path.parent.name)
    if os.getpgid(pid)==p.pid:
     for line in path.read_text().splitlines():
      if line.startswith('VmRSS:'):rss+=int(line.split()[1]);break
   except (OSError,ValueError,ProcessLookupError):pass
  peakOwnedRSS=max(peakOwnedRSS,rss)
  if time.monotonic()-start>180 or rss>1572864:
   timedout=time.monotonic()-start>180;rssLimited=rss>1572864;os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
   break
  time.sleep(.2)
 code=p.wait()
def running_group():
 found=[]
 for path in Path('/proc').glob('[0-9]*/status'):
  try:
   pid=int(path.parent.name);body=path.read_text()
   if os.getpgid(pid)==p.pid and not any(line.startswith('State:') and 'Z' in line for line in body.splitlines()):found.append(pid)
  except (OSError,ValueError,ProcessLookupError):pass
 return found
left=running_group()
if left:
 try:os.killpg(p.pid,signal.SIGKILL)
 except ProcessLookupError:pass
 for _ in range(20):
  if not running_group():break
  time.sleep(.1)
receipt={'activeOwnedPidsAfterCleanup':running_group(),'elapsedSeconds':time.monotonic()-start,'returnCode':code,'signal':signal.Signals(-code).name if code<0 else None,'timedOut':timedout,'rssWatchdogTriggered':rssLimited,'rssLimitKiB':1572864,'peakOwnedGroupRSSKiB':peakOwnedRSS,'maximumChildRSSKiB':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,'cgroupBefore':before,'cgroupAfter':mem(),'processGroup':p.pid,'terminatedAndReaped':True}
(out/'native-process.json').write_text(json.dumps(receipt,indent=2)+'\n')
print((out/'native.log').read_text());print(json.dumps(receipt));sys.exit(0 if code==0 else 1)
