// SPDX-License-Identifier: Apache-2.0
// Preserve the frozen legacy CLI file byte-for-byte and reuse its actual world
// declaration and typed Serializer through inclusion, not a copied schema.
#[allow(dead_code)]
mod pinned {
    include!("../../rapier-snapshot-exporter/src/main.rs");
pub fn version()->Value {json!({"sourceRevision":REV,"engineVersion":"0.21.0","engineSha256":ENGINE_SHA,"parryVersion":"0.31.1","schemaVersion":1})}
pub fn decode_snapshot(bytes:&[u8])->std::result::Result<Value,Box<dyn std::error::Error>> {
 if bytes.is_empty()||bytes.len() as u64>MAX_INPUT{return Err("snapshot input size outside 1..32MiB".into());}
 let options=bincode::DefaultOptions::new().with_fixint_encoding().with_little_endian().reject_trailing_bytes().with_limit(MAX_INPUT);
 let mut deserializer=bincode::Deserializer::from_slice(bytes,options);
 let world:SnapshotWorld=serde_path_to_error::deserialize(crate::bounded::Limited::new(&mut deserializer))?;
 let encoded=bincode::serialize(&world)?;
 if encoded!=bytes {let at=encoded.iter().zip(bytes).position(|(a,b)|a!=b).unwrap_or(encoded.len().min(bytes.len()));return Err(format!("native bincode byte roundtrip mismatch at {at}, input={}, encoded={}",bytes.len(),encoded.len()).into());}
 let tree=node(&world)?;
 Ok(json!({"schemaVersion":1,"sourceRevision":REV,"engineVersion":"0.21.0","engineSha256":ENGINE_SHA,"parryVersion":"0.31.1","byteLength":bytes.len(),"inputSha256":format!("{:x}",Sha256::digest(bytes)),"verification":{"nativeBincodeByteIdentical":true},"state":tree}))
}
    pub const INPUT_LIMIT:u64=MAX_INPUT;
}
pub use pinned::{decode_snapshot,version,INPUT_LIMIT as MAX_INPUT};
