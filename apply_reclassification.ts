import { createClient } from '@supabase/supabase-js';
import { 
  calculateOperatingExpenses,
  calculateNetProfit,
  calculateCOGS,
  calculateCommissions,
  isSameMonthArgentina
} from './src/lib/finance';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("=== INICIANDO RECLASIFICACIÓN ===");
  const targetId = "1a1a86e1-f991-439f-ab3a-44375cb9a9a2";
  const currentMonth = 7;
  const currentYear = 2026;

  // 1. Snapshot BEFORE update
  const { data: txsBefore } = await supabase.from('transactions').select('*');
  const { data: orders } = await supabase.from('orders').select('*');
  const { data: products } = await supabase.from('products').select('*');
  
  let totalCajaBefore = 0;
  txsBefore?.forEach(t => {
    if (t.type === 'income') totalCajaBefore += t.amount;
    else if (t.type === 'expense') totalCajaBefore -= t.amount;
  });

  const productsMap: Record<string, number> = {};
  products?.forEach(p => productsMap[p.id] = Number(p.cost_price) || 0);

  const expensesBefore = calculateOperatingExpenses(txsBefore || [], currentMonth, currentYear);

  // 2. Perform UPDATE
  console.log(`\nActualizando transacción ${targetId}...`);
  const { error } = await supabase
    .from('transactions')
    .update({ 
      description: '[RETIRO] Gastos personales / Casa'
    })
    .eq('id', targetId);

  if (error) {
    console.error("Error al actualizar:", error);
    return;
  }
  
  console.log("Transacción actualizada exitosamente.");

  // 3. Snapshot AFTER update
  const { data: txsAfter } = await supabase.from('transactions').select('*');
  
  let totalCajaAfter = 0;
  txsAfter?.forEach(t => {
    if (t.type === 'income') totalCajaAfter += t.amount;
    else if (t.type === 'expense') totalCajaAfter -= t.amount;
  });
  
  const expensesAfter = calculateOperatingExpenses(txsAfter || [], currentMonth, currentYear);
  const commissionsAfter = calculateCommissions(txsAfter || [], currentMonth, currentYear);
  const { cogs } = calculateCOGS(orders || [], productsMap, currentMonth, currentYear);
  
  let salesTotal = 0;
  orders?.forEach(o => {
    if (['ENTREGADO', 'ENVIADO', 'LISTO_PARA_ENTREGAR'].includes(o.status || '') && isSameMonthArgentina(o.created_at, currentMonth, currentYear)) {
      salesTotal += Math.max(0, o.total_amount || 0);
    }
  });

  const netProfitAfter = salesTotal - (cogs + expensesAfter + commissionsAfter);

  console.log("\n=== RESULTADOS DE LA AUDITORÍA DE VERIFICACIÓN ===");
  console.log("1. CAJA TOTAL");
  console.log(`Caja ANTES:     $${(totalCajaBefore / 100).toLocaleString('es-AR')}`);
  console.log(`Caja DESPUÉS:   $${(totalCajaAfter / 100).toLocaleString('es-AR')}`);
  console.log(`Variación:      $${((totalCajaAfter - totalCajaBefore) / 100).toLocaleString('es-AR')} ${totalCajaBefore === totalCajaAfter ? '✅ (Perfecto, no alteró la caja)' : '❌ (Peligro, la caja cambió)'}`);

  console.log("\n2. GASTOS OPERATIVOS (Agosto)");
  console.log(`Gastos ANTES:   $${(expensesBefore / 100).toLocaleString('es-AR')}`);
  console.log(`Gastos DESPUÉS: $${(expensesAfter / 100).toLocaleString('es-AR')}`);
  const expectedDrop = 44391900;
  console.log(`Variación:      $${((expensesAfter - expensesBefore) / 100).toLocaleString('es-AR')} ${expensesBefore - expensesAfter === expectedDrop ? '✅ (Desapareció de Gastos)' : '❌ (Falla en el filtro)'}`);

  console.log("\n3. GANANCIA ESTIMADA (Agosto)");
  console.log(`Nueva Ganancia Estimada: $${(netProfitAfter / 100).toLocaleString('es-AR')} ✅`);
}

run();
