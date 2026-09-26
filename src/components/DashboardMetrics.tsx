'use client';

import { useMemo } from 'react';
import { BarChart3, CircleDollarSign, ReceiptText, ShoppingBag } from 'lucide-react';
import {
  calculateCOGS,
  calculateCommissions,
  calculateNetProfit,
  calculateOperatingExpenses,
  calculateSales,
  getArgentinaDate,
  isCustomerPayment,
  isSameMonthArgentina,
  isValidSale,
  type Order,
  type Transaction,
} from '@/lib/finance';

type TrendPoint = {
  key: string;
  label: string;
  sales: number;
  collected: number;
  orders: number;
};

type DashboardMetricsProps = {
  orders: Order[];
  transactions: Transaction[];
  productsMap: Record<string, number>;
};

const pct = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
const formatMoney = (value: number) => `$${(value / 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const pointString = (values: number[], max: number, width = 320, height = 116) => {
  if (!values.length) return '';
  const safeMax = Math.max(1, max);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - (value / safeMax) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

export default function DashboardMetrics({ orders, transactions, productsMap }: DashboardMetricsProps) {
  const metrics = useMemo(() => {
    const now = getArgentinaDate(new Date().toISOString());
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previousDate = new Date(currentYear, currentMonth - 1, 1);
    const previousMonth = previousDate.getMonth();
    const previousYear = previousDate.getFullYear();

    const sales = calculateSales(orders, currentMonth, currentYear);
    const previousSales = calculateSales(orders, previousMonth, previousYear);

    const { cogs } = calculateCOGS(orders, productsMap, currentMonth, currentYear);
    const { cogs: previousCogs } = calculateCOGS(orders, productsMap, previousMonth, previousYear);
    const commissions = calculateCommissions(transactions, currentMonth, currentYear);
    const previousCommissions = calculateCommissions(transactions, previousMonth, previousYear);
    const expenses = calculateOperatingExpenses(transactions, currentMonth, currentYear);
    const previousExpenses = calculateOperatingExpenses(transactions, previousMonth, previousYear);

    const profit = calculateNetProfit(sales, cogs, commissions, expenses);
    const previousProfit = calculateNetProfit(previousSales, previousCogs, previousCommissions, previousExpenses);

    const currentOrders = orders.filter(o => isValidSale(o) && isSameMonthArgentina(o.created_at, currentMonth, currentYear));
    const previousOrders = orders.filter(o => isValidSale(o) && isSameMonthArgentina(o.created_at, previousMonth, previousYear));

    const ticket = currentOrders.length ? Math.round(sales / currentOrders.length) : 0;
    const previousTicket = previousOrders.length ? Math.round(previousSales / previousOrders.length) : 0;

    return [
      { label: 'Ventas del mes', value: formatMoney(sales), delta: pct(sales, previousSales), icon: BarChart3 },
      { label: 'Ganancia neta', value: formatMoney(profit), delta: pct(profit, previousProfit), icon: CircleDollarSign },
      { label: 'Ticket promedio', value: formatMoney(ticket), delta: pct(ticket, previousTicket), icon: ReceiptText },
      { label: 'Pedidos del mes', value: String(currentOrders.length), delta: pct(currentOrders.length, previousOrders.length), icon: ShoppingBag },
    ];
  }, [orders, transactions, productsMap]);

  const trends = useMemo(() => {
    const now = getArgentinaDate(new Date().toISOString());
    const days: TrendPoint[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        key: dateKey(d),
        label: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        sales: 0,
        collected: 0,
        orders: 0,
      });
    }

    const byKey = new Map(days.map(point => [point.key, point]));

    for (const order of orders) {
      if (!isValidSale(order)) continue;
      const d = getArgentinaDate(order.created_at);
      const point = byKey.get(dateKey(d));
      if (!point) continue;
      point.sales += Math.max(0, Number(order.total_amount || 0));
      point.orders += 1;
    }

    for (const tx of transactions) {
      if (!isCustomerPayment(tx)) continue;
      const d = getArgentinaDate(tx.created_at);
      const point = byKey.get(dateKey(d));
      if (!point) continue;
      point.collected += Math.max(0, Number(tx.amount || 0));
    }

    const salesTotal = days.reduce((sum, d) => sum + d.sales, 0);
    const collectedTotal = days.reduce((sum, d) => sum + d.collected, 0);
    const orderTotal = days.reduce((sum, d) => sum + d.orders, 0);
    const collectionRate = salesTotal > 0 ? (collectedTotal / salesTotal) * 100 : 0;

    return { days, salesTotal, collectedTotal, orderTotal, collectionRate };
  }, [orders, transactions]);

  const salesValues = trends.days.map(d => d.sales);
  const collectedValues = trends.days.map(d => d.collected);
  const orderValues = trends.days.map(d => d.orders);
  const moneyMax = Math.max(...salesValues, ...collectedValues, 1);
  const ordersMax = Math.max(...orderValues, 1);

  const firstLabel = trends.days[0]?.label || '';
  const middleLabel = trends.days[Math.floor(trends.days.length / 2)]?.label || '';
  const lastLabel = trends.days[trends.days.length - 1]?.label || '';

  return (
    <section className="dashboard-live-metrics" aria-label="Métricas rápidas del negocio">
      <div className="dashboard-trends dashboard-trends--priority">
        <div className="dashboard-trends__head">
          <div>
            <span className="dashboard-live-metrics__eyebrow">ÚLTIMOS 14 DÍAS</span>
            <h3>Ventas vs. cobros</h3>
          </div>
          <div className="dashboard-trends__rate">
            <span>Cobrado / vendido</span>
            <strong>{Math.round(trends.collectionRate)}%</strong>
          </div>
        </div>

        <div className="dashboard-trends__summary">
          <div><span>Vendido</span><strong>{formatMoney(trends.salesTotal)}</strong></div>
          <div><span>Cobrado</span><strong>{formatMoney(trends.collectedTotal)}</strong></div>
          <div><span>Pedidos</span><strong>{trends.orderTotal}</strong></div>
        </div>

        <div className="dashboard-trends__chart-card">
          <div className="dashboard-trends__legend">
            <span className="is-sales"><i /> Ventas</span>
            <span className="is-collected"><i /> Cobros</span>
          </div>
          <svg className="dashboard-trends__chart" viewBox="0 0 320 116" role="img" aria-label="Evolución diaria de ventas y cobros de los últimos 14 días">
            <line x1="0" y1="29" x2="320" y2="29" className="dashboard-trends__gridline" />
            <line x1="0" y1="58" x2="320" y2="58" className="dashboard-trends__gridline" />
            <line x1="0" y1="87" x2="320" y2="87" className="dashboard-trends__gridline" />
            <polyline points={pointString(salesValues, moneyMax)} className="dashboard-trends__line dashboard-trends__line--sales" />
            <polyline points={pointString(collectedValues, moneyMax)} className="dashboard-trends__line dashboard-trends__line--collected" />
          </svg>
          <div className="dashboard-trends__axis"><span>{firstLabel}</span><span>{middleLabel}</span><span>{lastLabel}</span></div>
        </div>

        <div className="dashboard-trends__orders-card">
          <div className="dashboard-trends__orders-head">
            <div>
              <span className="dashboard-live-metrics__label">Ritmo de pedidos</span>
              <strong>{trends.orderTotal} en 14 días</strong>
            </div>
            <span>Pedidos por día</span>
          </div>
          <svg className="dashboard-trends__spark" viewBox="0 0 320 70" role="img" aria-label="Cantidad diaria de pedidos de los últimos 14 días">
            <polyline points={pointString(orderValues, ordersMax, 320, 70)} className="dashboard-trends__line dashboard-trends__line--orders" />
          </svg>
        </div>

        <p className="dashboard-trends__note">Ventas muestra pedidos creados; Cobros muestra ingresos reales de clientes. Son métricas de los últimos 14 días y no tienen por qué coincidir con “Pedidos del mes”.</p>
      </div>

      <div className="dashboard-live-metrics__head">
        <div>
          <span className="dashboard-live-metrics__eyebrow">PULSO DEL NEGOCIO</span>
          <h2>Métricas rápidas</h2>
        </div>
        <span className="dashboard-live-metrics__period">vs. mes anterior</span>
      </div>

      <div className="dashboard-live-metrics__grid">
        {metrics.map(({ label, value, delta, icon: Icon }) => (
          <article className="dashboard-live-metrics__card" key={label}>
            <div className="dashboard-live-metrics__icon"><Icon size={18} /></div>
            <span className="dashboard-live-metrics__label">{label}</span>
            <strong>{value}</strong>
            <span className={`dashboard-live-metrics__delta ${delta < 0 ? 'is-negative' : 'is-positive'}`}>
              {formatPct(delta)} <small>vs. mes anterior</small>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
