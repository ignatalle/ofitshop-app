import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function extractAllCosts() {
  const { data: orders } = await supabase.from('orders').select('*');
  console.log('Todos los items CON costo en la base de datos:');
  const itemsConCosto = [];
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
          itemsConCosto.push({ name: item.productName || item.name, cost });
          console.log(`- ${item.productName || item.name}: $${cost/100}`);
        }
      });
    }
  });
}
extractAllCosts();
