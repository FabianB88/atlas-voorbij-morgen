import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fresh,restore,KEY,award,xp,level,finish,episodeIds} from '../dist/state.js';
import {REGIONS,move,pathTo,walkable,camera} from '../dist/world.js';
import {EPISODES,FUTURES} from '../dist/story.js';
import {routeReady,loopKind} from '../dist/models.js';
import {fieldPanel,fieldAction} from '../dist/field.js';

let paths=0;
for(const [id,r] of Object.entries(REGIONS)){
 assert(walkable(r.spawn,id),id+' spawn');assert(walkable(r.pad,id),id+' craft');
 for(const p of r.spots){assert(walkable(p,id),id+': '+p.id);const route=pathTo(r.spawn,p,id);assert(route.length||Math.hypot(r.spawn.x-p.x,r.spawn.y-p.y)<.02,id+': route '+p.id);assert(route.every(q=>walkable(q,id)),id+': route on land');
  let pos={...r.spawn},todo=route.map(q=>({...q}));for(let n=0;todo.length&&n<4000;n++){const dx=todo[0].x-pos.x,dy=todo[0].y-pos.y;if(Math.hypot(dx,dy)<.004)pos={...todo.shift()};else pos=move(pos,dx*1.5,dy,1/60,id,.073);}assert.equal(todo.length,0,id+': walking arrives at '+p.id);paths++;
 }
 const a=move(r.spawn,1,0,1/60,id),b=move(r.spawn,1,0,1/60,id);assert.deepEqual(a,b);assert(a.x>r.spawn.x);
 const held=move(r.spawn,1,0,300,id);assert(held.x-r.spawn.x<.007,'bounded elapsed time');
}
const s=fresh();assert.notEqual(KEY,'business-ethics');award(s,'climate-change');award(s,'climate-change');assert.equal(xp(s),15);assert.equal(level(s),1);
assert.throws(()=>finish(s,'climate',false));assert.deepEqual(s.completed,[]);finish(s,'climate',true);finish(s,'climate',true);assert.equal(xp(s),165);
s.notes.climate='Een eigen notitie met <tekst>';const saved=restore(JSON.parse(JSON.stringify(s)));assert.equal(saved.notes.climate,s.notes.climate);
assert.equal(restore({version:99}).started,false);assert.equal(restore({version:1,episode:Infinity,region:'no',era:'pressure'}).region,'coast');assert.equal(restore({version:1,region:'glacier',era:'pressure'}).era,'now');
const clamp=restore({version:1,episode:-4,player:{x:4,y:-3},completed:['no','climate','climate']});assert.equal(clamp.episode,0);assert.deepEqual(clamp.completed,['climate']);
for(const e of EPISODES){assert(episodeIds.includes(e.id));assert.equal(routeReady(fresh(),e.id),false);assert(e.steps.length>=2);assert(REGIONS[e.region]);}
const energy=fresh();energy.flags={power:true,energyCarrier:true};assert.equal(routeReady(energy,'energy'),false);energy.flags.emissions=true;assert.equal(routeReady(energy,'energy'),true);
const futures=fresh();futures.flags={responses:true,boundaries:true};futures.visits=['pressure'];assert.equal(routeReady(futures,'futures'),false);futures.visits.push('recovery');assert.equal(routeReady(futures,'futures'),true);assert.equal(FUTURES.pressure.year,FUTURES.recovery.year);
assert.equal(loopKind([{from:'a',to:'b',sign:'+'}]),'open');assert.equal(loopKind([{from:'a',to:'b',sign:'+'},{from:'b',to:'a',sign:'-'}]),'balancing');
for(const [id,value] of [['ice','absorb'],['melt','land'],['record','series'],['roots','service'],['shore','both'],['community','voices']]){const state=fresh();assert.equal(fieldAction(id,'wrong',state).correct,false);assert(!state.flags['field-'+id]);assert.equal(fieldAction(id,value,state).correct,true);assert(state.flags['field-'+id]);assert(fieldPanel(id,state).includes('veldboek'));}
const core=JSON.parse(fs.readFileSync('dist/core.json','utf8')),reading=JSON.parse(fs.readFileSync('sources/course-reading.json','utf8'));assert.equal(reading.lessons.length,9);assert.equal(reading.lessons.reduce((n,l)=>n+l.blocks.length,0),303);
assert.equal(core.concepts.filter(c=>c.priority==='essential').length,36);for(const c of core.concepts.filter(c=>c.priority==='essential'))assert(EPISODES.some(e=>e.concepts.includes(c.id)),c.id);
for(const c of core.concepts){const lesson=reading.lessons.find(l=>l.id===c.sourceLessonId);assert(lesson);assert(c.sourceItemIds.every(id=>lesson.blocks.some(b=>b.id===id)));}
for(const c of core.concepts.filter(c=>c.priority==='referenceOnly'))assert(!EPISODES.some(e=>e.concepts.includes(c.id)),'no incidental progression gates');
const app=fs.readFileSync('dist/app.js','utf8');assert(app.includes('if(!admin.active)localStorage.setItem(KEY'));assert(app.includes('state=admin.backup'));assert(app.includes('arrivalId=null;flightGoal=null;keys.add(d)'));assert(!app.includes('fetch(\'https://ethics'));
const view=camera({x:.5,y:.5},1000,700,1);assert(Math.abs(view.x-700)<1e-8&&Math.abs(view.y-401)<1e-8);
console.log(`Game QA passed: ${paths} reachable points in ${Object.keys(REGIONS).length} regions, physical movement, 8 route gates, future comparison, save isolation, 6 field applications and source tracing for all 303 blocks.`);
