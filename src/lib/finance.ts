export interface Transaction {
  id: string;
  type: string;
  amount: number; // Siempre en centavos (o pesos según la base de datos). Esperamos que la DB tenga montos en base a centavos o que la app normalice. TODO: Verificar base de datos (generalmente la app multiplica por 100).
  description: string;
  cuenta: 'EFECTIVO' | 'VIRTUAL';
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  total_amount: number;
  advance_payment: number;
  items: any; // jsonb
  status: string;
  created_at: string;
}

// ----------------------------------------------------------------------
// 1. FECHAS Y TIMEZONE
// ----------------------------------------------------------------------

/**
 * Normaliza una fecha ISO a la zona horaria de Argentina.
 * Devuelve un objeto Date que representa el momento local en Argentina,
 * permitiendo extraer getMonth() y getFullYear() de forma segura y estable.
 */
export const getArgentinaDate = (dateString: string): Date => {
  // Creamos un formato que fuerza la salida en Argentina Time
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  };
  
  // Extraemos las partes locales en Argentina
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  
  // Creamos un nuevo Date *local* que coincide exactamente con el reloj de pared en Argentina
  return new Date(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour'),
    getPart('minute'),
    getPart('second')
  );
};

export const isSameMonthArgentina = (dateStr: string, month: number, year: number): boolean => {
  const argDate = getArgentinaDate(dateStr);
  return argDate.getMonth() === month && argDate.getFullYear() === year;
};

// ----------------------------------------------------------------------
// 2. CLASIFICADORES DE TRANSACCIONES (Isolando lógicas difusas)
// ----------------------------------------------------------------------

export const isInternalTransfer = (tx: Transaction): boolean => {
  const d = tx.description.toLowerCase();
  return d.includes('transferencia hacia') || d.includes('transferencia desde');
};

export const isCashReconciliation = (tx: Transaction): boolean => {
  const d = tx.description.toUpperCase();
  return d.includes('AJUSTE DE BALANCE') || d.includes('CONCILIACION DE CAJA') || d.includes('CONCILIACIÓN DE CAJA');
};

export const isPersonalWithdrawal = (tx: Transaction): boolean => {
  if (tx.type !== 'EGRESO') return false;
  if (isCashReconciliation(tx)) return false;
  const d = tx.description.toLowerCase();
  // Adjust to avoid broad matching of "ajuste" if it's a reconciliation
  return d.includes('retiro') || d.includes('socio'); 
};

export const isCommission = (tx: Transaction): boolean => {
  if (tx.type !== 'EGRESO') return false;
  const d = tx.description.toLowerCase();
  return d.includes('comisión') || d.includes('comision');
};

export const isMerchandisePurchase = (tx: Transaction): boolean => {
  if (tx.type !== 'EGRESO') return false;
  // TODO: Asumir categoría de mercadería o inferir de descripción
  // Actualmente en Finanzas/Modal se guardan prefijos o descripciones.
  const d = tx.description.toLowerCase();
  // Según requerimiento de Cami, "Mercadería" se especifica explícitamente.
  return d.includes('mercadería') || d.includes('mercaderia') || d.includes('compra de ropa');
};

/**
 * Gasto operativo: Aquel gasto real de caja que SÍ debe afectar la rentabilidad.
 */
export const isOperatingExpense = (tx: Transaction): boolean => {
  if (tx.type !== 'EGRESO') return false;
  if (isInternalTransfer(tx)) return false;
  if (isCashReconciliation(tx)) return false;
  if (isPersonalWithdrawal(tx)) return false;
  if (isMerchandisePurchase(tx)) return false;
  if (isCommission(tx)) return false;
  
  // Lo que sobre, asumiendo que es un egreso real, se considera gasto operativo (envíos, packaging, publicidad, insumos).
  return true; 
};

export const isCustomerPayment = (tx: Transaction): boolean => {
  if (tx.type !== 'INGRESO') return false;
  if (isInternalTransfer(tx)) return false;
  if (isCashReconciliation(tx)) return false;
  // Todo ingreso que no sea transferencia interna es ingreso real de clientes/operativo.
  return true;
};


// ----------------------------------------------------------------------
// 3. CÁLCULOS DE CAJA (Invariante 1)
// ----------------------------------------------------------------------

export const calculateAccountBalance = (transactions: Transaction[], account: 'EFECTIVO' | 'VIRTUAL'): number => {
  let total = 0;
  for (const tx of transactions) {
    if (tx.cuenta === account) {
      // Las transferencias internas SÍ afectan la caja individual.
      // Egresos (incluyendo envíos de transferencia) restan.
      // Ingresos (incluyendo recepción de transferencia) suman.
      total += (tx.type === 'INGRESO' ? tx.amount : -tx.amount);
    }
  }
  return total;
};

export const calculateTotalCash = (transactions: Transaction[]): number => {
  return calculateAccountBalance(transactions, 'EFECTIVO') + calculateAccountBalance(transactions, 'VIRTUAL');
};

// ----------------------------------------------------------------------
// 4. NORMALIZACIÓN DE ÍTEMS Y COSTOS
// ----------------------------------------------------------------------

export const getItemQuantity = (item: any): number => {
  let rawQty = item.quantity || item.cantidad || item.qty || 1;
  if (typeof rawQty === 'string') rawQty = parseInt(rawQty, 10);
  const qty = Number(rawQty);
  if (isNaN(qty) || qty < 1) return 1;
  return Math.floor(qty);
};

export const getItemUnitCostCents = (item: any, productsMap: Record<string, number>): number => {
  // Buscamos todas las variaciones históricas del nombre de la propiedad
  let rawCost = item.wholesaleCost ?? item.costo ?? item.costoUnitario ?? item.cost ?? item.wholesaleCostCents ?? item.costCents ?? 0;
  
  // Limpiamos strings ("$15.000")
  if (typeof rawCost === 'string') {
    rawCost = parseFloat(rawCost.replace(/[^0-9.-]+/g,""));
  }
  
  let cost = Number(rawCost) || 0;
  
  // Si el costo explícito en el item es 0, intentamos recuperarlo del catálogo
  if (cost === 0 && item.productId && productsMap[item.productId]) {
    cost = Number(productsMap[item.productId]) || 0;
  }
  
  // Bloquear costos negativos absurdos
  if (cost < 0) return 0;
  
  return cost;
};

// Convierte un JSONB problemático de Supabase a un Array limpio
const parseOrderItems = (order: Order): any[] => {
  let itemsArr = order.items;
  if (typeof itemsArr === 'string') {
    try { itemsArr = JSON.parse(itemsArr); } catch(e) { itemsArr = []; }
  }
  
  if (itemsArr && !Array.isArray(itemsArr) && typeof itemsArr === 'object') {
    if (Array.isArray((itemsArr as any).items)) itemsArr = (itemsArr as any).items;
    else if (Array.isArray((itemsArr as any).cart)) itemsArr = (itemsArr as any).cart;
    else itemsArr = Object.values(itemsArr);
  }
  
  return Array.isArray(itemsArr) ? itemsArr : [];
};

// ----------------------------------------------------------------------
// 5. MÉTRICAS DE PEDIDOS (Deuda)
// ----------------------------------------------------------------------

export const isValidSale = (order: Order): boolean => {
  const s = order.status?.toUpperCase() || '';
  return s !== 'CANCELADO' && s !== 'ANULADO';
};

export const getOrderFinancialStatus = (order: Order): 'SIN PAGAR' | 'PARCIAL' | 'PAGADO' => {
  const pagado = order.advance_payment || 0;
  const total = order.total_amount || 0;
  if (pagado <= 0) return 'SIN PAGAR';
  if (pagado >= total) return 'PAGADO';
  return 'PARCIAL';
};

export const calculateOrderBalance = (order: Order): number => {
  if (!isValidSale(order)) return 0;
  const total = order.total_amount || 0;
  const advance = order.advance_payment || 0;
  return Math.max(0, total - advance); // Invariante: Nunca saldo negativo visual.
};

export const calculateReceivables = (orders: Order[]): number => {
  let total = 0;
  for (const o of orders) {
    total += calculateOrderBalance(o);
  }
  return total;
};

export const calculateDebtorCustomers = (orders: Order[]): number => {
  const debtors = new Set<string>();
  for (const o of orders) {
    if (calculateOrderBalance(o) > 0) {
      debtors.add(o.customer_id);
    }
  }
  return debtors.size;
};

// ----------------------------------------------------------------------
// 6. MÉTRICAS COMERCIALES (Rendimiento del mes)
// ----------------------------------------------------------------------

export const calculateSales = (orders: Order[], month: number, year: number): number => {
  let total = 0;
  for (const o of orders) {
    if (isValidSale(o) && isSameMonthArgentina(o.created_at, month, year)) {
      total += Math.max(0, o.total_amount || 0);
    }
  }
  return total;
};

export const calculateCOGS = (orders: Order[], productsMap: Record<string, number>, month: number, year: number) => {
  let cogs = 0;
  let hasIncompleteCosts = false;
  let incompleteItemsCount = 0;

  for (const o of orders) {
    if (isValidSale(o) && isSameMonthArgentina(o.created_at, month, year)) {
      const items = parseOrderItems(o);
      for (const item of items) {
        const qty = getItemQuantity(item);
        const cost = getItemUnitCostCents(item, productsMap);
        
        if (cost > 0) {
          cogs += (cost * qty);
        } else {
          hasIncompleteCosts = true;
          incompleteItemsCount++;
        }
      }
    }
  }
  return { cogs, hasIncompleteCosts, incompleteItemsCount };
};

export const calculateOperatingExpenses = (transactions: Transaction[], month: number, year: number): number => {
  let ops = 0;
  for (const tx of transactions) {
    if (isSameMonthArgentina(tx.created_at, month, year) && isOperatingExpense(tx)) {
      ops += Math.abs(tx.amount || 0); // Egresos siempre los sumamos en valor absoluto para restar al final
    }
  }
  return ops;
};

export const calculateCommissions = (transactions: Transaction[], month: number, year: number): number => {
  let com = 0;
  for (const tx of transactions) {
    if (isSameMonthArgentina(tx.created_at, month, year) && isCommission(tx)) {
      com += Math.abs(tx.amount || 0);
    }
  }
  return com;
};

export const calculateNetProfit = (sales: number, cogs: number, commissions: number, opExpenses: number): number => {
  // CMV NO vuelve a incluir "Compra Mercadería" de caja (para evitar descontar doble).
  return sales - cogs - commissions - opExpenses;
};

export const calculateDistribution = (netProfit: number, businessPercent: number) => {
  // Invariantes: 
  // 1. Ganancia negativa -> ambos 0
  // 2. Suma = 100%
  if (netProfit <= 0) {
    return { businessShare: 0, personalShare: 0 };
  }
  
  let pBusiness = businessPercent;
  if (isNaN(pBusiness) || pBusiness < 0) pBusiness = 0;
  if (pBusiness > 100) pBusiness = 100;
  
  const pPersonal = 100 - pBusiness;
  
  const businessShare = Math.round(netProfit * (pBusiness / 100));
  const personalShare = netProfit - businessShare; // Evita centavos perdidos por redondeo
  
  return { businessShare, personalShare };
};
