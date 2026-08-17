import { createClient } from '@supabase/supabase-js';
import { 
  getArgentinaDate, isSameMonthArgentina, isValidSale, getItemUnitCostCents, getItemQuantity 
} from './src/lib/finance';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  const { data: transactions } = await supabase.from('transactions').select('*');
  const { data: orders } = await supabase.from('orders').select('*, customers(name)');
  const { data: products } = await supabase.from('products').select('*');

  const productsMap = {};
  if (products) {
    products.forEach(p => {
      productsMap[p.id] = p.costo || p.cost || p.costCents || p.wholesaleCost || 0;
    });
  }

  // 1. Corregir Ropa Varias Deportiva
  const ropaTx = transactions.find(t => t.description === 'Ropa Varias Deportiva');
  if (ropaTx) {
    console.log(`Actualizando Tx ID ${ropaTx.id}...`);
    const { error } = await supabase.from('transactions')
      .update({ description: '[MERCADERÍA] Ropa Varias Deportiva' })
      .eq('id', ropaTx.id);
    if (!error) console.log('Tx Ropa Varias Deportiva actualizada con éxito.');
  }

  // 2. Auditar Gastos Varios y Porta Celular
  const gastosVariosTx = transactions.find(t => t.description.includes('Gastos Varios') && t.amount === 44391900);
  console.log('\n--- AUDITORÍA GASTOS VARIOS ---');
  console.log(gastosVariosTx);

  const portaCelularTx = transactions.find(t => t.description.includes('Porta Celular') && t.amount === 2350000);
  console.log('\n--- AUDITORÍA PORTA CELULAR ---');
  console.log(portaCelularTx);

  // 3. Obtener 26 items sin costo
  console.log('\n--- 26 ITEMS SIN COSTO ---');
  const now = getArgentinaDate(new Date().toISOString());
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const cmvOrders = orders.filter(o => isValidSale(o) && isSameMonthArgentina(o.created_at, currentMonth, currentYear));
  let itemsSinCostoVentaTotal = 0;

  cmvOrders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(it => {
        const cost = getItemUnitCostCents(it, productsMap);
        if (cost === 0) {
          const qty = getItemQuantity(it);
          const precioVenta = it.priceCents || it.price || 0; 
          let pVenta = 0;
          if (typeof precioVenta === 'string') pVenta = parseFloat(precioVenta.replace(/[^0-9.-]+/g,""));
          else pVenta = Number(precioVenta) || 0;

          // If price is 0, let's just log total order amount
          itemsSinCostoVentaTotal += (pVenta * qty);

          const customerName = o.customers ? o.customers.name : o.customer_id.substring(0,8);
          console.log(`Pedido ${o.id.substring(0,8)} | Cliente: ${customerName} | Prod: ${it.productName || it.name} | Cant: ${qty} | Venta: $${(pVenta*qty)/100} | Costo: $0`);
        }
      });
    }
  });

  console.log(`Ventas correspondientes a items sin costo = $${itemsSinCostoVentaTotal/100}`);
}
runAudit();
