// SPDX-License-Identifier: Apache-2.0
// Read-only source-operation observation. Never feeds values back into physics.
use crate::geometry::{Aabb, ColliderHandle, ColliderSet};
use crate::dynamics::RigidBodyHandle;
use crate::math::Real;
use crate::parry::bounding_volume::BoundingVolume;
use crate::parry::partitioning::Bvh;
use serde::Serialize;
use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
use std::vec::Vec;
#[derive(Serialize)]
pub struct Box3 { min: [Real;3], max: [Real;3] }
fn box3(a: &Aabb) -> Box3 { Box3 { min:a.mins.to_array(), max:a.maxs.to_array() } }
#[derive(Serialize)]
pub struct UpdateLeaf { leaf:u32, bounds:Box3, skin:Real }
#[derive(Serialize)]
pub enum Operation {
 Update { updates:Vec<UpdateLeaf>, removed_leaves:Vec<u32>, forced_reinsert_leaves:Vec<u32>, live_leaves:Vec<u32> },
 Join {},
 SetAabb { leaf:u32, bounds:Box3, skin:Real },
 Query { body:RigidBodyHandle, moving:ColliderHandle, swept_aabb:Box3, expected_leaves:Vec<u32> },
}
#[derive(Serialize)]
pub struct Record { phase:&'static str, operation:Operation }
static ENABLED: AtomicBool = AtomicBool::new(false);
static RECORDS: Mutex<Vec<Record>> = Mutex::new(Vec::new());
static PHASE: Mutex<&'static str> = Mutex::new("step-start");
pub fn enable(value:bool) { ENABLED.store(value,Ordering::SeqCst); if value { *PHASE.lock().unwrap()="step-start"; } }
pub fn take()->Vec<Record> { std::mem::take(&mut *RECORDS.lock().unwrap()) }
fn enabled()->bool { ENABLED.load(Ordering::SeqCst) }
fn push(operation:Operation) { RECORDS.lock().unwrap().push(Record {phase:*PHASE.lock().unwrap(),operation}); }
pub fn phase(phase:&'static str) { if enabled() { *PHASE.lock().unwrap()=phase; } }
pub fn update(updates:&[(ColliderHandle,Aabb,Real)],removed:&[ColliderHandle],forced:&[u32],colliders:&ColliderSet) {
 if !enabled() { return; }
 push(Operation::Update { updates:updates.iter().map(|(h,a,s)|UpdateLeaf {leaf:h.into_raw_parts().0,bounds:box3(a),skin:*s}).collect(), removed_leaves:removed.iter().map(|h|h.into_raw_parts().0).collect(), forced_reinsert_leaves:forced.to_vec(), live_leaves:colliders.iter().map(|(h,_)|h.into_raw_parts().0).collect() });
}
pub fn join() { if enabled() { push(Operation::Join {}); } }
pub fn set_aabb(handle:ColliderHandle,aabb:&Aabb,skin:Real) { if enabled() {push(Operation::SetAabb {leaf:handle.into_raw_parts().0,bounds:box3(aabb),skin});} }
pub fn query(bvh:&Bvh,colliders:&ColliderSet,aabb:&Aabb,body:RigidBodyHandle,moving:ColliderHandle) {
 if !enabled() {return;}
 let leaves=bvh.leaves(|node|node.aabb().intersects(aabb)).filter_map(|leaf|colliders.get_unknown_gen(leaf).map(|(_,h)|h.into_raw_parts().0)).collect();
 push(Operation::Query {body,moving,swept_aabb:box3(aabb),expected_leaves:leaves});
}
