'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { BarChart3, CircleDollarSign, ReceiptText, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  calculateCOGS,
  calculateCommissions,
  calculateNetProfit,
  calculateOperatingExpenses,
  calculateSales,
  getArgentinaDate,
  isSameMonthArgentina,
  isValidSale,
} from '@/lib/finance';

type Order = {
  id: string;
  customer_id: string;
  total_amount: number;
  advance_payment: number;
  items: any;
  status: string;
  created_at: string;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  cuenta: 'EFECTIVO' | 'VIRTUAL';
  created_at: string;
};

const pct = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
const formatMoney = (value: number) => `$${(value / 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export default function DashboardMetricsPortal() {
  const pathname = usePathname();
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (pathname !== '/') {
      setMountNode(null);
      return;
    }

    const attach = () => {
      const dashboard = document.querySelector('main > div.max-w-4xl');
      if (!dashboard) return false;

      let slot = document.getElementById('dashboard-live-metrics-slot');
      if (!slot) {
        slot = document.createElement('div');
        slot.id = 'dashboard-live-metrics-slot';
        const hero = dashboard.querySelector('.card.bg-\\[\\#FFF8ED\\]');
        if (hero?.nextSibling) dashboard.insertBefore(slot, hero.nextSibling);
        else dashboard.appendChild(slot);
      }
      setMountNode(slot);
      return true;
    };

    if (attach()) return;
    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') return;
    let active = true;

    (async () => {
      const [ordersRes, txRes, productsRes] = await Promise.all([
        supabase.from('orders').select('id,customer_id,total_amount,advance_payment,items,status,created_at'),
        supabase.from('transactions').select('id,type,amount,description,cuenta,created_at'),
        supabase.from('products').select('id,cost_price'),
      ]);

      if (!active) return;
      if (!ordersRes.error) setOrders((ordersRes.data || []) as Order[]);
      if (!txRes.error) setTransactions((txRes.data || []) as Transaction[]);
      if (!productsRes.error) {
        const map: Record<string, number> = {};
        for (const product of productsRes.data || []) {
          if (product.cost_price) map[product.id] = Number(product.cost_price);
        }
        setProductsMap(map);
      }
    })();

    return () => { active = false; };
  }, [pathname]);

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

  if (pathname !== '/' || !mountNode) return null;

  return createPortal(
    <section className="dashboard-live-metrics" aria-label="Métricas rápidas del negocio">
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
    </section>,
    mountNode
  );
}
