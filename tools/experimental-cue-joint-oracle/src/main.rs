// SPDX-License-Identifier: Apache-2.0
// Diagnostic host, not an original-WASM or whole-world replay oracle.
use rapier3d::dynamics::cue_joint_diagnostic::{Input, inspect};
use serde_json::json;
use std::io::{self, Read};
const REVISION: &str = "b716d375efc0201003f0cd9ef7168eee0b62c177";
const MAX_INPUT: u64 = 4 * 1024 * 1024;
fn metadata() -> serde_json::Value {
    json!({"schemaVersion":1,"oracleKind":"instrumented-pinned-rust-scalar-joint",
        "sourceRevision":REVISION,"rapierVersion":"0.36.0","parryVersion":"0.31.1",
        "engineVersion":"0.21.0","originalWasmOracle":false,
        "observationOnlyPatchSha256":option_env!("CUE_JOINT_PATCH_SHA256").unwrap_or("UNVERIFIED")})
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    if std::env::args().nth(1).as_deref() == Some("--version") {
        println!("{}", metadata()); return Ok(());
    }
    let mut bytes = Vec::new();
    io::stdin().take(MAX_INPUT + 1).read_to_end(&mut bytes)?;
    if bytes.is_empty() || bytes.len() as u64 > MAX_INPUT {
        return Err("JSON input size must be in 1..4MiB".into());
    }
    let input: Input = serde_json::from_slice(&bytes)?;
    let result = inspect(input).map_err(io::Error::other)?;
    println!("{}", json!({"metadata":metadata(),"result":result}));
    Ok(())
}
fn main() {
    if let Err(error) = run() {
        eprintln!("cue joint diagnostic oracle: {error}");
        std::process::exit(1);
    }
}
