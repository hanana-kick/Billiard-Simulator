// SPDX-License-Identifier: Apache-2.0
// World field order derived from Dimforge Rapier b716d375efc0201003f0cd9ef7168eee0b62c177,
// bindings/typescript/src/pipeline/serialization_pipeline.rs (Apache-2.0).
// Modified 2026: read-only, bit-faithful serde tree exporter. No physics stepping.
use bincode::Options;
use rapier3d::{dynamics::{ImpulseJointSet, IntegrationParameters, IslandManager,
    MultibodyJointSet, RigidBodySet, SoftBodySet}, geometry::{ColliderSet,
    DefaultBroadPhase, NarrowPhase}, math::Vector};
use serde::{Serialize, Deserialize, ser};
use serde_json::{Value, json};
use std::{fmt, io::{self, Read}};
use sha2::{Digest, Sha256};
const REV: &str = "b716d375efc0201003f0cd9ef7168eee0b62c177";
const ENGINE_SHA: &str = "fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4";
const MAX_INPUT: u64 = 32 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
struct SnapshotWorld {
    gravity: Vector,
    integration_parameters: IntegrationParameters,
    islands: IslandManager,
    broad_phase: DefaultBroadPhase,
    narrow_phase: NarrowPhase,
    bodies: RigidBodySet,
    colliders: ColliderSet,
    impulse_joints: ImpulseJointSet,
    multibody_joints: MultibodyJointSet,
    soft_bodies: SoftBodySet,
}
#[derive(Debug)] struct Error(String);
impl fmt::Display for Error { fn fmt(&self,f:&mut fmt::Formatter<'_>)->fmt::Result { f.write_str(&self.0) } }
impl std::error::Error for Error {}
impl ser::Error for Error { fn custom<T:fmt::Display>(msg:T)->Self { Error(msg.to_string()) } }
type Result<T> = std::result::Result<T,Error>;
struct Typed;
fn node<T: ?Sized + Serialize>(v:&T)->Result<Value> { v.serialize(Typed) }
fn integer<T:fmt::Display>(width:&str,value:T)->Value { json!({"kind":"integer","width":width,"value":value.to_string()}) }
struct Compound { value: Value, pending_key: Option<Value> }
impl Compound {
 fn new(kind:&str)->Self { Self {value:json!({"kind":kind}),pending_key:None} }
 fn named(mut self,name:&str)->Self {self.value["name"]=json!(name);self}
 fn variant(mut self,index:u32,variant:&str)->Self {self.value["index"]=json!(index);self.value["variant"]=json!(variant);self}
 fn list(mut self,key:&str)->Self {self.value[key]=json!([]);self}
 fn push<T:?Sized+Serialize>(&mut self,v:&T)->Result<()> {self.value["items"].as_array_mut().unwrap().push(node(v)?);Ok(())}
 fn field<T:?Sized+Serialize>(&mut self,k:&str,v:&T)->Result<()> {self.value["fields"].as_array_mut().unwrap().push(json!([k,node(v)?]));Ok(())}
 fn end(self)->Result<Value> {if self.pending_key.is_some(){Err(Error("Unpaired map key".into()))}else{Ok(self.value)}}
}
macro_rules! integer_method {($name:ident,$ty:ty,$width:literal)=>{fn $name(self,v:$ty)->Result<Value>{Ok(integer($width,v))}};}
impl ser::Serializer for Typed {
 type Ok=Value;type Error=Error;
 type SerializeSeq=Compound;type SerializeTuple=Compound;type SerializeTupleStruct=Compound;
 type SerializeTupleVariant=Compound;type SerializeMap=Compound;type SerializeStruct=Compound;type SerializeStructVariant=Compound;
 fn is_human_readable(&self)->bool {false}
 fn serialize_bool(self,v:bool)->Result<Value>{Ok(json!({"kind":"bool","value":v}))}
 integer_method!(serialize_i8,i8,"i8");integer_method!(serialize_i16,i16,"i16");integer_method!(serialize_i32,i32,"i32");integer_method!(serialize_i64,i64,"i64");integer_method!(serialize_i128,i128,"i128");
 integer_method!(serialize_u8,u8,"u8");integer_method!(serialize_u16,u16,"u16");integer_method!(serialize_u32,u32,"u32");integer_method!(serialize_u64,u64,"u64");integer_method!(serialize_u128,u128,"u128");
 fn serialize_f32(self,v:f32)->Result<Value>{Ok(json!({"kind":"float","width":"f32","bits":format!("{:08x}",v.to_bits())}))}
 fn serialize_f64(self,v:f64)->Result<Value>{Ok(json!({"kind":"float","width":"f64","bits":format!("{:016x}",v.to_bits())}))}
 fn serialize_char(self,v:char)->Result<Value>{Ok(json!({"kind":"char","value":v.to_string()}))}
 fn serialize_str(self,v:&str)->Result<Value>{Ok(json!({"kind":"string","value":v}))}
 fn serialize_bytes(self,v:&[u8])->Result<Value>{Ok(json!({"kind":"bytes","hex":v.iter().map(|x|format!("{x:02x}")).collect::<String>()}))}
 fn serialize_none(self)->Result<Value>{Ok(json!({"kind":"none"}))}
 fn serialize_some<T:?Sized+Serialize>(self,v:&T)->Result<Value>{Ok(json!({"kind":"some","value":node(v)?}))}
 fn serialize_unit(self)->Result<Value>{Ok(json!({"kind":"unit"}))}
 fn serialize_unit_struct(self,name:&'static str)->Result<Value>{Ok(json!({"kind":"unit_struct","name":name}))}
 fn serialize_unit_variant(self,name:&'static str,index:u32,variant:&'static str)->Result<Value>{Ok(json!({"kind":"unit_variant","name":name,"index":index,"variant":variant}))}
 fn serialize_newtype_struct<T:?Sized+Serialize>(self,name:&'static str,v:&T)->Result<Value>{Ok(json!({"kind":"newtype_struct","name":name,"value":node(v)?}))}
 fn serialize_newtype_variant<T:?Sized+Serialize>(self,name:&'static str,index:u32,variant:&'static str,v:&T)->Result<Value>{Ok(json!({"kind":"newtype_variant","name":name,"index":index,"variant":variant,"value":node(v)?}))}
 fn serialize_seq(self,_:Option<usize>)->Result<Compound>{Ok(Compound::new("seq").list("items"))}
 fn serialize_tuple(self,_:usize)->Result<Compound>{Ok(Compound::new("tuple").list("items"))}
 fn serialize_tuple_struct(self,name:&'static str,_:usize)->Result<Compound>{Ok(Compound::new("tuple_struct").named(name).list("items"))}
 fn serialize_tuple_variant(self,name:&'static str,index:u32,variant:&'static str,_:usize)->Result<Compound>{Ok(Compound::new("tuple_variant").named(name).variant(index,variant).list("items"))}
 fn serialize_map(self,_:Option<usize>)->Result<Compound>{Ok(Compound::new("map").list("entries"))}
 fn serialize_struct(self,name:&'static str,_:usize)->Result<Compound>{Ok(Compound::new("struct").named(name).list("fields"))}
 fn serialize_struct_variant(self,name:&'static str,index:u32,variant:&'static str,_:usize)->Result<Compound>{Ok(Compound::new("struct_variant").named(name).variant(index,variant).list("fields"))}
}
impl ser::SerializeSeq for Compound {type Ok=Value;type Error=Error;fn serialize_element<T:?Sized+Serialize>(&mut self,v:&T)->Result<()>{self.push(v)}fn end(self)->Result<Value>{self.end()}}
impl ser::SerializeTuple for Compound {type Ok=Value;type Error=Error;fn serialize_element<T:?Sized+Serialize>(&mut self,v:&T)->Result<()>{self.push(v)}fn end(self)->Result<Value>{self.end()}}
impl ser::SerializeTupleStruct for Compound {type Ok=Value;type Error=Error;fn serialize_field<T:?Sized+Serialize>(&mut self,v:&T)->Result<()>{self.push(v)}fn end(self)->Result<Value>{self.end()}}
impl ser::SerializeTupleVariant for Compound {type Ok=Value;type Error=Error;fn serialize_field<T:?Sized+Serialize>(&mut self,v:&T)->Result<()>{self.push(v)}fn end(self)->Result<Value>{self.end()}}
impl ser::SerializeStruct for Compound {type Ok=Value;type Error=Error;fn serialize_field<T:?Sized+Serialize>(&mut self,k:&'static str,v:&T)->Result<()>{self.field(k,v)}fn end(self)->Result<Value>{self.end()}}
impl ser::SerializeStructVariant for Compound {type Ok=Value;type Error=Error;fn serialize_field<T:?Sized+Serialize>(&mut self,k:&'static str,v:&T)->Result<()>{self.field(k,v)}fn end(self)->Result<Value>{self.end()}}
impl ser::SerializeMap for Compound {type Ok=Value;type Error=Error;
 fn serialize_key<T:?Sized+Serialize>(&mut self,k:&T)->Result<()>{if self.pending_key.is_some(){return Err(Error("Repeated map key".into()));}self.pending_key=Some(node(k)?);Ok(())}
 fn serialize_value<T:?Sized+Serialize>(&mut self,v:&T)->Result<()>{let k=self.pending_key.take().ok_or_else(||Error("Missing map key".into()))?;self.value["entries"].as_array_mut().unwrap().push(json!([k,node(v)?]));Ok(())}
 fn end(self)->Result<Value>{self.end()}
}
fn run()->std::result::Result<(),Box<dyn std::error::Error>> {
 if std::env::args().nth(1).as_deref()==Some("--version"){println!("{}",json!({"sourceRevision":REV,"engineVersion":"0.21.0","engineSha256":ENGINE_SHA,"parryVersion":"0.31.1","schemaVersion":1}));return Ok(());}
 let mut bytes=Vec::new();io::stdin().take(MAX_INPUT+1).read_to_end(&mut bytes)?;
 if bytes.is_empty()||bytes.len() as u64>MAX_INPUT{return Err("snapshot input size outside 1..32MiB".into());}
 let options=bincode::DefaultOptions::new().with_fixint_encoding().with_little_endian().reject_trailing_bytes().with_limit(MAX_INPUT);
 let mut deserializer=bincode::Deserializer::from_slice(&bytes,options);
 let world:SnapshotWorld=serde_path_to_error::deserialize(&mut deserializer)?;
 let encoded=bincode::serialize(&world)?;
 if encoded!=bytes {let at=encoded.iter().zip(&bytes).position(|(a,b)|a!=b).unwrap_or(encoded.len().min(bytes.len()));return Err(format!("native bincode byte roundtrip mismatch at {at}, input={}, encoded={}",bytes.len(),encoded.len()).into());}
 let tree=node(&world)?;
 println!("{}",json!({"schemaVersion":1,"sourceRevision":REV,"engineVersion":"0.21.0","engineSha256":ENGINE_SHA,"parryVersion":"0.31.1","byteLength":bytes.len(),"inputSha256":format!("{:x}",Sha256::digest(&bytes)),"verification":{"nativeBincodeByteIdentical":true},"state":tree}));Ok(())
}
fn main(){if let Err(e)=run(){eprintln!("native snapshot decoder: {e}");std::process::exit(1);}}
