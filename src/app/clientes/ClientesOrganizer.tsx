'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type StatusFilter = 'TODOS' | 'DEBEN' | 'AL_DIA';
type SortMode = 'MAYOR_DEUDA' | 'AZ' | 'MENOR_DEUDA' | 'RECIENTE';

type CustomerMeta = {
  id: string;
  name: string;
  phone: string;
  instagram: string;
  createdAt: string;
  debt: number;
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();

export default function ClientesOrganizer() {
  const [customers, setCustomers] = useState<CustomerMeta[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('DEBEN');
  const [sortMode, setSortMode] = useState<SortMode>('MAYOR_DEUDA');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const [customersRes, ordersRes] = await Promise.all([
          supabase.from('customers').select('id,name,phone,instagram,created_at'),
          supabase.from('orders').select('customer_id,total_amount,advance_payment')
        ]);

        if (customersRes.error) throw customersRes.error;
        if (ordersRes.error) throw ordersRes.error;

        const debtByCustomer = new Map<string, number>();
        for (const order of ordersRes.data || []) {
          const debt = Math.max(0, Number(order.total_amount || 0) - Number(order.advance_payment || 0));
          debtByCustomer.set(order.customer_id, (debtByCustomer.get(order.customer_id) || 0) + debt);
        }

        const next = (customersRes.data || []).map((customer: any) => ({
          id: customer.id,
          name: customer.name || '',
          phone: customer.phone || '',
          instagram: customer.instagram || '',
          createdAt: customer.created_at || '',
          debt: debtByCustomer.get(customer.id) || 0
        }));

        if (mounted) setCustomers(next);
      } catch (error) {
        console.error('No se pudieron cargar los filtros de clientes:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleCustomers = useMemo(() => {
    const term = normalize(search);

    const filtered = customers.filter((customer) => {
      const matchesSearch = !term || [customer.name, customer.phone, customer.instagram]
        .some(value => normalize(value).includes(term));

      const matchesStatus = status === 'TODOS'
        || (status === 'DEBEN' && customer.debt > 0)
        || (status === 'AL_DIA' && customer.debt <= 0);

      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'AZ') return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      if (sortMode === 'MENOR_DEUDA') return a.debt - b.debt || a.name.localeCompare(b.name, 'es');
      if (sortMode === 'RECIENTE') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return b.debt - a.debt || a.name.localeCompare(b.name, 'es');
    });
  }, [customers, search, status, sortMode]);

  useEffect(() => {
    if (loading) return;

    const root = document.querySelector('.clientes-mobile');
    if (!root) return;

    const allByName = new Map(customers.map(customer => [normalize(customer.name), customer]));
    const visibleIndex = new Map(visibleCustomers.map((customer, index) => [customer.id, index]));

    const apply = () => {
      const headings = Array.from(root.querySelectorAll('h3'));

      for (const heading of headings) {
        const name = (heading.textContent || '').trim();
        const customer = allByName.get(normalize(name));
        if (!customer) continue;

        const card = heading.closest('.bg-white.rounded-2xl.shadow-sm.border.transition-all.overflow-hidden') as HTMLElement | null;
        if (!card) continue;

        card.dataset.clientFilterCard = 'true';
        const order = visibleIndex.get(customer.id);
        card.hidden = order === undefined;
        card.style.order = order === undefined ? '9999' : String(order);
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      root.querySelectorAll<HTMLElement>('[data-client-filter-card="true"]').forEach(card => {
        card.hidden = false;
        card.style.removeProperty('order');
      });
    };
  }, [customers, visibleCustomers, loading]);

  const debtCount = customers.filter(customer => customer.debt > 0).length;
  const upToDateCount = customers.length - debtCount;

  return (
    <section className="mx-auto w-full max-w-lg px-4 pt-4" aria-label="Organizar fichas de clientes">
      <div className="rounded-2xl border border-ofit-border bg-white p-3 shadow-sm sm:p-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ofit-text-soft" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, teléfono o Instagram"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-base font-medium text-ofit-text outline-none transition focus:border-ofit-pink focus:bg-white focus:ring-2 focus:ring-ofit-pink/15"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {([
            ['TODOS', `Todos ${customers.length}`],
            ['DEBEN', `Deben ${debtCount}`],
            ['AL_DIA', `Al día ${upToDateCount}`]
          ] as [StatusFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                status === value
                  ? 'border-ofit-pink bg-ofit-pink text-white'
                  : 'border-gray-200 bg-white text-ofit-text-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <SlidersHorizontal size={17} className="shrink-0 text-ofit-text-soft" />
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base font-semibold text-ofit-text outline-none focus:border-ofit-pink focus:ring-2 focus:ring-ofit-pink/15"
          >
            <option value="MAYOR_DEUDA">Ordenar: Mayor deuda</option>
            <option value="AZ">Ordenar: A–Z</option>
            <option value="MENOR_DEUDA">Ordenar: Menor deuda</option>
            <option value="RECIENTE">Ordenar: Más reciente</option>
          </select>
        </div>

        {!loading && (
          <p className="mt-2 text-xs font-medium text-ofit-text-soft">
            Mostrando {visibleCustomers.length} de {customers.length} clientes
          </p>
        )}
      </div>
    </section>
  );
}
