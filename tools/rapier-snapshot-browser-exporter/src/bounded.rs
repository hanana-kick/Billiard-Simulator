// SPDX-License-Identifier: Apache-2.0
// A schema-agnostic serde adapter: preserves the actual pinned Deserialize
// implementation and adds bounds to every nested seed/visitor, never byte offsets.
use serde::de::{self, DeserializeSeed, Deserializer, EnumAccess, MapAccess, SeqAccess, VariantAccess, Visitor};
use std::{cell::Cell, fmt, rc::Rc};
pub const MAX_DEPTH: usize = 128;
pub const MAX_NODES: usize = 2_000_000;
#[derive(Clone)]
struct Budget { nodes: Rc<Cell<usize>>, depth: usize }
impl Budget {
    fn child(&self)->Self {Self {nodes:self.nodes.clone(),depth:self.depth+1}}
    fn check<E:de::Error>(&self)->Result<(),E> {
        let n=self.nodes.get();
        if self.depth>MAX_DEPTH || n>=MAX_NODES {return Err(E::custom("snapshot serde depth/node limit exceeded"));}
        self.nodes.set(n+1);Ok(())
    }
}
pub struct Limited<D> { inner:D, budget:Budget }
impl<D> Limited<D> {pub fn new(inner:D)->Self {Self {inner,budget:Budget {nodes:Rc::new(Cell::new(0)),depth:0}}}}
struct Seed<S> { inner:S, budget:Budget }
impl<'de,S:DeserializeSeed<'de>> DeserializeSeed<'de> for Seed<S> {
    type Value=S::Value;
    fn deserialize<D:Deserializer<'de>>(self,d:D)->Result<Self::Value,D::Error> {
        self.inner.deserialize(Limited {inner:d,budget:self.budget})
    }
}
struct Visit<V> {inner:V,budget:Budget}
macro_rules! scalar_visit {
    ($($method:ident($ty:ty)),* $(,)?)=>{$(fn $method<E:de::Error>(self,v:$ty)->Result<Self::Value,E>{self.inner.$method(v)})*};
}
impl<'de,V:Visitor<'de>> Visitor<'de> for Visit<V> {
    type Value=V::Value;
    fn expecting(&self,f:&mut fmt::Formatter)->fmt::Result {self.inner.expecting(f)}
    scalar_visit!(visit_bool(bool),visit_i8(i8),visit_i16(i16),visit_i32(i32),visit_i64(i64),visit_i128(i128),visit_u8(u8),visit_u16(u16),visit_u32(u32),visit_u64(u64),visit_u128(u128),visit_f32(f32),visit_f64(f64),visit_char(char),visit_str(&str),visit_borrowed_str(&'de str),visit_string(String),visit_bytes(&[u8]),visit_borrowed_bytes(&'de [u8]),visit_byte_buf(Vec<u8>));
    fn visit_none<E:de::Error>(self)->Result<Self::Value,E>{self.inner.visit_none()}
    fn visit_unit<E:de::Error>(self)->Result<Self::Value,E>{self.inner.visit_unit()}
    fn visit_some<D:Deserializer<'de>>(self,d:D)->Result<Self::Value,D::Error>{self.inner.visit_some(Limited {inner:d,budget:self.budget.child()})}
    fn visit_newtype_struct<D:Deserializer<'de>>(self,d:D)->Result<Self::Value,D::Error>{self.inner.visit_newtype_struct(Limited {inner:d,budget:self.budget.child()})}
    fn visit_seq<A:SeqAccess<'de>>(self,a:A)->Result<Self::Value,A::Error>{self.inner.visit_seq(Access {inner:a,budget:self.budget.child()})}
    fn visit_map<A:MapAccess<'de>>(self,a:A)->Result<Self::Value,A::Error>{self.inner.visit_map(Access {inner:a,budget:self.budget.child()})}
    fn visit_enum<A:EnumAccess<'de>>(self,a:A)->Result<Self::Value,A::Error>{self.inner.visit_enum(Access {inner:a,budget:self.budget.child()})}
}
struct Access<A> {inner:A,budget:Budget}
impl<'de,A:SeqAccess<'de>> SeqAccess<'de> for Access<A> {
    type Error=A::Error;
    fn next_element_seed<T:DeserializeSeed<'de>>(&mut self,seed:T)->Result<Option<T::Value>,Self::Error>{self.inner.next_element_seed(Seed {inner:seed,budget:self.budget.clone()})}
    fn size_hint(&self)->Option<usize>{self.inner.size_hint()}
}
impl<'de,A:MapAccess<'de>> MapAccess<'de> for Access<A> {
    type Error=A::Error;
    fn next_key_seed<T:DeserializeSeed<'de>>(&mut self,seed:T)->Result<Option<T::Value>,Self::Error>{self.inner.next_key_seed(Seed {inner:seed,budget:self.budget.clone()})}
    fn next_value_seed<T:DeserializeSeed<'de>>(&mut self,seed:T)->Result<T::Value,Self::Error>{self.inner.next_value_seed(Seed {inner:seed,budget:self.budget.clone()})}
    fn size_hint(&self)->Option<usize>{self.inner.size_hint()}
}
impl<'de,A:EnumAccess<'de>> EnumAccess<'de> for Access<A> {
    type Error=A::Error;type Variant=Access<A::Variant>;
    fn variant_seed<T:DeserializeSeed<'de>>(self,seed:T)->Result<(T::Value,Self::Variant),Self::Error>{
        let (value,variant)=self.inner.variant_seed(Seed {inner:seed,budget:self.budget.clone()})?;
        Ok((value,Access {inner:variant,budget:self.budget.child()}))
    }
}
impl<'de,A:VariantAccess<'de>> VariantAccess<'de> for Access<A> {
    type Error=A::Error;
    fn unit_variant(self)->Result<(),Self::Error>{self.budget.check()?;self.inner.unit_variant()}
    fn newtype_variant_seed<T:DeserializeSeed<'de>>(self,seed:T)->Result<T::Value,Self::Error>{self.inner.newtype_variant_seed(Seed {inner:seed,budget:self.budget})}
    fn tuple_variant<V:Visitor<'de>>(self,len:usize,v:V)->Result<V::Value,Self::Error>{self.budget.check()?;self.inner.tuple_variant(len,Visit {inner:v,budget:self.budget})}
    fn struct_variant<V:Visitor<'de>>(self,fields:&'static [&'static str],v:V)->Result<V::Value,Self::Error>{self.budget.check()?;self.inner.struct_variant(fields,Visit {inner:v,budget:self.budget})}
}
macro_rules! decode_method {
    ($($name:ident $(, $arg:ident:$ty:ty)*);* $(;)?)=>{$(
        fn $name<V:Visitor<'de>>(self,$($arg:$ty,)*visitor:V)->Result<V::Value,Self::Error>{
            self.budget.check()?;
            self.inner.$name($($arg,)*Visit {inner:visitor,budget:self.budget})
        }
    )*};
}
impl<'de,D:Deserializer<'de>> Deserializer<'de> for Limited<D> {
    type Error=D::Error;
    fn is_human_readable(&self)->bool {self.inner.is_human_readable()}
    decode_method!(deserialize_any;deserialize_bool;deserialize_i8;deserialize_i16;deserialize_i32;deserialize_i64;deserialize_i128;deserialize_u8;deserialize_u16;deserialize_u32;deserialize_u64;deserialize_u128;deserialize_f32;deserialize_f64;deserialize_char;deserialize_str;deserialize_string;deserialize_bytes;deserialize_byte_buf;deserialize_option;deserialize_unit;deserialize_unit_struct,name:&'static str;deserialize_newtype_struct,name:&'static str;deserialize_seq;deserialize_tuple,len:usize;deserialize_tuple_struct,name:&'static str,len:usize;deserialize_map;deserialize_struct,name:&'static str,fields:&'static [&'static str];deserialize_enum,name:&'static str,variants:&'static [&'static str];deserialize_identifier;deserialize_ignored_any);
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use bincode::Options;
    #[test]
    fn accepts_bounded_source_types_and_rejects_node_exhaustion() {
        let bytes=[1u32.to_le_bytes(),0u32.to_le_bytes()].concat();
        let mut d=bincode::Deserializer::from_slice(&bytes,bincode::DefaultOptions::new().with_fixint_encoding());
        assert!(Nested::deserialize(Limited::new(&mut d)).is_ok());
        let bytes=(MAX_NODES as u64+1).to_le_bytes();
        let mut d=bincode::Deserializer::from_slice(&bytes,bincode::DefaultOptions::new().with_fixint_encoding());
        let error=Vec::<()>::deserialize(Limited::new(&mut d)).unwrap_err();
        assert!(error.to_string().contains("depth/node limit exceeded"));
    }
    #[derive(Deserialize)]
    #[allow(dead_code)]
    enum Nested { End, More(Box<Nested>) }
    #[test]
    fn rejects_recursive_source_types() {
        let mut bytes=Vec::new();for _ in 0..MAX_DEPTH+1 {bytes.extend(1u32.to_le_bytes());}bytes.extend(0u32.to_le_bytes());
        let mut d=bincode::Deserializer::from_slice(&bytes,bincode::DefaultOptions::new().with_fixint_encoding());
        let error=match Nested::deserialize(Limited::new(&mut d)){Ok(_)=>panic!("Depth bound was ignored"),Err(e)=>e};
        assert!(error.to_string().contains("depth/node limit exceeded"));
    }
}
