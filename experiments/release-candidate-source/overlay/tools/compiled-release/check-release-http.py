import os,pathlib,subprocess,re,json,urllib.request,hashlib,signal,sys
assert len(sys.argv)==2,'Explicit repository release root required'
root=pathlib.Path(sys.argv[1]);app=root;r=json.loads((app/'dist/canonical-controller-assets/build-receipt.json').read_text());r['htmlSHA256']=hashlib.sha256((app/'dist/index.html').read_bytes()).hexdigest()
p=subprocess.Popen(['node','server.cjs'],cwd=app,env=dict(os.environ,HOST='127.0.0.1',PORT='0'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=p.stdout.readline();m=re.search(r'127\.0\.0\.1:(\d+)',line);assert m,line;base='http://127.0.0.1:'+m[1]+'/'
 files={'index.html':r['htmlSHA256'],'canonical-controller-assets/canonical-controller.mjs':r['controllerSHA256'],'canonical-controller-assets/'+r['worker']['file']:r['worker']['sha256'],'canonical-controller-assets/wasm-gpu-programs/compiled-resource-receipt.json':r['resourceReceiptSHA256']}
 for q in r['programs'].values():
  files['canonical-controller-assets/wasm-gpu-programs/'+q['manifestFile']]=q['manifestSHA256'];files['canonical-controller-assets/wasm-gpu-programs/'+q['artifactFile']]=q['artifactSHA256']
 manifestPath=app/'dist/canonical-controller-assets/wasm-gpu-programs/manifest.json'; original=json.loads(manifestPath.read_text())
 files['canonical-controller-assets/wasm-gpu-programs/manifest.json']='93f9bcc033060761a0a5dd445c4c8bf43eeca4c5088878d83e187c40fe628f02'
 files['canonical-controller-assets/manifest.json']=hashlib.sha256((app/'dist/canonical-controller-assets/manifest.json').read_bytes()).hexdigest()
 for e in original['programs']:
  for q in e['inputs'].values():files['canonical-controller-assets/wasm-gpu-programs/'+q['file']]=q['sha256']
 for q in [original['selectedProgram']['inputs'],original['scheduler']]:files['canonical-controller-assets/wasm-gpu-programs/'+q['file']]=q['sha256']
 facts=[]
 for name,expected in files.items():
  url=base+name;h=hashlib.sha256();size=0
  with urllib.request.urlopen(url,timeout=10) as response:
   assert response.status==200 and response.url==url;assert response.headers['X-Content-Type-Options']=='nosniff';mime=response.headers.get_content_type()
   if name.endswith('.mjs'):assert mime=='text/javascript'
   if name.endswith('.bin'):assert mime=='application/octet-stream'
   if name.endswith('.wasm'):assert mime=='application/wasm'
   while b:=response.read(65536):h.update(b);size+=len(b)
  assert h.hexdigest()==expected,name;facts.append(dict(path=name,bytes=size,sha256=expected,contentType=mime))
 out=dict(kind='actual-built-app-original-server-sealed-assets-http-audit',result='PASS',assets=facts,loopbackOnly=True,gpuExecuted=False,browserUIQualified=False);(root/'http-asset-audit.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'result':'PASS','assets':len(facts),'bytes':sum(f['bytes'] for f in facts)}))
finally:
 p.send_signal(signal.SIGTERM)
 try:p.wait(timeout=10)
 except subprocess.TimeoutExpired:p.kill();p.wait();raise
