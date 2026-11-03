
import test from 'node:test';import assert from 'node:assert/strict';import {candles,sma,rsi} from '../chart.js';
test('candles use execution order and aggregate volume into minute buckets',()=>{const t=[{id:3,created_at:'2026-11-03T10:01:01Z',price:102,quantity:4},{id:2,created_at:'2026-11-03T10:00:30Z',price:98,quantity:3},{id:1,created_at:'2026-11-03T10:00:01Z',price:100,quantity:2}];const b=candles(t);assert.equal(b.length,2);assert.deepEqual({...b[0],time:0},{time:0,open:100,high:100,low:98,close:98,volume:5});assert.equal(b[1].volume,4);assert.equal(t[0].id,3)});
test('moving average waits for enough actual executions',()=>assert.deepEqual(sma([{close:2},{close:4},{close:6}],2),[null,3,5]));
test('RSI handles flat and one-way execution series',()=>{assert.equal(rsi(Array.from({length:20},()=>({close:100}))).at(-1),50);assert.equal(rsi(Array.from({length:20},(_,i)=>({close:i}))).at(-1),100);assert.equal(rsi(Array.from({length:20},(_,i)=>({close:100-i}))).at(-1),0)});

