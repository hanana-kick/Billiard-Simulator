// SPDX-License-Identifier: Apache-2.0
mod bounded;
mod shared;
pub use shared::{decode_snapshot, version, MAX_INPUT};

// No wasm-bindgen, WASI, JS imports, physics step, or arbitrary pointer reads.
// The host can write only the advertised owned input allocation. Pointer/length
// methods are observational. A fresh instance per operation isolates all traps.
#[cfg(target_arch="wasm32")]
mod wasm {
    use super::*;
    use std::{cell::RefCell, io::{self,Write}};
    const MAX_OUTPUT:usize=256*1024*1024;
    #[derive(Default)]
    struct Bridge { input:Vec<u8>, output:Vec<u8> }
    thread_local! {static BRIDGE:RefCell<Bridge>=RefCell::new(Bridge::default());}
    struct Output(Vec<u8>);
    impl Write for Output {
        fn write(&mut self,bytes:&[u8])->io::Result<usize>{
            if bytes.len()>MAX_OUTPUT-self.0.len(){return Err(io::Error::other("decoder output exceeds 256MiB"));}
            self.0.extend_from_slice(bytes);Ok(bytes.len())
        }
        fn flush(&mut self)->io::Result<()>{Ok(())}
    }
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_abi()->u32 {1}
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_max_input()->u32 {MAX_INPUT as u32}
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_max_output()->u32 {MAX_OUTPUT as u32}
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_max_depth()->u32 {super::bounded::MAX_DEPTH as u32}
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_max_nodes()->u32 {super::bounded::MAX_NODES as u32}
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_prepare(len:u32)->u32 {
        BRIDGE.with(|cell|{let mut b=cell.borrow_mut();*b=Bridge::default();
            if len==0||len as u64>MAX_INPUT {return 0;}
            b.input=vec![0;len as usize];b.input.as_ptr() as u32
        })
    }
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_decode()->u32 {
        BRIDGE.with(|cell|{let mut b=cell.borrow_mut();b.output.clear();
            let (result,status)=match decode_snapshot(&b.input) {Ok(value)=>(value,0),Err(error)=>(serde_json::json!({"error":{"code":"snapshot-decode-failed","message":error.to_string()}}),1)};
            let mut output=Output(Vec::new());
            if serde_json::to_writer(&mut output,&result).is_err(){b.input.clear();return 2;}
            b.output=output.0;b.input.clear();status
        })
    }
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_output_ptr()->u32 {BRIDGE.with(|b|b.borrow().output.as_ptr() as u32)}
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_output_len()->u32 {BRIDGE.with(|b|b.borrow().output.len() as u32)}
    #[unsafe(no_mangle)] pub extern "C" fn snapshot_decoder_release() {BRIDGE.with(|b|*b.borrow_mut()=Bridge::default());}
}
