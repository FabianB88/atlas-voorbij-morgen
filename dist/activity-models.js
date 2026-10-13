// These are teaching models with visible assumptions, not calibrated forecasts.
export const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));

export function energyPlan(values = {}) {
  const solar = clamp(values.solar, 0, 90), wind = clamp(values.wind, 0, 90);
  const battery = clamp(values.battery, 0, 120), efficiency = clamp(values.efficiency, 0, 30);
  const demand = 60 - efficiency;
  const cost = solar / 5 + wind * .3 + battery / 20 + efficiency * .2;
  // Three representative one-hour periods. No initial stored energy and no free recharging.
  // Losses and detailed grid dynamics are deliberately omitted and stated in the activity.
  const periods = [
    { id: 'day', label: 'Zon en wind', sun: 1, wind: 1 },
    { id: 'night', label: 'Donker, minder wind', sun: 0, wind: .4 },
    { id: 'calm', label: 'Windstil, weinig zon', sun: .3, wind: 0 }
  ];
  let stored = 0;
  const rows = periods.map(period => {
    const generated = solar * period.sun + wind * period.wind;
    const surplus = Math.max(0, generated - demand);
    const charge = Math.min(surplus, Math.max(0, battery - stored));
    const discharge = Math.min(stored, Math.max(0, demand - generated));
    stored += charge - discharge;
    const shortage = Math.max(0, demand - generated - discharge);
    // Only useful output crosses this illustrative local delivery cable.
    const delivered = Math.min(demand, generated + discharge);
    return { ...period, generated, demand, charge, discharge, stored, shortage, delivered,
      curtailed: Math.max(0, surplus - charge), gridOverload: Math.max(0, delivered - 50) };
  });
  const budgetOK = cost <= 36 + 1e-7;
  return { solar, wind, battery, efficiency, cost, budget: 36, demand, gridLimit: 50,
    rows, budgetOK, ready: budgetOK && rows.every(row => row.shortage < 1e-7 && row.gridOverload < 1e-7) };
}

export function lifeCycle(values = {}) {
  const days = clamp(values.days, 100, 1200, 100);
  const electricityFactor = clamp(values.electricityFactor, .5, 2, 1);
  // Invented comparison units for ONE climate indicator, equal function, equal period.
  const repair = { manufacture: 20, transport: 5, use: days * .3 * electricityFactor, end: 5 };
  const replace = { manufacture: 100, transport: 5, use: days * .2 * electricityFactor, end: 10 };
  const total = row => row.manufacture + row.transport + row.use + row.end;
  repair.total = total(repair); replace.total = total(replace);
  return { days, electricityFactor, repair, replace,
    lower: Math.abs(repair.total - replace.total) < .001 ? 'tie' : repair.total < replace.total ? 'repair' : 'replace' };
}

export function rainTest(values = {}) {
  // 40 mm on a 10 m² test patch = 400 litres. Fixed field assumptions, not a hydrological forecast.
  const rain = 400, normalInfiltration = 80;
  const retention = values.swale ? 220 : values.tank ? 200 : 0;
  const runoff = Math.max(0, rain - normalInfiltration - retention);
  return { rain, normalInfiltration, retention, runoff, drainCapacity: 150,
    shade: values.shade === true, accessible: values.access === true,
    ready: runoff <= 150 && values.shade === true && values.access === true };
}

export function advanceWorkshop(model) {
  model.week = Math.max(0, Math.trunc(Number(model.week)) || 0) + 1;
  model.backlog = Math.max(0, Number(model.backlog) || 0);
  model.capacity = Math.max(0, Number(model.capacity) || 2);
  if (Number.isFinite(model.readyWeek) && model.week >= model.readyWeek && !model.trainingActive) {
    model.capacity += 4; model.trainingActive = true;
  }
  const repaired = Math.min(model.backlog + 4, model.capacity);
  model.backlog = Math.max(0, model.backlog + 4 - repaired);
  model.history ||= [];
  model.history.push({ week: model.week, arrived: 4, repaired, backlog: model.backlog, capacity: model.capacity });
  model.history = model.history.slice(-12);
  return model.history.at(-1);
}

export const loopCases = {
  market: {
    label: 'De recyclingmarkt', nodes: ['Vraag', 'Investering', 'Kwaliteit'],
    explanation: 'In deze casus stimuleert meer vraag nieuwe investering. Investering kan de kwaliteit verbeteren. Hogere kwaliteit maakt het materiaal aantrekkelijker en vergroot de vraag. Prijs en beschikbaar materiaal blijven voor deze oefening gelijk.',
    edges: [['Vraag', 'Investering', '+'], ['Investering', 'Kwaliteit', '+'], ['Kwaliteit', 'Vraag', '+']], type: 'reinforcing'
  },
  water: {
    label: 'Reageren op watertekort', nodes: ['Watertekort', 'Besparingsactie', 'Watergebruik'],
    explanation: 'In deze casus leidt meer watertekort tot meer besparingsactie. Die actie vermindert het gebruik, wat het tekort vermindert. Beschikbare watertoevoer blijft gelijk.',
    edges: [['Watertekort', 'Besparingsactie', '+'], ['Besparingsactie', 'Watergebruik', '-'], ['Watergebruik', 'Watertekort', '+']], type: 'balancing'
  },
  climate: {
    label: 'Zee-ijs en opwarming', nodes: ['Temperatuur', 'Zee-ijs', 'Opgenomen zonlicht'],
    explanation: 'Meer opwarming vermindert zee-ijs. Minder wit ijs betekent meer donker water en meer opname van zonlicht. Die energie versterkt de opwarming. Dit is één mechanisme, niet een complete klimaatvoorspelling.',
    edges: [['Temperatuur', 'Zee-ijs', '-'], ['Zee-ijs', 'Opgenomen zonlicht', '-'], ['Opgenomen zonlicht', 'Temperatuur', '+']], type: 'reinforcing'
  }
};

export function validateLoop(caseId, signs = [], type) {
  const item = loopCases[caseId];
  if (!item) return { ready: false, message: 'Kies eerst een van de drie uitgelegde situaties.' };
  const wrong = item.edges.findIndex((edge, index) => signs[index] !== edge[2]);
  if (wrong >= 0) {
    const [from, to, sign] = item.edges[wrong];
    return { ready: false, message: `${from} → ${to}: kijk naar de beschreven werking. Deze relatie werkt ${sign === '+' ? 'in dezelfde richting (+)' : 'in tegengestelde richting (−)'}. Dat zegt niets over goed of slecht.` };
  }
  if (type !== item.type) return { ready: false, message: 'Volg een verandering helemaal rond de lus. Komt zij versterkt terug of wordt zij tegengewerkt? De plus- en mintekens zijn richtingen, geen waardeoordeel.' };
  return { ready: true, message: item.type === 'reinforcing' ? 'De verandering keert versterkt terug. De keten is gesloten: dit is een versterkende terugkoppeling.' : 'De tegenreactie vermindert de eerste verandering. De keten is gesloten: dit is een dempende terugkoppeling.' };
}
