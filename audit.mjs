import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  console.log("Iniciando auditoria financiera...");
  
  const { data: customers } = await supabase.from('customers').select('*');
  const { data: orders } = await supabase.from('orders').select('*');
  const { data: transactions } = await supabase.from('transactions').select('*');
  
  console.log(`Descargados: ${customers?.length} clientes, ${orders?.length} ordenes, ${transactions?.length} transacciones`);
  
  let auditReport = "# Auditoría Financiera de Outfit Shop\n\n";
  let totalIssues = 0;

  // 1. Pagos mayores al total (Sobrepago)
  const overpaidOrders = orders?.filter(o => o.advance_payment > o.total_amount) || [];
  if (overpaidOrders.length > 0) {
    totalIssues += overpaidOrders.length;
    auditReport += `## ⚠️ Pagos mayores al total (${overpaidOrders.length})\n`;
    auditReport += `**Problema:** Existen pedidos donde \`advance_payment\` > \`total_amount\`, generando saldos negativos matemáticamente.\n`;
    overpaidOrders.forEach(o => {
      auditReport += `- Pedido ${o.id}: Total $${(o.total_amount/100).toFixed(2)}, Pagado $${(o.advance_payment/100).toFixed(2)}\n`;
    });
    auditReport += `\n`;
  }

  // 2. Costos negativos o anómalos
  let itemsWithNegativeCost = 0;
  let itemsWithoutCost = 0;
  let ordersWithZeroTotal = 0;

  orders?.forEach(o => {
    if (o.total_amount <= 0 && o.status !== 'CANCELADO') {
      ordersWithZeroTotal++;
    }

    if (o.items && Array.isArray(o.items)) {
      o.items.forEach((item) => {
        let rawCost = item.wholesaleCost || item.costo || item.costoUnitario || item.cost || item.wholesaleCostCents || item.costCents || 0;
        if (typeof rawCost === 'string') rawCost = parseFloat(rawCost.replace(/[^0-9.-]+/g,""));
        const cost = Number(rawCost);
        
        if (cost < 0) itemsWithNegativeCost++;
        if (cost === 0 && !item.productId) itemsWithoutCost++;
      });
    }
  });

  if (itemsWithNegativeCost > 0) {
    totalIssues += itemsWithNegativeCost;
    auditReport += `## ⚠️ Ítems con costo negativo (${itemsWithNegativeCost})\n`;
    auditReport += `**Problema:** Costo menor a 0. Distorsiona la ganancia.\n\n`;
  }

  if (itemsWithoutCost > 0) {
    auditReport += `## ℹ️ Ítems sin costo registrado (${itemsWithoutCost})\n`;
    auditReport += `**Problema:** Ítems personalizados o cargados rápido que no tienen costo, inflando la ganancia asumiendo margen del 100%.\n\n`;
  }
  
  if (ordersWithZeroTotal > 0) {
    totalIssues += ordersWithZeroTotal;
    auditReport += `## ⚠️ Pedidos con Total = 0 (${ordersWithZeroTotal})\n`;
    auditReport += `**Problema:** Pedidos que no tienen monto total válido.\n\n`;
  }

  // 3. Transacciones y Transferencias Internas
  let internalTxs = 0;
  let negativeAmounts = 0;
  let unknownAccounts = 0;
  
  transactions?.forEach(t => {
    if (t.amount < 0) negativeAmounts++;
    if (!t.cuenta) unknownAccounts++;
    
    const desc = t.description.toLowerCase();
    if (desc.includes('transferencia hacia') || desc.includes('transferencia desde')) {
      internalTxs++;
    }
  });

  if (negativeAmounts > 0) {
    totalIssues += negativeAmounts;
    auditReport += `## ⚠️ Transacciones con monto negativo (${negativeAmounts})\n`;
    auditReport += `**Problema:** Las transacciones deben tener valor absoluto, el tipo (INGRESO/EGRESO) define el signo.\n\n`;
  }

  if (unknownAccounts > 0) {
    totalIssues += unknownAccounts;
    auditReport += `## ⚠️ Transacciones sin cuenta asignada (${unknownAccounts})\n`;
    auditReport += `**Problema:** No se pueden sumar a Caja Total ni Efectivo/Virtual.\n\n`;
  }

  auditReport += `## 📊 Transferencias Internas detectadas: ${internalTxs}\n`;
  auditReport += `Deben ser filtradas del cálculo de Rendimiento y Ventas, ya que no son ingresos ni gastos reales del negocio.\n\n`;

  if (totalIssues === 0) {
    auditReport += `## ✅ Datos Estructuralmente Sanos\nNo se encontraron inconsistencias críticas de estructura (negativos, sobrepagos, etc).\n\n`;
  }

  console.log("Reporte generado, guardando...");
  
  import('fs').then(fs => {
    fs.writeFileSync('DATA_FINANCIAL_AUDIT.md', auditReport);
    console.log("DATA_FINANCIAL_AUDIT.md escrito con éxito.");
  });
}

runAudit();
