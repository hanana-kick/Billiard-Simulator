// SPDX-License-Identifier: Apache-2.0
// Appended to exact existing typed decoder, retaining all ten native fields.
struct ObserveEvents;
impl rapier3d::pipeline::EventHandler for ObserveEvents {
 fn handle_collision_event(&self, _: &RigidBodySet, _: &ColliderSet, event: rapier3d::geometry::CollisionEvent, _:Option<&rapier3d::geometry::ContactPair>) {
   rapier3d::pipeline::active_ccd_capture::event(event);
 }
 fn handle_soft_body_tear_event(&self, _: &SoftBodySet, _: &rapier3d::dynamics::SoftBodyTearEvent) {}
 fn handle_contact_force_event(&self, _:f32, _: &RigidBodySet, _: &ColliderSet, _: &rapier3d::geometry::ContactPair, _:f32) {}
}
fn step_active(bytes:&[u8],observe:bool)->std::result::Result<(Vec<u8>,Vec<rapier3d::pipeline::active_ccd_capture::Record>,usize),Box<dyn std::error::Error>> {
 let mut world:SnapshotWorld=bincode::deserialize(bytes)?;
 if bincode::serialize(&world)?!=bytes {return Err("Native input roundtrip mismatch".into());}
 if world.impulse_joints.len()!=0||world.multibody_joints.iter().next().is_some() {return Err("Post-withdrawal no-joint source capture only".into());}
 let mut pipeline=rapier3d::pipeline::PhysicsPipeline::new(); let mut ccd=rapier3d::dynamics::CCDSolver::new();
 rapier3d::pipeline::active_ccd_capture::enable(observe);
 pipeline.step(world.gravity,&world.integration_parameters,&mut world.islands,&mut world.broad_phase,
  &mut world.narrow_phase,&mut world.bodies,&mut world.colliders,&mut world.impulse_joints,
  &mut world.multibody_joints,&mut world.soft_bodies,&mut ccd,&(),&ObserveEvents);
 rapier3d::pipeline::active_ccd_capture::enable(false);
 Ok((bincode::serialize(&world)?,rapier3d::pipeline::active_ccd_capture::take(),pipeline.counters.ccd.num_substeps))
}
fn active_run()->std::result::Result<(),Box<dyn std::error::Error>> {
 let mut bytes=Vec::new();io::stdin().take(MAX_INPUT+1).read_to_end(&mut bytes)?;
 if bytes.is_empty()||bytes.len()as u64>MAX_INPUT{return Err("Bounded original snapshot required".into());}
 let (post,records,passes)=step_active(&bytes,true)?;let (independent,none,other_passes)=step_active(&bytes,false)?;
 if post!=independent||!none.is_empty()||passes!=other_passes{return Err("Observation instrumentation altered evolution".into());}
 let output=std::env::args().nth(1).ok_or("Explicit output snapshot path required")?;
 let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(output)?;
 std::io::Write::write_all(&mut file,&post)?;
 println!("{}",json!({"schema":"original-active-ccd-source-pipeline-v1","sourceRevision":REV,
  "engineSha256":ENGINE_SHA,"originalWasmOracle":false,"sourcePreparedReplay":true,
  "inputSha256":format!("{:x}",Sha256::digest(&bytes)),"nativePostSha256":format!("{:x}",Sha256::digest(&post)),
  "instrumentedAndUnobservedPostBytesEqual":true,"passes":passes,"records":records.iter().map(|r|node(r).unwrap()).collect::<Vec<_>>()}));Ok(())
}
fn main(){if let Err(error)=active_run(){eprintln!("active CCD source pipeline: {error}");std::process::exit(1);}}
