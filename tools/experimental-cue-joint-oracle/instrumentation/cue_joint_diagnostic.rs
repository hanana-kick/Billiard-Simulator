// SPDX-License-Identifier: Apache-2.0
// Read-only diagnostic instrumentation for Dimforge Rapier, revision
// b716d375efc0201003f0cd9ef7168eee0b62c177 (Apache-2.0).
// Added 2026: exposes the unchanged scalar cue-joint builders and solver.
// No production engine equations, snapshots, or shared sources are modified.

use crate::alloc_prelude::*;
use alloc::format;
use super::joint_velocity_constraint::{JointConstraint, WritebackId};
use super::{JointConstraintHelper, JointSolverBody};
use crate::dynamics::solver::SolverVel;
use crate::dynamics::IntegrationParameters;
use crate::math::{AngularInertia, Pose, Real, Rotation, Vector};
use serde::{Deserialize, Serialize};

/// Decimal inputs are rounded once to f32. Bits bypass decimal conversion.
#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(untagged)]
pub enum Scalar {
    Number(f32),
    Bits { bits: u32 },
}
impl Scalar {
    fn get(self) -> f32 {
        match self {
            Self::Number(value) => value,
            Self::Bits { bits } => f32::from_bits(bits),
        }
    }
}

/// `bits` is authoritative, including signed zero, infinities, and NaNs.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct Float {
    pub value: Option<f32>,
    pub bits: u32,
}
impl From<f32> for Float {
    fn from(value: f32) -> Self {
        Self { value: value.is_finite().then_some(value), bits: value.to_bits() }
    }
}
type V3 = [Scalar; 3];
fn vector(value: V3) -> Vector { Vector::from_array(value.map(Scalar::get)) }
fn output_vector(value: Vector) -> [Float; 3] { value.to_array().map(Float::from) }
fn matrix(value: crate::math::Matrix) -> [[Float; 3]; 3] {
    value.to_cols_array_2d().map(|column| column.map(Float::from))
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Frame {
    pub translation: V3,
    /// Quaternion order is x, y, z, w. No renormalization is performed.
    pub rotation: [Scalar; 4],
}
impl Frame {
    fn pose(self) -> Pose {
        let [x, y, z, w] = self.rotation.map(Scalar::get);
        Pose::from_parts(vector(self.translation), Rotation::from_xyzw(x, y, z, w))
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Body {
    pub world_com: V3,
    pub im: V3,
    /// Symmetric inverse inertia: m11, m12, m13, m22, m23, m33.
    pub ii: [Scalar; 6],
    pub linear: V3,
    pub angular: V3,
}
impl Body {
    fn solver_body(self, index: u32) -> JointSolverBody<Real, 1> {
        let [m11, m12, m13, m22, m23, m33] = self.ii.map(Scalar::get);
        JointSolverBody {
            im: vector(self.im),
            ii: AngularInertia::new(m11, m12, m13, m22, m23, m33),
            world_com: vector(self.world_com),
            solver_vel: [index],
        }
    }
    fn velocity(self) -> SolverVel<Real> {
        let mut result = SolverVel::default();
        result.linear = vector(self.linear);
        result.angular = vector(self.angular);
        result
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind { Flex, Guide }
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Warmstart {
    pub impulses: Vec<Scalar>,
    pub coefficient: Scalar,
    #[serde(default)]
    pub apply: bool,
}
fn one_iteration() -> usize { 1 }
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub kind: Kind,
    pub frame1: Frame,
    pub frame2: Frame,
    pub body1: Body,
    pub body2: Body,
    pub dt: Scalar,
    pub erp_inv_dt: Scalar,
    pub cfm_coeff: Scalar,
    pub max_corrective_velocity: Scalar,
    pub limits: Option<[Scalar; 2]>,
    pub warmstart: Option<Warmstart>,
    #[serde(default = "one_iteration")]
    pub solve_iterations: usize,
    #[serde(default)]
    pub remove_bias_before_solve: bool,
}
#[derive(Debug, Serialize)]
pub struct Writeback {
    pub kind: &'static str,
    pub axis: usize,
}
impl From<WritebackId> for Writeback {
    fn from(value: WritebackId) -> Self {
        let (kind, axis) = match value {
            WritebackId::Dof(axis) => ("dof", axis),
            WritebackId::Limit(axis) => ("limit", axis),
            WritebackId::Motor(axis) => ("motor", axis),
            WritebackId::Friction(axis) => ("friction", axis),
        };
        Self { kind, axis }
    }
}
#[derive(Debug, Serialize)]
pub struct Row {
    pub solver_vel1: u32,
    pub solver_vel2: u32,
    pub joint_id: usize,
    pub lin_jac: [Float; 3],
    pub ang_jac1: [Float; 3],
    pub ang_jac2: [Float; 3],
    pub ii_ang_jac1: [Float; 3],
    pub ii_ang_jac2: [Float; 3],
    pub im1: [Float; 3],
    pub im2: [Float; 3],
    pub impulse_bounds: [Float; 2],
    pub impulse: Float,
    pub inv_lhs: Float,
    pub rhs: Float,
    pub rhs_wo_bias: Float,
    pub cfm_gain: Float,
    pub cfm_coeff: Float,
    pub writeback_id: Writeback,
}
impl From<&JointConstraint<Real, 1>> for Row {
    fn from(value: &JointConstraint<Real, 1>) -> Self {
        Self {
            solver_vel1: value.solver_vel1[0], solver_vel2: value.solver_vel2[0],
            joint_id: value.joint_id[0],
            lin_jac: output_vector(value.lin_jac),
            ang_jac1: output_vector(value.ang_jac1), ang_jac2: output_vector(value.ang_jac2),
            ii_ang_jac1: output_vector(value.ii_ang_jac1), ii_ang_jac2: output_vector(value.ii_ang_jac2),
            im1: output_vector(value.im1), im2: output_vector(value.im2),
            impulse_bounds: value.impulse_bounds.map(Float::from),
            impulse: value.impulse.into(), inv_lhs: value.inv_lhs.into(),
            rhs: value.rhs.into(), rhs_wo_bias: value.rhs_wo_bias.into(),
            cfm_gain: value.cfm_gain.into(), cfm_coeff: value.cfm_coeff.into(),
            writeback_id: value.writeback_id.into(),
        }
    }
}
fn output_rows(rows: &[JointConstraint<Real, 1>]) -> Vec<Row> { rows.iter().map(Row::from).collect() }
#[derive(Debug, Serialize)]
pub struct Helper {
    /// Matrices are arrays of columns, each column in x, y, z order.
    pub basis: [[Float; 3]; 3],
    pub basis2: [[Float; 3]; 3],
    pub cmat1_basis: [[Float; 3]; 3],
    pub cmat2_basis: [[Float; 3]; 3],
    pub ang_basis: [[Float; 3]; 3],
    pub lin_err: [Float; 3],
    pub ang_err: [Float; 4],
}
#[derive(Debug, Serialize)]
pub struct Velocity {
    pub linear: [Float; 3],
    pub angular: [Float; 3],
}
impl From<&SolverVel<Real>> for Velocity {
    fn from(value: &SolverVel<Real>) -> Self {
        Self { linear: output_vector(value.linear), angular: output_vector(value.angular) }
    }
}
#[derive(Debug, Serialize)]
pub struct Sweep {
    pub iteration: usize,
    pub impulses: Vec<Float>,
    pub body1: Velocity,
    pub body2: Velocity,
}
#[derive(Debug, Serialize)]
pub struct Output {
    pub kind: Kind,
    pub locked_axes: u8,
    pub limit_axes: u8,
    pub dt: Float,
    pub helper: Helper,
    pub rows_before_finalize: Vec<Row>,
    /// Finalized rows, with optional coefficient-scaled warmstart seeds.
    pub rows: Vec<Row>,
    pub body1_after_warmstart: Velocity,
    pub body2_after_warmstart: Velocity,
    pub solve_sweeps: Vec<Sweep>,
    pub rows_after_solve: Vec<Row>,
    pub body1: Velocity,
    pub body2: Velocity,
}

/// Isolated row inspection. The builders, orthogonalizer, warmstart, and solve
/// functions called here are the pinned source implementations, unchanged.
/// This does not advance a World or claim original-WASM equivalence.
pub fn inspect(input: Input) -> Result<Output, String> {
    if input.solve_iterations > 8 { return Err("solve_iterations must be in 0..=8".into()); }
    if !input.dt.get().is_finite() || input.dt.get() <= 0.0 { return Err("dt must be finite and positive".into()); }
    let (locked_axes, limit_axes, expected_rows): (u8, u8, usize) = match input.kind {
        Kind::Flex => (57, 0, 4), Kind::Guide => (62, 1, 6),
    };
    if let Some(warmstart) = &input.warmstart {
        if warmstart.impulses.len() != expected_rows {
            return Err(format!("warmstart needs {expected_rows} impulses in scalar row order"));
        }
    }
    let mut params = IntegrationParameters::default();
    params.dt = input.dt.get();
    // The input is already the effective (length-scaled) corrective velocity.
    params.length_unit = 1.0;
    params.normalized_max_corrective_velocity = input.max_corrective_velocity.get();
    let erp_inv_dt = input.erp_inv_dt.get();
    let cfm_coeff = input.cfm_coeff.get();
    let body1 = input.body1.solver_body(0);
    let body2 = input.body2.solver_body(1);
    let builder = JointConstraintHelper::<Real>::new(
        &input.frame1.pose(), &input.frame2.pose(),
        &body1.world_com, &body2.world_com, locked_axes,
    );
    let helper = Helper {
        basis: matrix(builder.basis), basis2: matrix(builder.basis2),
        cmat1_basis: matrix(builder.cmat1_basis), cmat2_basis: matrix(builder.cmat2_basis),
        ang_basis: matrix(builder.ang_basis), lin_err: output_vector(builder.lin_err),
        ang_err: builder.ang_err.to_array().map(Float::from),
    };
    let mut rows = Vec::with_capacity(expected_rows);
    // This is precisely the source scalar order for these two no-motor,
    // no-coupling masks: angular locks, linear locks, then linear limits.
    for axis in 0..3 {
        rows.push(builder.lock_angular(&params, [0], &body1, &body2, axis,
            WritebackId::Dof(3 + axis), erp_inv_dt, cfm_coeff));
    }
    for axis in 0..3 {
        if locked_axes & (1 << axis) != 0 {
            rows.push(builder.lock_linear(&params, [0], &body1, &body2, axis,
                WritebackId::Dof(axis), erp_inv_dt, cfm_coeff));
        }
    }
    if matches!(input.kind, Kind::Guide) {
        let limits = input.limits.map(|v| v.map(Scalar::get)).unwrap_or([-0.08, 0.13]);
        rows.push(builder.limit_linear(&params, [0], &body1, &body2, 0,
            limits, WritebackId::Limit(0), erp_inv_dt, cfm_coeff));
    }
    let rows_before_finalize = output_rows(&rows);
    JointConstraintHelper::<Real>::finalize_constraints(&mut rows);
    if let Some(warmstart) = &input.warmstart {
        for (row, seed) in rows.iter_mut().zip(&warmstart.impulses) {
            row.impulse = seed.get() * warmstart.coefficient.get();
        }
    }
    let rows_built = output_rows(&rows);
    let mut velocity1 = input.body1.velocity();
    let mut velocity2 = input.body2.velocity();
    if input.warmstart.as_ref().is_some_and(|warmstart| warmstart.apply) {
        for row in &mut rows { row.warmstart_generic(&mut velocity1, &mut velocity2); }
    }
    let body1_after_warmstart = Velocity::from(&velocity1);
    let body2_after_warmstart = Velocity::from(&velocity2);
    if input.remove_bias_before_solve {
        for row in &mut rows { row.remove_bias_from_rhs(); }
    }
    let mut solve_sweeps = Vec::with_capacity(input.solve_iterations);
    for iteration in 0..input.solve_iterations {
        for row in &mut rows { row.solve_generic(&mut velocity1, &mut velocity2); }
        solve_sweeps.push(Sweep {
            iteration, impulses: rows.iter().map(|row| Float::from(row.impulse)).collect(),
            body1: Velocity::from(&velocity1), body2: Velocity::from(&velocity2),
        });
    }
    Ok(Output {
        kind: input.kind, locked_axes, limit_axes, dt: input.dt.get().into(), helper,
        rows_before_finalize, rows: rows_built, body1_after_warmstart, body2_after_warmstart,
        solve_sweeps, rows_after_solve: output_rows(&rows),
        body1: Velocity::from(&velocity1), body2: Velocity::from(&velocity2),
    })
}
