// SPDX-License-Identifier: Apache-2.0
// CLI behavior remains the same; all frontends use the same pinned serde decoder.
use std::io::{self, Read};
use rapier_snapshot_browser_decoder::{decode_snapshot, version, MAX_INPUT};
fn run()->Result<(),Box<dyn std::error::Error>> {
 if std::env::args().nth(1).as_deref()==Some("--version"){println!("{}",version());return Ok(());}
 let mut bytes=Vec::new();io::stdin().take(MAX_INPUT+1).read_to_end(&mut bytes)?;
 println!("{}",decode_snapshot(&bytes)?);Ok(())
}
fn main(){if let Err(e)=run(){eprintln!("native snapshot decoder: {e}");std::process::exit(1);}}
