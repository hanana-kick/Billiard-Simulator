// SPDX-License-Identifier: Apache-2.0
// Appended to the unchanged typed decoder. A distinct, explicit LIVE-joint host.
// Reuses the already-verified observation hooks without editing engine sources.
use rapier3d::dynamics::RigidBodyHandle;
use rapier3d::pipeline::active_ccd_capture::{self, Record};
const LIVE_INPUTS: [(&str, usize); 3] = [
    ("625e12b86a3db6067113689f3c36a67496ef155d9cd9df88726a178f52acd609", 1),
    ("52dd8bf643b8dc6c48b1b8d920942869089cf5eb63f77ef93aa6ce5ba400c168", 54),
    ("0ec1bee82cb3ecd25ead0fa3d67d85335caeebb89d77b805f9f3d8047f80863a", 152),
];
fn live_guard(world: &SnapshotWorld) -> std::result::Result<(), Box<dyn std::error::Error>> {
    if world.bodies.len()!=22 || world.colliders.len()!=25 || world.impulse_joints.len()!=2 || world.multibody_joints.iter().next().is_some() {
        return Err("Exactly original 22 bodies, 25 colliders and two impulse joints required".into());
    }
    let p=&world.integration_parameters;
    if p.dt.to_bits()!=(1.0_f32/61440.0).to_bits() || p.max_ccd_substeps!=4 || p.num_solver_iterations!=12 || p.num_internal_pgs_iterations!=4 {
        return Err("Original microstep and solver/CCD configuration required".into());
    }
    let shaft=RigidBodyHandle::from_raw_parts(19,0);
    let head=RigidBodyHandle::from_raw_parts(20,0);
    let guide=RigidBodyHandle::from_raw_parts(21,0);
    for (id,count) in [(shaft,1),(head,2)] {
        let b=world.bodies.get(id).ok_or("Original cue body missing")?;
        if !b.is_dynamic() || !b.is_ccd_enabled() || b.colliders().len()!=count || b.gravity_scale()!=0.0 {
            return Err("Original dynamic enabled-CCD zero-gravity cue parts required".into());
        }
    }
    if !world.bodies.get(guide).ok_or("Original guide missing")?.is_fixed() {return Err("Original fixed guide required".into());}
    let mut flex=false;let mut prism=false;
    for (_,j) in world.impulse_joints.iter() {
        if j.data.contacts_enabled || j.data.motor_axes.bits()!=0 || j.data.coupled_axes.bits()!=0 {return Err("Original nonmotor joint descriptors required".into());}
        if j.body1()==shaft && j.body2()==head && j.data.locked_axes.bits()==57 && j.data.limit_axes.bits()==0 {flex=true;}
        else if j.body1()==guide && j.body2()==shaft && j.data.locked_axes.bits()==62 && j.data.limit_axes.bits()==1 && j.data.limits[0].min.to_bits()==(-0.08_f32).to_bits() && j.data.limits[0].max.to_bits()==0.13_f32.to_bits() {prism=true;}
        else {return Err("Original flex and prismatic guide connectivity/masks required".into());}
    }
    if !flex || !prism {return Err("Both original cue joints required".into());}
    Ok(())
}
struct LiveObserveEvents;
impl rapier3d::pipeline::EventHandler for LiveObserveEvents {
    fn handle_collision_event(&self,_:&RigidBodySet,_:&ColliderSet,event:rapier3d::geometry::CollisionEvent,_:Option<&rapier3d::geometry::ContactPair>){active_ccd_capture::event(event);}
    fn handle_soft_body_tear_event(&self,_:&SoftBodySet,_:&rapier3d::dynamics::SoftBodyTearEvent){}
    fn handle_contact_force_event(&self,_:f32,_:&RigidBodySet,_:&ColliderSet,_:&rapier3d::geometry::ContactPair,_:f32){}
}
fn live_step(bytes:&[u8],observe:bool)->std::result::Result<(Vec<u8>,Vec<Record>,usize),Box<dyn std::error::Error>>{
    let mut world:SnapshotWorld=bincode::deserialize(bytes)?;
    if bincode::serialize(&world)?!=bytes {return Err("Exact native input serde roundtrip required".into());}
    live_guard(&world)?;
    let mut pipeline=rapier3d::pipeline::PhysicsPipeline::new();let mut ccd=rapier3d::dynamics::CCDSolver::new();
    active_ccd_capture::enable(observe);
    pipeline.step(world.gravity,&world.integration_parameters,&mut world.islands,&mut world.broad_phase,&mut world.narrow_phase,
        &mut world.bodies,&mut world.colliders,&mut world.impulse_joints,&mut world.multibody_joints,&mut world.soft_bodies,&mut ccd,&(),&LiveObserveEvents);
    active_ccd_capture::enable(false);
    let post=bincode::serialize(&world)?;
    let roundtrip:SnapshotWorld=bincode::deserialize(&post)?;
    if bincode::serialize(&roundtrip)?!=post {return Err("Exact native output serde roundtrip required".into());}
    Ok((post,active_ccd_capture::take(),pipeline.counters.ccd.num_substeps))
}
fn live_run()->std::result::Result<(),Box<dyn std::error::Error>>{
    let mut bytes=Vec::new();io::stdin().take(MAX_INPUT+1).read_to_end(&mut bytes)?;
    if bytes.is_empty() || bytes.len() as u64>MAX_INPUT {return Err("Bounded exact original snapshot required".into());}
    let digest=format!("{:x}",Sha256::digest(&bytes));
    let original_h=LIVE_INPUTS.iter().find(|(sha,_)|*sha==digest).ok_or("Only retained original h1/h54/h152 snapshots are admitted")?.1;
    let(post,records,passes)=live_step(&bytes,true)?;
    let(unobserved,none,unobserved_passes)=live_step(&bytes,false)?;
    if post!=unobserved || !none.is_empty() || passes!=unobserved_passes {return Err("Observation changed native evolution".into());}
    let output=std::env::args().nth(1).ok_or("Explicit new native output path required")?;
    let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(output)?;
    std::io::Write::write_all(&mut file,&post)?;
    let mut compact=Vec::new();
    for record in records {
        match record {
            Record::Stage{phase,parameters,remaining_time,remaining_substeps,bodies,..}=>{
                let mut dynamic=Vec::new();
                for(handle,body)in bodies.iter(){if body.is_dynamic(){dynamic.push(json!({"handle":node(&handle)?,"body":node(body)?}));}}
                if dynamic.len()!=5 {return Err("Original three balls and two live cue bodies required at every stage".into());}
                compact.push(json!({"kind":"Stage","phase":phase,"parameters":node(&parameters)?,"remainingTime":node(&remaining_time)?,"remainingSubsteps":remaining_substeps,"dynamicBodies":dynamic}));
            }
            other=>compact.push(json!({"kind":"TypedRecord","record":node(&other)?})),
        }
    }
    println!("{}",json!({"schema":"original-live-cue-three-boundary-source-v1","sourceRevision":REV,"engineSha256":ENGINE_SHA,
        "originalWasmOracle":false,"sourcePreparedReplay":true,"originalH":original_h,"inputSha256":digest,
        "nativePostSha256":format!("{:x}",Sha256::digest(&post)),"inputAndOutputSerdeRoundtrip":true,
        "instrumentedAndUnobservedPostBytesEqual":true,"passes":passes,"records":compact}));
    Ok(())
}
fn main(){if let Err(error)=live_run(){eprintln!("LIVE cue source observation: {error}");std::process::exit(1);}}
