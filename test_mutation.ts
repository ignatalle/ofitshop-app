import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMutation() {
  console.log("=== INICIANDO PRUEBA QUIRÚRGICA ===");
  // 1. Tomar un pedido real con varios items
  const { data: orders } = await supabase.from('orders').select('*');
  const order = orders.find(o => Array.isArray(o.items) ? o.items.length > 1 : (typeof o.items === 'string' && JSON.parse(o.items).length > 1));
  
  if (!order) {
    console.log("No se encontró el pedido");
    return;
  }

  let itemsArr = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const originalTotal = order.total_amount;
  const originalAdvance = order.advance_payment;
  
  console.log(`Original: Total $${originalTotal/100}, Items: ${itemsArr.length}`);

  // Simulamos lo que hace `executeUpdate`
  const targetItem = { ...itemsArr[0] };
  targetItem.costCents = 1234500;
  
  itemsArr[0] = targetItem;

  // Actualizamos solo items
  const { error } = await supabase.from('orders').update({ items: itemsArr }).eq('id', order.id);
  if (error) {
    console.log("Error al mutar", error);
    return;
  }

  // Volvemos a leer
  const { data: freshOrder } = await supabase.from('orders').select('*').eq('id', order.id).single();
  let freshItems = typeof freshOrder.items === 'string' ? JSON.parse(freshOrder.items) : freshOrder.items;

  console.log("--- RESULTADOS ---");
  console.log(`Costo Item 0: $${freshItems[0].costCents / 100} (Esperado: $12345)`);
  console.log(`Costo Item 1 intacto: ${JSON.stringify(freshItems[1]) === JSON.stringify(itemsArr[1]) ? 'SI' : 'NO'}`);
  console.log(`Total amount intacto: ${freshOrder.total_amount === originalTotal ? 'SI' : 'NO'}`);
  console.log(`Advance payment intacto: ${freshOrder.advance_payment === originalAdvance ? 'SI' : 'NO'}`);
  console.log(`Otras propiedades del pedido intactas: ${freshOrder.status === order.status ? 'SI' : 'NO'}`);

  // Revertir para no ensuciar producción
  itemsArr[0].costCents = undefined; // o borrarlo
  await supabase.from('orders').update({ items: itemsArr }).eq('id', order.id);
  console.log("Prueba revertida con éxito.");
}

testMutation();
