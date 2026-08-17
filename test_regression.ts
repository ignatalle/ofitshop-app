import { getItemUnitCostCents, isItemPendingCost, isSameMonthArgentina, getArgentinaDate } from './src/lib/finance';
import { calculateCOGS } from './src/lib/finance';

function runRegressionTest() {
  console.log("=== INICIANDO TEST DE REGRESIÓN ===");

  // 1. Producto tiene cost_price en catálogo
  const productsMap = {
    'prod-123': 1500000 // $15.000,00
  };

  // 2. Item del pedido no tiene costo embebido
  const itemWithoutCost = {
    id: 'item-1',
    productId: 'prod-123',
    quantity: 2,
    subtotal: 4000000, // $40.000,00
    priceType: 'retail',
    unitPrice: 2000000
    // No wholesaleCost, no costCents, etc.
  };

  // 3. finance.ts detecta costo
  const detectedCost = getItemUnitCostCents(itemWithoutCost, productsMap);
  const costDetected = detectedCost === 1500000;
  console.log(`[finance.ts] detecta costo: ${costDetected ? 'SI' : 'NO'} (${detectedCost})`);

  // 4. Costos Pendientes NO lo muestra (isItemPendingCost es false)
  const isPending = isItemPendingCost(itemWithoutCost, productsMap);
  console.log(`[Costos Pendientes] lo muestra: ${isPending ? 'SI' : 'NO'}`);

  // 5. CMV sí lo incluye
  // Creamos una orden ficticia para testear calculateCOGS
  const order = {
    id: 'order-1',
    status: 'ENTREGADO',
    created_at: new Date().toISOString(),
    items: [itemWithoutCost]
  };
  
  const cogsResult = calculateCOGS([order as any], productsMap, new Date().getMonth(), new Date().getFullYear());
  const isIncludedInCOGS = cogsResult.cogs === 3000000; // 2 * $15.000,00
  const isCMVFinal = cogsResult.hasIncompleteCosts === false;
  
  console.log(`Debug details:`);
  console.log(`  month: ${new Date().getMonth()}`);
  console.log(`  year: ${new Date().getFullYear()}`);
  console.log(`  created_at: ${order.created_at}`);
  
  console.log(`  getArgentinaDate:`, getArgentinaDate(order.created_at));
  console.log(`  isSameMonthArgentina: ${isSameMonthArgentina(order.created_at, new Date().getMonth(), new Date().getFullYear())}`);
  
  console.log(`[CMV] incluye el costo: ${isIncludedInCOGS ? 'SI' : 'NO'} (${cogsResult.cogs})`);
  console.log(`[CMV] marca hasIncompleteCosts como: ${cogsResult.hasIncompleteCosts}`);

  if (costDetected && !isPending && isIncludedInCOGS && isCMVFinal) {
    console.log("\n✅ TEST PASSED: El catálogo resuelve el costo correctamente para toda la app.");
  } else {
    console.log("\n❌ TEST FAILED: Hay discrepancias.");
    process.exit(1);
  }
}

runRegressionTest();
