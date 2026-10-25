// SPDX-License-Identifier: Apache-2.0
// Separate framed, read-only decoder. The original single-shot CLI is unchanged.
// No physics stepping, mutation, inferred workspace, or weakened roundtrip gate.
mod pinned {
    #[allow(dead_code)]
    mod original { include!("../main.rs");
        pub fn decode_snapshot(bytes: &[u8]) -> std::result::Result<Value, Box<dyn std::error::Error>> {
            if bytes.is_empty() || bytes.len() as u64 > MAX_INPUT { return Err("snapshot input size outside 1..32MiB".into()); }
            let options=bincode::DefaultOptions::new().with_fixint_encoding().with_little_endian().reject_trailing_bytes().with_limit(MAX_INPUT);
            let mut deserializer=bincode::Deserializer::from_slice(bytes,options);
            let world:SnapshotWorld=serde_path_to_error::deserialize(&mut deserializer)?;
            let encoded=bincode::serialize(&world)?;
            if encoded!=bytes {let at=encoded.iter().zip(bytes).position(|(a,b)|a!=b).unwrap_or(encoded.len().min(bytes.len()));return Err(format!("native bincode byte roundtrip mismatch at {at}, input={}, encoded={}",bytes.len(),encoded.len()).into());}
            let tree=node(&world)?;
            Ok(json!({"schemaVersion":1,"sourceRevision":REV,"engineVersion":"0.21.0","engineSha256":ENGINE_SHA,"parryVersion":"0.31.1","byteLength":bytes.len(),"inputSha256":format!("{:x}",Sha256::digest(bytes)),"verification":{"nativeBincodeByteIdentical":true},"state":tree}))
        }
        pub fn version() -> Value { json!({"sourceRevision":REV,"engineVersion":"0.21.0","engineSha256":ENGINE_SHA,"parryVersion":"0.31.1","schemaVersion":1,"batchProtocol":"u32le-length-json-v1","singleSourceSha256":format!("{:x}",Sha256::digest(include_bytes!("../main.rs"))),"batchSourceSha256":format!("{:x}",Sha256::digest(include_bytes!("rapier-snapshot-decoder-batch.rs")))}) }
    }
    pub use original::{decode_snapshot,version};
}
use std::io::{self,Read,Write};
const MAX_INPUT: usize=32*1024*1024;
const MAX_OUTPUT: usize=256*1024*1024;
const MAX_ITEMS: usize=8192;
const MAX_TOTAL: usize=1024*1024*1024;
fn run()->Result<(),Box<dyn std::error::Error>> {
    let mode=std::env::args().nth(1);if mode.as_deref()==Some("--version") {println!("{}",pinned::version());return Ok(());}if mode.as_deref()!=Some("--batch-v1") {return Err("explicit --batch-v1 protocol required".into());}
    let stdin=io::stdin();let mut input=stdin.lock();let stdout=io::stdout();let mut output=io::BufWriter::new(stdout.lock());let mut count=0usize;let mut total=0usize;
    loop {
        let mut size=[0u8;4];match input.read(&mut size[..1])? {0=>break,1=>{},_=>unreachable!()};
        input.read_exact(&mut size[1..]).map_err(|e|format!("truncated request header at item {count}: {e}"))?;
        let len=u32::from_le_bytes(size) as usize;
        if len==0||len>MAX_INPUT {return Err(format!("request size outside 1..32MiB at item {count}: {len}").into());}
        count+=1;total=total.checked_add(len).ok_or("total input overflow")?;
        if count>MAX_ITEMS||total>MAX_TOTAL {return Err("batch item or total byte limit exceeded".into());}
        let mut bytes=vec![0u8;len];input.read_exact(&mut bytes).map_err(|e|format!("truncated request payload at item {}: {e}",count-1))?;
        let value=match pinned::decode_snapshot(&bytes) {Ok(v)=>serde_json::json!({"protocolVersion":1,"index":count-1,"result":v}),Err(e)=>serde_json::json!({"protocolVersion":1,"index":count-1,"error":{"code":"native-exporter-failed","message":e.to_string()}})};
        let json=serde_json::to_vec(&value)?;if json.len()>MAX_OUTPUT {return Err("batch response exceeds256MiB".into());}
        output.write_all(&(json.len() as u32).to_le_bytes())?;output.write_all(&json)?;output.flush()?;
    }
    output.flush()?;Ok(())
}
fn main(){if let Err(e)=run(){eprintln!("native snapshot batch decoder: {e}");std::process::exit(1);}}
