// SPDX-License-Identifier: Apache-2.0
// Test-only read-only snapshots. No replacement physics, callbacks, mutable
// references, source-state restoration, or external I/O inside the pipeline.
use crate::dynamics::{ImpulseJointSet, IntegrationParameters, IslandManager, RigidBodySet};
use crate::geometry::{ColliderSet, NarrowPhase};
use crate::math::Vector;
use serde::Serialize;
use std::vec::Vec;
use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
#[derive(Serialize)]
pub struct Boundary {
    phase: &'static str,
    gravity: Vector,
    integration_parameters: IntegrationParameters,
    islands: IslandManager,
    bodies: RigidBodySet,
    colliders: ColliderSet,
    narrow_phase: NarrowPhase,
    impulse_joints: ImpulseJointSet,
}
static ENABLED: AtomicBool = AtomicBool::new(false);
static CAPTURES: Mutex<Vec<Boundary>> = Mutex::new(Vec::new());
pub fn enable(value: bool) { ENABLED.store(value, Ordering::SeqCst); }
pub fn take() -> Vec<Boundary> { std::mem::take(&mut *CAPTURES.lock().unwrap()) }
pub fn capture(phase: &'static str, gravity: Vector, integration_parameters: &IntegrationParameters,
    islands: &IslandManager, bodies: &RigidBodySet, colliders: &ColliderSet,
    narrow_phase: &NarrowPhase, impulse_joints: &ImpulseJointSet) {
    if !ENABLED.load(Ordering::SeqCst) { return; }
    CAPTURES.lock().unwrap().push(Boundary { phase, gravity,
        integration_parameters: *integration_parameters, islands: islands.clone(), bodies: bodies.clone(),
        colliders: colliders.clone(), narrow_phase: narrow_phase.clone(), impulse_joints: impulse_joints.clone() });
}
