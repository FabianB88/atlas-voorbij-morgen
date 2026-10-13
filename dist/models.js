// Teaching models are illustrative, not calibrated forecasts. Assumptions live beside each control.
export function climate(extra){return {sun:100,initialOutgoing:100-Number(extra)*8,initialImbalance:Number(extra)*8};}
export function loopKind(edges){if(!edges.length)return 'open';const starts=edges.map(e=>e.from),ends=edges.map(e=>e.to);if(!ends.every(n=>starts.includes(n))||!starts.every(n=>ends.includes(n)))return 'open';let at=edges[0].from,seen=new Set();while(!seen.has(at)){seen.add(at);const edge=edges.find(e=>e.from===at);if(!edge)return 'open';at=edge.to;}if(at!==edges[0].from||seen.size!==edges.length)return 'open';return edges.reduce((p,e)=>p*(e.sign==='-'?-1:1),1)>0?'reinforcing':'balancing';}
export function routeReady(s,id){return {
 climate:s.flags.weather&&s.flags.greenhouse,
 futures:s.visits.includes('pressure')&&s.visits.includes('recovery')&&s.flags.responses&&s.flags.boundaries,
 energy:s.flags.power&&s.flags.energyCarrier&&s.flags.emissions,
 circular:s.flags.product&&s.flags.ownership&&s.flags.ladder,
 value:s.flags.capitals&&s.flags.materiality&&s.flags.outcomes,
 nature:s.flags.biomimicry&&s.flags.water&&s.flags.natureLimits,
 system:s.flags.loop&&s.flags.delays&&s.flags.wicked,
 decision:s.flags.strategy&&s.flags.transfer&&s.flags.uncertainty
 }[id]===true;
}
