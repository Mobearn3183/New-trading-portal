import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshQueue,createRealtime} from '../live.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('a mutation refresh waits for a fresh read after an in-flight snapshot',async()=>{
 let finish,calls=[];
 const refresh=createRefreshQueue(async full=>{calls.push(full);if(calls.length===1)await new Promise(resolve=>finish=resolve)});
 const first=refresh(false);await tick();const afterMutation=refresh(true);finish();await afterMutation;await first;
 assert.deepEqual(calls,[false,true]);
});
test('refresh requests coalesce and retain the strongest render request',async()=>{
 let finish,calls=[];
 const refresh=createRefreshQueue(async full=>{calls.push(full);if(calls.length===1)await new Promise(resolve=>finish=resolve)});
 const p=refresh(false);await tick();refresh(false);refresh(true);refresh(false);finish();await p;
 assert.deepEqual(calls,[false,true]);
});
test('private authenticated broadcast refreshes on subscription and database event, and switches channels',async()=>{
 const sockets=[],states=[];let changed=0;
 class Socket {readyState=0;sent=[];constructor(url){this.url=url;sockets.push(this)}send(s){this.sent.push(JSON.parse(s))}close(){this.readyState=3}open(){this.readyState=1;this.onopen()}message(m){this.onmessage({data:JSON.stringify(m)})}}
 const feed=createRealtime({url:'https://example.supabase.co',key:'public-key',getToken:async()=>'test-token',onChange:()=>changed++,onStatus:s=>states.push(s),WebSocketImpl:Socket});
 try{
  feed.watch('competition-a');await tick();const a=sockets[0];a.open();const join=a.sent[0];
  assert.equal(join.topic,'realtime:arena:competition-a');assert.equal(join.payload.config.private,true);assert.equal(join.payload.access_token,'test-token');
  a.message({topic:join.topic,event:'phx_reply',ref:join.ref,payload:{status:'ok'}});assert.equal(states.at(-1),'live');assert.equal(changed,1);
  a.message({topic:join.topic,event:'broadcast',payload:{event:'refresh',payload:{}}});assert.equal(changed,2);
  feed.watch('competition-b');await tick();assert.equal(a.readyState,3);assert.equal(sockets.length,2);
  a.message({topic:join.topic,event:'broadcast',payload:{event:'refresh'}});assert.equal(changed,2,'ignore stale channel events');
  feed.watch('competition-b');await tick();assert.equal(sockets.length,2,'same channel is reused');
 }finally{feed.close()}
});
