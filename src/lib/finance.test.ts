import assert from 'assert';
import {
  Transaction, Order, getArgentinaDate, isSameMonthArgentina, isInternalTransfer, isCommission, 
  isPersonalWithdrawal, isMerchandisePurchase, isOperatingExpense, calculateTotalCash, calculateAccountBalance, 
  calculateReceivables, calculateDebtorCustomers, calculateSales, calculateCOGS, calculateOperatingExpenses, 
  calculateCommissions, calculateNetProfit, calculateDistribution, getItemQuantity, getItemUnitCostCents,
  getOrderFinancialStatus, calculateOrderBalance
} from './finance';

// Mock data builder helpers
const makeTx = (id: string, type: 'INGRESO'|'EGRESO', amount: number, desc: string, cuenta: 'EFECTIVO'|'VIRTUAL'): Transaction => ({
  id, type, amount, description: desc, cuenta, created_at: new Date().toISOString()
});

const makeOrder = (id: string, cust: string, total: number, adv: number, status: string, items: any[]): Order => ({
  id, customer_id: cust, total_amount: total, advance_payment: adv, status, items, created_at: new Date().toISOString()
});

function runTests() {
  console.log('Running Financial Tests...\n');

  // Caso 1: Venta con seña
  const o1 = makeOrder('o1', 'c1', 100000, 30000, 'PENDIENTE', []);
  assert.strictEqual(calculateReceivables([o1]), 70000, 'Caso 1: Plata en calle debe ser 70.000');
  assert.strictEqual(getOrderFinancialStatus(o1), 'PARCIAL', 'Caso 1: Estado financiero debe ser PARCIAL');

  // Caso 2: Pago total
  const o2 = makeOrder('o2', 'c2', 100000, 100000, 'PENDIENTE', []);
  assert.strictEqual(calculateReceivables([o2]), 0, 'Caso 2: Plata en calle debe ser 0');
  assert.strictEqual(getOrderFinancialStatus(o2), 'PAGADO', 'Caso 2: Estado financiero debe ser PAGADO');
  assert.strictEqual(o2.status, 'PENDIENTE', 'Caso 2: Estado operativo NO debe cambiar a ENTREGADO automáticamente');

  // Caso 3: Transferencia interna
  const tx1 = makeTx('tx1', 'EGRESO', 40000, 'Transferencia hacia Efectivo', 'VIRTUAL');
  const tx2 = makeTx('tx2', 'INGRESO', 40000, 'Transferencia desde Virtual', 'EFECTIVO');
  
  // Asumimos caja inicial Virtual 100k
  const txInitial = makeTx('txInit', 'INGRESO', 100000, 'Venta inicial', 'VIRTUAL');
  const allTxs = [txInitial, tx1, tx2];
  
  assert.strictEqual(calculateAccountBalance(allTxs, 'VIRTUAL'), 60000, 'Caso 3: Virtual debe ser 60.000');
  assert.strictEqual(calculateAccountBalance(allTxs, 'EFECTIVO'), 40000, 'Caso 3: Efectivo debe ser 40.000');
  assert.strictEqual(calculateTotalCash(allTxs), 100000, 'Caso 3: Caja total debe ser 100.000 (Sin cambio)');

  // Caso 4: Comisión
  const txCobro = makeTx('c1', 'INGRESO', 100000, 'Pago', 'VIRTUAL');
  const txCom = makeTx('c2', 'EGRESO', 5000, 'Comisión MP', 'VIRTUAL');
  const comTxs = [txCobro, txCom];
  
  assert.strictEqual(calculateTotalCash(comTxs), 95000, 'Caso 4: Caja debe ser 95.000');
  const comiss = calculateCommissions(comTxs, new Date().getMonth(), new Date().getFullYear());
  assert.strictEqual(comiss, 5000, 'Caso 4: Comisión calculada debe ser 5.000');

  // Caso 5: Retiro personal
  const rInit = makeTx('r1', 'INGRESO', 100000, 'Venta', 'EFECTIVO');
  const rRet = makeTx('r2', 'EGRESO', 30000, 'Retiro de socio', 'EFECTIVO');
  assert.strictEqual(calculateTotalCash([rInit, rRet]), 70000, 'Caso 5: Caja debe ser 70.000');
  
  const opExp = calculateOperatingExpenses([rRet], new Date().getMonth(), new Date().getFullYear());
  assert.strictEqual(opExp, 0, 'Caso 5: Retiro personal no debe ser gasto operativo');

  // Caso 6: Dos pedidos misma clienta
  const c6o1 = makeOrder('c6o1', 'clientA', 40000, 20000, 'PENDIENTE', []);
  const c6o2 = makeOrder('c6o2', 'clientA', 40000, 10000, 'PENDIENTE', []);
  assert.strictEqual(calculateReceivables([c6o1, c6o2]), 50000, 'Caso 6: Plata en calle 50.000');
  assert.strictEqual(calculateDebtorCustomers([c6o1, c6o2]), 1, 'Caso 6: 1 sola clienta con deuda');

  // Caso 7: Costo faltante
  const o7 = makeOrder('o7', 'cx', 50000, 0, 'PENDIENTE', [
    { wholesaleCost: 10000, quantity: 1 },
    { wholesaleCost: 0, quantity: 1 } // Sin costo
  ]);
  const cogsResult = calculateCOGS([o7], {}, new Date().getMonth(), new Date().getFullYear());
  assert.strictEqual(cogsResult.cogs, 10000, 'Caso 7: COGS calculado = 10000');
  assert.strictEqual(cogsResult.hasIncompleteCosts, true, 'Caso 7: Debe detectar costo incompleto');

  // Caso 8: Caja separada
  const t8_1 = makeTx('8_1', 'INGRESO', 30000, 'x', 'EFECTIVO');
  const t8_2 = makeTx('8_2', 'INGRESO', 50000, 'x', 'VIRTUAL');
  const t8_3 = makeTx('8_3', 'EGRESO', 10000, 'x', 'EFECTIVO');
  const t8_4 = makeTx('8_4', 'EGRESO', 5000, 'x', 'VIRTUAL');
  
  assert.strictEqual(calculateAccountBalance([t8_1, t8_2, t8_3, t8_4], 'EFECTIVO'), 20000, 'Caso 8: Efectivo 20k');
  assert.strictEqual(calculateAccountBalance([t8_1, t8_2, t8_3, t8_4], 'VIRTUAL'), 45000, 'Caso 8: Virtual 45k');
  assert.strictEqual(calculateTotalCash([t8_1, t8_2, t8_3, t8_4]), 65000, 'Caso 8: Total 65k');

  // Caso 9: Porcentajes
  const dist = calculateDistribution(100000, 30);
  assert.strictEqual(dist.businessShare, 30000, 'Caso 9: Negocio 30.000');
  assert.strictEqual(dist.personalShare, 70000, 'Caso 9: Cami 70.000');

  // Caso 10: Ganancia negativa
  const distNeg = calculateDistribution(-20000, 30);
  assert.strictEqual(distNeg.businessShare, 0, 'Caso 10: Negocio 0');
  assert.strictEqual(distNeg.personalShare, 0, 'Caso 10: Cami 0');

  // Caso 15: Compra de Mercadería
  const txMerc = makeTx('txm', 'EGRESO', 200000, 'Compra mercadería', 'VIRTUAL');
  const isMerc = isMerchandisePurchase(txMerc);
  assert.strictEqual(isMerc, true, 'Caso 15: Debe detectar compra de mercadería');
  
  const opExpMerc = calculateOperatingExpenses([txMerc], new Date().getMonth(), new Date().getFullYear());
  assert.strictEqual(opExpMerc, 0, 'Caso 15: Compra mercadería no es operating expense directo en el mes para la ganancia neta');

  // Invariante Timezone
  const dateStr = "2026-08-31T23:30:00.000Z"; // En UTC puede ser 31/8, en Arg también. Depende de dónde lo corro. 
  // Pero supongamos una venta a medianoche UTC 2026-09-01T01:30:00.000Z (que en arg es 31-08-2026 22:30).
  const midnightUTC = "2026-09-01T01:30:00.000Z";
  assert.strictEqual(isSameMonthArgentina(midnightUTC, 7, 2026), true, 'Timezone: Debe pertenecer a agosto en Arg (month 7)');

  console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
}

try {
  runTests();
} catch (e) {
  console.error('❌ TEST FAILED:', e);
  process.exit(1);
}
