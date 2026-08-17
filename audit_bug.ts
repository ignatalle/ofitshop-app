import { createClient } from '@supabase/supabase-js';
import { getItemUnitCostCents, isItemPendingCost, parseOrderItems } from './src/lib/finance';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function audit() {
  const { data: orders } = await supabase.from('orders').select('*, customers(name)');
  const { data: products } = await supabase.from('products').select('*');
  
  const productsMapPage = {};
  products.forEach(p => productsMapPage[p.id] = p.cost_price || 0);

  const productsMapClient = {};
  products.forEach(p => productsMapClient[p.id] = p);

  let countPage = 0;
  let countClient = 0;
  for (const o of orders) {
    if (o.status === 'CANCELADO' || o.status === 'ANULADO') continue;
    const items = parseOrderItems(o);
    for (const item of items) {
      if (isItemPendingCost(item, productsMapPage)) countPage++;
      if (isItemPendingCost(item, productsMapClient)) countClient++;
    }
  }
  console.log(`\nPage.tsx map (cost_price): ${countPage}`);
  console.log(`Client.tsx map (object): ${countClient}`);
}

audit();
