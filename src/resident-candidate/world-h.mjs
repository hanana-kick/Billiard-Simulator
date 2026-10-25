/* SPDX-License-Identifier: Apache-2.0
 * Immutable command schedule for the actual source world. Candidate branches,
 * contact order, CCD continuations and solver state remain on the device. A
 * bounded dispatch schedule is NOT a replacement iteration count: unfinished
 * owners fail closed before h publication. No CPU-evolved input is accepted.
 */
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
import {generateBvhWGSL} from './bvh.mjs';
import {generateContactJournalWGSL,CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {generateContactRosterWGSL} from './contact-roster.mjs';
import {generateSceneActivationWGSL,SCENE_LAYOUT as S} from './scene-activation.mjs';
import {generateSceneInitializationWGSL} from './scene-initialization.mjs';
import {generateSceneWorldWGSL,generateSceneWorldEvaluateWGSL} from './scene-world.mjs';
import {generateSceneIntegrationWGSL,generateSceneIntegrationEnergyWGSL,generateSceneIntegrationEvaluateWGSL} from './scene-integration.mjs';
import {generateCueOrchestrationWGSL} from './cue-orchestration.mjs';
import {generateCueCanonicalBridgeWGSL,generateCueInactiveCcdWGSL} from './cue-bridge.mjs';
import {generateWorldBroadWGSL} from './world-broad.mjs';
import {generateWorldGeometryWGSL,WORLD_GEOMETRY_LAYOUT as G} from './world-geometry.mjs';
import {generateWorldCueGeometryWGSL,generateWorldCueGeometryStageWGSL,WORLD_CUE_GEOMETRY_STAGES} from './world-cue-geometry.mjs';
import {generateCueClothCacheWGSL} from './cue-cloth-cache.mjs';
import {generateGeometryWorldWGSL} from './geometry-world.mjs';
import {generateWorldSolverWGSL} from './world-solver.mjs';
import {generateCoupledStagedWGSL} from './coupled-solver.mjs';
import {generateCoupledFlatWGSL,COUPLED_FLAT_LAYOUT} from './coupled-flat.mjs';
import {generateCoupledTransportWGSL,coupledTransportWorkBound} from './coupled-transport.mjs';
import {generateCueFlatWGSL,cueFlatDispatchCapacity} from './cue-flat.mjs';
import {generateCcdWGSL} from './ccd.mjs';
import {generateCcdFlatWGSL,planCcdFlatDispatches} from './ccd-flat.mjs';
import {generateWorldCcdWGSL} from './world-ccd.mjs';
import {generateApplicationWGSL,APPLICATION_LAYOUT as A} from './application.mjs';
import {generatePhysicalRulesWGSL,RULE_LAYOUT as R} from './physical-rules.mjs';
import {generateRawStrikeProgramWGSL} from './raw-strike.mjs';
import {generateWorldApplicationWGSL,generateWorldApplicationEvaluateWGSL,WORLD_APPLICATION_LAYOUT as WA} from './world-application.mjs';
import {generateWorldApplicationFlatWGSL,worldApplicationFlatDispatchBound} from './world-application-flat.mjs';

export const WORLD_H_CAPABILITY=Object.freeze({sourceStageComposition:true,hostForwardFallback:false,
  intermediateStateReadback:false,nativeWholeHQualified:false,fullRestQualified:false,defaultBackend:false});
export const WORLD_H_BOUNDS=Object.freeze({cueJobs:640,energyJobs:25,broadRows:27,
  coupledJobs:2130,inactiveCcdJobs:16,activeCcdJobs:4096,ccdPasses:4});
// Explicit source-family declarations. These labels only route the unchanged
// CALLs; they never select a candidate or infer a numerical result.
const OWNER_BY_STAGE=new Map();
const own=(owner,names)=>{for(const name of names){if(OWNER_BY_STAGE.has(name)&&OWNER_BY_STAGE.get(name)!==owner)throw Error('Conflicting source owner '+name);OWNER_BY_STAGE.set(name,owner);}};
for(const label of ['cue-application','cue-joint'])own('cue',['begin','prepare','numeric','source','scatter','flat','done'].map(k=>label+'-'+k));
own('coupled',['gather','evaluate','scatter','flat','transport'].map(k=>'ball-solver-'+k));
for(const label of ['application-post','application-outer'])own('application',['begin','flat-begin','flat','gather','evaluate','scatter','finish'].map(k=>label+'-'+k));
own('shared-graph',['collision-broad-evaluate','post-broad-evaluate','scene-energy-evaluate','cloth-evaluate','entry-inactive-evaluate','newly-awake-inactive-evaluate','post-inactive-evaluate','active-ccd-pre-evaluate','active-ccd-post-evaluate',...['pre','post'].flatMap(p=>[0,1].map(r=>'cue-'+p+'-ccd-'+r)),...['floor','pair','convexPrepare','convexFinish'].map(k=>'ball-geometry-'+k),'cue-geometry-pose','cue-geometry-cache']);
own('point',['init','gjk','epa','finish'].map(k=>'ball-geometry-'+k));
own('contact',['init','gjk','epa','finish'].map(k=>'cue-geometry-contact-'+k));
own('normal',['init','gjk','finish'].map(k=>'cue-geometry-normal-'+k));
for(const mode of ['pre','post'])own('ccd-'+mode,['control','flat-begin','flat','flat-finish'].map(k=>'active-ccd-'+mode+'-'+k));

const PREFIX=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;
`;

/** Binding order is state, immutable programs, immutable geometry, reusable
 * candidate scratch, raw rows. count is a tile count, not a search domain.
 * The final fixed-CCD tail occurs once in state, after all candidate banks. */
export function generateWorldHPlan(t,{count,numericProfile=NUMERIC_PROFILE.PRESERVED_F32,coupledTransport='staged',cueTransport='staged',applicationTransport='staged',ccdTransport='staged',queryTransport='staged',queryChunk=8}={}){
 if(t?.kind!=='resident-created-world-layout'||!Number.isInteger(count)||count<1||count>4096)throw new RangeError('Owned world template and bounded tile required');
 if(!['staged','flat','micro'].includes(coupledTransport))throw new RangeError('Explicit known coupled continuation transport required');
 if(!['staged','flat'].includes(cueTransport))throw new RangeError('Explicit known cue continuation transport required');
 if(!['staged','flat'].includes(applicationTransport))throw new RangeError('Explicit known application continuation transport required');
 if(!['staged','chunked'].includes(queryTransport)||![2,4,8].includes(queryChunk))throw new RangeError('Explicit source query transport required');
 if(!['staged','flat'].includes(ccdTransport))throw new RangeError('Explicit known CCD continuation transport required');
 for(const name of['worldH','worldApplication'])if(!t.segments[name])throw new RangeError('Complete application/world bank required');
 const o=Object.fromEntries(Object.entries(t.segments).map(([k,v])=>[k,v.offset])),p=t.programOffsets;
 const b=name=>`bank+${o[name]}u`,q=b('cue'),h=b('worldH'),a=b('worldApplication'),j=b('journal'),s=b('scene'),c=b('ccd'),body=b('bodies'),sw=b('sceneWorld'),broad=b('broad'),bv=b('bvh'),cl=b('cueCloth');
 const options={numericProfile,queryTransport,queryChunk},num=generateProfiledNumericWGSL(numericProfile);
 // Transport chunks are NOT source solver iterations. The conservative bound
 // counts every original job at the largest original graph length; completion
 // is still checked by the unchanged canonical solver scatter. Budget lives in
 // a device-owned word so the compiler cannot statically unroll the driver.
 const flatBudget=COUPLED_FLAT_LAYOUT.defaultInstructionBudget;
 const flatCoupledChunks=Math.ceil((WORLD_H_BOUNDS.coupledJobs*Math.max(...t.bundles.coupled.entries.map(e=>e.compiled.nodeCount))+1)/flatBudget);
 const coupledMicroCapacity=coupledTransportWorkBound(t.bundles.coupled,{instructionBudget:flatBudget});
 const flatCueCapacity=cueFlatDispatchCapacity(t.bundles.cue,{instructionBudget:flatBudget});
 const flatApplicationCapacity=Object.freeze({post:worldApplicationFlatDispatchBound(t.bundles.application,{mode:15,instructionBudget:flatBudget}),outer:worldApplicationFlatDispatchBound(t.bundles.application,{mode:16,instructionBudget:flatBudget})});
 const flatCcdCapacity=planCcdFlatDispatches(t.bundles.ccd,{instructionBudget:flatBudget});
 const integer=[generateBvhWGSL(),generateContactJournalWGSL(),generateContactRosterWGSL(),generateSceneActivationWGSL(),generateSceneInitializationWGSL(),generateSceneWorldWGSL({includeNumericLibrary:false,continuationOnly:true}),generateCueCanonicalBridgeWGSL(),generateSceneIntegrationWGSL(t),generateSceneIntegrationEnergyWGSL(t),generateWorldBroadWGSL(t.bundles.broad),generateGeometryWorldWGSL(),generateWorldSolverWGSL(),generateWorldGeometryWGSL(t,'control'),generateCueClothCacheWGSL(t.bundles.cueCloth),generateWorldCueGeometryWGSL(),generateWorldCcdWGSL(t,t.bundles.ccd)];
 const ccd=generateCcdWGSL(t.bundles.ccd),app=generateRawStrikeProgramWGSL()+generateApplicationWGSL(t.bundles.application),rules=generatePhysicalRulesWGSL(),worldApp=generateWorldApplicationWGSL(t);
 const helpers=`
 fn rc_wh_fail(bank:u32,detail:u32){if(rc_state[bank+2u]==1u){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;rc_state[bank+${o.worldH+3}u]=detail;}}
 fn rc_wh_check(bank:u32){
  if(rc_state[bank+2u]!=1u){return;}
  if(rc_state[bank+${o.broad}u]!=0u||rc_state[bank+${o.journal}u]!=0u||rc_state[bank+${o.roster}u]!=0u||rc_state[bank+${o.scene+S.header.status}u]!=1u||rc_state[bank+${o.ccd}u]!=0u||rc_state[bank+${o.cueCloth}u]!=0u||rc_state[bank+${o.cueGeometry}u]!=0u||rc_state[bank+24u]!=0u){rc_wh_fail(bank,1u);}
 }
 fn rc_wh_cloth_visit(bank:u32)->bool{let cloth=bank+${o.cueCloth}u;let journal=bank+${o.journal}u;var first=0xffffffffu;var second=0xffffffffu;for(var i=0u;i<rc_state[journal+2u];i++){let row=journal+${J.colliderOffset}u+i*${J.colliderStride}u;if(rc_state[row]==rc_state[cloth+20u]&&rc_state[row+1u]==rc_state[cloth+21u]){first=i;}if(rc_state[row]==rc_state[cloth+22u]&&rc_state[row+1u]==rc_state[cloth+23u]){second=i;}}if(first==0xffffffffu||second==0xffffffffu){rc_wh_fail(bank,2u);return false;}return rc_world_scene_geometry_visited(bank,first,second);}
 `;
 const pipelines=[],schedule=[];
 const stage=(name,code,extra=[],guard='true')=>{
  const entry=`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${count}u){return;}let bank=gid.x*${t.state.length}u;let scratch=gid.x*${t.numericScratchWords}u;if(rc_state[bank+2u]!=1u||!(${guard})){return;}${code}}`;
  const linked=linkResidentWGSL([PREFIX,...integer,helpers,...extra,entry]);const index=pipelines.length,owner=OWNER_BY_STAGE.get(name)??'control';let sourceNoOp;
  if(['ball-geometry-init','ball-geometry-epa','ball-geometry-finish'].includes(name))sourceNoOp=Object.freeze({skip:`!(rc_state[bank+24u]==0u&&rc_state[bank+25u]<26u&&rc_state[bank+31u]==1u&&rc_geometry[${t.geometryOffsets.catalog}u+rc_state[bank+25u]*16u]==2u&&rc_state[bank+29u]==1u)`,proof:'original world point phase returns before resident mutation when point_ready is false; active EPA/finish and cursor checks remain'});
  if(['cue-geometry-contact-init','cue-geometry-contact-epa','cue-geometry-contact-finish'].includes(name))sourceNoOp=Object.freeze({skip:`!(rc_state[${b('cueGeometry')}]==0u&&rc_state[${b('cueGeometry')}+10u]==1u)`,proof:'original world contact wrapper calls no source function when query_active is false; active EPA/finish remain'});
  if(['cue-geometry-normal-init','cue-geometry-normal-finish'].includes(name)){const g=b('cueGeometry'),cache=`${g}+32u+rc_state[${g}+2u]*56u`;sourceNoOp=Object.freeze({skip:`!(rc_state[${g}]==0u&&rc_state[${g}+11u]==2u&&rc_state[${cache}+2u]==2u&&rc_state[${cache}+11u]==1u)`,proof:'original empty query readiness returns before scratch validation/init/output mutation; active normal finish remains'});}
  if(owner==='control'&&/\bfn (?:rc_num_eval|rc_source_program_step)\(/.test(linked.code))throw new RangeError('Source control phase unexpectedly contains a graph VM: '+name);pipelines.push(Object.freeze({name,owner,...(sourceNoOp?{sourceNoOp}:{}),code:linked.code,functions:linked.functions,devicePc:Object.freeze({guard:`rc_state[bank+2u]==1u&&(${guard})`,body:code})}));return Object.freeze({pipeline:index});
 };
 // Metadata only: the staged command walker ignores these predicates. A
 // device-PC owner may skip remaining repetitions only at a loop boundary
 // where EVERY child call is a proven source no-op. No physics cap is reduced.
 const repeat=(times,steps,continueGuard,proof)=>Object.freeze({repeat:times,steps:Object.freeze(steps),...(continueGuard?{devicePc:Object.freeze({skip:`!(${continueGuard})`,proof})}:{})}),emit=(...steps)=>schedule.push(...steps);
 const pass=`rc_state[${h}+1u]==1u`,live=`rc_state[${h}]==1u`,active=`rc_state[${h}]==0u`,present=`rc_state[${q}+4u]!=0u`;
 const cueStages=(label,mode,guard)=>cueTransport==='flat'?[
  stage(label+'-begin',`rc_cue_flat_begin(${q},${p.cue}u,${mode}u,${h}+8u);`,[generateCueFlatWGSL(options)],guard),
  repeat(Math.ceil((mode===0?flatCueCapacity.applicationInstructions:flatCueCapacity.solveInstructions)/flatBudget),[stage(label+'-flat',`if(rc_state[${h}+24u]!=${flatBudget}u){rc_wh_fail(bank,15u);return;}rc_cue_flat_advance(${q},${body}+${t.selectedIndex*64}u,${b('others')},3u,${p.cue}u,scratch,${h}+8u,rc_state[${h}+24u]);`,[generateCueFlatWGSL(options)],guard)],`(${guard})&&(rc_state[${h}+24u]!=${flatBudget}u||rc_state[${q}+2u]==0u)`,'cue-flat advance returns the sticky nonzero source status without mutation'),
  stage(label+'-done',`if(rc_state[${q}+2u]!=1u${mode===1?`||rc_state[${q}+12u]!=0u`:''}){rc_wh_fail(bank,3u);}`,[],guard)
 ]:[
  stage(label+'-begin',`rc_cue_begin(${q},${p.cue}u,${mode}u);`,[generateCueOrchestrationWGSL('prepare',options)],guard),
  repeat(WORLD_H_BOUNDS.cueJobs,['prepare','numeric','source','scatter'].map(kind=>stage(label+'-'+kind,`rc_cue_${kind}(${q},${kind==='prepare'||kind==='scatter'?`${body}+${t.selectedIndex*64}u,`:''}${kind==='prepare'?`${b('others')},3u,`:''}${p.cue}u${kind!=='source'?',scratch':''});`,[generateCueOrchestrationWGSL(kind,options)],guard)),`(${guard})&&rc_state[${q}+2u]==0u`,'all four cue stage entries return the sticky nonzero source status before mutation'),
  stage(label+'-done',`if(rc_state[${q}+2u]!=1u${mode===1?`||rc_state[${q}+12u]!=0u`:''}){rc_wh_fail(bank,3u);}` ,[],guard)
 ];
 const broadRows=label=>repeat(27,['gather','evaluate','scatter'].map(kind=>stage(label+'-'+kind,
  kind==='gather'?`rc_world_broad_gather(${broad},${j},${s},scratch);`:kind==='evaluate'?`rc_world_broad_evaluate(${broad},${p.broad}u,scratch);`:`rc_world_broad_scatter(${broad},scratch);`,kind==='evaluate'?[num]:[],pass)),`${pass}&&rc_state[${broad}]==0u&&(rc_state[${broad}+19u]!=0u||rc_state[${broad}+20u]<rc_state[${broad}+7u])`,'broad gather stops at updates, evaluate/scatter require pending; errors are sticky');
 const inactive=label=>repeat(16,['evaluate','control'].map(kind=>stage(label+'-'+kind,kind==='evaluate'?`rc_world_ccd_inactive_evaluate(${c},scratch,${p.ccd}u);`:`rc_world_ccd_inactive_control(${c},${body});`,[ccd,...(kind==='evaluate'?[num]:[])],`${pass}&&${live}`)),`${pass}&&${live}&&rc_state[${c}]==0u&&(rc_state[${c}+1184u]==10u||rc_state[${c}+1184u]==12u||rc_state[${c}+1184u]==14u)`,'inactive evaluate/control both return outside the three pending adapter phases or on source error');
 const activePump=label=>{
  if(ccdTransport==='staged')return repeat(4096,['evaluate','control'].map(kind=>stage(label+'-'+kind,kind==='evaluate'?`rc_world_ccd_evaluate(${c},scratch,${p.ccd}u);`:label.endsWith('-pre')?`rc_world_ccd_pre_control(bank,${c},scratch,${p.ccd}u);`:`rc_world_ccd_post_control(${c},${body},scratch,${p.ccd}u);`,[ccd,...(kind==='evaluate'?[num]:[])],`${pass}&&${active}`)),`${pass}&&${active}&&rc_state[${c}]==0u&&(rc_state[${c}+1184u]==1u||rc_state[${c}+1184u]==3u)`,'world CCD evaluate/control return outside pending pre/post phases or on source error');
  const mode=label.endsWith('-pre')?'pre':'post',flat=generateCcdFlatWGSL(t.bundles.ccd,{...options,worldTemplate:t,mode}),guard=`${pass}&&${active}`;
  return repeat(1,[stage(label+'-flat-begin',`if(rc_ccd_flat_begin(${c},${h}+8u)>1u){rc_wh_fail(bank,16u);}`,[flat],guard),
   repeat(flatCcdCapacity.dispatches,[stage(label+'-flat',`if(rc_state[${h}+24u]!=${flatBudget}u){rc_wh_fail(bank,15u);return;}if(rc_ccd_flat_advance(${c},${h}+8u,scratch,${p.ccd}u,rc_state[${h}+24u])>1u){rc_wh_fail(bank,16u);}`,[flat],guard)]),
   stage(label+'-flat-finish',`if(rc_ccd_flat_finish(${c},${h}+8u)!=1u){rc_wh_fail(bank,16u);}`,[flat],guard)]);
 };
 const applicationPending=`(rc_state[${a}+2u]==4u||rc_state[${a}+2u]==6u)&&(rc_state[${b('application')}+${A.header.complete}u]==0u||rc_state[${b('application')}+${A.header.jobType}u]!=0u||rc_state[${b('application')}]!=0u||rc_state[${b('rules')}+${R.status}u]==4u)`;
 const applicationCycle=label=>applicationTransport==='flat'?repeat(1,[
  stage(label+'-flat-begin',`rc_world_application_flat_begin(bank,${h}+8u);`,[rules,generateWorldApplicationFlatWGSL(t,options)]),
  repeat((label.endsWith('-post')?flatApplicationCapacity.post:flatApplicationCapacity.outer).dispatches,[stage(label+'-flat',`if(rc_state[${h}+24u]!=${flatBudget}u){rc_wh_fail(bank,15u);return;}rc_world_application_flat_advance(bank,scratch,${h}+8u,rc_state[${h}+24u]);`,[rules,generateWorldApplicationFlatWGSL(t,options)])],`rc_state[${h}+24u]!=${flatBudget}u||((rc_state[${a}+2u]==4u||rc_state[${a}+2u]==6u)&&rc_state[${h}+9u]==0u)`,'flat application prior status returns before every continuation mutation; preserve budget validation')
 ]):repeat(WA.maximumApplicationJobs,['gather','evaluate','scatter'].map(kind=>stage(label+'-'+kind,`rc_world_application_${kind}(bank,scratch);`,[app,rules,worldApp,generateWorldApplicationEvaluateWGSL(t),num])),applicationPending,'completed application with no job performs no gather/evaluate/scatter writes; pending source errors still execute check');
 emit(stage('begin-outer',`if(rc_state[${a}+2u]==0u){rc_world_application_begin_outer(bank);}`, [app,rules,worldApp]),
  stage('begin-h',`rc_state[${h}]=u32(rc_state[${q}+4u]!=0u);rc_state[${h}+1u]=1u;rc_state[${h}+2u]=0u;${coupledTransport!=='staged'||cueTransport==='flat'||applicationTransport==='flat'||ccdTransport==='flat'?`rc_state[${h}+24u]=${flatBudget}u;`:''}rc_world_application_begin_h(bank);`,[app,rules,worldApp]));
 emit(...cueStages('cue-application',0,live));
 emit(stage('scene-after-cue',`rc_world_scene_after_cue_pre(bank);rc_world_application_after_cue_pre(bank);`,[app,rules,worldApp]));
 for(let role=0;role<2;role++)emit(stage('cue-pre-ccd-'+role,`if(rc_cue_inactive_ccd(${q},${body},${b('cuePreSolve')},${p.cueCcd+t.bundles.cueCcd.pre.base}u,scratch,${role}u,false)!=1u){rc_wh_fail(bank,4u);}`,[generateCueInactiveCcdWGSL({includeNumericLibrary:false}),num],present));
 emit(stage('begin-ccd',`if(${live}){rc_world_ccd_inactive_begin(bank,${c},${body},${s},${sw},rc_state[bank+10u]);}else{rc_world_ccd_begin(bank,${c},rc_state[bank+10u],${t.minimumCcdDtWord}u,0u);}rc_wh_check(bank);`,[ccd]));
 // Live-cue entry predicates precede any broad/narrow activation mutation.
 emit(inactive('entry-inactive'),stage('entry-inactive-done',`if(rc_state[${c}+1184u]!=11u){rc_wh_fail(bank,5u);}`,[],live));
 const physicsPass=[];
 physicsPass.push(stage('pass-start',`if(rc_state[${h}+2u]!=0u){if(${live}||rc_state[${c}+1u]==3u){rc_state[${h}+1u]=0u;return;}rc_world_scene_next_internal(bank);}rc_state[${h}+1u]=1u;`,[]));
 physicsPass.push(stage('collision-broad-begin',`rc_world_broad_begin_collision(${broad},${bv},${j},${s},${q});rc_wh_check(bank);`,[],pass),broadRows('collision-broad'));
 physicsPass.push(stage('collision-broad-commit',`rc_world_broad_commit_collision(${broad},${bv},${j});rc_world_broad_before_queries(${broad},${bv});rc_world_scene_after_broad(bank);rc_world_geometry_begin(bank);rc_wh_check(bank);`,[],pass));
 const pointReady=`${pass}&&rc_state[bank+24u]==0u&&rc_state[bank+25u]<26u&&rc_state[bank+31u]==1u&&rc_geometry[${t.geometryOffsets.catalog}u+rc_state[bank+25u]*16u]==2u&&rc_state[bank+29u]==1u`;
 physicsPass.push(repeat(26,G.stages.map(kind=>{const step=stage('ball-geometry-'+kind,'rc_world_geometry_stage(bank,scratch);',[generateWorldGeometryWGSL(t,kind,options)],pass);return kind==='gjk'?repeat(queryTransport==='chunked'?256/queryChunk:256,[step],pointReady+(queryTransport==='staged'?'&&(rc_scratch[scratch]&0x7fffffffu)==0u':''),'point owner readiness guard returns before mutation; staged GJK also returns on completed source status, chunk cursor cap is retained'):step;})));
 physicsPass.push(stage('cloth-prepare',`rc_cloth_prepare(${cl},${j},${body}+320u,rc_state[bank+10u],rc_wh_cloth_visit(bank));`,[],pass));
 for(const kind of['gather','evaluate','scatter'])physicsPass.push(stage('cloth-'+kind,`rc_cloth_${kind}(${cl},${kind==='evaluate'?`${p.cueCloth}u,`:''}scratch);`,kind==='evaluate'?[num]:[],pass));
 physicsPass.push(stage('cloth-publish',`rc_cloth_publish(${cl},${j},${b('geometryFacts')},${b('manifoldViews')},${b('geometryRefreshed')});rc_world_cue_geometry_begin(${b('cueGeometry')},${j});rc_wh_check(bank);`,[],pass));
 const cg=b('cueGeometry'),cueCache=`${cg}+32u+rc_state[${cg}+2u]*56u`;
 const contactReady=`${pass}&&rc_state[${cg}]==0u&&rc_state[${cg}+10u]==1u`+(queryTransport==='staged'?`&&(rc_scratch[scratch]&0x7fffffffu)==0u&&((rc_state[${cg}+3340u]&0x7fffffffu)==0u||rc_state[${cg}+3340u]==0x40000000u)`:''),normalReady=`${pass}&&rc_state[${cg}]==0u&&rc_state[${cg}+11u]==2u&&rc_state[${cueCache}+2u]==2u&&rc_state[${cueCache}+11u]==1u`+(queryTransport==='staged'?'&&(rc_scratch[scratch]&0x7fffffffu)==0u':'');
 physicsPass.push(repeat(56,WORLD_CUE_GEOMETRY_STAGES.map(kind=>{const step=stage('cue-geometry-'+kind,`rc_world_cue_geometry_stage(${b('cueGeometry')},${j},${body},${b('geometryFacts')},${b('manifoldViews')},${b('geometryRefreshed')},${p.cueGeometry}u,scratch);`,[generateWorldCueGeometryStageWGSL(kind,options)],pass);return kind==='contact-gjk'||kind==='normal-gjk'?repeat(queryTransport==='chunked'?256/queryChunk:256,[step],kind==='contact-gjk'?contactReady:normalReady,'original cue query readiness and completed GJK return before resident writes; preserve EPA, finish and all56 row lifecycles'):step;})));
 physicsPass.push(stage('narrow-commit',`if(!rc_world_geometry_complete(bank)||rc_state[${b('cueGeometry')}+2u]!=56u){rc_wh_fail(bank,6u);return;}rc_world_broad_narrow(${broad},${j},${b('geometryFacts')},rc_state[${j}+3u]);rc_world_scene_after_narrow(bank);rc_wh_check(bank);`,[],pass));
 physicsPass.push(stage('active-ccd-pre-begin',`rc_world_ccd_pre_begin(bank,${c},${body},${s},${sw},${broad},${j},${count*t.state.length}u,${bv});`,[ccd],`${pass}&&${active}`),activePump('active-ccd-pre'));
 physicsPass.push(stage('energy-begin',`if(${active}&&rc_state[${c}+1184u]!=2u){rc_wh_fail(bank,7u);return;}rc_world_scene_begin_energy(bank);`,[],pass));
 // 24 source evaluations plus the final gather-only completion walk.
 physicsPass.push(repeat(25,['gather','evaluate','scatter'].map(kind=>stage('scene-energy-'+kind,`rc_world_scene_energy_${kind}(bank,scratch);`,kind==='evaluate'?[generateSceneWorldEvaluateWGSL(options),generateSceneIntegrationEvaluateWGSL(t)]:[],pass)),`${pass}&&rc_state[bank+12u]==3u`,'all energy stages return outside original energy phase3'));
 physicsPass.push(stage('roster-and-new-wake',`if(rc_state[bank+12u]!=4u){rc_wh_fail(bank,8u);return;}rc_world_scene_prepare_roster(bank);if(${live}){rc_world_ccd_inactive_newly_awake_begin(${c},${body},${s},${sw});}rc_cloth_ownership(${cl},${j},${b('roster')},${s});rc_wh_check(bank);`,[ccd],pass),inactive('newly-awake-inactive'));
 physicsPass.push(stage('solver-prepare',`if(${live}&&rc_state[${c}+1184u]!=13u){rc_wh_fail(bank,9u);return;}if(${present}){if(rc_cue_capture_pre_solve(${q},${body},${b('cuePreSolve')})!=1u){rc_wh_fail(bank,10u);return;}rc_cloth_bind_cue(${cl},${q});}rc_wh_check(bank);`,[],pass));
 physicsPass.push(...cueStages('cue-joint',1,`${pass}&&${present}`));
 physicsPass.push(stage('cue-cloth-complete',`rc_cloth_complete(${cl},${q});if(rc_cue_to_canonical(${q},${body})!=1u){rc_wh_fail(bank,11u);}rc_wh_check(bank);`,[],pass));
 for(let role=0;role<2;role++)physicsPass.push(stage('cue-post-ccd-'+role,`if(rc_cue_inactive_ccd(${q},${body},${b('cuePreSolve')},${p.cueCcd+t.bundles.cueCcd.post.base}u,scratch,${role}u,true)!=1u){rc_wh_fail(bank,12u);}`,[generateCueInactiveCcdWGSL({includeNumericLibrary:false}),num],`${pass}&&${present}`));
 const coupledPending=`${pass}&&rc_state[${b('worldSolver')}]==0u&&rc_state[${b('worldSolver')}+1u]==1u&&rc_state[${b('coupled')}+${t.coupledLayout.rosterBase+6}u]==0u`;
 const solverArgs=`${b('worldSolver')},${j},${b('roster')},${s},${body},${t.geometryOffsets.catalog}u,${b('caches')},${b('coupled')}`;
 physicsPass.push(stage('ball-solver-gather',`rc_world_solver_gather(${solverArgs},rc_state[bank+10u],${cl}+256u);`,[],pass));
 if(coupledTransport!=='staged')physicsPass.push(repeat(coupledTransport==='micro'?coupledMicroCapacity.dispatches:flatCoupledChunks,[stage(coupledTransport==='micro'?'ball-solver-transport':'ball-solver-flat',`if(rc_state[${h}+24u]!=${flatBudget}u){rc_wh_fail(bank,15u);return;}if(rc_state[${b('worldSolver')}]==0u&&rc_state[${b('worldSolver')}+1u]==1u){${coupledTransport==='micro'?'rc_coupled_transport_advance':'rc_coupled_flat_advance'}(${b('coupled')},${b('coupled')}+${t.coupledLayout.coefficientBase}u,${b('coupled')}+${t.coupledLayout.rosterBase}u,${p.coupled}u,scratch,rc_state[${h}+24u]);}`,[coupledTransport==='micro'?generateCoupledTransportWGSL(options):generateCoupledFlatWGSL(options)],pass)],`(${pass})&&(rc_state[${h}+24u]!=${flatBudget}u||(${coupledPending}))`,'flat/micro coupled prior nonzero roster status returns without mutation; preserve instruction budget validation'));
 else physicsPass.push(repeat(2130,['gather','evaluate','scatter'].map(kind=>stage('ball-solver-'+kind,`if(rc_state[${b('worldSolver')}]==0u&&rc_state[${b('worldSolver')}+1u]==1u){rc_coupled_${kind}(${b('coupled')},${kind==='gather'?`${b('coupled')}+${t.coupledLayout.coefficientBase}u,`:''}${b('coupled')}+${t.coupledLayout.rosterBase}u,${kind==='gather'?`${p.coupled}u,`:''}scratch);}`,[generateCoupledStagedWGSL(kind,options)],pass)),coupledPending,'all coupled stages return the same sticky source roster status before mutation'));
 physicsPass.push(stage('ball-solver-scatter',`rc_world_solver_scatter(${solverArgs});if(rc_state[${b('worldSolver')} ]!=0u||rc_state[${b('worldSolver')}+1u]!=2u){rc_wh_fail(bank,13u);return;}rc_world_scene_after_solve(bank);if(${live}){rc_world_ccd_inactive_post_begin(${c},${body},${s},${sw});}else{rc_world_ccd_post_begin(${c},${body},${s},${sw},${count*t.state.length}u,${bv});}rc_wh_check(bank);`,[ccd],pass),inactive('post-inactive'),activePump('active-ccd-post'));
 physicsPass.push(stage('post-broad-begin',`if((${live}&&rc_state[${c}+1184u]!=15u)||(${active}&&rc_state[${c}+1184u]!=4u)){rc_wh_fail(bank,14u);return;}rc_world_broad_begin_post(${broad},${j},${s});rc_wh_check(bank);`,[],pass),broadRows('post-broad'));
 physicsPass.push(stage('pass-seal',`rc_world_broad_commit_post(${broad},${bv});rc_world_application_capture_events(bank);rc_cloth_finish(${cl});if(${active}){rc_world_broad_finish(${broad},${j});rc_world_ccd_advance(bank,${c},${broad},${j});}rc_state[${h}+2u]++;rc_wh_check(bank);`,[app,rules,worldApp,ccd],pass));
 emit(repeat(4,physicsPass));
 emit(stage('application-post-begin',`rc_world_application_begin_post_h(bank);`,[app,rules,worldApp]),applicationCycle('application-post'),stage('application-post-finish',`rc_world_application_finish_post_h(bank);if(${live}){rc_world_broad_finish(${broad},${j});}rc_world_scene_finish(bank);rc_world_application_finish_h(bank);`,[app,rules,worldApp]));
 emit(applicationCycle('application-outer'),stage('application-outer-finish',`if(rc_state[${a}+2u]==6u){rc_world_application_finish_outer(bank);}`,[app,rules,worldApp]));
 return Object.freeze({kind:'resident-source-world-h-plan',capability:WORLD_H_CAPABILITY,numericProfile,count,stateWords:t.state.length,scratchWords:t.numericScratchWords,fixedTailWords:t.fixedCcd.length,pipelines:Object.freeze(pipelines),schedule:Object.freeze(schedule),transport:Object.freeze({coupled:coupledTransport,cue:cueTransport,application:applicationTransport,ccd:ccdTransport,query:queryTransport,queryChunk,flatCoupledChunks,coupledMicroCapacity,flatCueCapacity,flatApplicationCapacity,flatCcdCapacity,instructionBudget:flatBudget}),bindingTypes:Object.freeze(['storage','read-only-storage','read-only-storage','storage','read-only-storage'])});
}

/** Host walks only an immutable source-capacity command schedule. No body,
 * contact, condition or terminal state is read to choose a continuation. */
export function* worldHCommands(plan){
 if(plan?.kind!=='resident-source-world-h-plan')throw new TypeError('Exact world h plan required');
 function* walk(steps){for(const step of steps){if(Number.isInteger(step.pipeline)){if(!plan.pipelines[step.pipeline])throw new RangeError('Unknown pipeline');yield step.pipeline;}else{if(!Number.isInteger(step.repeat)||step.repeat<1||!Array.isArray(step.steps))throw new RangeError('Invalid immutable command repetition');for(let i=0;i<step.repeat;i++)yield* walk(step.steps);}}}
 yield* walk(plan.schedule);
}
