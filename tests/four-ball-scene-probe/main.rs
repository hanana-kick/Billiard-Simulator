// SPDX-License-Identifier: Apache-2.0
// Appended to the exact existing read-only typed snapshot decoder source.
// Native first-h boundary observations are prepared-component evidence only.
// Reconstruct only the nonserialized pending cue-joint journal using the exact
// recorded creation/setter arguments. The official source APIs must reproduce
// every joint and queue member. Only serde-skipped state is transferred back;
// canonical initial serialized queue ordering is retained. No post-h fields.
fn replay_joint_journal(world: &mut SnapshotWorld, journal: &[Value]) -> std::result::Result<(), Box<dyn std::error::Error>> {
    use rapier3d::dynamics::{GenericJoint, GenericJointBuilder, PrismaticJointBuilder, JointAxesMask, JointAxis, RigidBodyHandle, ImpulseJointHandle};
    if journal.is_empty() { return Ok(()); }
    if journal.iter().map(|x| x["method"].as_str().unwrap_or("")).collect::<Vec<_>>() !=
        ["createImpulseJoint", "setContactsEnabled", "createImpulseJoint", "setLimits", "setContactsEnabled"] {
        return Err("Exact original source cue creation/mutator journal required".into());
    }
    let component = |v: &Value, key: &str| -> std::result::Result<u32, Box<dyn std::error::Error>> {
        Ok(u32::try_from(v[key].as_u64().ok_or("Exact source u32 handle required")?)?)
    };
    let vec = |v: &Value| -> std::result::Result<Vector, Box<dyn std::error::Error>> {
        Ok(Vector::new(v["fields"]["x"].as_f64().ok_or("Source vector x")? as f32,
            v["fields"]["y"].as_f64().ok_or("Source vector y")? as f32,
            v["fields"]["z"].as_f64().ok_or("Source vector z")? as f32))
    };
    let mut joints = ImpulseJointSet::new();
    for row in journal {
        match row["method"].as_str().unwrap() {
            "createImpulseJoint" => {
                let args = row["args"].as_array().ok_or("Source arguments required")?;
                let fields = &args[0]["fields"];
                let axis = vec(&fields["axis"] )?.try_normalize().ok_or("Nonzero source axis")?;
                let anchor1 = vec(&fields["anchor1"] )?; let anchor2 = vec(&fields["anchor2"] )?;
                let data: GenericJoint = match fields["jointType"].as_u64() {
                    Some(6) => GenericJointBuilder::new(JointAxesMask::from_bits(u8::try_from(fields["axesMask"].as_u64().ok_or("Source joint mask")?)?).ok_or("Joint axis mask")?)
                        .local_anchor1(anchor1).local_anchor2(anchor2).local_axis1(axis).local_axis2(axis).into(),
                    Some(2) => PrismaticJointBuilder::new(axis).local_anchor1(anchor1).local_anchor2(anchor2).into(),
                    _ => return Err("Only original generic/prismatic source builders".into()),
                };
                let a = &args[1]["handle"]; let b = &args[2]["handle"];
                let result = joints.insert(RigidBodyHandle::from_raw_parts(component(a, "index")?, component(a, "generation")?),
                    RigidBodyHandle::from_raw_parts(component(b, "index")?, component(b, "generation")?), data, args[3].as_bool().ok_or("Explicit source wake flag")?);
                let expected = &row["result"]["handle"];
                if result != ImpulseJointHandle::from_raw_parts(component(expected, "index")?, component(expected, "generation")?) { return Err("Source creation handle mismatch".into()); }
            },
            "setContactsEnabled" | "setLimits" => {
                let handle = &row["target"]["handle"];
                let joint = joints.get_mut(ImpulseJointHandle::from_raw_parts(component(handle, "index")?, component(handle, "generation")?), true).ok_or("Source mutated joint missing")?;
                if row["method"] == "setContactsEnabled" { joint.data.contacts_enabled = row["args"][0].as_bool().ok_or("Source contact setting")?; }
                else { joint.data.set_limits(JointAxis::LinX, [row["args"][0].as_f64().ok_or("Source limit min")? as f32, row["args"][1].as_f64().ok_or("Source limit max")? as f32]); }
            },
            _ => unreachable!(),
        }
    }
    let mut replayed = node(&joints)?; let mut expected = node(&world.impulse_joints)?;
    // Compare the only platform-order-dependent sets as sets, without changing
    // either native set. All remaining source fields must match exactly.
    for tree in [&mut replayed, &mut expected] {
        for field in tree["fields"].as_array_mut().ok_or("Exact source joint struct")? {
            if field[0] == "to_wake_up" || field[0] == "to_join" {
                field[1]["items"].as_array_mut().ok_or("Source ordered set serialization")?.sort_by_key(|value| value.to_string());
            }
        }
    }
    if replayed != expected { return Err("Source journal does not reproduce exact joint fields and queued members".into()); }
    world.impulse_joints.scene_probe_restore_pending_journal(&joints); Ok(())
}

fn step_world(bytes: &[u8], observe: bool, journal: &[Value]) -> std::result::Result<(Vec<u8>, Vec<rapier3d::pipeline::scene_phase_capture::Boundary>), Box<dyn std::error::Error>> {
    let mut world: SnapshotWorld = bincode::deserialize(bytes)?;
    replay_joint_journal(&mut world, journal)?;
    if bincode::serialize(&world)? != bytes { return Err("Replayed original source APIs changed serialized initial state".into()); }
    let mut pipeline = rapier3d::pipeline::PhysicsPipeline::new();
    let mut ccd = rapier3d::dynamics::CCDSolver::new();
    rapier3d::pipeline::scene_phase_capture::enable(observe);
    pipeline.step(world.gravity, &world.integration_parameters, &mut world.islands,
        &mut world.broad_phase, &mut world.narrow_phase, &mut world.bodies,
        &mut world.colliders, &mut world.impulse_joints, &mut world.multibody_joints,
        &mut world.soft_bodies, &mut ccd, &(), &());
    rapier3d::pipeline::scene_phase_capture::enable(false);
    Ok((bincode::serialize(&world)?, rapier3d::pipeline::scene_phase_capture::take()))
}
fn scene_probe_run() -> std::result::Result<(), Box<dyn std::error::Error>> {
    let mut bytes = Vec::new(); io::stdin().take(MAX_INPUT + 1).read_to_end(&mut bytes)?;
    if bytes.is_empty() || bytes.len() as u64 > MAX_INPUT { return Err("Bounded source snapshot required".into()); }
    let world: SnapshotWorld = bincode::deserialize(&bytes)?;
    if bincode::serialize(&world)? != bytes { return Err("Exact initial snapshot re-encode required".into()); }
    let journal: Vec<Value> = match std::env::args().nth(1) { Some(value) => serde_json::from_str(&value)?, None => Vec::new() };
    let (post, captures) = step_world(&bytes, true, &journal)?;
    let (independent, none) = step_world(&bytes, false, &journal)?;
    if post != independent || !none.is_empty() { return Err("Read-only instrumentation altered source evolution".into()); }
    if captures.len() != 2 { return Err("Exactly one source pre-energy and post-activation boundary required".into()); }
    println!("{}", json!({"schema": "original-four-ball-scene-source-boundary-v1", "sourceRevision": REV,
        "engineSha256": ENGINE_SHA, "originalWasmOracle": false,
        "scope": "prepared-source-phase-only-not-initial-only-full-world-or-full-shot-parity",
        "inputSha256": format!("{:x}", Sha256::digest(&bytes)),
        "instrumentedAndIndependentPostBytesEqual": true, "sourceJointJournalReplayed": !journal.is_empty(),
        "serializedInitialStatePreserved": true, "serializedInitialQueueOrderPreserved": true,
        "pendingStateSource": "official-source-create-and-mutate-joint-APIs-only", "sourceJointJournal": journal,
        "nativePostSha256": format!("{:x}", Sha256::digest(&post)),
        "boundaries": captures.iter().map(|state| node(state).unwrap()).collect::<Vec<_>>() }));
    Ok(())
}
fn main() { if let Err(error) = scene_probe_run() { eprintln!("scene phase source probe: {error}"); std::process::exit(1); } }
