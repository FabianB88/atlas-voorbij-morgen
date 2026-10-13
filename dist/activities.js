import { climate } from './models.js';
import { energyPlan, lifeCycle, rainTest, advanceWorkshop, loopCases, validateLoop, clamp } from './activity-models.js';

const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const n = value => Number(value).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
const button = (kind, action, value, label, selected = false, disabled = false) => `<button type="button" data-act="activity" data-kind="${e(kind)}" data-action="${e(action)}" data-value="${e(value)}" class="${selected ? 'selected' : ''}" ${disabled ? 'disabled' : ''}>${e(label)}</button>`;
const actions = body => `<div class="activity-actions">${body}</div>`;
const status = (done, text) => `<p class="status-strip ${done ? 'done' : ''}">${done ? '✓ ' : ''}${e(text)}</p>`;
const note = (key, state, label = 'Mijn aantekening — voor mijn eigen dossier') => `<label class="mini-note">${e(label)}<textarea data-note="${e(key)}" rows="2" placeholder="Schrijf wat je wilt onthouden…">${e(state.notes?.[key] || '')}</textarea></label>`;
const details = (title, body) => `<details><summary>${e(title)}</summary>${body}</details>`;
const select = (model, field, label, value, options) => `<label>${e(label)}<select data-model="${e(model)}" data-field="${e(field)}">${options.map(([id, text]) => `<option value="${e(id)}" ${value === id ? 'selected' : ''}>${e(text)}</option>`).join('')}</select></label>`;
const check = (model, field, label, value) => `<label class="check-row"><input type="checkbox" data-model="${e(model)}" data-field="${e(field)}" ${value === true ? 'checked' : ''}>${e(label)}</label>`;
const slider = (model, field, label, value, min, max, step, unit = '') => `<label>${e(label)} · <output data-field-value="${model}.${field}">${e(value)}</output> ${e(unit)}<input type="range" data-model="${model}" data-field="${field}" min="${min}" max="${max}" step="${step}" value="${e(value)}"></label>`;
const section = (title, intro, body) => `<section class="activity"><h2>${e(title)}</h2><p>${intro}</p>${body}</section>`;
const help = (id, concepts) => { const item = concepts?.find(c => c.id === id); return item ? details(`Uitleg: ${item.term}`, `<p>${e(item.definition)}</p><p class="example">${e(item.beginnerExample)}</p>`) : ''; };
const result = (message, correct, conceptIds = [], changed = true) => ({ message, ...(typeof correct === 'boolean' ? { correct } : {}), conceptIds, changed });
const finish = (state, flags, concepts, message) => { flags.forEach(flag => { state.flags[flag] = true; }); return result(message, true, concepts); };
const copy = value => JSON.parse(JSON.stringify(value));

export function initModels(state) {
  for (const key of ['flags', 'models', 'choices', 'trials', 'notes']) if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
  const defaults = {
    weatherLab: { view: 'day', seenDay: true, seenArchive: false },
    heatLab: { extra: 0, seenBase: false, seenExtra: false, interpretation: '' },
    boundaryLab: { sample: 'lake', visited: ['lake'], plan: '', scale: '' },
    powerLab: { solar: 20, wind: 20, battery: 0, efficiency: 0, tested: false },
    carrierLab: { view: 'sort', selected: '', placements: {} },
    emissionsLab: { emission: 20, uptake: 10, stock: 100, currentYear: 0, history: [], compared: false, explanation: '' },
    productLab: { view: 'repair', inspected: [], route: '', selected: '', days: 100, electricityFactor: 1, fullLife: false, conclusion: '' },
    contractLab: { owner: '', maintenance: '', payment: '', return: '' },
    valueLab: { view: 'capitals', selected: '', placements: {}, outcomeSelected: '', outcomePlacements: {}, metric: '', materialSelected: '', materialPlacements: {}, residents: false },
    natureLab: { view: 'prototype', observation: '', principle: '', design: '', measured: false, claims: {} },
    responseLab: { selected: '', placements: {} },
    waterLab: { shade: false, method: 'none', access: false, tested: false },
    loopLab: { caseId: 'market', signs: ['', '', ''], type: '', inspectedClimate: false },
    delayLab: { view: 'delay', week: 0, backlog: 10, capacity: 2, readyWeek: null, trainingActive: false, history: [], explanation: '', barrier: '', intervention: '', metric: '', pilot: false },
    decisionLab: { view: 'plan', device: '', maintenance: false, access: '', energy: '', return: false, risk: '', monitor: '', transfer: {}, labels: {} }
  };
  for (const [model, fields] of Object.entries(defaults)) {
    if (!state.models[model] || typeof state.models[model] !== 'object' || Array.isArray(state.models[model])) state.models[model] = {};
    for (const [field, value] of Object.entries(fields)) {
      const saved=state.models[model][field];
      const invalid=saved===undefined || (Array.isArray(value) && !Array.isArray(saved)) ||
        (value && typeof value==='object' && !Array.isArray(value) && (!saved || typeof saved!=='object' || Array.isArray(saved))) ||
        (typeof value==='number' && (typeof saved!=='number' || !Number.isFinite(saved))) ||
        (typeof value==='boolean' && typeof saved!=='boolean') || (typeof value==='string' && typeof saved!=='string') ||
        (value===null && saved!==null && (typeof saved!=='number' || !Number.isFinite(saved)));
      if(invalid)state.models[model][field]=copy(value);
    }
  }
  for(const model of ['emissionsLab','delayLab'])state.models[model].history=state.models[model].history.filter(row=>row&&typeof row==='object'&&!Array.isArray(row));
  return state;
}

// NASA GISTEMP v4, global annual anomalies relative to 1951–1980, CSV checked 2026-10-13.
const NASA_ANOMALIES = [.45,.41,.22,.23,.31,.45,.33,.47,.61,.38,.39,.53,.63,.62,.53,.68,.64,.66,.54,.66,.72,.61,.65,.67,.75,.89,1.01,.91,.85,.98,1.01,.85,.89,1.17,1.28,1.18];
function climateGraph() {
  const points = NASA_ANOMALIES.map((v, index) => `${52 + index / 35 * 510},${190 - v / 1.4 * 150}`).join(' ');
  return `<svg viewBox="0 0 600 240" role="img" aria-label="NASA wereldtemperatuur 1990 tot 2025. Jaarwaarden variëren; de langjarige reeks stijgt."><path d="M52 28V190H570" fill="none" stroke="currentColor" opacity=".5"/><path d="M52 136H570M52 83H570" fill="none" stroke="currentColor" opacity=".15"/><polyline points="${points}" fill="none" stroke="#df975f" stroke-width="4"/><text x="6" y="194" fill="currentColor">0 °C</text><text x="6" y="140" fill="currentColor">0,5</text><text x="6" y="87" fill="currentColor">1,0</text><text x="52" y="220" fill="currentColor">1990</text><text x="520" y="220" fill="currentColor">2025</text></svg>`;
}
function renderWeather(s, concepts) {
  const m = s.models.weatherLab;
  const body = m.view === 'day'
    ? `<div class="activity-card"><p class="eyebrow">Lokale verhaalmeting · vandaag</p><strong class="large-number">31 °C</strong><p>Het plein is heet. Dit vertelt iets over de omstandigheden van deze middag. Het vertelt nog niet hoe het klimaat over tientallen jaren verandert.</p></div>`
    : `<figure class="lab-output">${climateGraph()}<figcaption>Wereldgemiddelde temperatuur: afwijking van het gemiddelde in 1951–1980. Dit zijn jaarwaarden, geen lokaal weerbericht.</figcaption></figure><p class="mini-note">Echte meetgegevens: <a href="https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv" target="_blank" rel="noopener">NASA GISTEMP v4</a>, 1990–2025, gecontroleerd 13 oktober 2026. De vergelijkingsperiode is geen vóórindustrieel gemiddelde.</p>${details('Bekijk de jaarwaarden als tabel', `<div class="table-wrap"><table><thead><tr><th>Jaar</th><th>Afwijking</th></tr></thead><tbody>${NASA_ANOMALIES.map((v,i) => `<tr><td>${1990+i}</td><td>${n(v)} °C</td></tr>`).join('')}</tbody></table></div>`)}`;
  return section('Een hete dag of een veranderend klimaat?', 'Sam heeft twee bronnen. Bekijk ze allebei en kies welke een langjarige verandering kan laten zien.',
    actions(button('weather','view','day','Bekijk de middag',m.view==='day') + button('weather','view','archive','Open het meetarchief',m.view==='archive')) +
    `<div class="activity-live">${body}</div>` + status(m.seenDay && m.seenArchive, `Bekeken: ${m.seenDay ? 'middag ✓' : 'middag nog niet'} · ${m.seenArchive ? 'archief ✓' : 'archief nog niet'}`) +
    `<h3>Welk bewijs neem je mee voor de langjarige verandering?</h3>` + actions(button('weather','conclude','day','Alleen de warme middag') + button('weather','conclude','archive','De meetreeks over vele jaren')) +
    help('weather-climate',concepts) + note('weather',s));
}

function renderHeat(s, concepts) {
  const m = s.models.heatLab, model = climate(clamp(m.extra,0,2));
  return section('Volg de warmte', 'De zon levert energie. De aarde geeft energie weer af. Verander alleen de hoeveelheid extra broeikasgas en kijk naar de eerste reactie.',
    `<div class="lab-controls">${slider('heatLab','extra','Extra broeikasgas',m.extra,0,2,1,'stappen')}</div>` +
    `<div class="activity-live"><div class="flow-diagram"><div class="activity-card"><b>Zonlicht binnen</b><strong>${model.sun}</strong></div><span aria-hidden="true">→</span><div class="activity-card"><b>Aarde en lucht</b><p>Broeikasgassen nemen warmtestraling op en stralen die weer uit.</p></div><span aria-hidden="true">→</span><div class="activity-card"><b>Warmte naar ruimte, eerst</b><strong>${model.initialOutgoing}</strong></div></div><p>Er blijft aanvankelijk <b>${model.initialImbalance}</b> meer energie achter. Bij opwarming gaat het systeem later weer meer warmte uitstralen.</p></div>` +
    `<p class="mini-note">Vereenvoudigd model: 100 fictieve energie-eenheden zonlicht, vaste eerste toestand. De cijfers zijn geen meting en geven geen temperatuur of toekomstige opwarming aan.</p>` +
    actions(button('heat','observe','','Bewaar deze waarneming')) +
    status(m.seenBase && m.seenExtra, `Vergelijking: ${m.seenBase ? 'beginpunt ✓' : 'bekijk 0 extra'} · ${m.seenExtra ? 'extra gas ✓' : 'bekijk 1 of 2 extra'}`) +
    `<h3>Wat verandert extra CO₂ hier?</h3>` + actions(button('heat','explain','radiation','De aarde verliest eerst minder warmte naar de ruimte') + button('heat','explain','source','CO₂ maakt zelf nieuwe energie') + button('heat','explain','sun','De zon gaat hierdoor harder schijnen')) +
    help('greenhouse-energy-flow',concepts) + details('Waar komt de extra CO₂ vandaan?', '<p>Door kolen, olie en gas te verbranden voegen mensen CO₂ toe. Ook ontbossing en andere activiteiten dragen bij. Daarom gaat een klimaatmaatregel over de bron van uitstoot, niet alleen over een hete straat.</p>') + note('heat',s));
}

const SAMPLES = {
  field: { title:'Het bovenstroomse veld', body:'Voedingsstoffen helpen het gewas groeien. In de casus spoelen bij regen te veel stikstof- en fosforverbindingen naar de sloot. Die verandering begint dus buiten de plaats waar de schade opvalt.' },
  lake: { title:'Het meer', body:'Veel voedingsstoffen zorgen hier voor sterke algengroei. Bij afbraak verbruiken organismen zuurstof. De meting in dit fictieve dossier laat zuurstoftekort zien; vissen en ander waterleven komen onder druk.' },
  village: { title:'Het dorp en zijn bewoners', body:'Bewoners missen schoon water en recreatie; een visser verliest inkomen. De veroorzaker, de getroffen groep en de plek waar de rekening terechtkomt zijn niet dezelfde. Mensen met weinig macht hebben wel belangrijke kennis.' },
  habitat: { title:'De natuurlijke verbinding', body:'Het water, de bodem en het leven zijn verbonden. Bestuivers, waterzuivering en vruchtbare bodem ondersteunen ook menselijke activiteiten. Klimaat is één grens; natuur, water en voedingsstoffen vragen daarnaast aandacht.' }
};
function renderBoundary(s, concepts) {
  const m=s.models.boundaryLab, item=SAMPLES[m.sample]||SAMPLES.lake;
  return section('Een probleem reist met het water', 'In het meer gaat het mis. Onderzoek de bron, het water en de mensen die de gevolgen ervaren. De grens van je onderzoek maakt verschil.',
    `<div class="flow-diagram">${['field','lake','village'].map((id,i)=>`${i?'<span aria-hidden="true">→</span>':''}${button('boundary','sample',id,SAMPLES[id].title,m.sample===id)}`).join('')}</div>` + actions(button('boundary','sample','habitat','Onderzoek ook de natuurverbinding',m.sample==='habitat')) +
    `<div class="activity-live"><article class="activity-card"><h3>${e(item.title)}</h3><p>${e(item.body)}</p></article></div>` +
    `<div class="lab-controls">${select('boundaryLab','scale','Wat neem je mee in je onderzoek?',m.scale,[['','Kies een onderzoeksgrens'],['lake','Alleen het water bij het meer'],['chain','Veld, meer, bewoners en gevolgen op langere termijn']])}${select('boundaryLab','plan','Welke aanpak past bij de gevonden oorzaak?',m.plan,[['','Vergelijk de aanpakken'],['cosmetic','Alleen watergroen wegwerken voor bezoekers'],['source','Afspoeling beperken, water herstellen en bewoners betrekken'],['move','Afvoer naar een ander dorp verleggen']])}</div>` +
    status(s.flags.boundaries,'Je taak: bron en meer onderzoeken, de betrokken mensen meenemen en verplaatsing van schade voorkomen.') + actions(button('boundary','conclude','','Leg de aanpak vast')) +
    help('planetary-boundaries',concepts)+help('nutrients-water',concepts)+details('Waarom telt dit ook als duurzame waarde?', '<p>People: gezondheid en kunnen meedoen. Planet: water en levende natuur. Prosperity: inkomen en brede welvaart. Een goed financieel resultaat wist vervuild water niet uit. Planetaire grenzen beschrijven veilige marges voor verbonden processen; een overschrijding is geen knop die meteen overal een ramp veroorzaakt.</p>')+note('boundary',s));
}

function powerOutput(m) {
  const p=energyPlan(m);
  return `<div class="activity-live"><p class="status-strip">Planmiddelen: <b>${n(p.cost)} / ${p.budget}</b> · lokale kabel: maximaal <b>${p.gridLimit} kW</b></p><div class="table-wrap"><table><thead><tr><th>Periode</th><th>Opwek</th><th>Vraag</th><th>Accu in / uit</th><th>Accu over</th><th>Tekort</th><th>Kabel</th></tr></thead><tbody>${p.rows.map(r=>`<tr><th>${e(r.label)}</th><td>${n(r.generated)} kW</td><td>${n(r.demand)} kW</td><td>+${n(r.charge)} / −${n(r.discharge)} kWh</td><td>${n(r.stored)} kWh</td><td>${n(r.shortage)} kW</td><td>${r.gridOverload>0?'te zwaar':'binnen grens'}</td></tr>`).join('')}</tbody></table></div><p>${p.ready?'Dit plan dekt alle drie oefenperiodes binnen het middelenbudget en de lokale kabelgrens.':'Pas het plan aan: kijk waar een tekort, kabelprobleem of middelenoverschrijding ontstaat.'}</p></div>`;
}
function renderPower(s, concepts) {
  const m=s.models.powerLab;
  return section('Een net dat ook zonder zon werkt', 'Ada moet stroom kunnen leveren in drie oefenperiodes. De batterij begint leeg. Alleen overschot in een eerdere periode kan later worden gebruikt.',
    `<div class="lab-controls">${slider('powerLab','solar','Zonnevermogen',m.solar,0,90,10,'kW')}${slider('powerLab','wind','Windvermogen',m.wind,0,90,10,'kW')}${slider('powerLab','battery','Accu-inhoud',m.battery,0,120,20,'kWh')}${slider('powerLab','efficiency','Vraag verminderen',m.efficiency,0,30,10,'kW')}</div>`+powerOutput(m)+
    `<p class="mini-note">Spelmodel: drie representatieve periodes van elk één uur, vraag eerst 60 kW. Opwek en accu zitten vóór de lokale kabel; alleen levering naar de gebruikers gaat door die kabel van maximaal 50 kW. Zon levert 100%, 0%, 30%; wind 100%, 40%, 0%. Verliezen, laadvermogensgrenzen en tussenliggende uren zijn weggelaten. Dit controleert deze casus, geen jaarbetrouwbaarheid.</p>`+
    details('Hoe werken de planmiddelen?', '<p>Het fictieve budget is 36. Elke 10 kW zon kost 2, elke 10 kW wind 3, elke 20 kWh accu 1 en elke 10 kW lagere vraag 2. Meer opwek, minder vraag en opslag hebben dus elk hun prijs. Er zijn verschillende werkbare combinaties.</p>')+
    status(s.flags.power,'Je taak: alle drie periodes zonder tekort, maximaal 50 kW door de kabel en hoogstens 36 planmiddelen.')+actions(button('power','run','','Test en bewaar het plan'))+
    details('Een startpunt als je vastloopt', '<p>Onderzoek bijvoorbeeld 60 kW zon, 40 kW wind, 80 kWh opslag en 20 kW minder vraag. Kijk daarna zelf wat een andere combinatie verandert. Dit is een voorbeeld, geen verplichte eindoplossing.</p>')+help('grid-congestion',concepts)+note('power',s));
}

const ENERGY_ITEMS = {
  sun:['Zonlicht','Primaire energie die een paneel omzet.','source'],
  coal:['Kolen','De brandstof wordt verbrand om energie vrij te maken.','source'],
  electricity:['Elektriciteit','Na de omzetting vervoert zij energie naar de machine.','carrier'],
  hydrogen:['Waterstof','In deze keten eerst gemaakt met stroom; daarna vervoerd naar een gebruiker.','carrier'],
  battery:['Een geladen accu','Dit apparaat bewaart eerder omgezette energie voor later.','storage']
};
function renderCarrier(s, concepts) {
  const m=s.models.carrierLab;
  const tab=actions(button('carrier','view','sort','Bron → drager → opslag',m.view==='sort')+button('carrier','view','emissions','Uitstoot en ophoping',m.view==='emissions'));
  if(m.view==='emissions') {
    const a=s.models.emissionsLab, next=Math.max(0,Number(a.stock)+Number(a.emission)-Number(a.uptake));
    return section('Minder toevoegen is niet meteen minder voorraad', 'Dit is een eenvoudig voorraadmodel. Eerst komt er 20 bij en gaat er 10 uit. Verlaag de toevoer en kijk of de voorraad daardoor al daalt.',tab+
      `<div class="lab-controls">${slider('emissionsLab','emission','CO₂ erbij in dit speljaar',a.emission,0,30,5,'eenheden')}${slider('emissionsLab','uptake','Opname uit de lucht',a.uptake,0,30,5,'eenheden')}</div>`+
      `<div class="activity-live"><div class="activity-grid"><article class="activity-card"><h3>Voorraad nu</h3><strong>${n(a.stock)}</strong></article><article class="activity-card"><h3>Na één speljaar</h3><strong>${n(next)}</strong><p>${next>a.stock?'Groeit':next<a.stock?'Daalt':'Blijft gelijk'}</p></article></div></div>`+
      actions(button('carrier','year','','Volg één speljaar'))+
      `<p class="mini-note">Fictieve eenheden en constante opname. Een echt koolstofsysteem heeft veel meer processen. Natuurlijke opname is niet hetzelfde als menselijke CO₂-verwijdering voor netto nul.</p>`+
      `<h3>Twee routes met dezelfde einddatum</h3><div class="table-wrap"><table><thead><tr><th>Route</th><th>Jaar 1 → 5</th><th>Totaal toegevoegd</th></tr></thead><tbody><tr><th>Vroeg verminderen</th><td>40 · 30 · 20 · 10 · 0</td><td>100</td></tr><tr><th>Laat verminderen</th><td>40 · 40 · 40 · 20 · 0</td><td>140</td></tr></tbody></table></div><p>Alle getallen zijn oefenwaarden. Beide routes eindigen bij nul uitstoot, maar wat onderweg is toegevoegd verschilt.</p>`+
      actions(button('carrier','emissions','cumulative','Vroeg verminderen voegt in totaal minder toe')+button('carrier','emissions','endpoint','Dezelfde einddatum betekent dezelfde totale uitstoot'))+
      status(s.flags.emissions,'Je taak: het voorraadmodel één keer onderzoeken en de twee uitstootroutes vergelijken.')+help('carbon-budget',concepts)+note('emissions',s));
  }
  return section('Waar komt de energie echt vandaan?', 'Kies een onderdeel en plaats het bij zijn rol in deze getoonde keten. Bij waterstof is de productieroute belangrijk; waterstof maakt niet zelf nieuwe energie.',tab+
    `<div class="activity-grid">${Object.entries(ENERGY_ITEMS).map(([id,[label,desc]])=>`<article class="activity-card">${button('carrier','pick',id,label,m.selected===id)}<p>${e(desc)}</p><p class="mini-note">${m.placements[id]?`Geplaatst bij: ${e({source:'bron',carrier:'drager',storage:'opslag'}[m.placements[id]])}`:'Nog niet geplaatst'}</p></article>`).join('')}</div>`+
    `<p>Kies eerst een onderdeel hierboven, daarna een plek hieronder. Je kunt iedere plaatsing aanpassen.</p>`+actions(button('carrier','place','source','Bron')+button('carrier','place','carrier','Drager')+button('carrier','place','storage','Opslag'))+
    status(s.flags.energyCarrier,`${Object.keys(m.placements).length} van 5 onderdelen geplaatst. De controle legt een verkeerde koppeling uit.`)+actions(button('carrier','check','','Controleer de keten'))+
    details('Zijn deze rollen altijd strikt gescheiden?', '<p>De rollen hangen samen. Een brandstof kan energie dragen en waterstof kan ook opgeslagen worden. Hier vragen we naar de beschreven rol: primaire energie vóór omzetting, vervoer ná omzetting, of het apparaat dat energie voor later bewaart. De context bepaalt de koppeling.</p>')+note('carrier',s));
}

const PARTS={battery:['Batterij','De batterij is defect. Hij kan in deze casus met gereedschap worden vervangen.'],screen:['Scherm','Het scherm reageert en vertoont geen schade.'],body:['Behuizing','De behuizing is intact en open te schroeven. Een passende reservebatterij is beschikbaar.']};
function renderProduct(s, concepts) {
  const m=s.models.productLab, tab=actions(button('product','view','repair','Onderzoek en repareer',m.view==='repair')+button('product','view','life','Volg de levenscyclus',m.view==='life'));
  if(m.view==='life') {
    const lc=lifeCycle(m);
    return section('Dezelfde functie, de hele route', 'Vergelijk één werkend tablet gedurende hetzelfde aantal schooldagen. Een nieuw tablet gebruikt in deze oefening minder stroom, maar vraagt meer nieuwe productie. De R-ladder is een vertrekpunt; de omstandigheden blijven tellen.',tab+
      `<div class="lab-controls">${slider('productLab','days','Gelijke gebruiksperiode',m.days,100,1200,100,'schooldagen')}${slider('productLab','electricityFactor','Klimaatbelasting per stroomgebruik',m.electricityFactor,.5,2,.5,'factor')}${check('productLab','fullLife','Ik neem productie, vervoer, gebruik én einde gebruik mee',m.fullLife)}</div>`+
      `<div class="activity-live"><div class="table-wrap"><table><thead><tr><th>Gelijke tabletfunctie</th><th>Productie</th><th>Vervoer</th><th>Gebruik</th><th>Einde</th><th>Totaal</th></tr></thead><tbody>${[['repair','Repareren'],['replace','Nieuw aanschaffen']].map(([id,label])=>`<tr><th>${label}</th>${['manufacture','transport','use','end','total'].map(k=>`<td>${n(lc[id][k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>Dit zijn fictieve vergelijkingspunten voor <b>één klimaatindicator</b>, geen volledige LCA en geen gezondheid- of geldscore. Dezelfde functie en periode blijven in beide routes gelijk. Onderzoeksgrens: de keuze vanaf nu. De oude tablet bestaat al; de nieuwe productie is hier een reservebatterij of een nieuw apparaat.</p></div>`+
      `<h3>Welke route heeft bij jouw huidige aannames minder van deze belasting?</h3>`+actions(button('product','life','repair','Repareren')+button('product','life','replace','Nieuw aanschaffen')+button('product','life','tie','De totalen zijn gelijk'))+
      status(s.flags.ladder,'Je taak: vergelijk dezelfde functie over alle vier fasen en onderbouw met de huidige totalen.')+
      help('life-cycle-assessment',concepts)+details('Waarom niet meteen alles recyclen?', '<p>Een bruikbaar product bevat grondstoffen én gemaakte onderdelen, arbeid en kennis. Reparatie kan die waarde behouden. Recyclen bewaart materiaal en vraagt verwerking. Eerst voorkomen, slimmer gebruiken, hergebruiken en repareren onderzoeken is een nuttige vuistregel. Als een oud apparaat extreem veel energie gebruikt, kan de levenscyclusvergelijking anders uitvallen.</p>')+
      details('Wat als we dit tablet delen?', '<p>Delen kan nieuwe productie vermijden als één apparaat meerdere ongebruikte apparaten vervangt. Controleer wel extra vervoer, slijtage en gebruik. Een deelproduct dat vooral nieuw gebruik uitlokt, bespaart niet automatisch materiaal of uitstoot.</p>')+actions(button('product','sharing','','Neem het deelvraagstuk mee'))+note('life-cycle',s));
  }
  const item=PARTS[m.selected];
  return section('Niet het hele apparaat is kapot', 'Ada vraagt je de tablet te onderzoeken. De gebruiker heeft een werkend apparaat nodig; bekijk batterij, scherm en behuizing voordat je een route kiest.',tab+
    `<div class="activity-grid">${Object.entries(PARTS).map(([id,[label]])=>`<div class="activity-card">${button('product','inspect',id,`${label}${m.inspected.includes(id)?' ✓':''}`,m.selected===id)}</div>`).join('')}</div>`+
    `<div class="activity-live">${item?`<article class="activity-card"><h3>${e(item[0])}</h3><p>${e(item[1])}</p></article>`:'<p>Kies een onderdeel om te inspecteren.</p>'}</div>`+
    status(s.flags.product,`${m.inspected.length} van 3 onderdelen onderzocht. Eén reservebatterij is beschikbaar.`)+
    actions(button('product','route','repair','Schroef open en vervang alleen de batterij')+button('product','route','recycle','Verwerk het hele apparaat tot grondstoffen')+button('product','route','reuse','Geef het defecte apparaat direct opnieuw uit'))+
    help('design-for-long-life',concepts)+note('product',s));
}

function renderContract(s, concepts) {
  const m=s.models.contractLab;
  return section('Wie verdient aan langer gebruik?', 'De haven wil werkende tablets aanbieden als dienst. Stel de afspraken zo op dat de aanbieder reden heeft voor degelijk ontwerp, onderhoud en verantwoorde terugname.',
    `<div class="lab-controls">${select('contractLab','owner','Wie houdt het product in eigendom?',m.owner,[['','Kies een afspraak'],['provider','De aanbieder'],['user','Iedere leerling koopt het apparaat']])}${select('contractLab','maintenance','Wie draagt normale onderhouds- en reparatiekosten?',m.maintenance,[['','Kies een afspraak'],['provider','De aanbieder neemt onderhoud op zich'],['user','De leerling betaalt elke reparatie apart']])}${select('contractLab','payment','Waarvoor wordt de aanbieder betaald?',m.payment,[['','Kies een afspraak'],['uptime','Een werkende dienst gedurende de periode'],['usage','Bruikbare gebruiksuren, met onderhoud inbegrepen'],['replacement','Iedere nieuwe vervanging levert extra inkomsten op']])}${select('contractLab','return','Wat gebeurt er na de gebruiksperiode?',m.return,[['','Kies een afspraak'],['inspect','Terugname: eerst behoud onderzoeken, daarna materiaalroute'],['recycle','Terugname met aantoonbare materiaalverwerking'],['trash','De gebruiker moet het zelf maar weggooien']])}</div>`+
    `<div class="activity-live"><p>Eigendom: <b>${e({provider:'aanbieder',user:'leerling'}[m.owner]||'nog open')}</b> · onderhoud: <b>${e({provider:'aanbieder',user:'leerling'}[m.maintenance]||'nog open')}</b>. Het is de combinatie van afspraken die gedrag verandert; het woord lease is geen keurmerk.</p></div>`+
    actions(button('contract','check','','Bespreek en sluit de afspraak'))+help('service-ownership',concepts)+note('contract',s));
}

const CAPITAL_ITEMS={
  money:['Beschikbare financiering','Geld voor onderhoud en investeren.','financial'],
  machine:['Werkplaats en machines','Fysieke middelen om te repareren.','manufactured'],
  blueprint:['Vastgelegde reparatiemethode','Een getest ontwerp en een instructie die de organisatie kan gebruiken.','intellectual'],
  skill:['De vaardigheid van het team','Wat medewerkers kennen, kunnen en gezond kunnen uitvoeren.','human'],
  trust:['Vertrouwen en samenwerking','De school en leveranciers durven samen afspraken aan.','social'],
  water:['Schoon water en grondstoffen','De natuurlijke basis waarvan productie en omgeving afhankelijk zijn.','natural']
};
const CAPITAL_NAMES={financial:'Financieel',manufactured:'Geproduceerd',intellectual:'Intellectueel',human:'Menselijk',social:'Sociaal en relationeel',natural:'Natuurlijk'};
const OUTCOME_ITEMS={investment:['Onderhoudsbudget en teamkennis worden ingezet','input'],tablets:['De werkplaats levert 100 herstelde tablets','output'],lifedays:['Die tablets blijven aantoonbaar langer bruikbaar','outcome'],skills:['Medewerkers werken aantoonbaar vaardiger en veiliger','outcome']};
const MATERIAL_ITEMS={pollution:['Een lozing beschadigt waterleven. In dit dossier is nog geen financieel effect aangetoond.','impact'],drought:['Droogte maakt de wateraanvoer duurder en verstoort leveringen.','financial'],workers:['Onveilige werkomstandigheden schaden medewerkers én veroorzaken aantoonbaar extra uitvalkosten.','both']};
function renderValue(s, concepts) {
  const m=s.models.valueLab;
  const tab=actions(button('value','view','capitals','De zes middelen',m.view==='capitals')+button('value','view','outcomes','Producten en gevolgen',m.view==='outcomes')+button('value','view','materiality','Twee richtingen',m.view==='materiality'));
  if(m.view==='outcomes') return section('Geleverd is niet hetzelfde als veranderd', 'Je kent de middelen. Volg nu wat het proces gebruikt, wat eruit komt en wat daardoor verandert. Een productieteller bewijst nog geen langere levensduur.',tab+
    `<div class="activity-grid">${Object.entries(OUTCOME_ITEMS).map(([id,[text]])=>`<article class="activity-card">${button('value','outcome-pick',id,text,m.outcomeSelected===id)}<p>${m.outcomePlacements[id]?`Geplaatst: ${e(m.outcomePlacements[id])}`:'Kies de beschreven gebeurtenis, daarna haar plek.'}</p></article>`).join('')}</div>`+
    actions(button('value','outcome-place','input','Input · wat je inzet')+button('value','outcome-place','output','Output · wat je oplevert')+button('value','outcome-place','outcome','Outcome · wat verandert'))+
    `<div class="lab-controls">${select('valueLab','metric','Welke meting onderzoekt of de gebruiksduur echt is verlengd?',m.metric,[['','Kies een meting'],['days','Bruikbare gebruiksdagen na reparatie, vergeleken met vooraf'],['count','Alleen het aantal gemaakte reparatiebonnen'],['likes','Likes op de campagne']])}</div>`+
    actions(button('value','outcomes-check','','Controleer proces en meetplan'))+help('multiple-value-creation',concepts)+help('indicators',concepts)+note('outcomes',s));
  if(m.view==='materiality') return section('Bedrijf → wereld. Wereld → bedrijf.', 'Lees de drie beschreven situaties. Plaats wat daadwerkelijk is beschreven bij impact, financieel gevolg of beide. Ernstige impact blijft relevant wanneer financieel gevolg nog niet zichtbaar is.',tab+
    `<div class="activity-grid">${Object.entries(MATERIAL_ITEMS).map(([id,[text]])=>`<article class="activity-card">${button('value','material-pick',id,text,m.materialSelected===id)}<p>${m.materialPlacements[id]?`Geplaatst: ${e({impact:'impact op mensen en natuur',financial:'financieel gevolg voor de haven',both:'beide richtingen'}[m.materialPlacements[id]])}`:'Nog niet geplaatst'}</p></article>`).join('')}</div>`+
    actions(button('value','material-place','impact','Bedrijf → mensen en natuur')+button('value','material-place','financial','Omgeving → financiële positie')+button('value','material-place','both','Beide richtingen staan in dit dossier'))+
    check('valueLab','residents','Ik neem ook informatie van getroffen bewoners met weinig invloed mee',m.residents)+actions(button('value','material-check','','Leg het onderzoek vast'))+
    help('double-materiality',concepts)+help('stakeholder-perspectives',concepts)+note('materiality',s));
  return section('Zes soorten middelen, één haven', 'Kies een middel op de werkbank en plaats het bij het passende kapitaal. Hier zijn de voorbeelden bewust afgebakend; in echte organisaties kunnen categorieën samenhangen.',tab+
    `<div class="activity-grid">${Object.entries(CAPITAL_ITEMS).map(([id,[title,body]])=>`<article class="activity-card">${button('value','capital-pick',id,title,m.selected===id)}<p>${e(body)}</p><p class="mini-note">${m.placements[id]?`Geplaatst: ${e(CAPITAL_NAMES[m.placements[id]])}`:'Nog niet geplaatst'}</p></article>`).join('')}</div>`+
    actions(Object.entries(CAPITAL_NAMES).map(([id,label])=>button('value','capital-place',id,label)).join(''))+actions(button('value','capitals-check','','Controleer de zes koppelingen'))+
    help('six-capitals',concepts)+details('Kunnen we alles bij elkaar optellen?', '<p>Nee. Meer geld kan samengaan met minder vertrouwen of schade aan water. Benoem iedere verandering en voor wie zij telt. De zes kapitalen zijn een manier om afhankelijkheden en gevolgen te zien; niet zes financiële rekeningen.</p>')+note('capitals',s));
}

const NATURE_CLAIMS={natural:['De coating is van een plant gemaakt. Veiligheid is niet getest.','unproven'],water:['In dezelfde regenproef vangt het prototype meer water op dan het uitgangsontwerp.','shown'],restore:['Het dak produceert meer stroom dan het gebruikt. Herstel van bodem en soorten is niet onderzocht.','unproven']};
function renderBiomimicry(s, concepts) {
  const m=s.models.natureLab;
  const tab=actions(button('biomimicry','view','prototype','Van waarneming naar prototype',m.view==='prototype')+button('biomimicry','view','claims','Controleer de ontwerpclaims',m.view==='claims'));
  if(m.view==='claims') return section('Een groene naam is nog geen bewijs', 'Amir legt drie bevindingen voor. Maak onderscheid tussen een aangetoonde werking in deze proef en een claim die nog onderzocht moet worden.',tab+
    `<div class="activity-grid">${Object.entries(NATURE_CLAIMS).map(([id,[text]])=>`<article class="activity-card"><p>${e(text)}</p>${actions(button('biomimicry','claim',`${id}:shown`,'Deze beschreven werking is aangetoond',m.claims[id]==='shown')+button('biomimicry','claim',`${id}:unproven`,'Deze claim moet nog worden onderzocht',m.claims[id]==='unproven'))}</article>`).join('')}</div>`+
    actions(button('biomimicry','claims-check','','Bespreek wat het bewijs wel zegt'))+help('regenerative-design',concepts)+details('Wat zou herstel bewijzen?', '<p>Kies een beginsituatie, kijk over tijd naar passende indicatoren voor bodem, water, biodiversiteit en mensen, en controleer of er elders schade ontstaat. Minder schade is waardevol. Aangetoond herstel is een aanvullende claim.</p>')+note('nature-claims',s));
  return section('Kopieer de werking, niet alleen de vorm', 'Op een lotusblad rollen waterdruppels gemakkelijk weg. De microscopische oppervlaktestructuur en waslaag spelen daarbij een rol. Het atelier onderzoekt een oppervlak dat druppels naar een opvangrand kan laten bewegen. Onderzoek de functie, vertaal die en test onder dezelfde omstandigheden.',tab+
    `<div class="lab-controls">${select('natureLab','observation','Wat onderzoek je aan het blad?',m.observation,[['','Kies de waarneming'],['function','Hoe de oppervlaktewerking druppels laat afrollen'],['shape','Alleen de mooie buitenvorm']])}${select('natureLab','principle','Welk principe neem je mee?',m.principle,[['','Kies een principe'],['guide','Waterafstotende oppervlaktewerking helpt druppels bewegen'],['green','Alles wat natuurlijk is, is veilig']])}${select('natureLab','design','Hoe vertaal je het principe?',m.design,[['','Kies een prototype'],['channels','Een geteste oppervlaktestructuur met afvoer en opvangrand'],['leafshape','Een bladvorm zonder onderzochte oppervlaktewerking']])}</div>`+
    `<div class="activity-live"><div class="flow-diagram"><div class="activity-card">Waarnemen: functie</div><span aria-hidden="true">→</span><div class="activity-card">Vertalen: geleiding</div><span aria-hidden="true">→</span><div class="activity-card">Testen: gelijke regen</div></div><p>${m.measured?'De uitgevoerde fictieve proef vergelijkt dezelfde regenhoeveelheid en hetzelfde oppervlak; de opgevangen hoeveelheid is het resultaat.':'De test vergelijkt gelijke regen en gelijke oppervlakte. Alleen een andere vorm kiezen is nog geen resultaat.'}</p></div>`+
    actions(button('biomimicry','test','','Voer de vergelijkbare waterproef uit'))+help('biomimicry',concepts)+help('lifes-principles',concepts)+details('De biologische bron en de fictieve toepassing', '<p>Het lotusoppervlak is wetenschappelijk onderzocht: <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3148040/" target="_blank" rel="noopener">Superhydrophobicity in perfection: the outstanding properties of the lotus leaf</a>. De opvangrand en prototypeproef in dit avontuur zijn een fictief ontwerpvoorstel; het onderzoek bewijst niet dat dit complete ontwerp in de praktijk werkt.</p>')+note('biomimicry',s));
}

const RESPONSE_ITEMS={insulate:['Minder verwarmingsenergie door isolatie; het soort energie blijft gelijk.','mitigation'],catch:['Een opvangplek voorkomt dat de zware bui direct de straat instroomt.','adaptation'],cleanPower:['Dezelfde stroomfunctie vervangt fossiele opwek door een aantoonbaar lagere uitstootroute.','mitigation'],shade:['Schaduw vermindert hitteblootstelling; daardoor daalt in deze casus ook het stroomgebruik van koeling.','both']};
function renderWater(s, concepts) {
  if(s.episode===1) {
    const m=s.models.responseLab;
    return section('De oorzaak beperken of met het gevolg omgaan?', 'Je zag twee mogelijke toekomsten. Kies een ingreep en plaats het beschreven werkingsmechanisme bij de juiste richting. Sommige ingrepen doen in deze casus beide.',
      `<div class="activity-grid">${Object.entries(RESPONSE_ITEMS).map(([id,[text]])=>`<article class="activity-card">${button('water','response-pick',id,text,m.selected===id)}<p>${m.placements[id]?`Geplaatst: ${e({mitigation:'minder uitstoot',adaptation:'omgaan met gevolgen',both:'beide beschreven mechanismen'}[m.placements[id]])}`:'Kies de ingreep, daarna de richting.'}</p></article>`).join('')}</div>`+
      actions(button('water','response-place','mitigation','Minder uitstoot · mitigatie')+button('water','response-place','adaptation','Omgaan met gevolgen · adaptatie')+button('water','response-place','both','Beide mechanismen'))+actions(button('water','responses-check','','Controleer de vier ingrepen'))+
      details('Wat verandert een lokale ingreep?', '<p>Schaduw en wateropvang kunnen lokale schade verminderen. Zij veranderen niet in hun eentje de wereldtemperatuur. De twee toekomstbeelden verschillen ook in mondiale uitstoot; benoem dat afzonderlijk.</p>')+help('mitigation-adaptation',concepts)+note('responses',s));
  }
  const m=s.models.waterLab, p=rainTest({...m,swale:m.method==='swale',tank:m.method==='tank'});
  return section('Een proefveld voor water, warmte en toegang', 'De route wordt na een bui onbruikbaar. Het afvoerpunt kan in deze proef 150 liter verwerken. Ontwerp een opvangroute én een schaduwplek waar iedereen kan komen.',
    `<div class="lab-controls">${check('waterLab','shade','Maak schaduw bij de rustplek',m.shade)}${select('waterLab','method','Eén opvangvoorziening past in de beschikbare ruimte',m.method,[['none','Geen extra opvang'],['swale','Wadi: grond en planten houden tijdelijk water vast'],['tank','Tank: water tijdelijk bewaren en later gebruiken']])}${check('waterLab','access','Houd een toegankelijke, bruikbare route open',m.access)}</div>`+
    `<div class="activity-live"><div class="activity-grid"><article class="activity-card"><h3>Regen</h3><strong>${p.rain} liter</strong></article><article class="activity-card"><h3>Bodemopname + opvang</h3><strong>${p.normalInfiltration+p.retention} liter</strong></article><article class="activity-card"><h3>Naar afvoer</h3><strong>${p.runoff} liter</strong><p>Grens: 150 liter</p></article></div><p>Rustplek: ${p.shade?'schaduw':'nog blootgesteld aan zon'} · Route: ${p.accessible?'toegankelijk':'nog niet voor iedereen bruikbaar'}.</p></div>`+
    `<p class="mini-note">Fictieve veldproef: 40 mm regen op 10 m² = 400 liter. Bodemopname 80 liter; wadi houdt hier 220 vast, tank 200. Geen voorspelling voor een echte locatie. Onderhoud, bodem en regen veranderen de werking.</p>`+
    actions(button('water','field-test','','Test de route bij deze bui'))+status(s.flags.water,'Je taak: hoogstens 150 liter naar de afvoer, schaduw bij de rustplek en een toegankelijke route.')+
    help('lifes-principles',concepts)+help('regenerative-design',concepts)+note('water-field',s));
}

function renderLoop(s, concepts) {
  const m=s.models.loopLab, item=loopCases[m.caseId]||loopCases.market;
  return section('Een keten die terugwerkt op zichzelf', 'Kies een uitgelegde situatie. Bepaal bij iedere pijl wat er met het tweede onderdeel gebeurt als het eerste toeneemt. Volg daarna de hele lus.',
    actions(Object.entries(loopCases).map(([id,c])=>button('loop','case',id,c.label,m.caseId===id)).join(''))+
    `<article class="activity-card"><p>${e(item.explanation)}</p></article>`+
    `<div class="lab-controls">${item.edges.map(([from,to],index)=>select('loopLab',`sign${index}`,`${from} → ${to}`,m[`sign${index}`]||m.signs[index],[['','Kies de richting'],['+','Dezelfde richting (+)'],['-','Tegengestelde richting (−)']])).join('')}${select('loopLab','type','Wat gebeurt er na een hele ronde?',m.type,[['','Volg de verandering rond'],['reinforcing','De verandering wordt versterkt'],['balancing','De verandering wordt tegengewerkt']])}</div>`+
    `<div class="activity-live"><div class="flow-diagram">${item.nodes.map((node,i)=>`<div class="activity-card">${e(node)}</div><span aria-hidden="true">${e(m[`sign${i}`]||'?')} →</span>`).join('')}<div class="activity-card">Terug bij ${e(item.nodes[0])}</div></div></div>`+
    actions(button('loop','check','','Controleer mijn gesloten lus'))+details('Wat kun je hieruit niet afleiden?', '<p>Een gesloten lus toont een mogelijk mechanisme. Zonder sterkte, voorraden en tijd kun je niet vaststellen welke lus het hele systeem domineert. Versterkend betekent ook niet wenselijk, en dempend niet schadelijk.</p>')+
    details('Kantelpunt of alleen verandering?', '<p>Een kantelpunt is een drempel waarna een systeem sterk kan veranderen en moeilijk terugkeert. Niet iedere terugkoppeling is een kantelpunt. Exacte drempel, kans en snelheid kunnen onzeker zijn. De ijslus hier voorspelt dus geen zekere datum voor een ramp.</p>')+actions(button('loop','risk','','Neem dit onderscheid over klimaatrisico mee'))+help('causal-loop-diagram',concepts)+note('loop',s));
}

function renderDelay(s, concepts) {
  const m=s.models.delayLab, tab=actions(button('delay','view','delay','Een gevolg met vertraging',m.view==='delay')+button('delay','view','pilot','Een kleine structurele proef',m.view==='pilot'));
  if(m.view==='pilot') return section('Verander wat het probleem vasthoudt', 'Nieuwe apparatuur is niet altijd de ontbrekende stap. In deze casus blokkeren óf gesloten reparatiegegevens óf onbetrouwbare retourstromen de circulariteit. Kies een drempel en een proef die juist die drempel onderzoekt.',tab+
    `<div class="lab-controls">${select('delayLab','barrier','Welke drempel ga je onderzoeken?',m.barrier,[['','Kies de concrete drempel'],['information','Reparateurs krijgen geen onderdelengegevens'],['returns','Bruikbare afgedankte producten komen niet betrouwbaar terug']])}${select('delayLab','intervention','Wat doe je in een begrensde proef?',m.intervention,[['','Kies een ingreep'],['access','Regel onderdeleninformatie en test reparaties met gebruikers'],['returnPilot','Test terugname en kwaliteitsafspraken met school en werkplaats'],['poster','Maak alleen een algemene duurzaamheidsposter']])}${select('delayLab','metric','Welk resultaat ga je volgen?',m.metric,[['','Kies een resultaat'],['repairs','Bruikbare reparaties en resterende storingen'],['returns','Teruggekomen bruikbare producten en afkeur'],['views','Alleen hoeveel mensen de poster zien']])}${check('delayLab','pilot','Ik bespreek gevolgen met betrokken gebruikers en spreek een herzieningsmoment af',m.pilot)}</div>`+
    actions(button('delay','pilot-check','','Start de onderbouwde proef'))+help('lock-in-path-dependence',concepts)+help('leverage-points',concepts)+help('wicked-problems',concepts)+note('pilot',s));
  return section('Waarom loopt de werkvoorraad eerst op?', 'De werkplaats ontvangt vier kapotte apparaten per spelweek en kan er eerst twee repareren. Training verhoogt de capaciteit, maar wordt pas na twee weken actief. Observeer wat vóór die tijd gebeurt.',tab+
    `<div class="activity-live"><div class="activity-grid"><article class="activity-card"><h3>Spelweek</h3><strong>${m.week}</strong></article><article class="activity-card"><h3>Wachtende apparaten</h3><strong>${m.backlog}</strong></article><article class="activity-card"><h3>Capaciteit per week</h3><strong>${m.capacity}</strong></article></div><p>${m.readyWeek===null?'Training nog niet afgesproken.':m.trainingActive?'De extra capaciteit is nu actief.':`Training wordt actief in spelweek ${m.readyWeek}; het effect is nog onderweg.`}</p>${m.history.length?`<div class="table-wrap"><table><thead><tr><th>Week</th><th>Erbij</th><th>Gerepareerd</th><th>Voorraad over</th></tr></thead><tbody>${m.history.map(r=>`<tr><td>${r.week}</td><td>${r.arrived}</td><td>${r.repaired}</td><td>${r.backlog}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`+
    actions(button('delay','train','','Spreek training af',false,m.readyWeek!==null)+button('delay','tick','','Laat één spelweek verstrijken'))+
    `<p class="mini-note">Expliciet voorraadmodel: instroom 4, capaciteit eerst 2, na training +4, vertraging 2 spelweken. Dit is geen voorspelling van een echt bedrijf.</p>`+
    `<h3>Wat vertelt een stijgende voorraad tijdens de wachttijd?</h3>`+actions(button('delay','explain','delay','Het effect is nog onderweg; volg tijd én voorraad')+button('delay','explain','failure','Geen direct effect bewijst dat training nooit werkt'))+
    status(s.flags.delays,'Je taak: training afspreken, minimaal één daaropvolgende week waarnemen en het vertraagde effect verklaren.')+note('delay',s));
}

const PLAN_NAMES={refurb:'Bestaande tablets opknappen',new:'Nieuwe efficiëntere tablets',service:'Werkende tablets als dienst'};
const PLAN_BASE={refurb:180,new:280,service:320};
const PLAN_RISKS={refurb:'parts',new:'production',service:'contract'};
const TRANSFER={
  lifecycle:{question:'Een nieuwe, zeer intensief gebruikte machine: reparatie vraagt 10 productiepunten en 300 gebruikspunten; nieuw vraagt 90 productiepunten en 100 gebruikspunten. Transport en einde zijn hier gelijk. Welke klimaatvergelijking klopt?',answers:[['new','Nieuw: 190 tegenover 310; de gebruiksfase weegt hier zwaarder'],['repair','Reparatie wint altijd omdat die hoger op de R-ladder staat'],['purchase','Alleen de productie telt: 10 tegenover 90']],correct:'new'},
  energy:{question:'Een school wil alleen zonnepanelen inzetten voor avondles. Er is geen opslag- of andere leveringsroute afgesproken. Wat kun je onderbouwen?',answers:[['gap','De avondlevering is nog niet aangetoond; er ontbreekt een passende route'],['annual','Voldoende zonnestroom per jaar bewijst levering op iedere avond'],['hydrogen','Het woord waterstof maakt de ontbrekende energie vanzelf beschikbaar']],correct:'gap'},
  materiality:{question:'Een onderneming veroorzaakt ernstige schade aan waterleven. Het dossier toont nog geen groot financieel nadeel voor de onderneming. Is dit onderwerp relevant?',answers:[['impact','Ja: ernstige impact kan op zichzelf materieel zijn'],['both','Alleen wanneer de financiële score ook hoog is'],['money','Nee: er is nog geen verlies in de jaarrekening']],correct:'impact'}
};
const LABEL_STATEMENTS={measured:['In het fictieve dossier zijn 12 van 100 apparaten tijdens de proef uitgevallen.','fact'],assumed:['We rekenen erop dat geschikte onderdelen volgend jaar beschikbaar blijven.','assumption'],valued:['We willen voorkomen dat leerlingen zonder betaalmiddel buiten de regeling vallen.','value']};
function renderDecision(s, concepts) {
  const m=s.models.decisionLab, tab=actions(button('decision','view','plan','Het leveringsvoorstel',m.view==='plan')+button('decision','view','transfer','Een nieuwe situatie',m.view==='transfer')+button('decision','view','uncertainty','Feit, aanname en toets',m.view==='uncertainty'));
  if(m.view==='transfer') return section('Werkt jouw kennis ook buiten deze route?', 'Gebruik de informatie van de nieuwe casus. De uitkomst hoeft niet dezelfde te zijn als bij het eerdere tablet of de haven.',tab+
    Object.entries(TRANSFER).map(([id,q])=>`<article class="activity-card"><h3>${e(q.question)}</h3>${actions(q.answers.map(([answer,label])=>button('decision','transfer',`${id}:${answer}`,label,m.transfer[id]===answer)).join(''))}${status(m.transfer[id]===q.correct,m.transfer[id]===q.correct?'Deze redenering past bij de nieuwe gegevens.':'Nog te onderzoeken.')}</article>`).join('')+note('transfer',s));
  if(m.view==='uncertainty') return section('Wat weet je — en wat moet je nog toetsen?', 'Een keuze bevat gegevens, verwachtingen en waarden. Houd die apart. Je vrije toelichting bewaren we voor je dossier; het spel beoordeelt die tekst niet automatisch.',tab+
    Object.entries(LABEL_STATEMENTS).map(([id,[text]])=>`<article class="activity-card"><p>${e(text)}</p>${actions([['fact','Gegeven uit de proef'],['assumption','Aanname voor de toekomst'],['value','Waarde of doel']].map(([label,title])=>button('decision','label',`${id}:${label}`,title,m.labels[id]===label)).join(''))}</article>`).join('')+
    `<div class="lab-controls">${select('decisionLab','monitor','Welk toetsmoment past bij de resterende onzekerheid?',m.monitor,[['','Kies een toets'],['review','Volg uitval, werkelijk gebruik en toegang; bespreek die na de proef met betrokkenen'],['sales','Kijk alleen of de bestelling betaald is'],['future','Wacht tot het toekomstbeeld zeker is']])}</div>`+
    actions(button('decision','uncertainty-check','','Voeg de toets en onzekerheid toe'))+help('decisions-under-uncertainty',concepts)+note('final-reasoning',s,'Mijn eigen onderbouwing — feiten, afruilen en wat ik nog wil toetsen'));
  const base=PLAN_BASE[m.device]||0, total=base+(m.device==='service'?0:(m.maintenance?30:0)+(m.return?20:0))+(m.access?10:0)+(m.energy?20:0);
  return section('Een werkbare afspraak voor de school', 'De school vraagt een werkende tabletvoorziening, ook tijdens avondles. Onderhoud, toegang en terugname moeten geregeld zijn. Er zijn meerdere verdedigbare plannen; kies en onderzoek de eigen kwetsbaarheid van jouw route.',tab+
    `<div class="activity-grid">${Object.entries(PLAN_NAMES).map(([id,label])=>`<article class="activity-card"><h3>${e(label)}</h3><p>${PLAN_BASE[id]} fictieve planmiddelen${id==='service'?', inclusief normaal onderhoud en terugname':', onderhoud en terugname nog regelen'}.</p>${button('decision','device',id,'Onderzoek deze route',m.device===id)}</article>`).join('')}</div>`+
    `<div class="lab-controls">${check('decisionLab','maintenance','Regel normaal onderhoud en reparatie',m.maintenance)}${select('decisionLab','access','Hoe kunnen alle leerlingen deelnemen?',m.access,[['','Nog niet geregeld'],['school','School organiseert uitleen zonder eigen betaalmiddel'],['support','Een toegankelijke regeling met ondersteuning voor wie dat nodig heeft']])}${select('decisionLab','energy','Welke avondlevering is afgesproken?',m.energy,[['','Nog niet geregeld'],['grid','Een passende netroute met verschoven laadmomenten'],['storage','Overdag aantoonbaar geladen opslag, passend bij avondvraag'],['solar','Alleen panelen, zonder opslag of andere route']])}${check('decisionLab','return','Regel terugname met eerst onderzoek naar behoud',m.return)}${select('decisionLab','risk','Wat verdient extra onderzoek bij jouw gekozen route?',m.risk,[['','Kies de kwetsbaarheid'],['parts','Beschikbaarheid en herstelbaarheid van geschikte onderdelen'],['production','Nieuwe productie-impact tegenover lager gebruik'],['contract','Contractduur, toegang en echte verantwoordelijkheid voor onderhoud']])}</div>`+
    `<div class="activity-live"><p class="status-strip">Middelen: ${total} / 360 · ${m.device?e(PLAN_NAMES[m.device]):'Kies eerst een productroute'}</p><p>Rekenregel: onderhoud 30, terugname 20, toegankelijke uitvoering 10 en passende avondroute 20. Bij de dienst zijn onderhoud en terugname al in de basisprijs opgenomen. Dit zijn oefenwaarden, geen marktprijzen.</p></div>`+
    actions(button('decision','plan-check','','Leg het werkbare voorstel vast'))+help('decisions-under-uncertainty',concepts)+note('strategy',s,'Mijn afweging — wie merkt welke winst, welk verlies en welke onzekerheid?'));
}

export function renderActivity(kind, state, concepts = []) {
  initModels(state);
  const renderers={weather:renderWeather,heat:renderHeat,boundary:renderBoundary,power:renderPower,carrier:renderCarrier,product:renderProduct,contract:renderContract,value:renderValue,biomimicry:renderBiomimicry,water:renderWater,loop:renderLoop,delay:renderDelay,decision:renderDecision};
  return renderers[kind] ? renderers[kind](state,concepts) : section('Onderzoek', 'Deze plek heeft nog geen gekoppelde activiteit.', '');
}

function checkPlacements(items, placements, labels = {}) {
  for(const [id,item] of Object.entries(items)) {
    const correct=item.at(-1);
    if(!placements[id]) return {ok:false,message:`Plaats eerst: ${Array.isArray(item)?item[0]:id}. Kies het kaartje en daarna de bijbehorende plek.`};
    if(placements[id]!==correct) return {ok:false,message:`Kijk nog naar “${item[0]}”. In de beschreven situatie hoort dit bij ${labels[correct]||correct}. De koppeling gaat over het beschreven mechanisme, niet over een verborgen kaartnummer.`};
  }
  return {ok:true};
}

export function handleActivity(kind, action, value, state) {
  initModels(state);
  value=String(value??'');
  if(kind==='weather') {
    const m=state.models.weatherLab;
    if(action==='view' && ['day','archive'].includes(value)){m.view=value;m[value==='day'?'seenDay':'seenArchive']=true;return result(value==='day'?'Dit is het weer van één middag. Vergelijk het met de lange reeks.':'Jaarwaarden wisselen. Over deze lange wereldwijde reeks zie je een stijgend patroon.',undefined,['weather-climate']);}
    if(action==='conclude') {
      if(!m.seenDay||!m.seenArchive)return result('Bekijk eerst de middag én het meetarchief. De twee knoppen bovenaan laten de verschillende bronnen zien.',false);
      if(value!=='archive')return result('De hete middag beschrijft vandaag. Voor klimaatverandering heb je een langjarig patroon nodig; een dag alleen toont dat niet.',false);
      return finish(state,['weather'],['climate-change','weather-climate'],'Je neemt de langjarige meetreeks mee. Wereldwijde opwarming betekent niet dat iedere dag of ieder jaar warmer moet zijn.');
    }
  }
  if(kind==='heat') {
    const m=state.models.heatLab;
    if(action==='observe'){const extra=clamp(m.extra,0,2);m[extra===0?'seenBase':'seenExtra']=true;return result(extra===0?'Beginpunt bewaard: binnenkomende en uitgaande energietelling zijn eerst gelijk.':'Met extra gas verliest de aarde aanvankelijk minder warmte. Vergelijk dit met het beginpunt.',undefined,['greenhouse-energy-flow']);}
    if(action==='explain') {
      if(!m.seenBase||!m.seenExtra)return result('Bewaar één waarneming met 0 extra gas en één met 1 of 2 extra. Zo vergelijk je dezelfde opstelling met één verschil.',false);
      if(value!=='radiation')return result(value==='source'?'CO₂ maakt geen nieuwe energie. Het verandert hoe warmtestraling wordt opgenomen en uitgestraald.':'De zon blijft in deze vergelijking gelijk. De verandering zit in de uitgaande warmtestraling.',false);
      m.interpretation=value;return finish(state,['greenhouse'],['greenhouse-energy-flow','human-emissions'],'Juist: extra broeikasgas vermindert aanvankelijk het warmteverlies naar de ruimte. Fossiele verbranding voegt gas toe; het warmer geworden systeem straalt later meer warmte uit.');
    }
  }
  if(kind==='boundary') {
    const m=state.models.boundaryLab;
    if(action==='sample' && SAMPLES[value]){m.sample=value;if(!m.visited.includes(value))m.visited.push(value);return result(SAMPLES[value].body,undefined,value==='habitat'?['biodiversity-services']:value==='village'?['climate-impact-chain','people-planet-prosperity']:['nutrients-water']);}
    if(action==='conclude') {
      const missing=['field','lake','village'].filter(id=>!m.visited.includes(id));
      if(missing.length)return result(`Onderzoek nog: ${missing.map(id=>SAMPLES[id].title).join(', ')}. Je moet bron, mechanisme en getroffen groep kunnen verbinden.`,false);
      if(m.scale!=='chain')return result('Alleen het meer bekijken mist de afspoeling op het veld en de gevolgen voor bewoners. Neem die keten en de tijd mee in je onderzoeksgrens.',false);
      if(m.plan!=='source')return result(m.plan==='move'?'Afvoer verplaatsen kan schade bij een andere groep leggen. De oorzaak verdwijnt daarmee niet.':'Alleen zichtbare algen wegwerken onderzoekt de bron niet. Combineer minder afspoeling, herstel en kennis van de getroffen mensen.',false);
      return finish(state,['boundaries'],['planetary-boundaries','nutrients-water','biodiversity-services','system-boundary','sustainable-development','people-planet-prosperity','climate-impact-chain'],'Je volgt oorzaak én gevolg over de keten. Gezond water, inkomen en toegang hangen samen; klimaat alleen vertelt niet of alle natuurgrenzen worden gerespecteerd.');
    }
  }
  if(kind==='power' && action==='run') {
    const m=state.models.powerLab,p=energyPlan(m);m.tested=true;
    state.trials.power ||= [];state.trials.power.push({solar:p.solar,wind:p.wind,battery:p.battery,efficiency:p.efficiency,ready:p.ready});state.trials.power=state.trials.power.slice(-20);
    if(!p.budgetOK)return result(`Je plan kost ${n(p.cost)} planmiddelen; beschikbaar zijn 36. Kies welke combinatie genoeg toevoegt zonder alles maximaal te bouwen.`,false,['energy-transition']);
    const bad=p.rows.find(row=>row.shortage>1e-7||row.gridOverload>1e-7);
    if(bad)return result(bad.gridOverload>0?`${bad.label}: de vraag vraagt ${n(bad.delivered)} kW door een kabel van maximaal 50 kW. Verlaag hier de vraag binnen die vaste kabelgrens. Meer zon of een grotere accu vergroot deze kabel niet.`:`${bad.label}: er ontbreekt ${n(bad.shortage)} kW. De accu kan alleen leveren wat eerder werkelijk is geladen. Kijk naar opwek, eerdere overschotten, inhoud en vraag.`,false,['energy-transition','grid-congestion']);
    return finish(state,['power'],['energy-transition','grid-congestion'],'Het plan werkt in alle drie gekozen periodes, binnen de kabelgrens en het budget. Opslag verplaatst eerder opgewekte energie. Dit bewijst de oefencasus, geen betrouwbaarheid voor een heel jaar.');
  }
  if(kind==='carrier') {
    const m=state.models.carrierLab,a=state.models.emissionsLab;
    if(action==='view'&&['sort','emissions'].includes(value)){m.view=value;return result(value==='emissions'?'Onderzoek toevoer, opname en voorraad; de twee uitstootroutes eindigen hetzelfde maar tellen anders op.':'Plaats ieder onderdeel bij zijn beschreven rol.',undefined);}
    if(action==='pick'&&ENERGY_ITEMS[value]){m.selected=value;return result(`Kies nu de rol voor ${ENERGY_ITEMS[value][0]}.`,undefined);}
    if(action==='place'&&['source','carrier','storage'].includes(value)){if(!ENERGY_ITEMS[m.selected])return result('Kies eerst een onderdeel van de keten.',false);const name=ENERGY_ITEMS[m.selected][0];m.placements[m.selected]=value;m.selected='';return result(`${name} geplaatst. Kies nu een volgend onderdeel, of kies een eerder kaartje om het te verplaatsen.`,undefined);}
    if(action==='check'){const test=checkPlacements(ENERGY_ITEMS,m.placements,{source:'bron',carrier:'drager',storage:'opslag'});if(!test.ok)return result(test.message,false);return finish(state,['energyCarrier'],['energy-transition'],'De rollen kloppen voor deze keten. Waterstof is eerst met energie gemaakt en draagt die vervolgens; de productieroute bepaalt mede de uitstoot.');}
    if(action==='year'){const before=Number(a.stock);a.stock=Math.max(0,before+Number(a.emission)-Number(a.uptake));a.currentYear+=1;a.history.push({year:a.currentYear,emission:Number(a.emission),uptake:Number(a.uptake),stock:a.stock});a.history=a.history.slice(-20);return result(`Er komt ${n(a.emission)} bij en gaat ${n(a.uptake)} uit. De voorraad gaat van ${n(before)} naar ${n(a.stock)}. Minder toevoer is niet automatisch een dalende voorraad.`,undefined,['emissions-accumulation']);}
    if(action==='emissions'){if(!a.history.length)return result('Gebruik “Volg één speljaar” om toevoer en voorraad eerst in werking te zien. Eén waarneming is voldoende; er is geen verborgen proef-aantal.',false);if(value!=='cumulative')return result('Tel de vijf jaren op: vroeg 100, laat 140. Dezelfde einddatum wist eerdere uitstoot niet uit. Een koolstofbudget gaat juist over de totale hoeveelheid, onder bepaalde aannames.',false);a.compared=true;return finish(state,['emissions'],['emissions-accumulation','carbon-budget'],'Vroeg verminderen voegt in deze vergelijking minder CO₂ toe. Een resterend koolstofbudget is een schatting bij een temperatuurdoel, begindatum, kans en overige aannames; geen gegarandeerde ruimte.');}
  }
  if(kind==='product') {
    const m=state.models.productLab;
    if(action==='view'&&['repair','life'].includes(value)){m.view=value;return result(value==='life'?'Houd functie en periode gelijk. Vergelijk alle fasen, niet alleen de aanschaf.':'Inspecteer de drie onderdelen voordat je ingrijpt.',undefined);}
    if(action==='inspect'&&PARTS[value]){m.selected=value;if(!m.inspected.includes(value))m.inspected.push(value);return result(PARTS[value][1],undefined,['design-for-long-life']);}
    if(action==='route'){if(['battery','screen','body'].some(id=>!m.inspected.includes(id)))return result('Inspecteer batterij, scherm en behuizing. De route moet aansluiten op de toestand van het product.',false);m.route=value;if(value!=='repair')return result(value==='reuse'?'De gebruiker heeft een werkend tablet nodig. Direct opnieuw uitgeven laat de defecte batterij zitten.':'Recycling kan nodig zijn, maar hier zijn scherm en behuizing bruikbaar en is reparatie mogelijk. Behoud eerst die gemaakte onderdelen.',false);return finish(state,['product'],['linear-circular','r-ladder','design-for-long-life'],'Je vervangt alleen het defecte onderdeel. Het bruikbare product, de gemaakte onderdelen en veel eerdere arbeid blijven behouden.');}
    if(action==='life'){if(!m.fullLife)return result('Neem productie, vervoer, gebruik en einde gebruik mee. Vink de volledige vergelijking aan; anders kan een ontbrekende fase je conclusie veranderen.',false);const lc=lifeCycle(m);m.conclusion=value;if(value!==lc.lower)return result(`Bij de huidige aannames: reparatie ${n(lc.repair.total)}, nieuw ${n(lc.replace.total)}. Kijk naar de totalen voor dezelfde ${lc.days} schooldagen. Een R-voorkeur is geen automatische uitkomst.`,false);return finish(state,['ladder'],['r-ladder','life-cycle-assessment','system-boundary'],`De vergelijking klopt bij deze aannames: reparatie ${n(lc.repair.total)}, nieuw ${n(lc.replace.total)}. Andere gebruiksduur of stroomimpact kan de uitkomst veranderen; sociale en financiële gevolgen vragen aanvullend onderzoek.`);}
    if(action==='sharing')return result('Delen bespaart wanneer het werkelijk nieuw bezit of productie vervangt. Neem ook extra gebruik, vervoer en slijtage mee; alleen het woord delen bewijst geen winst.',undefined,['sharing-and-rebound']);
  }
  if(kind==='contract' && action==='check') {
    const m=state.models.contractLab;
    if(!m.owner||!m.maintenance||!m.payment||!m.return)return result('Vul de vier afspraken in: eigendom, onderhoudskosten, betaling en terugname. Ze moeten samen de prikkel verklaren.',false);
    if(m.owner!=='provider'||m.maintenance!=='provider')return result('Voor deze product-als-dienstopdracht houdt de aanbieder eigendom en draagt hij normale onderhoudskosten. Een degelijk product bespaart hem dan kosten. Een los lease-etiket regelt dat niet.',false);
    if(!['uptime','usage'].includes(m.payment))return result('Betaling per nieuwe vervanging kan juist vervanging belonen. Koppel de betaling hier aan een werkende dienst of bruikbaar gebruik met onderhoud.',false);
    if(!['inspect','recycle'].includes(m.return))return result('Leg terugname en verwerking vast. Als de gebruiker het zelf moet weggooien, blijft de beloofde ketenverantwoordelijkheid open.',false);
    return finish(state,['ownership'],['service-ownership'],`De prikkel is verklaard: de aanbieder verdient aan de dienst en draagt onderhoud en terugname. ${m.return==='recycle'?'Je regelt materiaalverwerking; onderzoek bij bruikbare producten ook eerst behoud.':'Eerst behoud onderzoeken past bij de bruikbare productwaarde.'} Controleer daarnaast toegang en werkelijk gebruik.`);
  }
  if(kind==='value') {
    const m=state.models.valueLab;
    if(action==='view'&&['capitals','outcomes','materiality'].includes(value)){m.view=value;return result('Je kunt tussen de drie onderzoeken wisselen; eerdere plaatsingen blijven bewaard.',undefined);}
    const maps={ 'capital-pick':[CAPITAL_ITEMS,'selected'],'outcome-pick':[OUTCOME_ITEMS,'outcomeSelected'],'material-pick':[MATERIAL_ITEMS,'materialSelected'] };
    if(maps[action]){const [items,key]=maps[action];if(items[value]){m[key]=value;return result('Kaartje gekozen. Kies nu de plek die past bij de beschreven situatie.',undefined);}}
    const places={ 'capital-place':['selected','placements',Object.keys(CAPITAL_NAMES)],'outcome-place':['outcomeSelected','outcomePlacements',['input','output','outcome']],'material-place':['materialSelected','materialPlacements',['impact','financial','both']] };
    if(places[action]){const [key,container,allowed]=places[action];if(!m[key])return result('Kies eerst een kaartje hierboven.',false);if(allowed.includes(value)){m[container][m[key]]=value;m[key]='';return result('Koppeling bewaard. Kies een volgend kaartje, of kies een eerder kaartje opnieuw om het te verplaatsen.',undefined);}}
    if(action==='capitals-check'){const test=checkPlacements(CAPITAL_ITEMS,m.placements,CAPITAL_NAMES);if(!test.ok)return result(test.message,false);return finish(state,['capitals'],['six-capitals','multiple-value-creation'],'De zes middelen zijn zichtbaar. Een verandering kan het ene kapitaal versterken en het andere aantasten; het zijn geen zes geldrekeningen.');}
    if(action==='outcomes-check'){const test=checkPlacements(OUTCOME_ITEMS,m.outcomePlacements,{input:'wat het proces inzet',output:'wat het proces oplevert',outcome:'wat daardoor verandert'});if(!test.ok)return result(test.message,false);if(m.metric!=='days')return result('Een reparatiebon is een activiteitenteller. Om langere levensduur te onderzoeken volg je werkelijk bruikbare gebruiksdagen, met een vergelijkingspunt.',false);return finish(state,['outcomes'],['multiple-value-creation','indicators'],'Input, output en gevolgen zijn onderscheiden. Je meet niet alleen hoeveel je doet, maar wat daardoor verandert. Ook een gunstige waarde per tablet moet naast de totale impact worden bekeken.');}
    if(action==='material-check'){const test=checkPlacements(MATERIAL_ITEMS,m.materialPlacements,{impact:'impact op mensen en natuur',financial:'financiële gevolgen voor de haven',both:'beide beschreven richtingen'});if(!test.ok)return result(test.message,false);if(!m.residents)return result('Neem ook kennis van getroffen bewoners mee. Weinig invloed betekent niet dat hun gezondheid of informatie weinig telt.',false);return finish(state,['materiality'],['double-materiality','stakeholder-perspectives'],'Beide richtingen zijn onderzocht. Ernstige impact kan relevant zijn zonder al aantoonbaar financieel nadeel; een lage score aan één kant wist de andere kant niet uit.');}
  }
  if(kind==='biomimicry') {
    const m=state.models.natureLab;
    if(action==='view'&&['prototype','claims'].includes(value)){m.view=value;return result('Je onderzoekt werking én de grenzen van de ontwerpclaim.',undefined);}
    if(action==='test'){if(m.observation!=='function')return result('Onderzoek hoe de oppervlaktewerking druppels laat afrollen. Alleen de buitenvorm observeren geeft nog geen werkend ontwerpprincipe.',false);if(m.principle!=='guide')return result('Vertaal het werkingsmechanisme. “Natuurlijk is veilig” is geen bewezen principe; natuurlijke stoffen kunnen ook schadelijk zijn.',false);if(m.design!=='channels')return result('Maak een ontwerp dat de gevonden functie uitvoert. Een bladvorm zonder onderzochte oppervlaktewerking test die functie niet.',false);m.measured=true;return finish(state,['biomimicry'],['biomimicry','lifes-principles'],'Je vertaalt een functie naar een testbaar ontwerp en houdt regen en oppervlakte gelijk. De fictieve proef toont de waterwerking in deze casus; veiligheid en ecologische gevolgen zijn aparte vragen.');}
    if(action==='claim'){const [id,label]=value.split(':');if(NATURE_CLAIMS[id]&&['shown','unproven'].includes(label)){m.claims[id]=label;return result('Beoordeling bewaard. Controleer straks iedere claim aan het beschreven bewijs.',undefined);}}
    if(action==='claims-check'){const test=checkPlacements(NATURE_CLAIMS,m.claims,{shown:'een aangetoonde werking in deze proef',unproven:'een claim die nog onderzocht moet worden'});if(!test.ok)return result(test.message,false);return finish(state,['natureLimits'],['regenerative-design','lifes-principles'],'Je begrenst de claims. Wateropvang is in deze proef aangetoond. Natuurlijke herkomst bewijst geen veiligheid, en extra energie bewijst geen herstel van bodem of biodiversiteit.');}
  }
  if(kind==='water') {
    if(state.episode===1){const m=state.models.responseLab;if(action==='response-pick'&&RESPONSE_ITEMS[value]){m.selected=value;return result('Kies nu welke richting het beschreven mechanisme heeft.',undefined);}if(action==='response-place'&&['mitigation','adaptation','both'].includes(value)){if(!m.selected)return result('Kies eerst een ingreep hierboven.',false);m.placements[m.selected]=value;m.selected='';return result('Koppeling bewaard. Kies nu een volgende ingreep, of wijzig een eerdere door haar opnieuw te kiezen.',undefined);}if(action==='responses-check'){const test=checkPlacements(RESPONSE_ITEMS,m.placements,{mitigation:'minder uitstoot (mitigatie)',adaptation:'omgaan met gevolgen (adaptatie)',both:'beide beschreven mechanismen'});if(!test.ok)return result(test.message,false);return finish(state,['responses'],['mitigation-adaptation','climate-impact-chain'],'De ingrepen zijn verklaard. Minder uitstoot beperkt verdere opwarming; aanpassing vermindert blootstelling en schade. Lokaal beschermen is geen garantie voor een andere wereldtemperatuur.');}}
    if(action==='field-test'){const m=state.models.waterLab,p=rainTest({...m,swale:m.method==='swale',tank:m.method==='tank'});m.tested=true;if(p.runoff>150)return result(`Er gaat ${p.runoff} liter naar een afvoer die 150 kan verwerken. Kies een opvangvoorziening; controleer waar het water tijdelijk blijft.`,false,['lifes-principles']);if(!p.shade)return result('Het waterdeel werkt, maar de rustplek mist nog schaduw. Lokale warmte en gebruik tellen ook mee.',false);if(!p.accessible)return result('Water en schaduw zijn geregeld, maar een toegankelijke route ontbreekt. Een ontwerp moet ook bruikbaar zijn voor de betrokken mensen.',false);return finish(state,['water'],['lifes-principles','regenerative-design','mitigation-adaptation'],`De proef werkt: ${p.runoff} liter naar de afvoer, schaduw en toegang. Voor een herstelclaim moet je daarna bodem, soorten en gebruik over tijd onderzoeken. Deze test alleen bewijst nog geen regeneratie.`);}
  }
  if(kind==='loop') {
    const m=state.models.loopLab;
    if(action==='case'&&loopCases[value]){m.caseId=value;m.signs=['','',''];delete m.sign0;delete m.sign1;delete m.sign2;m.type='';return result(loopCases[value].explanation,undefined);}
    if(action==='check'){const signs=[0,1,2].map(i=>m[`sign${i}`]||m.signs[i]);const test=validateLoop(m.caseId,signs,m.type);if(!test.ready)return result(test.message,false);m.signs=signs;return finish(state,['loop'],['systems-thinking','causal-loop-diagram',...(m.caseId==='climate'?['climate-feedback']:[])],test.message+' Welke lus het hele systeem domineert, kun je hier nog niet vaststellen.');}
    if(action==='risk'){m.inspectedClimate=true;return result('Een terugkoppeling is niet automatisch een kantelpunt. Bij een kantelpunt kunnen herstelbaarheid, drempel en tijd onzeker zijn. Het risico serieus nemen vraagt geen verzonnen zekere datum.',undefined,['climate-feedback','tipping-points']);}
  }
  if(kind==='delay') {
    const m=state.models.delayLab;
    if(action==='view'&&['delay','pilot'].includes(value)){m.view=value;return result('Kies een waarneming of een structurele proef. Je eerdere onderzoek blijft bewaard.',undefined);}
    if(action==='train'){if(m.readyWeek!==null)return result('De training is al afgesproken; het afgesproken effect blijft onderweg of is al actief.',undefined,[],false);m.readyWeek=m.week+2;return result(`Training afgesproken: extra capaciteit wordt actief in spelweek ${m.readyWeek}. Kijk eerst naar wat de voorraad tijdens de wachttijd doet.`,undefined);}
    if(action==='tick'){const r=advanceWorkshop(m);return result(`Week ${r.week}: 4 erbij, ${r.repaired} gerepareerd, ${r.backlog} over. ${m.trainingActive?'Training is actief.':m.readyWeek!==null?'Het trainingseffect is nog onderweg.':'Er is nog geen extra capaciteit afgesproken.'}`,undefined,['systems-thinking']);}
    if(action==='explain'){if(m.readyWeek===null)return result('Spreek eerst training af. De vertraging moet bij een concrete ingreep horen.',false);if(!m.history.some(r=>r.week>=m.readyWeek-1))return result('Laat één week na de trainingsafspraak verstrijken. Dan kun je de voorraad tijdens de wachttijd zien.',false);if(value!=='delay')return result('Geen direct effect bewijst geen mislukking: de extra capaciteit wordt pas na twee weken actief. Vergelijk de tijdlijn met de voorraad.',false);m.explanation=value;return finish(state,['delays'],['systems-thinking','causal-loop-diagram'],'Je onderscheidt de ingreep van haar vertraagde effect. Een stijgende voorraad vóór de extra capaciteit actief is, vraagt volgen en interpreteren, niet automatisch steeds een nieuwe ingreep.');}
    if(action==='pilot-check'){const match={information:['access','repairs'],returns:['returnPilot','returns']}[m.barrier];if(!match)return result('Kies eerst de concrete drempel: gesloten reparatieinformatie of onbetrouwbare retourstromen.',false);if(m.intervention!==match[0])return result(m.barrier==='information'?'De drempel is toegang tot reparatiegegevens. Een proef met die gegevens en echte reparaties raakt het mechanisme; een poster opent de gegevens niet.':'De drempel is betrouwbare terugname. Test materiaalstroom en kwaliteitsafspraken; algemene aandacht alleen maakt bruikbare toevoer niet zeker.',false);if(m.metric!==match[1])return result('Volg het resultaat dat bij jouw proef hoort: bruikbare reparaties of bruikbare terugname, inclusief wat uitvalt. Alleen bereik is geen bewijs van systeemverandering.',false);if(!m.pilot)return result('Bespreek gevolgen met de betrokken gebruikers en leg een herzieningsmoment vast. Bij een wicked problem is de eerste ingreep geen gegarandeerde eindoplossing.',false);return finish(state,['wicked'],['wicked-problems','lock-in-path-dependence','leverage-points','stakeholder-perspectives'],'Je pakt een concrete structuur aan, volgt een passend resultaat en maakt bijsturen mogelijk. Er zijn twee geldige proefroutes; geen interventie garandeert dat alle conflicten verdwijnen.');}
  }
  if(kind==='decision') {
    const m=state.models.decisionLab;
    if(action==='view'&&['plan','transfer','uncertainty'].includes(value)){m.view=value;return result('Je voorstel, toepassing en onzekerheden blijven apart bewaard.',undefined);}
    if(action==='device'&&PLAN_NAMES[value]){m.device=value;return result(`${PLAN_NAMES[value]} gekozen. Onderzoek nu de voorwaarden en de eigen kwetsbaarheid van deze route.`,undefined);}
    if(action==='plan-check'){if(!PLAN_NAMES[m.device])return result('Kies eerst een productroute. Geen van de drie routes is op zichzelf de moreel juiste keuze.',false);if(m.device!=='service'&&!m.maintenance)return result('Regel onderhoud; een levering alleen houdt de tablets niet werkend. Bij de dienstroute is onderhoud al opgenomen.',false);if(!['school','support'].includes(m.access))return result('Regel deelname zonder dat een eigen betaalmiddel een noodzakelijke toegangsdrempel is.',false);if(!['grid','storage'].includes(m.energy))return result('Alleen panelen bewijzen geen levering tijdens avondles. Kies een passende netroute of aantoonbaar geladen opslag die bij de vraag past.',false);if(m.device!=='service'&&!m.return)return result('Regel terugname en onderzoek naar behoud, in plaats van de materiaalroute open te laten.',false);if(m.risk!==PLAN_RISKS[m.device])return result(`Onderzoek de eigen kwetsbaarheid van ${PLAN_NAMES[m.device]}: ${m.device==='refurb'?'geschikte onderdelen en herstelbaarheid':m.device==='new'?'productie-impact tegenover lager gebruik':'contract, toegang en echte onderhoudsverantwoordelijkheid'}.`,false);const total=PLAN_BASE[m.device]+(m.device==='service'?0:30+20)+10+20;if(total>360)return result(`Deze ingevulde uitvoering vraagt ${total} middelen; de casus biedt 360. Herzie de combinatie.`,false);return finish(state,['strategy'],['decisions-under-uncertainty','multiple-value-creation','service-ownership'],`Het voorstel is binnen de voorwaarden werkbaar (${total} / 360 middelen). Dat bewijst niet dat het voor iedereen het beste plan is. Jouw vrije afweging blijft in het dossier voor gesprek en beoordeling.`);}
    if(action==='transfer'){const [id,answer]=value.split(':');const q=TRANSFER[id];if(!q||!q.answers.some(([a])=>a===answer))return result('Kies een antwoord uit de nieuwe casus.',false);m.transfer[id]=answer;if(answer!==q.correct)return result(id==='lifecycle'?'Tel de volledige vergelijking op: 310 tegenover 190. De R-ladder is een vuistregel, geen vervanging van de gebruiksfase.':id==='energy'?'Het moment van levering telt. Jaarproductie en de naam van een drager bewijzen de ontbrekende avondroute niet.':'Impactmaterialiteit kan zelfstandig voldoende relevant zijn. Een financieel effect is niet altijd eerst nodig.',false);if(Object.entries(TRANSFER).every(([key,item])=>m.transfer[key]===item.correct))return finish(state,['transfer'],['life-cycle-assessment','grid-congestion','double-materiality','decisions-under-uncertainty'],'Je past de kennis op gewijzigde gegevens toe. Een nieuwe situatie kan een andere conclusie geven; dezelfde redeneringswijze blijft nodig.');return result('Deze redenering past bij de nieuwe casus. Onderzoek ook de resterende vragen op dit scherm.',true,['decisions-under-uncertainty']);}
    if(action==='label'){const [id,label]=value.split(':');if(LABEL_STATEMENTS[id]&&['fact','assumption','value'].includes(label)){m.labels[id]=label;return result('Koppeling bewaard. Gegeven, verwachting en doel hebben ieder een andere rol in je besluit.',undefined);}}
    if(action==='uncertainty-check'){const test=checkPlacements(LABEL_STATEMENTS,m.labels,{fact:'het gegeven in dit fictieve proefverslag',assumption:'een aanname die later anders kan blijken',value:'een doel of waarde die je wilt beschermen'});if(!test.ok)return result(test.message,false);if(m.monitor!=='review')return result('Controleer werking, uitval en toegang na de proef, samen met betrokkenen. Een betaalde bestelling of een zeker toekomstbeeld vervangt dat niet.',false);return finish(state,['uncertainty'],['decisions-under-uncertainty','indicators'],'Je houdt bewijs, aanname en waarde uit elkaar en kiest een toetsmoment. De toekomsten zijn scenario’s, geen voorspellingen. Je vrije onderbouwing is bewaard en wordt niet automatisch inhoudelijk beoordeeld.');}
  }
  return result('Deze handeling is hier niet beschikbaar. Je voortgang is niet veranderd.',undefined,[],false);
}
