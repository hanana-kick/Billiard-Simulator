// SPDX-License-Identifier: Apache-2.0
// Read-only diagnostic of an unchanged original PhysicsLab snapshot. This calls
// pinned source CCD methods; it never invents velocities or disables CCD.
use rapier3d::{dynamics::{CCDSolver, ImpulseJointSet, IntegrationParameters, IslandManager,
    MultibodyJointSet, RigidBodySet, SoftBodySet}, geometry::{ColliderSet,
    DefaultBroadPhase, NarrowPhase}, math::Vector};
use serde::{Serialize, Deserialize};
use serde_json::json;
use std::io::{self, Read};
use sha2::{Digest, Sha256};
#[derive(Serialize, Deserialize)]
struct SnapshotWorld {
    gravity: Vector, integration_parameters: IntegrationParameters, islands: IslandManager,
    broad_phase: DefaultBroadPhase, narrow_phase: NarrowPhase, bodies: RigidBodySet,
    colliders: ColliderSet, impulse_joints: ImpulseJointSet, multibody_joints: MultibodyJointSet,
    soft_bodies: SoftBodySet,
}
#[derive(Deserialize)]
struct ProxyInput { points:Vec<Vector>,radius:f32 }
#[derive(Deserialize)]
struct QueryInput { proxy_a:ProxyInput,proxy_b:ProxyInput,sweep_a:parry3d::query::sweep_toi::Sweep,sweep_b:parry3d::query::sweep_toi::Sweep,max_fraction:f32,linear_slop:f32,fractions:Vec<f32> }
#[derive(Deserialize)]
struct CacheInput {metric:f32,count:u8,index_a:[u32;3],index_b:[u32;3]}
#[derive(Deserialize)]
struct DistanceInput {proxy_a:ProxyInput,proxy_b:ProxyInput,pos12:rapier3d::math::Pose,use_radii:bool,cache:CacheInput}
fn run()->Result<(),Box<dyn std::error::Error>> {
    let mut bytes=Vec::new(); io::stdin().take(32*1024*1024+1).read_to_end(&mut bytes)?;
    if bytes.is_empty()||bytes.len()>32*1024*1024 { return Err("Bounded original snapshot required".into()); }
    if std::env::args().nth(1).as_deref()==Some("--proxy-distance") {
        use parry3d::query::sweep_toi::{ToiProxy,SimplexCache,proxy_distance};
        let items:Vec<DistanceInput>=serde_json::from_slice(&bytes)?;
        let out=items.iter().map(|s| {
            let a=ToiProxy::from_points(&s.proxy_a.points,s.proxy_a.radius);let b=ToiProxy::from_points(&s.proxy_b.points,s.proxy_b.radius);
            let mut cache=SimplexCache{metric:s.cache.metric,count:s.cache.count,index_a:s.cache.index_a,index_b:s.cache.index_b};
            let q=proxy_distance(&s.pos12,&a,&b,s.use_radii,&mut cache);
            json!({"distance":q.distance,"point_a":q.point_a,"point_b":q.point_b,"normal":q.normal,"iterations":q.iterations,
                "cache":{"metric":cache.metric,"count":cache.count,"index_a":cache.index_a,"index_b":cache.index_b}})
        }).collect::<Vec<_>>();
        println!("{}",json!({"schema":"pinned-parry-active-ccd-proxy-distance-v1","sourceRevision":"b716d375efc0201003f0cd9ef7168eee0b62c177","items":out}));return Ok(());
    }
    if std::env::args().nth(1).as_deref()==Some("--sweep-query") {
        use parry3d::query::sweep_toi::{ToiProxy,sweep_time_of_impact};
        let items:Vec<QueryInput>=serde_json::from_slice(&bytes)?;
        let out=items.iter().map(|s| {
            let a=ToiProxy::from_points(&s.proxy_a.points,s.proxy_a.radius);let b=ToiProxy::from_points(&s.proxy_b.points,s.proxy_b.radius);
            let q=sweep_time_of_impact(&a,&s.sweep_a,&b,&s.sweep_b,s.max_fraction,s.linear_slop);
            json!({"status":format!("{:?}",q.status),"fraction":q.fraction,"point":q.point,"normal":q.normal,
                "transforms":s.fractions.iter().map(|f|json!({"fraction":f,"a":s.sweep_a.transform_at(*f),"b":s.sweep_b.transform_at(*f)})).collect::<Vec<_>>()})
        }).collect::<Vec<_>>();
        println!("{}",json!({"schema":"pinned-parry-active-ccd-direct-query-v1","sourceRevision":"b716d375efc0201003f0cd9ef7168eee0b62c177","items":out}));return Ok(());
    }
    let mut world:SnapshotWorld=bincode::deserialize(&bytes)?;
    if bincode::serialize(&world)?!=bytes { return Err("Source snapshot roundtrip mismatch".into()); }
    let mut ccd=CCDSolver::new(); let dt=world.integration_parameters.dt;
    if std::env::args().nth(1).as_deref()==Some("--step") {
        if world.impulse_joints.len()!=0||world.multibody_joints.iter().next().is_some() {return Err("Post-cue no-joint replay only".into());}
        let mut pipeline=rapier3d::pipeline::PhysicsPipeline::new();
        pipeline.step(world.gravity,&world.integration_parameters,&mut world.islands,&mut world.broad_phase,
            &mut world.narrow_phase,&mut world.bodies,&mut world.colliders,&mut world.impulse_joints,
            &mut world.multibody_joints,&mut world.soft_bodies,&mut ccd,&(),&());
        let post=bincode::serialize(&world)?;
        let path=std::env::args().nth(2).ok_or("Explicit new output required")?;
        let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(path)?;
        std::io::Write::write_all(&mut file,&post)?;
        println!("{}",json!({"schema":"unmodified-pinned-source-native-step-v1","inputSha256":format!("{:x}",Sha256::digest(&bytes)),"postSha256":format!("{:x}",Sha256::digest(&post)),"passes":pipeline.counters.ccd.num_substeps}));return Ok(());
    }
    let active=ccd.update_ccd_active_flags(&world.islands,&mut world.bodies,dt,true);
    let impact=if active { ccd.find_first_impact(dt,&world.integration_parameters,&world.islands,
        &world.bodies,&world.colliders,&mut world.broad_phase,&world.narrow_phase,&()) } else {None};
    let bodies=world.bodies.iter().filter(|(_,b)|b.is_dynamic()).map(|(h,b)|json!({"handle":h.into_raw_parts(),"body":b})).collect::<Vec<_>>();
    println!("{}",json!({"schema":"original-active-ccd-source-find-first-impact-v1",
        "sourceRevision":"b716d375efc0201003f0cd9ef7168eee0b62c177",
        "inputSha256":format!("{:x}",Sha256::digest(&bytes)), "dt":dt,
        "maxCcdSubsteps":world.integration_parameters.max_ccd_substeps,
        "preActive":active,"firstImpact":impact,"bodies":bodies,
        "scope":"read-only-source-pre-split-method-diagnostic-not-full-pipeline-replay"})); Ok(())
}
fn main(){if let Err(e)=run(){eprintln!("active CCD probe: {e}");std::process::exit(1);}}
