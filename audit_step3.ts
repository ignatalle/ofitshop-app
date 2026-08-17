import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findMatch() {
  const { data: orders } = await supabase.from('orders').select('*');
  
  const knownCosts = [];
  orders.forEach(o => {
    let itemsArr = o.items;
    if (typeof itemsArr === 'string') {
      try { itemsArr = JSON.parse(itemsArr); } catch(e) { itemsArr = []; }
    }
    if (itemsArr && Array.isArray(itemsArr)) {
      itemsArr.forEach((item) => {
        let rawCost = item.wholesaleCost || item.costo || item.costoUnitario || item.cost || item.wholesaleCostCents || item.costCents || 0;
        if (typeof rawCost === 'string') rawCost = parseFloat(rawCost.replace(/[^0-9.-]+/g,""));
        let cost = Number(rawCost) || 0;
        if (cost > 0) {
          knownCosts.push({ name: item.productName || item.name, cost });
        }
      });
    }
  });

  const missingNames = [
    "Conjunto Deportivo", "Camisa Manga corta", "Conjunto Stras", "Conjunto con Franja Blanca",
    "Pijama Dos Piezas", "Corpiño de Encaje", "Sweater liviano lanilla", "Remera curvy manga princesa",
    "Pantalón sastrero importado", "Blazer Corto Celeste", "Conjunto deportivo Importado", "Blazer Largo",
    "Top mas Colale", "Calza deportiva Importada", "Conjunto Ami Importado", "Baggi Importado",
    "Camisa Manga corta", "Pantalón sastrero importado", "Blazer Corto con Boton", "Camisa Manga Princesa",
    "Short Sastrero", "Short Sastrero Con Pizas", "Sweater con Botones", "Short Pollera", "Baggi Bordo"
  ];

  console.log("MATCHING RESULTS:");
  for (const m of missingNames) {
    let best = null;
    for (const k of knownCosts) {
      if (k.name.toLowerCase() === m.toLowerCase()) best = { name: k.name, cost: k.cost, conf: 'ALTA' };
      else if (k.name.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(k.name.toLowerCase())) {
        if (!best) best = { name: k.name, cost: k.cost, conf: 'MEDIA' };
      } else {
        const wordsM = m.toLowerCase().split(' ').filter(w => w.length > 3);
        const wordsK = k.name.toLowerCase().split(' ').filter(w => w.length > 3);
        if (wordsM.some(w => wordsK.includes(w))) {
          if (!best) best = { name: k.name, cost: k.cost, conf: 'BAJA' };
        }
      }
    }
    if (best) {
      console.log(`${m} -> ${best.name} ($${best.cost/100}) [${best.conf}]`);
    } else {
      console.log(`${m} -> SIN DATO`);
    }
  }
}
findMatch();
