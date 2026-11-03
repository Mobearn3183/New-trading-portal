
export function candles(trades, interval=60) {
 const bins=new Map();
 for(const t of [...trades].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)||Number(a.id)-Number(b.id))){
  const time=Math.floor(new Date(t.created_at).getTime()/1000/interval)*interval,p=Number(t.price),q=Number(t.quantity);
  if(!bins.has(time)) bins.set(time,{time,open:p,high:p,low:p,close:p,volume:0});
  const b=bins.get(time); b.high=Math.max(b.high,p);b.low=Math.min(b.low,p);b.close=p;b.volume+=q;
 }
 return [...bins.values()];
}
export function sma(bars,n=20){return bars.map((b,i)=>i<n-1?null:bars.slice(i-n+1,i+1).reduce((s,x)=>s+x.close,0)/n)}
export function rsi(bars,n=14){
 const out=bars.map(()=>null);if(bars.length<=n)return out;let gain=0,loss=0;
 for(let i=1;i<=n;i++){const d=bars[i].close-bars[i-1].close;gain+=Math.max(0,d);loss+=Math.max(0,-d)}
 gain/=n;loss/=n;out[n]=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 for(let i=n+1;i<bars.length;i++){const d=bars[i].close-bars[i-1].close;gain=(gain*(n-1)+Math.max(d,0))/n;loss=(loss*(n-1)+Math.max(-d,0))/n;out[i]=loss===0?(gain===0?50:100):100-100/(1+gain/loss)}return out;
}
export function drawChart(canvas,trades,opts={},drawings=[]){
 const ctx=canvas.getContext('2d'),w=canvas.clientWidth||800,h=canvas.clientHeight||400,dpr=globalThis.devicePixelRatio||1;
 canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.fillStyle='#111a27';ctx.fillRect(0,0,w,h);
 const bars=candles(trades,Number(opts.interval)||60).slice(-120);
 if(!bars.length){ctx.fillStyle='#91a2bb';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('No executed trades yet — place a limit order to start the market.',w/2,h/2);return null}
 const left=10,right=w-65,top=20,bottom=h-(opts.rsi?125:75),vbottom=h-(opts.rsi?70:25);
 let lo=Math.min(...bars.map(b=>b.low)),hi=Math.max(...bars.map(b=>b.high));const pad=(hi-lo)*.12||Math.max(hi*.01,.01);lo-=pad;hi+=pad;
 const y=p=>bottom-(p-lo)/(hi-lo)*(bottom-top),x=i=>left+(i+.5)*(right-left)/bars.length,bw=(right-left)/bars.length;
 ctx.font='11px system-ui';
 for(let i=0;i<5;i++){const p=lo+(hi-lo)*i/4;ctx.strokeStyle='#243044';ctx.beginPath();ctx.moveTo(left,y(p));ctx.lineTo(right,y(p));ctx.stroke();ctx.fillStyle='#93a5bd';ctx.fillText(p.toFixed(2),right+5,y(p)+4)}
 if(opts.profile){const volume=Array(20).fill(0);for(const t of trades){const p=Number(t.price);if(p<lo||p>hi)continue;volume[Math.min(19,Math.floor((p-lo)/(hi-lo)*20))]+=Number(t.quantity)}const max=Math.max(...volume)||1;volume.forEach((v,i)=>{ctx.fillStyle='#4b80b044';ctx.fillRect(right-v/max*(right-left)*.25,y(lo+(hi-lo)*(i+1)/20),v/max*(right-left)*.25,(bottom-top)/20)})}
 if(opts.type==='line'){ctx.beginPath();ctx.strokeStyle='#4cdeb2';bars.forEach((b,i)=>i?ctx.lineTo(x(i),y(b.close)):ctx.moveTo(x(i),y(b.close)));ctx.stroke()}
 else bars.forEach((b,i)=>{ctx.fillStyle=ctx.strokeStyle=b.close>=b.open?'#43dcb0':'#f27b90';ctx.beginPath();ctx.moveTo(x(i),y(b.high));ctx.lineTo(x(i),y(b.low));ctx.stroke();ctx.fillRect(x(i)-bw*.3,Math.min(y(b.open),y(b.close)),Math.max(1,bw*.6),Math.max(1,Math.abs(y(b.open)-y(b.close))))});
 if(opts.ma){const a=sma(bars);ctx.strokeStyle='#f1c874';ctx.beginPath();let started=false;a.forEach((p,i)=>{if(p===null)return;if(started)ctx.lineTo(x(i),y(p));else{ctx.moveTo(x(i),y(p));started=true}});ctx.stroke()}
 const vmax=Math.max(...bars.map(b=>b.volume))||1;
 bars.forEach((b,i)=>{ctx.fillStyle=b.close>=b.open?'#43dcb055':'#f27b9055';ctx.fillRect(x(i)-bw*.3,vbottom-b.volume/vmax*40,bw*.6,b.volume/vmax*40)});
 if(opts.rsi){const a=rsi(bars),ry=p=>h-15-p/100*45;ctx.fillStyle='#93a5bd';ctx.fillText('RSI 14',left,h-60);ctx.strokeStyle='#b49cf7';ctx.beginPath();let started=false;a.forEach((p,i)=>{if(p===null)return;if(started)ctx.lineTo(x(i),ry(p));else{ctx.moveTo(x(i),ry(p));started=true}});ctx.stroke()}
 ctx.fillStyle='#93a5bd';ctx.fillText(new Date(bars[0].time*1000).toLocaleTimeString(),left,h-3);ctx.fillText(new Date(bars.at(-1).time*1000).toLocaleTimeString(),Math.max(left,right-75),h-3);
 const tx=t=>left+((t-bars[0].time)/(Number(opts.interval)||60)+.5)*bw;
 ctx.strokeStyle='#86aef7';
 for(const d of drawings){ctx.beginPath();if(d.kind==='horizontal'){ctx.moveTo(left,y(d.price));ctx.lineTo(right,y(d.price))}else{ctx.moveTo(tx(d.start.time),y(d.start.price));ctx.lineTo(tx(d.end.time),y(d.end.price))}ctx.stroke()}
 return {point:(cx,cy)=>({time:bars[0].time+(cx-left)/bw*(Number(opts.interval)||60),price:lo+(bottom-cy)/(bottom-top)*(hi-lo)})};
}

