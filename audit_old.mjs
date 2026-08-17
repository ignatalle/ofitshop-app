import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEarlyAugOrders() {
  const { data: orders } = await supabase.from('orders').select('*');
  const { data: products } = await supabase.from('products').select('*');
  const productsMap = {};
  products.forEach(p => productsMap[p.id] = p.costo || p.cost || 0);

  console.log('Early Aug Orders:');
  orders.forEach(o => {
    let orderCmv = 0;
    let itemsArr = o.items;
    if (typeof itemsArr === 'string') {
      try { itemsArr = JSON.parse(itemsArr); } catch(e) { itemsArr = []; }
    }
    if (itemsArr && Array.isArray(itemsArr)) {
      itemsArr.forEach((item) => {
        let rawCost = item.wholesaleCost || item.costo || item.costoUnitario || item.cost || item.wholesaleCostCents || item.costCents || 0;
        if (typeof rawCost === 'string') rawCost = parseFloat(rawCost.replace(/[^0-9.-]+/g,""));
        let cost = Number(rawCost) || 0;
        if (cost === 0 && item.productId && productsMap[item.productId]) {
          cost = Number(productsMap[item.productId]) || 0;
        }
        let qty = item.quantity || item.cantidad || item.qty || 1;
        qty = Number(qty) || 1;
        if (cost > 0) orderCmv += (cost * qty);
      });
    }
    if (orderCmv > 0 && o.created_at.startsWith('2026-08')) {
      console.log(`[${o.created_at}] ID: ${o.id} CMV: $${orderCmv/100} Ventas: $${o.total_amount/100}`);
    }
  });
}
checkEarlyAugOrders();
