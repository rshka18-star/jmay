'use strict';
const $=id=>document.getElementById(id);
const DATA_KEY='jma.transactions.v3',PIN_KEY='jma.pin.v3',DB_NAME='jma-db-v3',DB_STORE='backup',DB_RECORDS_KEY='transactions';
let records=[],credential=null,period='day',entryType='income',concealed=false,unlocked=false;
const euro=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'});
function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s);}
function validRecords(items){return Array.isArray(items)&&items.every(r=>r&&typeof r.id==='string'&&['income','expense'].includes(r.type)&&Number.isSafeInteger(r.cents)&&r.cents>0&&typeof r.description==='string'&&validDate(r.date));}
function money(c){return concealed?'••••':euro.format(c/100);}
function totals(items){return items.reduce((t,r)=>{t[r.type]+=r.cents;return t;},{income:0,expense:0});}
function openBackupDb(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return resolve(null);const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(DB_STORE))req.result.createObjectStore(DB_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function backupRecords(items){try{const db=await openBackupDb();if(!db)return;await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(items,DB_RECORDS_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch{}}
async function readBackup(){try{const db=await openBackupDb();if(!db)return null;const value=await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly');const req=tx.objectStore(DB_STORE).get(DB_RECORDS_KEY);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error)});db.close();return value}catch{return null}}
async function requestPersistentStorage(){try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}}
function save(next){localStorage.setItem(DATA_KEY,JSON.stringify(next));records=next;void backupRecords(next);render();}
function periodStart(p,now=new Date()){
  if(p==='day') return new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(p==='week'){
    const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    d.setDate(d.getDate()-(d.getDay()+6)%7);
    return d;
  }
  if(p==='month') return new Date(now.getFullYear(),now.getMonth(),1);
  return new Date(now.getFullYear(),now.getMonth(),now.getDate());
}
function inPeriod(r,p,now=new Date()){
  const start=localDate(periodStart(p,now));
  const today=localDate(now);
  return r.date>=start && r.date<=today;
}
function formatDisplayDate(d){return d.toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'});}
function getWeekRange(now=new Date()){const start=periodStart('week',now);const end=new Date(start);end.setDate(start.getDate()+6);return{start,end};}
function summary(id,title,p){
  const t=totals(records.filter(r=>inPeriod(r,p)));
  const el=$(id);
  if(id==='weekSummary' || id==='monthSummary'){
    let subtitle='';
    const now=new Date();
    if(p==='week'){
      const wr=getWeekRange(now);
      subtitle=`${formatDisplayDate(wr.start)} – ${formatDisplayDate(wr.end)}`;
    }else if(p==='month'){
      subtitle=now.toLocaleDateString('en-IE',{month:'long',year:'numeric'});
    }
    el.innerHTML=`<h2>${title}</h2><small class="total-date">${subtitle}</small><div class="total-box-row"><span>Total</span><strong>${money(t.income-t.expense)}</strong></div>`;
    return;
  }
  el.innerHTML=`<h2>${title}</h2><div class="summary-row in"><span>Income</span><strong>${money(t.income)}</strong></div><div class="summary-row out"><span>Expenses</span><strong>${money(t.expense)}</strong></div><div class="summary-row net"><span>Balance</span><strong>${money(t.income-t.expense)}</strong></div>`;
}
function formatDisplayDate(d){return d.toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'});}
function getWeekRange(now=new Date()){const start=periodStart('week',now);const end=new Date(start);end.setDate(start.getDate()+6);return{start,end};}
function renderPeriodExpenseTotals(){
  const now=new Date();
  const day=totals(records.filter(r=>inPeriod(r,'day'))).expense;
  const week=totals(records.filter(r=>inPeriod(r,'week'))).expense;
  const month=totals(records.filter(r=>inPeriod(r,'month'))).expense;
  const wr=getWeekRange(now);
  $('dayDateLabel').textContent=formatDisplayDate(now);
  $('weekDateLabel').textContent=`${formatDisplayDate(wr.start)} – ${formatDisplayDate(wr.end)}`;
  $('monthDateLabel').textContent=now.toLocaleDateString('en-IE',{month:'long',year:'numeric'});
  $('dayExpenseOnly').textContent=money(day);
  $('weekExpenseOnly').textContent=money(week);
  $('monthExpenseOnly').textContent=money(month);
}
function render(){const t=totals(records.filter(r=>inPeriod(r,period)));$('incomeTotal').textContent=money(t.income);$('expenseTotal').textContent=money(t.expense);$('balanceTotal').textContent=money(t.income-t.expense);summary('selectedSummary',{day:'Today Summary',week:'This Week',month:'This Month'}[period],period);summary('weekSummary','This Week','week');summary('monthSummary','This Month','month');renderPeriodExpenseTotals();renderHistory();}
function renderHistory(){const list=$('historyList');list.replaceChildren();const filtered=records.filter(r=>$('historyFilter').value==='all'||r.type===$('historyFilter').value).slice().sort((a,b)=>b.date.localeCompare(a.date));if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent='No transactions yet.';list.append(p)}filtered.forEach(r=>{const row=document.createElement('article');row.className=`history-item ${r.type}`;const details=document.createElement('div');details.className='details';const title=document.createElement('h3');title.textContent=r.description;const date=document.createElement('small');date.textContent=`${r.date} · ${r.type==='income'?'Income':'Expense'}`;details.append(title,date);const amount=document.createElement('strong');amount.textContent=(r.type==='income'?'+':'−')+money(r.cents);const del=document.createElement('button');del.className='delete-button';del.textContent='×';del.onclick=()=>{if(confirm('Delete this transaction?'))save(records.filter(x=>x.id!==r.id))};row.append(details,amount,del);list.append(row)});}
function switchView(view){['home','history','settings'].forEach(v=>$(v+'View').hidden=v!==view);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));window.scrollTo(0,0);}
async function pinHash(pin,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(salt),iterations:150000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');}
async function makeCredential(pin){const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)));return{salt,hash:await pinHash(pin,salt)};}
function lock(){unlocked=false;$('app').hidden=true;$('lockScreen').hidden=false;$('entryForm').reset();$('lockForm').reset();$('lockError').textContent='';$('confirmGroup').hidden=!!credential;$('confirmPin').required=!credential;$('lockTitle').textContent=credential?'Welcome back':'Welcome to JMA';$('lockDescription').textContent=credential?'Enter your PIN to open your dashboard.':'Create a PIN to protect access on this device.';$('unlockButton').textContent=credential?'Unlock dashboard':'Create PIN & open';}
$('lockForm').onsubmit=async e=>{e.preventDefault();const pin=$('pin').value;if(!/^\d{4}$/.test(pin)){$('lockError').textContent='Use 4 digits.';return}try{if(credential){if(await pinHash(pin,credential.salt)!==credential.hash)throw Error('Incorrect PIN. Please try again.')}else{if(pin!==$('confirmPin').value)throw Error('PINs do not match.');credential=await makeCredential(pin);localStorage.setItem(PIN_KEY,JSON.stringify(credential))}unlocked=true;$('lockScreen').hidden=true;$('app').hidden=false;switchView('home');render()}catch(err){$('lockError').textContent=err.message}};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll('[data-period]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});render()});
document.querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>{entryType=b.dataset.entry;$('entryForm').reset();$('date').value=localDate();$('date').max=localDate();$('entryError').textContent='';$('entryTitle').textContent=entryType==='income'?'Add income':'Add expense';$('entryDialog').showModal()});
$('closeDialog').onclick=()=>$('entryDialog').close();
$('entryForm').onsubmit=e=>{e.preventDefault();const raw=$('amount').value,cents=Math.round(Number(raw)*100),date=$('date').value,description=$('description').value.trim();if(!Number.isSafeInteger(cents)||cents<1||!description||!validDate(date)||date>localDate()){$('entryError').textContent='Enter a positive amount, description and a valid date.';return}save([{id:crypto.randomUUID(),type:entryType,cents,description,date},...records]);$('entryDialog').close();$('toast').textContent='Transaction saved';$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),2500)};
$('historyFilter').onchange=renderHistory;
$('visibilityButton').onclick=()=>{concealed=!concealed;render()};
$('lockButton').onclick=lock;$('profileButton').onclick=()=>switchView('settings');
$('changePinForm').onsubmit=async e=>{e.preventDefault();const old=$('oldPin').value,next=$('newPin').value;try{if(await pinHash(old,credential.salt)!==credential.hash)throw Error('Current PIN is incorrect.');if(!/^\d{4}$/.test(next)||next!==$('repeatPin').value)throw Error('New PINs do not match.');credential=await makeCredential(next);localStorage.setItem(PIN_KEY,JSON.stringify(credential));$('settingsMessage').textContent='PIN updated successfully.'}catch(err){$('settingsMessage').textContent=err.message}};
$('exportButton').onclick=()=>{const blob=new Blob([JSON.stringify({app:'JMA',version:3,transactions:records},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`JMA-backup-${localDate()}.json`;a.click()};
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!validRecords(data.transactions))throw Error('Invalid backup.');save(data.transactions)}catch(err){$('settingsMessage').textContent=err.message}e.target.value=''};
window.addEventListener('pagehide',()=>{try{localStorage.setItem(DATA_KEY,JSON.stringify(records))}catch{}void backupRecords(records)});
async function init(){try{const raw=localStorage.getItem(DATA_KEY);if(raw){records=JSON.parse(raw);if(!validRecords(records))records=[];void backupRecords(records)}else{const backup=await readBackup();if(validRecords(backup)){records=backup;localStorage.setItem(DATA_KEY,JSON.stringify(records))}}credential=JSON.parse(localStorage.getItem(PIN_KEY)||'null');void requestPersistentStorage()}catch{}lock()}
void init();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
