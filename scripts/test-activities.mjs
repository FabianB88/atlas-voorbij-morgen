import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fresh, restore, award } from '../dist/state.js';
import { routeReady } from '../dist/models.js';
import { initModels, renderActivity, handleActivity } from '../dist/activities.js';
import { energyPlan, lifeCycle, rainTest, loopCases } from '../dist/activity-models.js';

const audit=JSON.parse(await fs.readFile(new URL('../sources/core-audit.json',import.meta.url),'utf8'));
const s=initModels(fresh());
const conceptIds=new Set(audit.items.map(i=>i.id));
let actions=0;
function act(kind,action,value='') {
  actions++;
  const result=handleActivity(kind,action,value,s);
  assert.equal(typeof result.message,'string');
  assert.ok(result.message.trim());
  for(const id of result.conceptIds||[]){assert.ok(conceptIds.has(id),`Unknown awarded concept ${id}`);award(s,id);}
  return result;
}
function ok(kind,action,value='') {assert.equal(act(kind,action,value).correct,true,`${kind}/${action}: valid route should work`);}
function no(kind,action,value='') {assert.equal(act(kind,action,value).correct,false,`${kind}/${action}: missing reasoning should be explained`);}
function put(kind,pick,place,pairs){for(const [item,target] of Object.entries(pairs)){act(kind,pick,item);act(kind,place,target);}}

// Valid defaults and saved investigations survive repeated rendering and initialization.
s.notes.own='Mijn eigen reden is niet automatisch te beoordelen.';
s.models.powerLab.solar=60;
initModels(s);
assert.equal(s.models.powerLab.solar,60);
assert.equal(s.notes.own,'Mijn eigen reden is niet automatisch te beoordelen.');
const originalFlags=JSON.stringify(s.flags);
assert.equal(act('unknown','unsupported').changed,false);
assert.equal(JSON.stringify(s.flags),originalFlags);

// All interaction kinds render accessible button/input contracts; saved prose is escaped.
const kinds=['weather','heat','boundary','power','carrier','product','contract','value','biomimicry','water','loop','delay','decision'];
s.notes.weather='<img src=x onerror=alert(1)>';
for(const kind of kinds){const html=renderActivity(kind,s,audit.items);assert.ok(html.includes('<section class="activity">'));assert.ok(html.includes('data-act="activity"'));assert.ok(!html.includes('<img src=x'));}
assert.ok(renderActivity('weather',s,audit.items).includes('&lt;img'));
assert.ok(renderActivity('weather',s,audit.items).includes('1951–1980')===false); // archive is not yet selected

// First episode: real archive, explicit controlled contrast, clear wrong-answer feedback.
no('weather','conclude','archive');
assert.equal(s.flags.weather,undefined);
act('weather','view','archive');
assert.ok(renderActivity('weather',s,audit.items).includes('1951–1980'));
assert.ok(renderActivity('weather',s,audit.items).includes('NASA GISTEMP'));
no('weather','conclude','day');ok('weather','conclude','archive');
s.models.heatLab.extra=0;act('heat','observe');
no('heat','explain','radiation');
s.models.heatLab.extra=1;act('heat','observe');
no('heat','explain','source');ok('heat','explain','radiation');
assert.equal(routeReady(s,'climate'),true);

// Second episode: source-chain scope and mitigation/adaptation refer to described mechanisms.
s.episode=1;
no('water','responses-check');
put('water','response-pick','response-place',{insulate:'mitigation',catch:'adaptation',cleanPower:'mitigation',shade:'both'});
assert.equal(s.models.responseLab.selected,'');
ok('water','responses-check');
no('boundary','conclude');
for(const id of ['field','village','habitat'])act('boundary','sample',id);
s.models.boundaryLab.scale='lake';s.models.boundaryLab.plan='source';no('boundary','conclude');
s.models.boundaryLab.scale='chain';s.models.boundaryLab.plan='move';no('boundary','conclude');
s.models.boundaryLab.plan='source';ok('boundary','conclude');
s.visits.push('pressure','recovery');assert.equal(routeReady(s,'futures'),true);

// Energy cannot appear in an initially empty battery, and more than one physical plan works.
const empty=energyPlan({solar:0,wind:0,battery:120,efficiency:20});
assert.equal(empty.rows[0].discharge,0);
assert.equal(empty.rows[1].stored,0);
assert.ok(empty.rows.every(row=>row.shortage===40));
for(const plan of [{solar:60,wind:40,battery:80,efficiency:20},{solar:80,wind:30,battery:100,efficiency:20},{solar:20,wind:70,battery:80,efficiency:20}]) {
  const p=energyPlan(plan);assert.equal(p.ready,true);
  assert.ok(p.rows.every(row=>row.stored>=0&&row.stored<=p.battery));
  assert.ok(p.rows.every(row=>row.discharge<=Math.max(0,row.demand-row.generated)+1e-7));
}
s.episode=2;
Object.assign(s.models.powerLab,{solar:90,wind:90,battery:120,efficiency:30});no('power','run');
Object.assign(s.models.powerLab,{solar:60,wind:40,battery:80,efficiency:20});ok('power','run');
assert.equal(routeReady(s,'energy'),false); // source/drivers and accumulation still required
put('carrier','pick','place',{sun:'source',coal:'source',electricity:'carrier',hydrogen:'source',battery:'storage'});
assert.equal(s.models.carrierLab.selected,'');
no('carrier','check');assert.equal(s.flags.energyCarrier,undefined);
put('carrier','pick','place',{hydrogen:'carrier'});ok('carrier','check');
assert.equal(routeReady(s,'energy'),false);
act('carrier','view','emissions');no('carrier','emissions','cumulative');
s.models.emissionsLab.emission=15;s.models.emissionsLab.uptake=10;
act('carrier','year');assert.equal(s.models.emissionsLab.stock,105); // lower flow still grows stock
no('carrier','emissions','endpoint');ok('carrier','emissions','cumulative');
assert.equal(routeReady(s,'energy'),true);

// Product diagnosis precedes intervention. Life-cycle conclusions change with use assumptions.
s.episode=3;
no('product','route','repair');
for(const id of ['battery','screen','body'])act('product','inspect',id);
no('product','route','reuse');ok('product','route','repair');
assert.equal(lifeCycle({days:100,electricityFactor:1}).lower,'repair');
assert.equal(lifeCycle({days:1200,electricityFactor:1}).lower,'replace');
Object.assign(s.models.productLab,{view:'life',fullLife:true,days:100,electricityFactor:1});
no('product','life','replace');ok('product','life','repair');
s.models.productLab.days=1200;ok('product','life','replace');
act('product','sharing');
Object.assign(s.models.contractLab,{owner:'provider',maintenance:'provider',payment:'replacement',return:'inspect'});
no('contract','check');s.models.contractLab.payment='uptime';ok('contract','check');
s.models.contractLab.payment='usage';s.models.contractLab.return='recycle';ok('contract','check');
assert.equal(routeReady(s,'circular'),true);

// Six capitals, input/output/outcome and independent materiality directions are distinct.
s.episode=4;
put('value','capital-pick','capital-place',{money:'financial',machine:'manufactured',blueprint:'intellectual',skill:'human',trust:'social',water:'natural'});
ok('value','capitals-check');
put('value','outcome-pick','outcome-place',{investment:'input',tablets:'output',lifedays:'outcome',skills:'outcome'});
s.models.valueLab.metric='count';no('value','outcomes-check');s.models.valueLab.metric='days';ok('value','outcomes-check');
put('value','material-pick','material-place',{pollution:'both',drought:'financial',workers:'both'});
s.models.valueLab.residents=true;no('value','material-check');
put('value','material-pick','material-place',{pollution:'impact'});ok('value','material-check');
assert.equal(routeReady(s,'value'),true);

// Natural appearance is not mechanism or safety; two distinct field designs are valid.
s.episode=5;
Object.assign(s.models.natureLab,{observation:'shape',principle:'guide',design:'channels'});no('biomimicry','test');
s.models.natureLab.observation='function';ok('biomimicry','test');
for(const [id,label] of Object.entries({natural:'unproven',water:'shown',restore:'unproven'}))act('biomimicry','claim',`${id}:${label}`);
ok('biomimicry','claims-check');
Object.assign(s.models.waterLab,{shade:true,method:'swale',access:false});no('water','field-test');
s.models.waterLab.access=true;ok('water','field-test');
s.models.waterLab.method='tank';ok('water','field-test');
assert.equal(rainTest({shade:true,swale:true,access:true}).runoff,100);
assert.equal(rainTest({shade:true,tank:true,access:true}).runoff,120);
assert.equal(routeReady(s,'nature'),true);

// Every offered loop has a genuinely closed, explained polarity; sign != desirable.
s.episode=6;
for(const [id,item] of Object.entries(loopCases)) {
  act('loop','case',id);
  item.edges.forEach((edge,index)=>{s.models.loopLab[`sign${index}`]=edge[2];});
  s.models.loopLab.type=item.type==='reinforcing'?'balancing':'reinforcing';no('loop','check');
  s.models.loopLab.type=item.type;ok('loop','check');
}
act('loop','risk');
no('delay','explain','delay');
act('delay','train');no('delay','explain','delay');
act('delay','tick');assert.equal(s.models.delayLab.backlog,12);assert.equal(s.models.delayLab.capacity,2);
no('delay','explain','failure');ok('delay','explain','delay');
act('delay','tick');assert.equal(s.models.delayLab.capacity,6);assert.equal(s.models.delayLab.backlog,10);
Object.assign(s.models.delayLab,{barrier:'information',intervention:'poster',metric:'repairs',pilot:true});no('delay','pilot-check');
s.models.delayLab.intervention='access';ok('delay','pilot-check');
Object.assign(s.models.delayLab,{barrier:'returns',intervention:'returnPilot',metric:'returns',pilot:true});ok('delay','pilot-check');
assert.equal(routeReady(s,'system'),true);

// Three different strategic routes can work; exact prose is never silently scored.
s.episode=7;
Object.assign(s.models.decisionLab,{device:'refurb',maintenance:true,access:'school',energy:'solar',return:true,risk:'parts'});
no('decision','plan-check');s.models.decisionLab.energy='grid';ok('decision','plan-check');
s.models.decisionLab.device='new';s.models.decisionLab.risk='production';ok('decision','plan-check');
Object.assign(s.models.decisionLab,{device:'service',maintenance:false,return:false,risk:'contract',access:'support',energy:'storage'});ok('decision','plan-check');
no('decision','transfer','lifecycle:repair');
ok('decision','transfer','lifecycle:new');ok('decision','transfer','energy:gap');ok('decision','transfer','materiality:impact');
for(const [id,label] of Object.entries({measured:'fact',assumed:'assumption',valued:'value'}))act('decision','label',`${id}:${label}`);
s.models.decisionLab.monitor='sales';no('decision','uncertainty-check');s.models.decisionLab.monitor='review';ok('decision','uncertainty-check');
assert.equal(routeReady(s,'decision'),true);
assert.equal(s.notes.own,'Mijn eigen reden is niet automatisch te beoordelen.');

// Every authored optional tab remains renderable after the entire route and saved restore.
const tabs={carrierLab:['sort','emissions'],productLab:['repair','life'],valueLab:['capitals','outcomes','materiality'],natureLab:['prototype','claims'],delayLab:['delay','pilot'],decisionLab:['plan','transfer','uncertainty']};
const tabKinds={carrierLab:'carrier',productLab:'product',valueLab:'value',natureLab:'biomimicry',delayLab:'delay',decisionLab:'decision'};
for(const [model,views] of Object.entries(tabs))for(const view of views){s.models[model].view=view;assert.ok(renderActivity(tabKinds[model],s,audit.items).includes('data-act="activity"'));}
const restored=initModels(restore(JSON.parse(JSON.stringify(s))));
assert.deepEqual(restored.flags,s.flags);
assert.equal(restored.models.productLab.days,1200);
assert.equal(restored.models.carrierLab.placements.hydrogen,'carrier');
assert.equal(restored.notes.own,s.notes.own);
const essential=audit.items.filter(i=>i.priority==='essential').map(i=>i.id);
assert.deepEqual(essential.filter(id=>!s.concepts.includes(id)),[],'Every essential concept has a meaningful authored investigation/feedback route.');

// Corrupt imported model shapes must not prevent opening an activity.
const malformed=initModels({...fresh(),models:{powerLab:{solar:NaN},productLab:{inspected:null},valueLab:{placements:[]},delayLab:{readyWeek:'invalid'}}});
for(const kind of kinds)assert.doesNotThrow(()=>renderActivity(kind,malformed,audit.items));
console.log(`Activity QA passed: ${actions} actions, 13 kinds, all 8 episode checks, 36 essential concept investigations, alternate valid energy/LCA/contract/field/strategy routes, saved progress and notes.`);
