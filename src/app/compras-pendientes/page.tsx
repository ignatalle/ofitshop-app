'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  PackageOpen,
  CheckCircle2,
  XCircle,
  Search,
  Store,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';

interface PendingPurchase {
  id: string;
  order_id: string;
  item_id: string;
  product_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  customer_id: string | null;
  quantity: number;
  color: string | null;
  size: string | null;
  status: 'PENDIENTE' | 'CONSEGUIDO' | 'NO_DISPONIBLE';
  cost_price: number | null;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
  customer?: { name: string };
}

export default function ComprasPendientesPage() {
  const [purchases, setPurchases] = useState<PendingPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveCost, setResolveCost] = useState('');
  const [resolveAccount, setResolveAccount] = useState<'EFECTIVO' | 'VIRTUAL'>('VIRTUAL');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [supplierDraft, setSupplierDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pending_purchases')
        .select(`
          *,
          customer:customers(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPurchases(data || []);
    } catch (err: any) {
      alert('Error al cargar compras pendientes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const s = search.toLowerCase();
      return (
        p.product_name.toLowerCase().includes(s) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(s)) ||
        (p.customer?.name && p.customer.name.toLowerCase().includes(s))
      );
    });
  }, [purchases, search]);

  const groupedPurchases = useMemo(() => {
    const groups: Record<string, PendingPurchase[]> = {};
    filteredPurchases.forEach((p) => {
      const key = p.supplier_name || 'Sin Proveedor';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [filteredPurchases]);

  const handleMarkUnavailable = async (purchase: PendingPurchase) => {
    if (!window.confirm(`¿Marcar "${purchase.product_name}" como NO DISPONIBLE?`)) return;
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('pending_purchases')
        .update({ status: 'NO_DISPONIBLE', resolved_at: now, updated_at: now })
        .eq('id', purchase.id)
        .eq('status', 'PENDIENTE');
      if (error) throw error;
      setPurchases((prev) => prev.map((p) => p.id === purchase.id ? { ...p, status: 'NO_DISPONIBLE', resolved_at: now, updated_at: now } : p));
    } catch (err: any) {
      alert('Error al actualizar estado: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingId) return;
    const purchase = purchases.find((p) => p.id === resolvingId);
    if (!purchase || purchase.status !== 'PENDIENTE') return;

    const parsedCost = Number(resolveCost);
    const newCostCents = Number.isFinite(parsedCost) ? Math.round(parsedCost * 100) : 0;
    if (newCostCents <= 0) return alert('Ingresá un costo real por unidad mayor a $0.');

    try {
      setIsSubmitting(true);
      const { error } = await supabase.rpc('resolve_pending_purchase_with_payment', {
        p_purchase_id: purchase.id,
        p_cost_price: newCostCents,
        p_cuenta: resolveAccount,
      });
      if (error) throw error;
      const now = new Date().toISOString();
      setPurchases((prev) => prev.map((p) => p.id === purchase.id ? { ...p, status: 'CONSEGUIDO', cost_price: newCostCents, resolved_at: now, updated_at: now } : p));
      setResolvingId(null);
      setResolveCost('');
      setResolveAccount('VIRTUAL');
    } catch (err: any) {
      alert('Error al resolver compra: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOrCreateSupplier = async (rawName: string) => {
    const cleanName = rawName.trim();
    if (!cleanName) return { id: null as string | null, name: null as string | null };
    const { data: existing, error: findError } = await supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', cleanName)
      .limit(1);
    if (findError) throw findError;
    if (existing && existing.length > 0) return { id: existing[0].id as string, name: existing[0].name as string };

    const { data: created, error: createError } = await supabase
      .from('suppliers')
      .insert([{ name: cleanName }])
      .select('id, name')
      .single();
    if (createError) throw createError;
    return { id: created.id as string, name: created.name as string };
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningId) return;
    const purchase = purchases.find((p) => p.id === assigningId);
    if (!purchase || purchase.status !== 'PENDIENTE') return;

    try {
      setIsSubmitting(true);
      const supplier = await getOrCreateSupplier(supplierDraft);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('pending_purchases')
        .update({ supplier_id: supplier.id, supplier_name: supplier.name, updated_at: now })
        .eq('id', purchase.id)
        .eq('status', 'PENDIENTE');
      if (error) throw error;
      setPurchases((prev) => prev.map((p) => p.id === purchase.id ? { ...p, supplier_id: supplier.id, supplier_name: supplier.name, updated_at: now } : p));
      setAssigningId(null);
      setSupplierDraft('');
    } catch (err: any) {
      alert('Error al guardar proveedor: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvingPurchase = purchases.find((p) => p.id === resolvingId);
  const resolvingUnitCostCents = Math.max(0, Math.round((Number(resolveCost) || 0) * 100));
  const resolvingTotalCostCents = resolvingPurchase ? resolvingUnitCostCents * Math.max(1, resolvingPurchase.quantity || 1) : 0;

  return (
    <div className="px-3 sm:px-4 pt-3 sm:pt-4 flex flex-col gap-5 sm:gap-6 max-w-3xl mx-auto w-full pb-[calc(7.5rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ofit-text mb-1">Compras Pendientes</h1>
        <p className="text-xs sm:text-sm text-ofit-text-soft leading-snug">Lista de prendas a conseguir para cumplir con pedidos</p>
      </div>

      <div className="relative min-w-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar prenda, cliente o proveedor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-w-0 h-11 sm:h-12 pl-11 pr-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-ofit-pink focus:border-ofit-pink transition-all font-medium text-ofit-text text-sm sm:text-base"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-ofit-pink" /></div>
      ) : purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-gray-400 gap-3 text-center px-4"><PackageOpen size={44} className="opacity-50" /><p className="font-medium text-base sm:text-lg">No hay compras pendientes</p></div>
      ) : (
        <div className="flex flex-col gap-7 sm:gap-8 min-w-0">
          {Object.entries(groupedPurchases).map(([supplierName, groupPurchases]) => {
            const pendingCount = groupPurchases.filter((p) => p.status === 'PENDIENTE').length;
            return (
              <section key={supplierName} className="flex flex-col gap-3 min-w-0">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] min-[360px]:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-1 min-w-0">
                  <Store size={19} className="text-ofit-text shrink-0" />
                  <h2 className="text-sm min-[360px]:text-base sm:text-lg font-black text-ofit-text uppercase tracking-tight truncate min-w-0">{supplierName}</h2>
                  <span className="col-span-2 min-[360px]:col-span-1 justify-self-start min-[360px]:justify-self-auto min-[360px]:ml-auto text-[10px] sm:text-xs font-bold text-white bg-ofit-text px-2 py-1 rounded-full whitespace-nowrap">{pendingCount} pendientes</span>
                </div>

                <div className="flex flex-col gap-3 min-w-0">
                  {groupPurchases.map((p) => (
                    <article key={p.id} className={`bg-white rounded-2xl p-3 sm:p-4 border transition-all min-w-0 ${p.status === 'PENDIENTE' ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-70'}`}>
                      <div className="min-w-0">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="font-black text-base sm:text-lg text-ofit-text shrink-0 pt-0.5">{p.quantity}x</span>
                          <h3 className="font-bold text-ofit-text text-base sm:text-lg leading-snug break-words min-w-0 flex-1">{p.product_name}</h3>
                          {p.status === 'CONSEGUIDO' && <span className="shrink-0 flex items-center gap-1 text-green-600 font-bold text-[10px] min-[390px]:text-xs bg-green-50 px-2 py-1.5 rounded-lg border border-green-100"><CheckCircle2 size={14} /> <span className="hidden min-[360px]:inline">Conseguido</span></span>}
                          {p.status === 'NO_DISPONIBLE' && <span className="shrink-0 flex items-center gap-1 text-red-500 font-bold text-[10px] min-[390px]:text-xs bg-red-50 px-2 py-1.5 rounded-lg border border-red-100"><XCircle size={14} /> <span className="hidden min-[360px]:inline">Agotado</span></span>}
                        </div>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
                          {p.size && <span className="text-[11px] sm:text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md">Talle: {p.size}</span>}
                          {p.color && <span className="text-[11px] sm:text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md">Color: {p.color}</span>}
                          {p.customer?.name && <Link href={`/clientes?expand=${p.customer_id}`} className="text-[11px] sm:text-xs font-bold text-ofit-pink bg-ofit-pink/10 px-2 py-1 rounded-md break-words">Para: {p.customer.name}</Link>}
                        </div>

                        {p.status === 'PENDIENTE' && (
                          <div className="grid grid-cols-1 min-[360px]:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 mt-3 items-center">
                            <button
                              type="button"
                              onClick={() => { setAssigningId(p.id); setSupplierDraft(p.supplier_name || ''); }}
                              className="min-w-0 h-10 px-3 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl inline-flex items-center justify-center gap-1.5"
                            >
                              <Pencil size={13} className="shrink-0" />
                              <span className="truncate">{p.supplier_name ? 'Cambiar proveedor' : 'Asignar proveedor'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setResolvingId(p.id); setResolveCost(p.cost_price ? (p.cost_price / 100).toString() : ''); setResolveAccount('VIRTUAL'); }}
                              disabled={isSubmitting}
                              className="h-10 px-3 rounded-xl bg-green-50 text-green-700 border border-green-100 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <CheckCircle2 size={17} /> Conseguido
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkUnavailable(p)}
                              disabled={isSubmitting}
                              className="h-10 px-3 rounded-xl bg-red-50 text-red-600 border border-red-100 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <XCircle size={17} /> Agotado
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {resolvingId && resolvingPurchase && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top)]">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[calc(100dvh-env(safe-area-inset-top))] flex flex-col overflow-hidden">
            <div className="overflow-y-auto overscroll-contain p-5 sm:p-6 pb-4">
              <h2 className="text-xl font-bold text-ofit-text mb-2">Prenda Conseguida</h2>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">Confirmá cuánto pagaste por cada unidad y de qué cuenta salió la plata.</p>
              <form id="resolve-purchase-form" onSubmit={handleResolveSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Costo real por unidad</label>
                  <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span><input type="number" min="0.01" step="0.01" inputMode="decimal" required autoFocus value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} className="w-full h-14 pl-8 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-400 font-black text-xl text-gray-800" placeholder="0.00" /></div>
                  {resolvingTotalCostCents > 0 && <p className="text-xs text-gray-500 mt-2 leading-relaxed">Egreso total: <strong>${(resolvingTotalCostCents / 100).toLocaleString('es-AR')}</strong>{resolvingPurchase.quantity > 1 ? ` (${resolvingPurchase.quantity} unidades)` : ''}</p>}
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">¿De dónde salió la plata?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setResolveAccount('VIRTUAL')} className={`min-w-0 h-12 rounded-xl border font-bold text-xs min-[360px]:text-sm transition-all ${resolveAccount === 'VIRTUAL' ? 'bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-100' : 'bg-white border-gray-200 text-gray-500'}`}>📱 Virtual</button>
                    <button type="button" onClick={() => setResolveAccount('EFECTIVO')} className={`min-w-0 h-12 rounded-xl border font-bold text-xs min-[360px]:text-sm transition-all ${resolveAccount === 'EFECTIVO' ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-100' : 'bg-white border-gray-200 text-gray-500'}`}>💵 Efectivo</button>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">Se registra como <strong>compra de mercadería</strong>: baja Caja sin duplicar el costo en la ganancia.</div>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 border-t bg-white pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:pb-4 shrink-0">
              <button type="button" onClick={() => { setResolvingId(null); setResolveCost(''); setResolveAccount('VIRTUAL'); }} disabled={isSubmitting} className="h-12 font-bold text-gray-500 bg-gray-100 rounded-xl disabled:opacity-50">Cancelar</button>
              <button form="resolve-purchase-form" type="submit" disabled={isSubmitting || !resolveCost || Number(resolveCost) <= 0} className="h-12 font-bold text-white bg-green-500 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {assigningId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top)]">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[calc(100dvh-env(safe-area-inset-top))] flex flex-col overflow-hidden">
            <form onSubmit={handleSupplierSubmit} className="flex flex-col min-h-0">
              <div className="overflow-y-auto overscroll-contain p-5 sm:p-6 pb-4">
                <h2 className="text-xl font-bold text-ofit-text mb-2">Proveedor</h2>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">Escribí el proveedor de esta compra. Si no existe, se crea.</p>
                <input type="text" value={supplierDraft} onChange={(e) => setSupplierDraft(e.target.value)} placeholder="Ej: Mandarina" autoFocus className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-ofit-pink" />
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 border-t bg-white pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:pb-4 shrink-0">
                <button type="button" onClick={() => { setAssigningId(null); setSupplierDraft(''); }} disabled={isSubmitting} className="h-12 font-bold text-gray-500 bg-gray-100 rounded-xl disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="h-12 font-bold text-white bg-ofit-pink rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting && <Loader2 size={18} className="animate-spin" />} Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
