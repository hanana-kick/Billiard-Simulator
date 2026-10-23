'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');require('../src/game-rules.js');
const hit=(game,a,b,kind='ball')=>game.contact({a:{id:a,kind:'ball'},b:{id:b,kind}});
test('two distinct reds score once and preserve turn',()=>{const g=new FourBallGame();g.begin(1);hit(g,1,3);hit(g,3,1);hit(g,4,1);assert.deepEqual(g.finish(),{cueId:1,delta:1,nextCue:1});assert.equal(g.scores[1],1);assert.equal(g.finish(),null);});
test('opponent contact overrides both reds and switches turn',()=>{const g=new FourBallGame();g.begin(1);hit(g,1,3);hit(g,1,4);hit(g,1,2);assert.equal(g.finish().delta,-1);assert.equal(g.activeCue,2);assert.equal(g.scores[1],-1);});
test('red-to-red and opponent-to-red contact never score for shooter',()=>{const g=new FourBallGame();g.begin(2);hit(g,2,3);hit(g,3,4);hit(g,1,4);assert.equal(g.finish().delta,0);assert.equal(g.activeCue,1);});
test('floor contact is foul; invalid shooter cannot start',()=>{const g=new FourBallGame();assert.equal(g.begin(3),false);g.begin(2);hit(g,2,null,'floor');assert.equal(g.finish().delta,-1);});
test('rule state snapshot restores score, turn and pending state without physics mutation',()=>{const g=new FourBallGame();const before=g.snapshot();g.begin(1);hit(g,1,3);hit(g,1,4);g.finish();g.restore(before);assert.equal(g.scores[1],0);assert.equal(g.pending,null);assert.equal(g.activeCue,1);});
