//! Stage-one GPU command scheduler, not a CPU physics implementation.
//! The host owns GPU objects; this module owns the admitted schedule and run cursor.
// Two u32 arrays at 131072 handles add 512 KiB over the previous capacity.
// Command handles/cursors remain u32; the per-submission chunk remains 4096.
const CAPACITY: usize = 131072;
const CHUNK: usize = 4096;
static mut INPUT: [u32; CAPACITY] = [0; CAPACITY];
static mut STREAM: [u32; CAPACITY] = [0; CAPACITY];
static mut OUTPUT: [u32; CHUNK] = [0; CHUNK];
static mut BOUND: u32 = 0;
static mut LEN: u32 = 0;
static mut STATE: u32 = 0;
static mut GENERATION: u32 = 0;
static mut CURSOR: u32 = 0;
static mut REPEATS_LEFT: u32 = 0;
static mut BUSY: bool = false;
static mut NEXT_CURSOR: u32 = 0;
static mut NEXT_REPEATS: u32 = 0;
#[link(wasm_import_module = "bridge")]
extern "C" { fn submit(ptr: *const u32, count: u32, generation: u32) -> i32; }
#[no_mangle] pub extern "C" fn abi_version() -> u32 { 1 }
#[no_mangle] pub extern "C" fn input_ptr() -> *mut u32 { core::ptr::addr_of_mut!(INPUT).cast() }
#[no_mangle] pub extern "C" fn capacity() -> u32 { CAPACITY as u32 }
#[no_mangle] pub extern "C" fn max_chunk() -> u32 { CHUNK as u32 }
#[no_mangle] pub extern "C" fn state() -> u32 { unsafe { STATE } }
#[no_mangle] pub extern "C" fn generation() -> u32 { unsafe { GENERATION } }
#[no_mangle] pub extern "C" fn cursor() -> u32 { unsafe { CURSOR } }
#[no_mangle] pub extern "C" fn repeats_left() -> u32 { unsafe { REPEATS_LEFT } }
#[no_mangle] pub extern "C" fn stream_len() -> u32 { unsafe { LEN } }
#[no_mangle] pub extern "C" fn configure(bound: u32) -> i32 { unsafe {
    if BOUND != 0 || STATE != 0 || bound == 0 || bound > CAPACITY as u32 { return -1; }
    BOUND = bound; 0
} }
#[no_mangle] pub extern "C" fn load(len: u32) -> i32 { unsafe {
    if BUSY || STATE == 2 || STATE >= 5 { return -1; }
    LEN = 0; CURSOR = 0; REPEATS_LEFT = 0; STATE = 0;
    if BOUND == 0 || len == 0 || len > CAPACITY as u32 { return -2; }
    for i in 0..len as usize { if INPUT[i] == 0 || INPUT[i] > BOUND { return -3; } }
    for i in 0..len as usize { STREAM[i] = INPUT[i]; }
    LEN = len; STATE = 1; 0
} }
#[no_mangle] pub extern "C" fn start(repeat: u32) -> i32 { unsafe {
    if BUSY || !(STATE == 1 || STATE == 3 || STATE == 4) || LEN == 0 || repeat == 0 || GENERATION == u32::MAX { return -1; }
    GENERATION += 1; CURSOR = 0; REPEATS_LEFT = repeat; STATE = 2; 0
} }
#[no_mangle] pub extern "C" fn step(limit: u32) -> i32 { unsafe {
    if BUSY || STATE != 2 || limit == 0 || limit > CHUNK as u32 { return -1; }
    let mut cursor = CURSOR; let mut remaining = REPEATS_LEFT; let mut count = 0;
    while count < limit && remaining > 0 {
        OUTPUT[count as usize] = STREAM[cursor as usize]; count += 1; cursor += 1;
        if cursor == LEN { cursor = 0; remaining -= 1; }
    }
    BUSY = true;
    let accepted = submit(core::ptr::addr_of!(OUTPUT).cast(), count, GENERATION);
    if accepted != 0 { BUSY = false; STATE = 5; return -2; }
    NEXT_CURSOR = cursor; NEXT_REPEATS = remaining;
    count as i32
} }
#[no_mangle] pub extern "C" fn commit(success: u32) -> i32 { unsafe {
    if !BUSY { return -1; }
    BUSY = false;
    if STATE >= 5 { return -2; }
    if success != 1 { if STATE == 4 { return 0; } STATE = 5; return -3; }
    CURSOR = NEXT_CURSOR; REPEATS_LEFT = NEXT_REPEATS;
    if STATE == 2 && REPEATS_LEFT == 0 { STATE = 3; }
    0
} }
#[no_mangle] pub extern "C" fn cancel() -> i32 { unsafe {
    if STATE != 2 { return -1; } STATE = 4; 0
} }
#[no_mangle] pub extern "C" fn lose() -> i32 { unsafe {
    if STATE == 6 { return -1; } STATE = 5; 0
} }
#[no_mangle] pub extern "C" fn dispose() -> i32 { unsafe {
    STATE = 6; LEN = 0; CURSOR = 0; REPEATS_LEFT = 0;
    for i in 0..CAPACITY { INPUT[i] = 0; STREAM[i] = 0; }
    for i in 0..CHUNK { OUTPUT[i] = 0; } 0
} }
