// SPDX-License-Identifier: Apache-2.0
// Read-only, opt-in diagnostics in an isolated source copy. Every captured engine
// value is cloned; no callbacks, restored physics state, or replacement math.
use crate::dynamics::{IntegrationParameters, IslandManager, RigidBody, RigidBodyHandle, RigidBodySet};
use crate::geometry::{BroadPhaseBvh, ColliderHandle, ColliderSet, NarrowPhase, CollisionEvent};
use crate::math::{Real, Vector};
use crate::parry::query::sweep_toi::{Sweep, ToiProxy, SweepToiOutput};
use serde::Serialize;
use std::vec::Vec;
use std::{format, string::String};
use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
#[derive(Serialize)]
pub enum Record {
    Stage {phase: &'static str, parameters: IntegrationParameters, remaining_time: Real,
        remaining_substeps: usize, bodies: RigidBodySet, islands: IslandManager,
        colliders: ColliderSet, broad_phase: BroadPhaseBvh, narrow_phase: NarrowPhase},
    Split {remaining_time: Real, remaining_substeps: usize, first_impact: Option<Real>, active: bool},
    Candidate {body: RigidBodyHandle, moving: ColliderHandle, target: ColliderHandle,
        incoming_max_fraction: Real, reason: &'static str},
    Query {status: String, fraction: Real, point: Vector, normal: Vector, max_fraction: Real,
        linear_slop: Real, pseudo: bool, moving_sweep: Sweep, moving_points: Vec<Vector>,
        moving_radius: Real, target_sweep: Option<Sweep>, target_points: Vec<Vector>, target_radius: Option<Real>},
    Body {phase: &'static str, handle: RigidBodyHandle, fraction: Real, body: RigidBody},
    Event {event: CollisionEvent},
}
static ENABLED: AtomicBool = AtomicBool::new(false);
static CAPTURES: Mutex<Vec<Record>> = Mutex::new(Vec::new());
pub fn enable(value: bool) { ENABLED.store(value, Ordering::SeqCst); }
pub fn take() -> Vec<Record> { std::mem::take(&mut *CAPTURES.lock().unwrap()) }
fn push(value: Record) { CAPTURES.lock().unwrap().push(value); }
pub fn stage(phase: &'static str, parameters: &IntegrationParameters, remaining_time: Real,
    remaining_substeps: usize, bodies: &RigidBodySet, islands: &IslandManager,
    colliders: &ColliderSet, broad_phase: &BroadPhaseBvh, narrow_phase: &NarrowPhase) {
    if !ENABLED.load(Ordering::SeqCst) { return; }
    push(Record::Stage {phase, parameters: *parameters, remaining_time, remaining_substeps,
        bodies:bodies.clone(), islands:islands.clone(), colliders:colliders.clone(),
        broad_phase:broad_phase.clone(), narrow_phase:narrow_phase.clone()});
}
pub fn split(remaining_time: Real, remaining_substeps: usize, first_impact: Option<Real>, active: bool) {
    if ENABLED.load(Ordering::SeqCst) {push(Record::Split {remaining_time, remaining_substeps, first_impact, active});}
}
pub fn candidate(body: RigidBodyHandle, moving: ColliderHandle, target: ColliderHandle,
    incoming_max_fraction: Real, reason: &'static str) {
    if ENABLED.load(Ordering::SeqCst) {push(Record::Candidate {body,moving,target,incoming_max_fraction,reason});}
}
pub fn query(output: &SweepToiOutput, max_fraction: Real, linear_slop: Real, pseudo: bool,
    moving_sweep: &Sweep, moving_proxy: &ToiProxy, target_sweep: Option<&Sweep>, target_proxy: Option<&ToiProxy>) {
    if !ENABLED.load(Ordering::SeqCst) { return; }
    push(Record::Query {status:format!("{:?}",output.status),fraction:output.fraction,point:output.point,normal:output.normal,
        max_fraction,linear_slop,pseudo,moving_sweep:*moving_sweep,moving_points:moving_proxy.points().to_vec(),
        moving_radius:moving_proxy.radius,target_sweep:target_sweep.copied(),
        target_points:target_proxy.map(|p|p.points().to_vec()).unwrap_or_default(),target_radius:target_proxy.map(|p|p.radius)});
}
pub fn body(phase: &'static str, handle: RigidBodyHandle, fraction: Real, body: &RigidBody) {
    if ENABLED.load(Ordering::SeqCst) {push(Record::Body {phase,handle,fraction,body:body.clone()});}
}
pub fn event(event: CollisionEvent) {
    if ENABLED.load(Ordering::SeqCst) {push(Record::Event {event});}
}
