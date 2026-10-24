'use strict';
// Test-only: product sources are unmodified, WebGPU is not exercised here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn, execFileSync} = require('node:child_process');
const {chromium, expect} = require('@playwright/test');
const {waitForPretendard} = require('../e2e/font-helper.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'software-webgl-evidence');
fs.mkdirSync(out, {recursive: true});
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'billiard-swangle-'));
const executablePath = process.env.BROWSER_EXECUTABLE || '/opt/google/chrome/chrome';
// Official driver selection, NOT the unsafe WebGL fallback:
// https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
// Discard Playwright defaults, several of which weaken browser security features.
const args = ['--headless', '--remote-debugging-pipe', '--no-startup-window',
  '--no-first-run', '--no-default-browser-check', '--use-gl=angle',
  '--use-angle=swiftshader', `--user-data-dir=${profile}`];
assert(!args.some(a => /no-sandbox|disable-.*sandbox|unsafe|ignore-certificate|disable-web-security/.test(a)));
const evidence = {commit: process.env.GITHUB_SHA || null, timestamp: new Date().toISOString(),
  scope: 'Software WebGL only; not WebGPU compute or physical-GPU performance',
  launch: {executablePath, chromiumSandbox: true, ignoreDefaultArgs: true, args},
  contexts: [], application: [], passed: false};
const save = () => fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify(evidence, null, 2) + '\n');
let browser, launcher, server, serverLog;
async function bounded(promise, milliseconds, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label} exceeded ${milliseconds} ms`)),milliseconds);})]); }
  finally { clearTimeout(timer); }
}
async function cleanup() {
  evidence.cleanup={startedAt:new Date().toISOString(),resourcesBefore:process.getActiveResourcesInfo(),serverPid:server?.pid,browserPid:launcher?.process().pid,forced:[]};save();
  console.log('SOFTWARE_WEBGL_CLEANUP_START '+JSON.stringify(evidence.cleanup));
  // All page contexts have already been closed. Close the client connection,
  // then the specifically owned Playwright browser server, never any shared browser.
  try { if(browser) await bounded(browser.close(),10000,'browser connection close'); }
  catch(error){evidence.cleanup.clientCloseError=error.message;}
  if(launcher){
    try { await bounded(launcher.close(),10000,'owned Chrome close'); }
    catch(error){evidence.cleanup.forced.push('owned Chrome process');await bounded(launcher.kill(),5000,'owned Chrome kill');}
  }
  if(server&&server.exitCode===null&&server.signalCode===null){
    const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');
    try { await bounded(stopped,5000,'owned HTTP server close'); }
    catch(error){evidence.cleanup.forced.push('owned HTTP server process');server.kill('SIGKILL');await bounded(stopped,3000,'owned HTTP server kill');}
  }
  if(serverLog!==undefined)fs.closeSync(serverLog);
  evidence.cleanup.finishedAt=new Date().toISOString();evidence.cleanup.resourcesAfter=process.getActiveResourcesInfo();save();
  console.log('SOFTWARE_WEBGL_CLEANUP_DONE '+JSON.stringify(evidence.cleanup));
}

function probeContext({api, offscreen}) {
  const canvas = offscreen ? new OffscreenCanvas(64, 64) : document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const errors = [];
  canvas.addEventListener('webglcontextcreationerror', e => errors.push(e.statusMessage));
  const gl = canvas.getContext(api, {alpha: false, antialias: false, preserveDrawingBuffer: true});
  const result = {api, offscreen, context: !!gl, errors};
  if (!gl) return result;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  result.renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  result.vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  result.version = gl.getParameter(gl.VERSION);
  result.attributes = gl.getContextAttributes();
  result.software = /SwiftShader|llvmpipe|softpipe|software/i.test(result.renderer);
  const is2 = api === 'webgl2';
  const vertex = is2 ? '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}' : 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}';
  const fragment = is2 ? '#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(.25,.5,.75,1.);}' : 'precision highp float;void main(){gl_FragColor=vec4(.25,.5,.75,1.);}';
  const compile = (kind, source) => {const shader=gl.createShader(kind); gl.shaderSource(shader,source); gl.compileShader(shader); return {shader, pass:gl.getShaderParameter(shader,gl.COMPILE_STATUS), log:gl.getShaderInfoLog(shader)};};
  const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
  result.shaderCompile={vertex:vs.pass,fragment:fs.pass,logs:[vs.log,fs.log]};
  const program=gl.createProgram();gl.attachShader(program,vs.shader);gl.attachShader(program,fs.shader);gl.linkProgram(program);
  result.link=gl.getProgramParameter(program,gl.LINK_STATUS);result.programLog=gl.getProgramInfoLog(program);
  if(result.link){
    gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.viewport(0,0,64,64);gl.disable(gl.DITHER);gl.drawArrays(gl.TRIANGLES,0,3);
    const pixel=new Uint8Array(4);gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    result.pixel=Array.from(pixel);result.expected=[64,128,191,255];result.pixelPass=result.pixel.every((v,i)=>Math.abs(v-result.expected[i])<=1);
    result.glError=gl.getError();result.contextLost=gl.isContextLost();
    gl.deleteBuffer(buffer);
  }
  result.pass=!!(result.software&&result.shaderCompile.vertex&&result.shaderCompile.fragment&&result.link&&result.pixelPass&&result.glError===gl.NO_ERROR&&!result.contextLost);
  gl.deleteProgram(program);gl.deleteShader(vs.shader);gl.deleteShader(fs.shader);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return result;
}

async function rendererProof(page) {
  const mode = await page.evaluate(() => ({worker:!!cueLab.renderer.workerMode,fallback:!!cueLab.renderer.isFallback,reason:cueLab.renderer.fallbackReason || null,frames:cueLab.renderedFrames()}));
  assert.equal(mode.fallback, false, `Canvas2D fallback is NOT software WebGL: ${JSON.stringify(mode)}`);
  let proof;
  if(mode.worker){
    for(const worker of page.workers()){
      const candidate=await worker.evaluate(() => {
        if(typeof renderer === 'undefined' || !renderer?.gl) return null;
        const gl=renderer.gl, ext=gl.getExtension('WEBGL_debug_renderer_info');
        return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),programs:[renderer.main,renderer.depth,renderer.line].map(p=>gl.getProgramParameter(p,gl.LINK_STATUS)),lost:gl.isContextLost(),glError:gl.getError()};
      });
      if(candidate){proof=candidate;break;}
    }
  }else{
    proof=await page.evaluate(() => {
      const r=cueLab.renderer,gl=r.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),programs:[r.main,r.depth,r.line].map(p=>gl.getProgramParameter(p,gl.LINK_STATUS)),lost:gl.isContextLost(),glError:gl.getError()};
    });
  }
  assert(proof, 'Actual application renderer must expose its own live WebGL context');
  assert.match(proof.renderer,/SwiftShader|llvmpipe|softpipe|software/i);
  assert(proof.programs.every(Boolean),'All actual application GLSL programs linked');
  assert.equal(proof.lost,false);assert.equal(proof.glError,0);
  return {...mode,...proof};
}

async function openSidebar(page){
  await expect.poll(()=>page.evaluate(()=>{
    const mobile=matchMedia('(max-width: 767px)').matches;
    const desktop=!!document.querySelector('[data-slot="sidebar"][data-state]:not([data-mobile])');
    return mobile?!desktop:desktop;
  })).toBe(true);
  if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();
  await expect(page.locator('#tab-shot')).toBeInViewport();
}

async function appCase(viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const result={viewport};evidence.application.push(result);save();
  try{
    await page.goto('http://127.0.0.1:8787/');
    await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready,null,{timeout:90000});
    await page.evaluate(()=>cueLab.option('predict',false));
    await page.waitForFunction(()=>cueLab.renderedFrames()>0);
    result.renderer=await rendererProof(page);save();
    result.scene=await page.evaluate(()=>{
      const copy=document.createElement('canvas');copy.width=copy.height=64;const ctx=copy.getContext('2d');ctx.drawImage(cueLab.canvas,0,0,64,64);
      const pixels=ctx.getImageData(0,0,64,64).data,colors=new Set();let opaque=0;
      for(let i=0;i<pixels.length;i+=4){colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);if(pixels[i+3]===255)opaque++;}
      return {distinctColors:colors.size,opaquePixels:opaque,width:cueLab.canvas.width,height:cueLab.canvas.height};
    });
    assert(result.scene.distinctColors>8,'Real billiards frame must not be a blank canvas');assert(result.scene.opaquePixels>100);
    await openSidebar(page);
    await page.getByRole('tab',{name:'수동',exact:true}).click();
    await page.locator('#angle').fill('17.23');await page.locator('#angle').press('Tab');
    const before=await page.evaluate(()=>{globalThis.__SWGL_WORLD=cueLab.lab;globalThis.__SWGL_CANVAS=cueLab.canvas;return{settings:{...cueLab.state.settings},positions:cueLab.lab.objects.map(o=>({...o.body.translation()}))};});
    await page.getByRole('tab',{name:'설정',exact:true}).click();
    const paths=page.getByRole('checkbox',{name:'실제 이동 궤적',exact:true});await paths.click();assert.equal(await page.evaluate(()=>cueLab.state.paths),true);await paths.click();
    await page.getByRole('tab',{name:'경로 탐색',exact:true}).click();
    await page.getByRole('tab',{name:'수동',exact:true}).click();await expect(page.locator('#angle')).toHaveValue('17.23');
    const after=await page.evaluate(()=>({sameWorld:cueLab.lab===__SWGL_WORLD,sameCanvas:cueLab.canvas===__SWGL_CANVAS,settings:{...cueLab.state.settings},positions:cueLab.lab.objects.map(o=>({...o.body.translation()})),overflow:document.documentElement.scrollWidth>innerWidth+1}));
    assert(after.sameWorld&&after.sameCanvas);assert.deepEqual(after.settings,before.settings);assert.deepEqual(after.positions,before.positions);assert.equal(after.overflow,false);result.ui={tabsPreserveWorld:true,manualInput:true,settingsToggle:true,noHorizontalOverflow:true};
    const font=await waitForPretendard(page);result.font={family:font.family,weights:font.weights.map(w=>({weight:w.weight,loadedCount:w.loadedCount,missingKorean:w.missingKorean}))};
    await page.screenshot({path:path.join(out,`app-${viewport.width}x${viewport.height}.png`),fullPage:true});
    result.cadence=await page.evaluate(async()=>{
      const c=cueLab,r=c.renderer,original=r.render,times=[],first=performance.now(),before={calls:c.renderMetrics.frames,presented:c.renderedFrames()};
      r.render=function(...args){times.push(c.last);return original.apply(this,args);};
      let active=true,id;const invalidate=()=>{if(!active)return;c.dirty=true;id=requestAnimationFrame(invalidate);};id=requestAnimationFrame(invalidate);
      try{await new Promise(resolve=>setTimeout(resolve,2400));}finally{active=false;cancelAnimationFrame(id);r.render=original;}
      return {elapsedMs:performance.now()-first,cap:c.renderMetrics.cap,calls:c.renderMetrics.frames-before.calls,presented:c.renderedFrames()-before.presented,timestamps:times,minGapMs:times.length>1?Math.min(...times.slice(1).map((t,i)=>t-times[i])):null,fallback:!!r.isFallback};
    });
    assert.equal(result.cadence.fallback,false);assert.equal(result.cadence.cap,60);
    assert(result.cadence.calls>2&&result.cadence.presented>0,'Actual WebGL frames must be submitted and presented during the sample');
    assert(result.cadence.calls<=Math.ceil(result.cadence.elapsedMs*60/1000)+2);
    assert(result.cadence.minGapMs>=1000/60-1e-4,'Real controller must enforce at most 60 FPS even while continuously invalidated');
    result.finalRenderer=await rendererProof(page);assert.deepEqual(errors,[]);result.pageErrors=errors;result.pass=true;
    console.log('SOFTWARE_WEBGL_APP '+JSON.stringify(result));save();
  }finally{await context.close();}
}

(async()=>{
  try{
    evidence.chromeVersion=execFileSync(executablePath,['--version'],{encoding:'utf8'}).trim();save();
    serverLog=fs.openSync(path.join(out,'server.log'),'w');
    server=spawn(process.execPath,['server.cjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:'8787'},stdio:['ignore',serverLog,serverLog]});
    const deadline=Date.now()+15000;
    while(true){try{const response=await fetch('http://127.0.0.1:8787/');if(response.ok)break;}catch{}if(Date.now()>deadline)throw Error('App server did not become ready');await new Promise(r=>setTimeout(r,100));}
    launcher=await chromium.launchServer({host:'127.0.0.1',executablePath,headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args});
    browser=await chromium.connect(launcher.wsEndpoint());
    evidence.processCommandLines=execFileSync('ps',['-eo','args'],{encoding:'utf8'}).split('\n').filter(line=>line.includes(profile));save();
    assert(evidence.processCommandLines.length>0,'Record actual Chrome process command line');
    assert(!evidence.processCommandLines.some(line=>/--no-sandbox|--disable-gpu-sandbox|--enable-unsafe-swiftshader|--disable-web-security/.test(line)),'No security-relaxing switches in launched browser');
    const page=await browser.newPage();await page.goto('http://127.0.0.1:8787/');
    for(const api of ['webgl','webgl2'])for(const offscreen of [false,true]){
      const proof=await page.evaluate(probeContext,{api,offscreen});evidence.contexts.push(proof);console.log('SOFTWARE_WEBGL_CONTEXT '+JSON.stringify(proof));save();assert.equal(proof.pass,true,`${api} offscreen=${offscreen} must compile and draw on a named software renderer`);
    }
    await page.close();
    for(const viewport of [{width:1280,height:800},{width:390,height:844}])await appCase(viewport);
    evidence.passed=true;console.log('SOFTWARE_WEBGL_PROOF_PASSED');
  }catch(error){evidence.error={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
  finally{save();try{await cleanup();}catch(error){evidence.cleanupError=error.message;evidence.passed=false;save();console.error(error);process.exitCode=1;}}
})();
