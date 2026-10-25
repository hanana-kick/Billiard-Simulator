// SPDX-License-Identifier: Apache-2.0
// Independent native steps from real original boundaries, not native application recurrence.
fn observed_step(bytes:&[u8],observe:bool)->std::result::Result<(Vec<u8>,Vec<rapier3d::pipeline::multi_toi_bvh_capture::Record>,usize),Box<dyn std::error::Error>> {
 let mut world:SnapshotWorld=bincode::deserialize(bytes)?;
 if bincode::serialize(&world)?!=bytes {return Err("Native input roundtrip mismatch".into());}
 let mut pipeline=rapier3d::pipeline::PhysicsPipeline::new();let mut ccd=rapier3d::dynamics::CCDSolver::new();
 rapier3d::pipeline::multi_toi_bvh_capture::enable(observe);
 pipeline.step(world.gravity,&world.integration_parameters,&mut world.islands,&mut world.broad_phase,&mut world.narrow_phase,&mut world.bodies,&mut world.colliders,&mut world.impulse_joints,&mut world.multibody_joints,&mut world.soft_bodies,&mut ccd,&(),&());
 rapier3d::pipeline::multi_toi_bvh_capture::enable(false);
 Ok((bincode::serialize(&world)?,rapier3d::pipeline::multi_toi_bvh_capture::take(),pipeline.counters.ccd.num_substeps))
}
fn bvh_run()->std::result::Result<(),Box<dyn std::error::Error>> {
 use std::io::Write;
 let mut input=io::stdin().lock();let output=std::env::args().nth(1).ok_or("Explicit create-new JSONL output required")?;
 let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(output)?;
 let mut total=0;
 loop {
  let mut header=[0u8;12];match input.read_exact(&mut header) {Ok(())=>{},Err(e) if e.kind()==io::ErrorKind::UnexpectedEof=>break,Err(e)=>return Err(e.into())};
  let h=u32::from_le_bytes(header[..4].try_into().unwrap());let n=u32::from_le_bytes(header[4..8].try_into().unwrap()) as usize;let m=u32::from_le_bytes(header[8..].try_into().unwrap()) as usize;
  if n==0||n>MAX_INPUT as usize||m>MAX_INPUT as usize {return Err("Bounded per-step snapshot required".into());}
  let mut pre=vec![0u8;n];let mut expected=vec![0u8;m];input.read_exact(&mut pre)?;input.read_exact(&mut expected)?;
  let pre_world:SnapshotWorld=bincode::deserialize(&pre)?;let (post,records,passes)=observed_step(&pre,true)?;let (unobserved,none,other_passes)=observed_step(&pre,false)?;
  if post!=unobserved||!none.is_empty()||passes!=other_passes {return Err("Observation instrumentation changed physics evolution".into());}
  let world:SnapshotWorld=bincode::deserialize(&post)?;let broad=bincode::serialize(&world.broad_phase)?;let initial=bincode::serialize(&pre_world.broad_phase)?;
  let mut out=json!({"schema":"original-bvh-minimal-operation-observation-v1","h":h,"sourceRevision":REV,"engineSha256":ENGINE_SHA,"inputSha256":format!("{:x}",Sha256::digest(&pre)),"nativePostSha256":format!("{:x}",Sha256::digest(&post)),"instrumentedAndUnobservedPostBytesEqual":true,"passes":passes,"initialBroadSha256":format!("{:x}",Sha256::digest(&initial)),"nativePostBroadSha256":format!("{:x}",Sha256::digest(&broad)),"records":records.iter().map(|r|node(r).unwrap()).collect::<Vec<_>>(),"expectedNativeBroad":node(&world.broad_phase)?});
  if total==0 {out["initialBroad"]=node(&pre_world.broad_phase)?;}
  if m>0 {let expected_world:SnapshotWorld=bincode::deserialize(&expected)?;let expected_broad=bincode::serialize(&expected_world.broad_phase)?;out["originalPostSha256"]=json!(format!("{:x}",Sha256::digest(&expected)));out["nativeAndOriginalBroadBytesEqual"]=json!(broad==expected_broad);out["nativeAndOriginalWorldBytesEqual"]=json!(post==expected);out["originalPostBroadSha256"]=json!(format!("{:x}",Sha256::digest(&expected_broad)));}
  writeln!(file,"{}",out)?;file.flush()?;total+=1;
 }
 println!("{}",json!({"schema":"original-bvh-minimal-operation-observation-v1","steps":total,"sourceOnly":true,"paritySuccess":false}));Ok(())
}
fn main(){if let Err(e)=bvh_run(){eprintln!("original BVH observer: {e}");std::process::exit(1);}}
