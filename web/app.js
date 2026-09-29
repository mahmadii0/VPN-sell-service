const tg = window.Telegram?.WebApp;
tg?.ready();
const initData = tg?.initData || '';
const el = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('en-US').format(n) + ' toman';
let packages = [];
function status(text, error=false) { el('status').textContent=text; el('status').className=error?'error':''; }
async function api(path, options={}) {
  const res = await fetch(path,{...options,headers:{...(options.headers||{}),'X-Telegram-Init-Data':initData},cache:'no-store'});
  const data=await res.json(); if (!res.ok) throw Error(data.error || `HTTP ${res.status}`); return data;
}
function node(tag,text) { const n=document.createElement(tag);n.textContent=text;return n; }
async function refresh() {
  const [shop,me,list]=await Promise.all([api('/api/shop'),api('/api/me'),api('/api/orders')]);
  packages=shop.packages;el('card').textContent=shop.card_number;el('wallet').textContent=fmt(me.wallet_toman);
  const select=el('package'), cards=el('packages');select.replaceChildren();cards.replaceChildren();
  for(const p of packages){const option=document.createElement('option');option.value=p.id;option.textContent=`${p.name} — ${fmt(p.price_toman)}`;select.append(option);const box=document.createElement('p');box.append(node('strong',p.name),node('span',` — ${fmt(p.price_toman)}. ${p.description||''}`));cards.append(box)}
  select.onchange=()=>{const p=packages.find(x=>x.id===select.value);el('price').textContent=p?fmt(p.price_toman):''};select.onchange();
  const orders=el('orders');orders.replaceChildren();if(!list.orders.length)orders.append(node('p','No orders yet.'));
  for(const o of list.orders){const row=document.createElement('p');row.append(node('span',`#${o.id} ${o.package_name} — ${fmt(o.price_toman)} — ${o.status} `));if(o.status==='approved'){const button=node('button','Open service');button.onclick=()=>openService(o.id);row.append(button)}orders.append(row)}
}
async function openService(id){try{status('Loading service…');const s=await api(`/api/orders/${id}/service`);const box=el('service');box.replaceChildren();box.append(node('p',`${s.package_name} · ${s.panel_email} · inbound ${s.inbound_id}`),node('p',`Expiry (UTC): ${s.expiry_utc||'Unavailable'}`),node('p',`Remaining: ${s.remaining_seconds===null?'Unavailable':Math.floor(s.remaining_seconds/86400)+' days, '+Math.floor(s.remaining_seconds%86400/3600)+' hours'}`));const a=document.createElement('a');a.href=s.subscription_url;a.textContent=s.subscription_url;a.rel='noreferrer noopener';a.className='link';box.append(a);el('serviceBox').hidden=false;status('')}catch(e){status(e.message,true)}}
el('orderForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const p=packages.find(x=>x.id===el('package').value);if(!p)throw Error('Choose a package');status(`Submitting receipt for ${fmt(p.price_toman)}…`);const result=await api('/api/orders',{method:'POST',body:new FormData(e.target)});status(`Order #${result.id} pending manual review.`);e.target.querySelector('input[type=file]').value='';await refresh()}catch(err){status(err.message,true)}finally{button.disabled=false}};
if(!initData)status('Open this page from the Telegram bot to authenticate.',true);else refresh().catch(e=>status(e.message,true));
