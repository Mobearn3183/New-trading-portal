// A single refresh worker never drops a mutation's follow-up read.
export function createRefreshQueue(task) {
 let running=null, dirty=false, full=false;
 return function refresh(renderAll=true) {
  dirty=true; full ||= renderAll;
  if(!running) running=(async()=>{
   while(dirty){dirty=false;const mode=full;full=false;await task(mode)}
  })().finally(()=>{running=null});
  return running;
 };
}

// Supabase's documented Phoenix JSON protocol, using authenticated private broadcasts.
export function createRealtime({url,key,getToken,onChange,onStatus,WebSocketImpl=globalThis.WebSocket}) {
 let socket=null, desired='', generation=0, heartbeat=null, retry=null, joinTimeout=null, sequence=0, lastToken='', failures=0, lastHeartbeat=null;
 const status=s=>onStatus?.(s);
 function clean(){clearInterval(heartbeat);clearTimeout(retry);clearTimeout(joinTimeout);heartbeat=retry=joinTimeout=null;lastHeartbeat=null;if(socket){const old=socket;socket=null;old.onclose=null;old.close()}}
 async function connect(gen){
  if(!desired||gen!==generation)return;
  clean();status('connecting');
  let token;try{token=await getToken()}catch{if(gen===generation){status('reconnecting');retry=setTimeout(()=>connect(gen),5000)}return}
  if(gen!==generation||!desired)return;
  const topic='realtime:arena:'+desired;
  const ws=new WebSocketImpl(url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(key)+'&vsn=1.0.0');socket=ws;lastToken=token;
  const joinRef=String(++sequence);
  const send=(event,payload={},target=topic)=>{const ref=String(++sequence);if(ws.readyState===1)ws.send(JSON.stringify({topic:target,event,payload,ref,join_ref:target==='phoenix'?null:joinRef}));return ref};
  const fail=()=>{if(gen!==generation||socket!==ws)return;clean();status('reconnecting');retry=setTimeout(()=>connect(gen),Math.min(15000,1000*2**Math.min(failures++,4)))};
  ws.onopen=()=>{
   ws.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:true},access_token:token},ref:joinRef,join_ref:joinRef}));
   joinTimeout=setTimeout(()=>{console.warn('Arena live subscription timed out');fail()},30000);
   heartbeat=setInterval(async()=>{
    if(lastHeartbeat){fail();return}
    lastHeartbeat=send('heartbeat',{},'phoenix');
    try{const next=await getToken();if(gen===generation&&socket===ws&&next!==lastToken){lastToken=next;send('access_token',{access_token:next})}}catch{fail()}
   },20000);
  };
  ws.onmessage=ev=>{
   if(gen!==generation||socket!==ws)return;
   let m;try{m=JSON.parse(ev.data)}catch{return}
   if(m.event==='phx_reply'&&m.ref===lastHeartbeat){lastHeartbeat=null;return}
   if(m.topic!==topic)return;
   if(m.event==='phx_reply'&&m.ref===joinRef){
    clearTimeout(joinTimeout);
    if(m.payload?.status==='ok'){failures=0;status('live');onChange()}else{console.warn('Arena live subscription rejected',m.payload?.response?.reason||m.payload?.status);fail()};
   }
   if(m.event==='broadcast'&&m.payload?.event==='refresh')onChange();
   if(m.event==='phx_error'||m.event==='phx_close')fail();
  };
  ws.onclose=ev=>{if(socket===ws)console.warn('Arena live socket closed',ev.code);fail()};ws.onerror=()=>{console.warn('Arena live transport unavailable');ws.close()};
 }
 return {
  watch(id){id=id||'';if(desired===id)return;desired=id;generation++;clean();if(id)void connect(generation);else status('idle')},
  reconnect(){if(desired){generation++;void connect(generation)}},
  close(){desired='';generation++;clean();status('idle')}
 };
}
