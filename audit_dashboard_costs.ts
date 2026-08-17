import { createClient } from '@supabase/supabase-js';
import { 
  calculateCOGS, 
  calculateOperatingExpenses, 
  calculateCommissions, 
  calculateNetProfit, 
  isSameMonthArgentina,
  isValidSale,
  parseOrderItems,
  getItemUnitCostCents,
  getItemQuantity
} from './src/lib/finance';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const currentMonth = 7; // 7 = Agosto in 0-indexed JS dates
  const currentYear = 2026;

  // 1. Fetch data
  const { data: transactions } = await supabase.from('transactions').select('*');
  const { data: orders } = await supabase.from('orders').select('*');
  const { data: products } = await supabase.from('products').select('*');
  
  const productsMap: Record<string, number> = {};
  products?.forEach(p => productsMap[p.id] = Number(p.cost_price) || 0);

  // 2. Breakdown components
  const { cogs, hasIncompleteCosts } = calculateCOGS(orders || [], productsMap, currentMonth, currentYear);
  const expenses = calculateOperatingExpenses(transactions || [], currentMonth, currentYear);
  const commissions = calculateCommissions(transactions || [], currentMonth, currentYear);
  
  const totalCostsAndExpenses = cogs + expenses + commissions;

  console.log("=== DESGLOSE DE COSTOS Y GASTOS (AGOSTO 2026) ===");
  console.log(`CMV Reconocido:      $${(cogs / 100).toLocaleString('es-AR')}`);
  console.log(`Comisiones:          $${(commissions / 100).toLocaleString('es-AR')}`);
  console.log(`Gastos Operativos:   $${(expenses / 100).toLocaleString('es-AR')}`);
  console.log(`------------------------------------------------`);
  console.log(`Total Esperado:      $${(totalCostsAndExpenses / 100).toLocaleString('es-AR')}`);

  // 3. Verify exclusions (transactions)
  let ignoredTx = 0;
  let ignoredAmount = 0;
  for (const t of transactions || []) {
    if (isSameMonthArgentina(t.created_at, currentMonth, currentYear)) {
      if (t.type === 'expense' && 
          (t.category === 'MERCADERIA' || 
           t.category === 'RETIRO_SOCIO' || 
           t.category === 'GASTO_OPERATIVO' || 
           t.category === 'COMISION' ||
           t.category === 'AJUSTE')) {
           
           if (t.category !== 'GASTO_OPERATIVO' && t.category !== 'COMISION') {
             ignoredTx++;
             ignoredAmount += t.amount;
           }
      }
    }
  }
  console.log(`\nVerificación: Se ignoraron ${ignoredTx} egresos (Mercadería, Retiros, Ajustes) por un total de $${(ignoredAmount / 100).toLocaleString('es-AR')}`);

  // 4. Catalog fallback stats
  let totalCMV = 0;
  let cmvFromOrder = 0;
  let cmvFromCatalog = 0;
  let itemsFromCatalog = 0;
  let itemsFromOrder = 0;
  
  for (const o of orders || []) {
    if (isValidSale(o) && isSameMonthArgentina(o.created_at, currentMonth, currentYear)) {
      const items = parseOrderItems(o);
      for (const item of items) {
        const qty = getItemQuantity(item);
        const cost = getItemUnitCostCents(item, productsMap);
        
        let rawCost = item.wholesaleCost ?? item.costo ?? item.costoUnitario ?? item.cost ?? item.wholesaleCostCents ?? item.costCents ?? 0;
        if (typeof rawCost === 'string') rawCost = parseFloat(rawCost.replace(/[^0-9.-]+/g,""));
        let explicitCost = Number(rawCost) || 0;
        
        if (cost > 0) {
          totalCMV += (cost * qty);
          if (explicitCost === 0 && item.productId && productsMap[item.productId]) {
            cmvFromCatalog += (cost * qty);
            itemsFromCatalog += qty;
          } else {
            cmvFromOrder += (cost * qty);
            itemsFromOrder += qty;
          }
        }
      }
    }
  }
  
  console.log(`\n=== ORIGEN DEL CMV ===`);
  console.log(`CMV Total:           $${(totalCMV / 100).toLocaleString('es-AR')}`);
  console.log(`CMV (Pedido JSON):   $${(cmvFromOrder / 100).toLocaleString('es-AR')} (${itemsFromOrder} uds)`);
  console.log(`CMV (Catálogo Fallback): $${(cmvFromCatalog / 100).toLocaleString('es-AR')} (${itemsFromCatalog} uds)`);

  // 5. Impact of Baggi Bordo
  // We need sales to compute net profit
  const { data: sales } = await supabase.from('sales').select('*');
  let salesTotal = 0;
  for (const o of orders || []) {
    if (isValidSale(o) && isSameMonthArgentina(o.created_at, currentMonth, currentYear)) {
      salesTotal += Math.max(0, o.total_amount || 0);
    }
  }

  const netProfitEstimada = salesTotal - totalCostsAndExpenses;
  
  console.log(`\n=== IMPACTO BAGGI BORDO ===`);
  console.log(`Ventas (Agosto):     $${(salesTotal / 100).toLocaleString('es-AR')}`);
  console.log(`Ganancia Actual (Estimada): $${(netProfitEstimada / 100).toLocaleString('es-AR')}`);
  
  // If Baggi Bordo gets $13.990 cost
  const baggiCostCents = 1399000;
  const newTotalCosts = totalCostsAndExpenses + baggiCostCents;
  const newNetProfit = salesTotal - newTotalCosts;
  
  console.log(`Ganancia si Cami confirma Baggi Bordo a $13.990: $${(newNetProfit / 100).toLocaleString('es-AR')}`);
  console.log(`Diferencia: -$13.990 (pasaría de ser 'Estimada' a 'Ganancia Real')`);
}

run();
