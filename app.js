
import {drawChart} from './chart.js';
import {createRefreshQueue,createRealtime} from './live.js';
const URL='https://ilrfmmztttpuxhyapqez.supabase.co';
const KEY='sb_publishable_AOqKzg9pmdBfqGOxrxYSMg_dpk6z7MA';
const $=s=>document.querySelector(s);
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHTML, money=v=>Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}),date=v=>new Date(v).toLocaleString();
let session=null;try{session=JSON.parse(localStorage.getItem('arena-session'))}catch{}
let home={},snap={},cid='',code='',activeTab='positions',signup=false,busy=false,loading=false,pendingOrder=null;
let chartOptions={interval:60,type:'candles',ma:true,rsi:false,profile:false},drawings=[],geometry=null,startPoint=null;
const notice=(s,error=false)=>{$('#notice').textContent=s;$('#notice').className=error?'error':''};
function saveSession(s){if(!s)liveFeed.close();session=s; if(s)localStorage.setItem('arena-session',JSON.stringify(s));else localStorage.removeItem('arena-session')}
async function request(path,body,token){
 const r=await fetch(URL+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok)throw new Error(data.message||data.msg||data.error_description||data.error||'Request failed');return data;
}
let refreshing;
async function accessToken(){
 if(!session)throw new Error('Sign in to continue');
 if((session.expires_at||0)>Date.now()/1000+60)return session.access_token;
 if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(s=>{saveSession({...s,expires_at:Math.floor(Date.now()/1000)+s.expires_in});return s.access_token}).finally(()=>refreshing=null);
 return refreshing;
}
async function api(action,payload={}){return request('/rest/v1/rpc/arena_api',{action,payload},await accessToken())}
function table(headers,rows,empty='No records yet.'){return rows.length?'<div class="scroll"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<div class="empty">'+empty+'</div>'}
function competitionPicker(){return '<select id="competitionSelect" aria-label="Competition"><option value="">Choose a competition</option>'+(home.competitions||[]).map(c=>'<option value="'+e(c.id)+'" '+(cid===c.id?'selected':'')+'>'+e(c.name)+'</option>').join('')+'</select>'}
function status(c){return c.status!=='published'?c.status:Date.now()<new Date(c.starts_at)?'Upcoming':Date.now()>=new Date(c.ends_at)?'Ended':'Trading open'}
function currentPage(){return location.hash.slice(1)||'competitions'}
function render(){
 const profile=home.profile;$('#adminNav').hidden=profile?.role!=='admin';$('#authButton').textContent=session?'Sign out':'Sign in';
 if(!session){$('#app').innerHTML='<section class="hero"><p class="eyebrow">The participant-powered exchange</p><h1>Your edge. Your arena.</h1><p class="muted">Compete on a level playing field. Equal virtual balances, a real order book, and a leaderboard that tracks your performance.</p><button class="primary" data-action="login">Sign in to compete</button></section><div class="grid"><article class="card"><h2>Equal starting capital</h2><p class="muted">Every participant begins with the balance set for their competition.</p></article><article class="card"><h2>Participant-driven prices</h2><p class="muted">Buy and sell limit orders match with other traders. Executed trades form the chart.</p></article><article class="card"><h2>Track your performance</h2><p class="muted">Follow positions, executions, equity and your competition rank.</p></article></div>';return}
 const page=currentPage();document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash===location.hash));
 if(page==='competitions'){
 $('#app').innerHTML='<section class="hero"><p class="eyebrow">Competition lobby</p><h1>Find your next challenge</h1><p class="muted">Welcome, '+e(profile?.display_name||profile?.username||'trader')+'. Each competition has an independent balance and portfolio.</p></section><div class="grid">'+(home.competitions||[]).map(c=>'<article class="card"><div class="row between"><span class="badge">'+e(status(c))+'</span><small>'+e(c.max_participants)+' places</small></div><h2>'+e(c.name)+'</h2><p class="muted">'+e(c.description)+'</p><div><small>Starting balance</small><h2>'+money(c.starting_balance)+'</h2></div><small>'+e(date(c.starts_at))+' → '+e(date(c.ends_at))+'</small><div class="row"><button class="primary" data-action="open" data-id="'+e(c.id)+'">Open arena</button>'+((home.memberships||[]).some(m=>m.competition_id===c.id)?'<span class="positive">Joined</span>':'<button data-action="join" data-id="'+e(c.id)+'">Join competition</button>')+'</div></article>').join('')+'</div>'+(!(home.competitions||[]).length?'<div class="panel empty">No competitions published yet. An admin can create the first competition.</div>':'');return}
 if(page==='profile'){
 $('#app').innerHTML='<p class="eyebrow">Your account</p><h1>Trader profile</h1><div class="grid"><section class="panel"><h2>'+e(profile?.username)+'</h2><p>'+e(session.user?.email)+'</p><form id="profileForm"><label>Display name<input name="display_name" maxlength="60" required value="'+e(profile?.display_name)+'"></label><button class="primary">Save profile</button></form></section><section class="panel"><h2>Competition history</h2>'+table(['Competition','Joined',''],(home.memberships||[]).map(m=>[e((home.competitions||[]).find(c=>c.id===m.competition_id)?.name||m.competition_id),e(date(m.joined_at)),'<button data-action="open" data-id="'+e(m.competition_id)+'">View history</button>']))+'</section></div>';return}
 if(page==='admin'){renderAdmin();return}
 $('#app').innerHTML='<div class="row between"><div><p class="eyebrow">Competition workspace</p><h1>'+e(page==='leaderboard'?'Leaderboard':'Trading terminal')+'</h1></div><div>'+competitionPicker()+'</div></div>';
 if(!cid||!snap.competition){$('#app').innerHTML+='<div class="panel empty">Select a competition to continue.</div>';return}
 const c=snap.competition,m=snap.member;
 $('#app').innerHTML+='<div class="row between section"><h2>'+e(c.name)+'</h2><span class="badge" id="competitionStatus">'+e(status(c))+'</span></div><p class="muted">Ends '+e(date(c.ends_at))+(c.daily_opens_at?' · Daily trading '+e(c.daily_opens_at)+'–'+e(c.daily_closes_at)+' UTC':'')+' · Updated <span id="updatedAt">'+e(date(snap.server_time))+'</span> · <span id="feedStatus" role="status">'+e(feedLabel())+'</span> <button data-action="refresh" class="compact">Refresh</button></p>';
 if(page==='leaderboard'){$('#app').innerHTML+='<section class="panel" id="leaderboardTable">'+leaderboard()+'</section>';return}
 $('#app').innerHTML+='<div class="stats" id="marketStats">'+[['Equity',m?.equity],['Cash',m?.cash],['Reserved collateral',m?.reserved],['Net return',m?Number(m.equity)-Number(c.starting_balance):null]].map(([label,value])=>'<div class="panel"><small>'+label+'</small><strong>'+ (value==null?'—':money(value))+'</strong></div>').join('')+'</div><section class="panel quotes" id="liveQuotes">'+quotes()+'</section><div class="terminal"><div><section class="panel chart"><div class="row between"><div class="row"><select id="symbolSelect" aria-label="Symbol">'+(snap.markets||[]).map(s=>'<option '+(code===s.code?'selected':'')+' value="'+e(s.code)+'">'+e(s.code)+' · '+money(s.last_price)+'</option>').join('')+'</select><select id="chartType" aria-label="Chart type"><option value="candles">Candles</option><option value="line" '+(chartOptions.type==='line'?'selected':'')+'>Line</option></select><select id="interval" aria-label="Candle interval">'+[60,300,900,3600].map(t=>'<option value="'+t+'" '+(Number(chartOptions.interval)===t?'selected':'')+'>'+(t/60)+'m</option>').join('')+'</select></div><small>Executed trades only</small></div><div class="row">'+['ma','rsi','profile'].map(k=>'<label><input type="checkbox" data-indicator="'+k+'" '+(chartOptions[k]?'checked':'')+'> '+({ma:'MA 20',rsi:'RSI 14',profile:'Visible-range volume profile'}[k])+'</label>').join('')+'<select id="drawingTool" aria-label="Drawing tool"><option value="">Cursor</option><option value="horizontal">Horizontal line</option><option value="trend">Trend line (2 clicks)</option></select><button data-action="clearDrawing">Clear drawings</button></div><canvas id="chart" aria-label="Trade price chart"></canvas><small id="chartHint">Volume below price · Drawings are local to the selected market.</small></section><section class="panel section"><div class="row tabs">'+['positions','orders','history','trades'].map(t=>'<button data-action="tab" data-tab="'+t+'">'+t[0].toUpperCase()+t.slice(1)+'</button>').join('')+'</div><div id="tradeTable"></div></section></div><aside><section class="panel"><h2>Place an order</h2>'+(m?orderForm():'<p class="muted">Join to receive '+money(c.starting_balance)+' virtual capital.</p><button class="primary" data-action="join" data-id="'+e(cid)+'">Join competition</button>')+'</section><section class="panel section"><h2>Order book</h2><div class="book" id="orderBook">'+orderBook()+'</div></section><p class="muted">Market orders need an opposing participant order. Unfilled market quantity is canceled.</p></aside></div>';
 renderTradeTable(activeTab);paint();
}
function orderForm(){const market=(snap.markets||[]).find(s=>s.code===code);return '<form id="orderForm"><label>Side<select name="side"><option value="buy">Buy / Long</option><option value="sell">Sell / Short</option></select></label><label>Order type<select name="kind" id="orderKind"><option value="limit">Limit</option><option value="market">Market</option></select></label><label>Quantity<input name="quantity" type="number" min=".0001" max="1000000" step=".0001" required value="1"></label><label id="priceLabel">Limit price<input name="price" type="number" min="'+e(market?.tick_size||.01)+'" step="'+e(market?.tick_size||.01)+'" required value="'+e(market?.last_price||100)+'"></label><label><input type="checkbox" name="reduce_only"> Reduce existing position only</label><button class="primary" '+(pendingOrder?'disabled':'')+'>Submit order</button></form>'}
function leaderboard(){return table(['Rank','Trader','Equity','Profit','Return'],(snap.leaderboard||[]).map(l=>[e(l.rank),e(l.display_name||l.username)+(l.is_me?' (you)':''),money(l.equity),money(l.profit),e(l.return_pct)+'%']))}
function renderTradeTable(tab){activeTab=tab;document.querySelectorAll('[data-action=tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const target=$('#tradeTable');if(!target)return;
 if(tab==='positions')target.innerHTML=table(['Symbol','Quantity','Average','Last price','Unrealized P/L',''],(snap.positions||[]).map(p=>[e(p.code),e(p.quantity),money(p.average_price),money(p.last_price),'<span class="'+(p.pnl>=0?'positive':'negative')+'">'+money(p.pnl)+'</span>',Number(p.quantity)!==0?'<button data-action="closePosition" data-code="'+e(p.code)+'">Close at market</button>':'Closed']));
 if(tab==='orders')target.innerHTML=table(['Time','Symbol','Side','Type','Price','Quantity','Remaining','Status',''],(snap.orders||[]).map(o=>[e(date(o.created_at)),e(o.code),e(o.side),e(o.kind),money(o.price),e(o.quantity),e(o.remaining),e(o.status),['open','partial'].includes(o.status)?'<button data-action="cancel" data-id="'+e(o.id)+'">Cancel</button>':'']));
 if(tab==='history')target.innerHTML=table(['Time','Symbol','Side','Price','Quantity'],(snap.my_trades||[]).map(t=>[e(date(t.created_at)),e(t.code),e(t.side),money(t.price),e(t.quantity)]));
 if(tab==='trades')target.innerHTML=table(['Time','Taker','Price','Quantity'],(snap.trades||[]).map(t=>[e(date(t.created_at)),e(t.taker_side),money(t.price),e(t.quantity)]));
}
function renderAdmin(){
 if(home.profile?.role!=='admin'){$('#app').innerHTML='<div class="panel">Admin access is required. Roles are verified on the server.</div>';return}
 $('#app').innerHTML='<p class="eyebrow">Administration</p><h1>Manage the arena</h1><div class="grid"><section class="panel"><h2>Publish a competition</h2><form id="competitionForm" class="formgrid"><label class="wide">Name<input name="name" required maxlength="100"></label><label class="wide">Description<textarea name="description"></textarea></label><label>Starting balance<input name="starting_balance" type="number" value="100000" min="100" required></label><label>Participant limit<input name="max_participants" type="number" value="1000" min="2" max="10000" required></label><label>Starts (your local time)<input name="starts_at" type="datetime-local" required></label><label>Ends (your local time)<input name="ends_at" type="datetime-local" required></label><label>Daily opens (UTC, optional)<input name="daily_opens_at" type="time"></label><label>Daily closes (UTC, optional)<input name="daily_closes_at" type="time"></label><button class="primary wide">Publish competition</button></form></section><section class="panel"><h2>Add a market symbol</h2><form id="symbolForm"><label>Code<input name="code" required maxlength="20"></label><label>Name<input name="name" required maxlength="80"></label><label>Reference price<input name="reference_price" type="number" min=".01" step=".01" required></label><button class="primary">Save symbol</button></form><p class="muted">New competitions include all active symbols. Existing market codes are immutable.</p></section></div><section class="panel"><h2>Competitions</h2>'+table(['Name','State','Start','End',''],(home.competitions||[]).map(c=>[e(c.name),e(status(c)),e(date(c.starts_at)),e(date(c.ends_at)),c.status==='published'?'<button data-action="cancelCompetition" data-id="'+e(c.id)+'">Cancel competition</button>':'']))+'</section>';
}
let feedState='connecting', liveTimer=null, lastSnapshotAt=0;
function feedLabel(){return !navigator.onLine?'Offline':feedState==='live'?'Live updates':feedState==='idle'?'Auto refresh':'Reconnecting · auto refresh'}
const liveFeed=createRealtime({url:URL,key:KEY,getToken:accessToken,onChange:()=>{
 clearTimeout(liveTimer);liveTimer=setTimeout(()=>{if(session&&!document.hidden)void refresh(false)},80);
},onStatus:state=>{feedState=state;const target=$('#feedStatus');if(target)target.textContent=feedLabel()}});
function orderBook(){return table(['Side','Price','Quantity'],(snap.book||[]).filter(b=>b.side==='sell').sort((a,b)=>Number(b.price)-Number(a.price)).slice(-10).concat((snap.book||[]).filter(b=>b.side==='buy').sort((a,b)=>Number(b.price)-Number(a.price)).slice(0,10)).map(b=>['<span class="'+(b.side==='buy'?'positive':'negative')+'">'+e(b.side)+'</span>',money(b.price),e(b.quantity)]),'No resting orders yet.')}
function quotes(){const bids=(snap.book||[]).filter(b=>b.side==='buy').map(b=>Number(b.price)),asks=(snap.book||[]).filter(b=>b.side==='sell').map(b=>Number(b.price)),last=(snap.markets||[]).find(m=>m.code===code)?.last_price;return [['Last traded / reference',last],['Best bid',bids.length?Math.max(...bids):null],['Best ask',asks.length?Math.min(...asks):null]].map(([label,value])=>'<div><small>'+label+'</small><strong>'+(value==null?'—':money(value))+'</strong></div>').join('')}
function renderLive(){
 if(!['terminal','leaderboard'].includes(currentPage())||!$('#updatedAt'))return;
 $('#updatedAt').textContent=date(snap.server_time);$('#feedStatus').textContent=feedLabel();
 $('#competitionStatus').textContent=status(snap.competition);
 if($('#leaderboardTable'))$('#leaderboardTable').innerHTML=leaderboard();
 const m=snap.member,c=snap.competition;
 if($('#marketStats')){
  const values=[m?.equity,m?.cash,m?.reserved,m?Number(m.equity)-Number(c.starting_balance):null];
  $('#marketStats').querySelectorAll('strong').forEach((node,i)=>node.textContent=values[i]==null?'—':money(values[i]));
 }
 if($('#orderBook'))$('#orderBook').innerHTML=orderBook();
 if($('#liveQuotes'))$('#liveQuotes').innerHTML=quotes();
 document.querySelectorAll('#symbolSelect option').forEach(option=>{const market=(snap.markets||[]).find(m=>m.code===option.value);if(market)option.textContent=market.code+' · '+money(market.last_price)});
 renderTradeTable(activeTab);paint();
}
const refresh=createRefreshQueue(async(renderNow)=>{
 if(!session){liveFeed.close();if(renderNow)render();return}
 loading=true;const selected=cid,symbol=code,account=session.user?.id;
 try{
  if(renderNow||!selected)home=await api('snapshot');
  const next=selected?await api('snapshot',{competition_id:selected,...(symbol?{code:symbol}:{})}):null;
  if(!session||account!==session.user?.id||selected!==cid||symbol!==code)return;
  if(next){snap=next;if(!code)code=[...(next.markets||[])].sort((a,b)=>a.code.localeCompare(b.code))[0]?.code||''}
  liveFeed.watch(cid&&snap.member?cid:'');lastSnapshotAt=Date.now();
  if(renderNow)render();else renderLive();
 }catch(err){notice(err.message,true);if($('#feedStatus'))$('#feedStatus').textContent='Update failed · retrying'}finally{loading=false}
});
async function mutate(action,payload){const r=await api(action,payload);await refresh(action!=='cancel');return r}
async function run(fn){if(busy)return;busy=true;try{notice('');await fn()}catch(err){notice(err.message,true)}finally{busy=false}}
function paint(){const canvas=$('#chart');if(canvas)geometry=drawChart(canvas,snap.trades||[],chartOptions,drawings)}
$('#authButton').onclick=()=>run(async()=>{if(session){await request('/auth/v1/logout',{},await accessToken());saveSession(null);home={};snap={};cid='';render()}else $('#authDialog').showModal()});
$('#authClose').onclick=()=>$('#authDialog').close();
$('#authToggle').onclick=()=>{signup=!signup;$('#nameField').hidden=!signup;$('#authTitle').textContent=signup?'Create your trader account':'Welcome back';$('#authSubmit').textContent=signup?'Create account':'Sign in';$('#authToggle').textContent=signup?'Already have an account?':'Create an account'};
$('#authForm').onsubmit=ev=>{ev.preventDefault();run(async()=>{
 const d=Object.fromEntries(new FormData(ev.target));$('#authSubmit').disabled=true;
 try{const r=await request(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{email:d.email,password:d.password,...(signup?{data:{display_name:d.name}}:{})});
 if(r.access_token){saveSession({...r,expires_at:Math.floor(Date.now()/1000)+r.expires_in});$('#authDialog').close();ev.target.reset();await refresh()}else notice('Account created. Check your email to confirm, then sign in.')}
 finally{$('#authSubmit').disabled=false}
 })};
$('#app').addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='login')return $('#authDialog').showModal();
 if(a==='tab')return renderTradeTable(b.dataset.tab);
 if(a==='refresh')return run(()=>refresh(false));
 if(a==='clearDrawing'){drawings=[];startPoint=null;paint();return}
 run(async()=>{
 if(a==='open'){cid=b.dataset.id;code='';drawings=[];location.hash='terminal';await refresh()}
 if(a==='join'){await mutate('join',{competition_id:b.dataset.id});notice('Competition joined. Your starting balance is ready.')}
 if(a==='cancel'){await mutate('cancel',{competition_id:cid,order_id:b.dataset.id});notice('Order canceled.')}
 if(a==='cancelCompetition'&&confirm('Cancel this competition and its pending orders?'))await mutate('cancel_competition',{competition_id:b.dataset.id});
 if(a==='closePosition'){const p=snap.positions.find(x=>x.code===b.dataset.code);if(!p)return;await submitOrder({competition_id:cid,code:p.code,side:Number(p.quantity)>0?'sell':'buy',kind:'market',quantity:Math.abs(Number(p.quantity)),reduce_only:true})}
 });});
async function submitOrder(payload){
 if(pendingOrder)throw new Error('An order is already being processed.');
 const key=JSON.stringify(payload),saved=JSON.parse(sessionStorage.getItem('arena-pending-order')||'null');
 const order=saved?.key===key?saved.payload:{...payload,request_id:crypto.randomUUID()};
 pendingOrder=order;sessionStorage.setItem('arena-pending-order',JSON.stringify({key,payload:order}));
 try{const result=await api('order',order);sessionStorage.removeItem('arena-pending-order');activeTab='orders';await refresh(false);notice('Order '+result.status+' · remaining '+result.remaining)}
 catch(err){if(!(err instanceof TypeError)&&!['TimeoutError','AbortError'].includes(err.name))sessionStorage.removeItem('arena-pending-order');throw err}finally{pendingOrder=null;const b=$('#orderForm button');if(b)b.disabled=false}
}
$('#app').addEventListener('submit',ev=>{ev.preventDefault();const form=ev.target,data=Object.fromEntries(new FormData(form));run(async()=>{
 if(form.id==='orderForm'){form.querySelector('button').disabled=true;try{await submitOrder({competition_id:cid,code,side:data.side,kind:data.kind,quantity:Number(data.quantity),price:data.kind==='limit'?Number(data.price):null,reduce_only:data.reduce_only==='on'})}finally{const b=$('#orderForm button');if(b)b.disabled=false}}
 if(form.id==='profileForm'){await mutate('profile',data);notice('Profile updated.')}
 if(form.id==='symbolForm'){await mutate('save_symbol',{...data,reference_price:Number(data.reference_price),active:true});notice('Symbol saved.')}
 if(form.id==='competitionForm'){const start=new Date(data.starts_at),end=new Date(data.ends_at);if(end<=start)throw new Error('End time must be after start time.');if(Boolean(data.daily_opens_at)!==Boolean(data.daily_closes_at))throw new Error('Set both daily opening and closing times.');await mutate('create_competition',{...data,starting_balance:Number(data.starting_balance),max_participants:Number(data.max_participants),starts_at:start.toISOString(),ends_at:end.toISOString()});notice('Competition published.')}
 })});
$('#app').addEventListener('change',ev=>{const t=ev.target;
 if(t.id==='competitionSelect'){cid=t.value;code='';snap={};drawings=[];run(()=>refresh());}
 if(t.id==='symbolSelect'){code=t.value;drawings=[];startPoint=null;run(()=>refresh())}
 if(t.id==='orderKind'){$('#priceLabel').hidden=t.value==='market';$('#priceLabel input').required=t.value==='limit'}
 if(t.id==='chartType'){chartOptions.type=t.value;paint()}
 if(t.id==='interval'){chartOptions.interval=Number(t.value);paint()}
 if(t.dataset.indicator){chartOptions[t.dataset.indicator]=t.checked;paint()}
});
$('#app').addEventListener('pointerdown',ev=>{if(ev.target.id!=='chart'||!geometry)return;const tool=$('#drawingTool')?.value;if(!tool)return;const rect=ev.target.getBoundingClientRect(),p=geometry.point(ev.clientX-rect.left,ev.clientY-rect.top);
 if(tool==='horizontal')drawings.push({kind:'horizontal',price:p.price});
 else if(startPoint){drawings.push({kind:'trend',start:startPoint,end:p});startPoint=null;$('#chartHint').textContent='Trend line added.'}else{startPoint=p;$('#chartHint').textContent='Select the second point.'}paint();
});
addEventListener('hashchange',()=>run(()=>refresh()));addEventListener('resize',paint);
// The backup poll runs while typing too; only data regions are replaced.
setInterval(()=>{if(session&&!loading&&!document.hidden&&navigator.onLine&&Date.now()-lastSnapshotAt>(feedState==='live'?15000:2000))void refresh(false)},1000);
addEventListener('online',()=>{liveFeed.reconnect();if(session)void refresh(false)});
addEventListener('offline',()=>{if($('#feedStatus'))$('#feedStatus').textContent='Offline'});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session){liveFeed.reconnect();void refresh(false)}});
render();if(session)refresh();

