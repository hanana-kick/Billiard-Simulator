#!/usr/bin/env python3
"""Hash an already-downloaded exact Pages compiled-app artifact. No network/build."""
import argparse,hashlib,json
from pathlib import Path
from urllib.parse import quote,urlparse
from html.parser import HTMLParser
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);p.add_argument('--commit',required=True);p.add_argument('--run-id',required=True);p.add_argument('--artifact-id',required=True);p.add_argument('--archive',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
assert (a.dist/'index.html').is_file(),'Exact artifact dist/index.html missing; do not substitute local build'
assert len(a.commit)==40 and all(c in '0123456789abcdef' for c in a.commit),'Full pinned deployment build commit required'
files={}
for f in a.dist.rglob('*'):
 if f.is_file():files['/'+quote(f.relative_to(a.dist).as_posix())]=hashlib.sha256(f.read_bytes()).hexdigest()
files['/']=files['/index.html']
class Entry(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.inline=False;self.ui=[];self.required=['/']
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='script':
   self.inline=d.get('id')=='source-ui'
   if d.get('src') and not urlparse(d['src']).scheme:self.required.append('/'+d['src'].lstrip('./'))
  if tag=='link' and d.get('rel')=='stylesheet' and d.get('href') and not urlparse(d['href']).scheme:self.required.append('/'+d['href'].lstrip('./'))
 def handle_endtag(self,tag):
  if tag=='script':self.inline=False
 def handle_data(self,data):
  if self.inline:self.ui.append(data)
entry=Entry();entry.feed((a.dist/'index.html').read_text());ui=''.join(entry.ui)
assert ui or any(k.endswith('.js') for k in entry.required),'No compiled UI evidence in artifact entry'
assert all(k in files for k in entry.required),'Required entry asset absent from artifact'
result={'embeddedUIHash':hashlib.sha256(ui.encode()).hexdigest() if ui else None,'requiredPaths':entry.required,'provenance':{'source':'Already-downloaded Pages build compiled-app artifact, supplied by caller; no local rebuild','commit':a.commit,'runId':a.run_id,'artifactId':a.artifact_id,'archiveSHA256':hashlib.sha256(a.archive.read_bytes()).hexdigest() if a.archive else None},'files':files}
a.out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'files':len(files),'output':str(a.out),'sha256':hashlib.sha256(a.out.read_bytes()).hexdigest()}))
