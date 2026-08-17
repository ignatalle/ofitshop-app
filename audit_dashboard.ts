import { createClient } from '@supabase/supabase-js';
import { 
  getArgentinaDate, isSameMonthArgentina, isValidSale, isCashReconciliation, 
  isInternalTransfer, isPersonalWithdrawal, isMerchandisePurchase, isCommission, 
  isOperatingExpense, calculateSales, calculateCOGS, getItemUnitCostCents, getItemQuantity 
} from './src/lib/finance';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  const { data: orders } = await supabase.from('orders').select('*');
  const { data: transactions } = await supabase.from('transactions').select('*');
  const { data: products } = await supabase.from('products').select('*');

  if (!orders || !transactions) return;

  const productsMap = {};
  if (products) {
    products.forEach(p => {
      productsMap[p.id] = p.costo || p.cost || p.costCents || p.wholesaleCost || 0;
    });
  }

  // Obtenemos el mes actual de la misma forma que el dashboard
  const now = getArgentinaDate(new Date().toISOString());
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  console.log(`Auditoría para Mes: ${currentMonth + 1}, Año: ${currentYear}`);

  // 1 & 2. CMV y Costos + Gastos
  const { cogs, hasIncompleteCosts, incompleteItemsCount } = calculateCOGS(orders, productsMap, currentMonth, currentYear);
  
  let comisiones = 0;
  let gastosOp = 0;
  let comprasMerc = 0;
  let retiros = 0;

  const currentMonthTxs = transactions.filter(t => isSameMonthArgentina(t.created_at, currentMonth, currentYear));

  const listGastosOp = [];
  const listComisiones = [];
  const listComprasMerc = [];
  const listRetiros = [];
  let containsReconciliation = false;
  let containsTransfer75k = false;

  currentMonthTxs.forEach(t => {
    if (isCashReconciliation(t)) {
      if (t.amount === 50975367) containsReconciliation = true;
      return;
    }
    if (isInternalTransfer(t)) {
      if (t.amount === 7500000) containsTransfer75k = true;
      return;
    }
    if (isPersonalWithdrawal(t)) {
      retiros += t.amount;
      listRetiros.push(t);
      return;
    }
    if (isCommission(t)) {
      comisiones += t.amount;
      listComisiones.push(t);
      return;
    }
    if (isMerchandisePurchase(t)) {
      comprasMerc += t.amount;
      listComprasMerc.push(t);
      return;
    }
    if (isOperatingExpense(t)) {
      gastosOp += t.amount;
      listGastosOp.push(t);
      return;
    }
  });

  const totalCostosGastos = cogs + comisiones + gastosOp;

  console.log('\n--- 1. RESULTADO COSTOS Y GASTOS ---');
  console.log(`CMV: $${cogs / 100}`);
  console.log(`Comisiones: $${comisiones / 100}`);
  console.log(`Gastos Operativos: $${gastosOp / 100}`);
  console.log(`TOTAL COSTOS + GASTOS: $${totalCostosGastos / 100}`);

  console.log('\n--- 2. DESGLOSE CMV ---');
  let cmvOrders = orders.filter(o => isValidSale(o) && isSameMonthArgentina(o.created_at, currentMonth, currentYear));
  let fallbackCount = 0;
  let missingCount = 0;
  let explicitCount = 0;
  let fallbackTotal = 0;
  let explicitTotal = 0;

  cmvOrders.forEach(o => {
    let orderCogs = 0;
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(it => {
        const qty = getItemQuantity(it);
        const cost = getItemUnitCostCents(it, productsMap);
        orderCogs += cost * qty;
        
        let explicit = it.wholesaleCost || it.costo || it.costoUnitario || it.cost || it.wholesaleCostCents || it.costCents || 0;
        if (typeof explicit === 'string') explicit = parseFloat(explicit.replace(/[^0-9.-]+/g,""));
        const expCost = Number(explicit) || 0;
        
        if (expCost > 0) {
          explicitCount++;
          explicitTotal += cost * qty;
        } else if (it.productId && productsMap[it.productId]) {
          fallbackCount++;
          fallbackTotal += cost * qty;
        } else {
          missingCount++;
        }
      });
    }
  });
  console.log(`Total CMV: $${cogs/100}. Pedidos en CMV: ${cmvOrders.length}.`);

  console.log('\n--- 3. DESGLOSE VENTAS ---');
  const ventas = calculateSales(orders, currentMonth, currentYear);
  console.log(`Ventas totales calculadas: $${ventas / 100}`);
  cmvOrders.forEach(o => {
    console.log(`[${o.created_at}] ID: ${o.id.substring(0,8)} | Cust: ${o.customer_id.substring(0,8)} | Estado: ${o.status} | Total: $${o.total_amount/100} | Pagado: $${o.advance_payment/100}`);
  });

  console.log('\n--- 5. PEDIDOS CANCELADOS ---');
  const allOrdersThisMonth = orders.filter(o => isSameMonthArgentina(o.created_at, currentMonth, currentYear));
  allOrdersThisMonth.forEach(o => {
    if (!isValidSale(o)) {
      console.log(`Pedido excluido: ${o.id.substring(0,8)} | Estado: ${o.status}`);
    }
  });

  console.log('\n--- 6. GASTOS OPERATIVOS ---');
  listGastosOp.forEach(t => console.log(`[${t.created_at}] $${t.amount/100} | ${t.description} | ${t.cuenta}`));

  console.log('\n--- 7. COMPRAS DE MERCADERÍA COMO GASTO OP ---');
  console.log('Listadas bajo compras de mercadería (filtradas explícitamente):');
  listComprasMerc.forEach(t => console.log(`[${t.created_at}] $${t.amount/100} | ${t.description} | ${t.cuenta}`));
  console.log('Posibles compras escondidas en Gastos Operativos:');
  listGastosOp.forEach(t => {
    if (t.description.toLowerCase().includes('mercaderia') || t.description.toLowerCase().includes('ropa') || t.description.toLowerCase().includes('mayorista')) {
      console.log(`!! POSIBLE MERCADERIA EN GASTO OP: [${t.created_at}] $${t.amount/100} | ${t.description}`);
    }
  });

  console.log('\n--- 8. COMISIONES ---');
  listComisiones.forEach(t => console.log(`[${t.created_at}] $${t.amount/100} | ${t.description}`));

  console.log('\n--- 9. & 10. CONCILIACIÓN Y TRANSFERENCIAS ---');
  console.log(`¿La conciliación de 509k está en las listas de gastos? ${listGastosOp.some(t => t.amount === 50975367) || listRetiros.some(t => t.amount === 50975367)} (Debe ser false)`);
  console.log(`¿Transferencia 75k en listas de gastos? ${listGastosOp.some(t => t.amount === 7500000)} (Debe ser false)`);

  console.log('\n--- 11. RETIROS ---');
  listRetiros.forEach(t => console.log(`[${t.created_at}] $${t.amount/100} | ${t.description}`));

  console.log('\n--- 13. VALORES EXTRAÑOS EN COSTOS (CENTS VS PESOS) ---');
  cmvOrders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(it => {
        const cost = getItemUnitCostCents(it, productsMap);
        if (cost > 0 && cost < 1000) { // Menos de 10 pesos = muy probable error de cents
          console.log(`SOSPECHA COSTO BAJO: ID ${o.id} - Item: ${it.productName} - Costo: ${cost} centavos ($${cost/100})`);
        }
        if (cost > 10000000) { // Mas de 100,000 pesos
          console.log(`SOSPECHA COSTO ALTO: ID ${o.id} - Item: ${it.productName} - Costo: ${cost} centavos ($${cost/100})`);
        }
      });
    }
  });

  console.log('\n--- 14 & 15. FALLBACK Y FALTANTES ---');
  console.log(`Costo explicito: ${explicitCount} items (Total: $${explicitTotal/100})`);
  console.log(`Costo fallback: ${fallbackCount} items (Total: $${fallbackTotal/100})`);
  console.log(`Costo faltante: ${missingCount} items`);
  console.log(`Pedidos con alerta de costo incompleto: ${hasIncompleteCosts ? 'SI' : 'NO'}`);

  console.log('\n--- 16. TABLA FINAL ---');
  console.log(`Ventas            | $${ventas/100}`);
  console.log(`CMV               | $${cogs/100}`);
  console.log(`Comisiones        | $${comisiones/100}`);
  console.log(`Gastos Operativos | $${gastosOp/100}`);
  console.log(`Costos + Gastos   | $${totalCostosGastos/100}`);
  console.log(`Ganancia Neta     | $${(ventas - totalCostosGastos)/100}`);

}

runAudit();
