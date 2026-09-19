const $ = selector => document.querySelector(selector);
const node = (tag, text, className) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
let dataset, tier = 1, sort = 'ticket', ascending = true;
const money = value => value == null ? 'Unavailable' : '$' + value.toFixed(4);
const seconds = value => value == null ? 'Unavailable' : value.toFixed(2);
function render() {
  if (!dataset) return;
  const available = tier === 1;
  $('#empty').hidden = available; $('#populated').hidden = !available;
  $('#empty-copy').textContent = tier === 2
    ? 'The customer reconciliation task is being built and tested. No model results have been collected for this tier.'
    : 'The executive task asks for a deployed ticketing system. Its execution environment and automated acceptance suite remain pending.';
  for (const control of document.querySelectorAll('.controls select')) control.disabled = !available;
  if (!available) return;
  const records = dataset.rows.filter(r => ($('#model').value === 'all' || r.model === $('#model').value) && ($('#ticket').value === 'all' || r.ticket === $('#ticket').value));
  records.sort((a,b) => { const av = a[sort], bv = b[sort]; if (av == null) return 1; if (bv == null) return -1; return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * (ascending ? 1 : -1); });
  const total = records.reduce((s,r)=>s+r.attempts,0), passes = records.reduce((s,r)=>s+r.appChecksPassed,0), holds = records.reduce((s,r)=>s+r.reviewHolds,0);
  $('#stats').replaceChildren(...[[total,'Recorded attempts'],[passes,'Apps passing task checks'],[holds,'Execution review holds']].map(([n,label])=>{ const d=node('div',null,'stat');d.append(node('strong',String(n)),node('span',label));return d; }));
  $('#rows').replaceChildren(...records.map(r=>{
    const tr=node('tr');tr.append(node('td',dataset.tasks[r.ticket]),node('td',r.model),node('td',`${r.appChecksPassed} / ${r.attempts}`),node('td',seconds(r.elapsedSeconds)),node('td',money(r.apiEquivalentUsd)));
    const td=node('td'), details=node('details');details.append(node('summary','Inspect result'));
    details.append(node('p',`${r.client}, ${r.effort} effort. ${r.reviewHolds} execution review holds. Full transcript grading pending.`,'detail-note'));
    const a=node('a','Cohort evidence ↗');a.href=dataset.evidenceUrl;details.append(a);td.append(details);tr.append(td);return tr;
  }));
  const metric=$('#measure').value, isTime=metric==='elapsedSeconds', max=Math.max(0,...records.map(r=>r[metric]??0));
  $('#chart-title').textContent=isTime?'Total elapsed time':'API-equivalent token cost';
  $('#chart').setAttribute('aria-label',isTime?'Total seconds by task and model, all attempts included':'API-equivalent token estimates by task and model, not actual charges');
  $('#chart').replaceChildren(...records.map(r=>{
    const row=node('div',null,'bar-row'), track=node('div',null,'bar-track'), bar=node('div',null,'bar'+(r.model.includes('terra')?' terra':''));
    bar.style.width=(max?100*(r[metric]??0)/max:0)+'%';track.append(bar);
    row.append(node('span',`${r.ticket} · ${r.model}`),track,node('span',isTime?seconds(r[metric])+' s':money(r[metric]),'bar-value'));return row;
  }));
  $('#chart-note').textContent=isTime?'Totals include failed attempts. These are measured resources, not success-adjusted speed scores.':'Estimates use dated API token prices. Actual subscription charges are unavailable.';
  $('#result-count').textContent=`${records.length} task/model rows · ${total} attempts · no published MTB scores`;
}
for (const button of document.querySelectorAll('[data-tier]')) button.addEventListener('click',()=>{tier=Number(button.dataset.tier);for(const b of document.querySelectorAll('[data-tier]'))b.setAttribute('aria-pressed',String(b===button));render();});
for (const control of document.querySelectorAll('.controls select')) control.addEventListener('change',render);
for (const button of document.querySelectorAll('[data-sort]')) button.addEventListener('click',()=>{ascending=sort===button.dataset.sort?!ascending:true;sort=button.dataset.sort;for(const th of document.querySelectorAll('th'))th.removeAttribute('aria-sort');button.closest('th').setAttribute('aria-sort',ascending?'ascending':'descending');render();});
try {
  const response=await fetch('/results.json');if(!response.ok)throw new Error('Results unavailable');dataset=await response.json();
  $('#data-date').textContent='COHORT · '+dataset.date;
  for(const model of [...new Set(dataset.rows.map(r=>r.model))]){const o=node('option',model);o.value=model;$('#model').append(o);}
  for(const [id,label] of Object.entries(dataset.tasks)){const o=node('option',label);o.value=id;$('#ticket').append(o);}
  render();
} catch {$('#load-error').hidden=false;$('#populated').hidden=true;}
