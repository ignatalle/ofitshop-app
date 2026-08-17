import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("=== INICIANDO AUDITORIA DE GASTOS VARIOS ===");

  // 1. Fetch the exact transaction
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('amount', 44391900)
    .ilike('description', '%Gastos Varios%');
    
  if (!txs || txs.length === 0) {
    console.log("No se encontró el movimiento de $443.919");
    return;
  }
  
  const targetTx = txs[0];
  console.log("\n1. REGISTRO COMPLETO:");
  console.log(JSON.stringify(targetTx, null, 2));

  // 2. Fetch context around it (30 min before and after)
  const targetTime = new Date(targetTx.created_at).getTime();
  const thirtyMins = 30 * 60 * 1000;
  const startTime = new Date(targetTime - thirtyMins).toISOString();
  const endTime = new Date(targetTime + thirtyMins).toISOString();

  const { data: contextTxs } = await supabase
    .from('transactions')
    .select('*')
    .gte('created_at', startTime)
    .lte('created_at', endTime)
    .order('created_at', { ascending: true });

  console.log("\n2. CONTEXTO HISTÓRICO (30 min antes y después):");
  contextTxs?.forEach(t => {
    const time = new Date(t.created_at).toLocaleTimeString('es-AR');
    console.log(`${time} | $${(t.amount / 100).toLocaleString('es-AR')} | ${t.description} | ${t.type} | ${t.category}`);
  });

  // 3 & 5. Find potential matches with merchandise/orders
  const dateStr = targetTx.created_at.split('T')[0];
  const { data: dayOrders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', `${dateStr}T00:00:00Z`)
    .lte('created_at', `${dateStr}T23:59:59Z`);

  let dayCost = 0;
  let daySales = 0;
  
  console.log("\n3/5. RELACIÓN CON MERCADERÍA Y PEDIDOS (Mismo día):");
  dayOrders?.forEach(o => {
    daySales += (o.total_amount || 0);
    try {
      const items = JSON.parse(o.items as string);
      items.forEach((i: any) => {
        const c = i.wholesaleCost || i.costo || i.costoUnitario || i.wholesaleCostCents || i.costCents || 0;
        dayCost += (Number(c) * (Number(i.quantity) || 1));
      });
    } catch (e) {}
  });
  console.log(`Ventas totales del día: $${(daySales / 100).toLocaleString('es-AR')}`);
  console.log(`Costos embebidos de pedidos del día: $${(dayCost / 100).toLocaleString('es-AR')}`);

  // Also check if any catalog-based calculation matches roughly
  const { data: allTxsThisDay } = await supabase
    .from('transactions')
    .select('*')
    .gte('created_at', `${dateStr}T00:00:00Z`)
    .lte('created_at', `${dateStr}T23:59:59Z`);
    
  console.log("\nMovimientos de caja de ese mismo día (Resumen):");
  let txTotalIn = 0;
  let txTotalOut = 0;
  allTxsThisDay?.forEach(t => {
    if (t.type === 'income') txTotalIn += t.amount;
    if (t.type === 'expense') txTotalOut += t.amount;
  });
  console.log(`Ingresos del día: $${(txTotalIn / 100).toLocaleString('es-AR')}`);
  console.log(`Egresos del día: $${(txTotalOut / 100).toLocaleString('es-AR')}`);

  // 4. Relation to "AJUSTE DE BALANCE $509.753,67"
  const { data: txsAjuste } = await supabase
    .from('transactions')
    .select('*')
    .eq('amount', 50975367)
    .ilike('description', '%AJUSTE DE BALANCE%');

  console.log("\n4. RELACIÓN CON AJUSTE DE BALANCE $509.753,67:");
  if (txsAjuste && txsAjuste.length > 0) {
    const ajusteTx = txsAjuste[0];
    console.log(`Encontrado: ${ajusteTx.created_at} | ${ajusteTx.description} | ${ajusteTx.account}`);
    const diffHours = Math.abs(new Date(ajusteTx.created_at).getTime() - targetTime) / (1000 * 60 * 60);
    console.log(`Diferencia de tiempo con Gastos Varios: ${diffHours.toFixed(2)} horas`);
  } else {
    console.log("No se encontró AJUSTE DE BALANCE $509.753,67 en la BD.");
  }
}

run();
