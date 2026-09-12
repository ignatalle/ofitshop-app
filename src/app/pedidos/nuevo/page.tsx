'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronLeft,
  Copy,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string | null;
}

type Account = 'EFECTIVO' | 'VIRTUAL';

interface DraftItem {
  id: string;
  productId?: string;
  quantity: number | '';
  productName: string;
  size?: string;
  color?: string;
  wholesaleCost: string;
  margin: string;
  unitPrice: string;
  needsPurchase: boolean;
  costAccount: Account;
  supplierId?: string;
  supplierName?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  retail_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  size: string | null;
  color: string | null;
  supplier_id: string | null;
  suppliers: { name: string } | { name: string }[] | null;
}

function NuevoPedidoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdUrl = searchParams.get('clienteId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState(clienteIdUrl || '');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clientPayment, setClientPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [cuenta, setCuenta] = useState<Account>('EFECTIVO');
  const [hasCommission, setHasCommission] = useState(false);
  const [realIncome, setRealIncome] = useState('');

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerType, setNewCustomerType] = useState('MINORISTA');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  const emptyItem = (): DraftItem => ({
    id: crypto.randomUUID(),
    quantity: 1,
    productName: '',
    wholesaleCost: '',
    margin: '',
    unitPrice: '',
    needsPurchase: true,
    costAccount: 'VIRTUAL',
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        setCustomers(data || []);
      } catch (error: any) {
        alert('Error al cargar clientes: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
    setDraftItems([emptyItem()]);
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoadingCatalog(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, retail_price, cost_price, stock_quantity, image_url, size, color, supplier_id, suppliers(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCatalogProducts(data || []);
    } catch (error: any) {
      alert('Error al cargar catálogo: ' + error.message);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const addFromCatalog = (product: CatalogProduct) => {
    const cost = product.cost_price ? product.cost_price / 100 : 0;
    const price = product.retail_price ? product.retail_price / 100 : 0;
    const margin = cost > 0 && price > 0 ? (((price - cost) / cost) * 100).toFixed(1) : '';
    const supplierName = Array.isArray(product.suppliers)
      ? product.suppliers[0]?.name
      : product.suppliers?.name || undefined;

    setDraftItems((prev) => [
      ...prev.filter((item) => item.productName.trim() !== '' || item.unitPrice !== ''),
      {
        id: crypto.randomUUID(),
        productId: product.id,
        quantity: 1,
        productName: product.name,
        wholesaleCost: cost > 0 ? cost.toString() : '',
        margin,
        unitPrice: price > 0 ? price.toString() : '',
        size: product.size || '',
        color: product.color || '',
        needsPurchase: true,
        costAccount: 'VIRTUAL',
        supplierId: product.supplier_id || undefined,
        supplierName,
      },
    ]);
    setIsCatalogModalOpen(false);
  };

  const handleRowChange = (id: string, field: keyof DraftItem, value: string | number | boolean) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value } as DraftItem;

        if (field === 'wholesaleCost') {
          const cost = parseFloat(value as string);
          const margin = parseFloat(next.margin);
          if (!isNaN(cost) && cost > 0 && !isNaN(margin)) {
            next.unitPrice = (cost * (1 + margin / 100)).toFixed(2);
          }
        }

        if (field === 'margin') {
          const margin = parseFloat(value as string);
          const cost = parseFloat(next.wholesaleCost);
          if (!isNaN(cost) && cost > 0 && !isNaN(margin)) {
            next.unitPrice = (cost * (1 + margin / 100)).toFixed(2);
          }
        }

        if (field === 'unitPrice') {
          const price = parseFloat(value as string);
          const cost = parseFloat(next.wholesaleCost);
          if (!isNaN(cost) && cost > 0 && !isNaN(price)) {
            next.margin = (((price - cost) / cost) * 100).toFixed(1);
          }
        }

        return next;
      }),
    );
  };

  const totalAmountCents = useMemo(
    () =>
      draftItems.reduce((acc, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : 1;
        return acc + Math.round((parseFloat(item.unitPrice) || 0) * qty * 100);
      }, 0),
    [draftItems],
  );

  const cleanItemsForSave = () =>
    draftItems
      .filter((item) => item.productName.trim() !== '' && parseFloat(item.unitPrice) > 0)
      .map((item) => {
        const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
        const unitPrice = Math.round((parseFloat(item.unitPrice) || 0) * 100);
        const rawCost = parseFloat(item.wholesaleCost);
        const wholesaleCost = !isNaN(rawCost) && rawCost > 0 ? Math.round(rawCost * 100) : 0;
        return {
          id: item.id,
          productId: item.productId || null,
          productName: item.productName.trim(),
          size: item.size || null,
          color: item.color || null,
          quantity,
          unitPrice,
          wholesaleCost,
          subtotal: unitPrice * quantity,
          needsPurchase: item.needsPurchase,
          costPaid: !item.needsPurchase,
          costAccount: !item.needsPurchase ? item.costAccount : null,
          supplierId: item.supplierId || null,
          supplierName: item.supplierName || null,
        };
      });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) return;
    try {
      setIsSubmittingCustomer(true);
      const { data, error } = await supabase
        .from('customers')
        .insert([{ name: newCustomerName.trim(), phone: newCustomerPhone.trim(), type: newCustomerType }])
        .select();
      if (error) throw error;
      const created = data?.[0];
      if (created) {
        setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedCustomerId(created.id);
      }
      setIsCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (error: any) {
      alert('Error al crear cliente: ' + error.message);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleCopyBudget = async () => {
    const items = cleanItemsForSave();
    if (!items.length) return alert('Agregá al menos una prenda válida.');
    const lines = items.map((item) => {
      const attrs = [item.size, item.color].filter(Boolean).join(', ');
      return `▫️ ${item.quantity}x ${item.productName}${attrs ? ` (${attrs})` : ''} - $${(item.unitPrice / 100).toLocaleString('es-AR')}`;
    });
    const total = items.reduce((acc, item) => acc + item.subtotal, 0);
    const text = `¡Hola! ✨ Te paso el detalle de tu pedido:\n\n${lines.join('\n')}\n\nTotal: $${(total / 100).toLocaleString('es-AR')}`;
    await navigator.clipboard.writeText(text);
    alert('Presupuesto copiado.');
  };

  const handleFinalOrderSubmit = async () => {
    const cleanItems = cleanItemsForSave();
    if (!selectedCustomerId) return alert('Seleccioná un cliente.');
    if (!cleanItems.length) return alert('Agregá al menos una prenda válida.');

    const invalidPaid = cleanItems.find((item) => !item.needsPurchase && item.wholesaleCost <= 0);
    if (invalidPaid) {
      return alert(`Para "${invalidPaid.productName}" marcaste que el costo ya fue pagado. Cargá un costo real mayor a $0.`);
    }

    try {
      setIsSubmitting(true);
      const warnings: string[] = [];
      const advanceCents = clientPayment ? Math.round((parseFloat(clientPayment) || 0) * 100) : 0;
      const total = cleanItems.reduce((acc, item) => acc + item.subtotal, 0);
      const details = cleanItems.map((item) => `${item.quantity}x ${item.productName}`).join(', ');

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_id: selectedCustomerId,
          details,
          items: cleanItems,
          total_amount: total,
          advance_payment: advanceCents,
          status: 'PENDIENTE',
        }])
        .select();
      if (orderError) throw orderError;
      const orderId = orderData?.[0]?.id;
      if (!orderId) throw new Error('El pedido no devolvió un id válido.');

      if (advanceCents > 0) {
        const { error } = await supabase.from('transactions').insert([{
          order_id: orderId,
          type: 'INGRESO',
          amount: advanceCents,
          description: `Pago inicial pedido (${paymentMethod}): ${customers.find((c) => c.id === selectedCustomerId)?.name || 'Cliente'}`,
          cuenta,
        }]);
        if (error) warnings.push('No se pudo registrar el pago inicial en Finanzas.');

        if (hasCommission && realIncome) {
          const realIncomeCents = Math.round((parseFloat(realIncome) || 0) * 100);
          const commission = advanceCents - realIncomeCents;
          if (commission > 0) {
            const { error: commissionError } = await supabase.from('transactions').insert([{
              order_id: orderId,
              type: 'EGRESO',
              amount: commission,
              description: '[COMISION] Comisión de tarjeta',
              cuenta,
            }]);
            if (commissionError) warnings.push('No se pudo registrar la comisión en Finanzas.');
          }
        }
      }

      const pending = cleanItems
        .filter((item) => item.needsPurchase)
        .map((item) => ({
          order_id: orderId,
          item_id: item.id,
          product_id: item.productId,
          supplier_id: item.supplierId,
          customer_id: selectedCustomerId,
          product_name: item.productName,
          supplier_name: item.supplierName,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
          cost_price: item.wholesaleCost > 0 ? item.wholesaleCost : null,
          status: 'PENDIENTE',
          updated_at: new Date().toISOString(),
        }));

      if (pending.length) {
        const { error } = await supabase
          .from('pending_purchases')
          .upsert(pending, { onConflict: 'order_id,item_id' });
        if (error) warnings.push('No se pudo sincronizar Compras Pendientes.');
      }

      if (warnings.length) {
        alert(`Pedido creado, pero revisá:\n• ${warnings.join('\n• ')}`);
      } else {
        alert('¡Pedido creado correctamente!');
      }
      router.push(`/clientes?expand=${selectedCustomerId}`);
    } catch (error: any) {
      alert('Error al crear pedido: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCatalog = catalogProducts.filter((p) =>
    p.name.toLowerCase().includes(catalogSearch.toLowerCase()),
  );

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ofit-pink" /></div>;
  }

  return (
    <div className="px-2.5 min-[360px]:px-3 sm:px-4 flex flex-col gap-4 sm:gap-6 max-w-2xl mx-auto w-full mb-24 overflow-x-hidden">
      <div className="flex items-start gap-2 sm:gap-3 pt-2 min-w-0">
        <Link href={clienteIdUrl ? `/clientes?expand=${clienteIdUrl}` : '/pedidos'} className="p-2 -ml-2 rounded-full hover:bg-gray-100 shrink-0">
          <ChevronLeft size={24} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-ofit-text leading-tight">Carga Rápida</h1>
          <p className="text-xs sm:text-sm text-ofit-text-soft mt-1 leading-snug">Pedido + costo + estado de compra en un solo lugar</p>
        </div>
      </div>

      <div className="card p-3 min-[360px]:p-4 sm:p-5 border-none shadow-sm min-w-0 overflow-hidden">
        <label className="input-label mb-1.5">Cliente *</label>
        <div className="grid grid-cols-[minmax(0,1fr)_3rem] min-[380px]:grid-cols-[minmax(0,1fr)_3.25rem] gap-2 mb-5 sm:mb-6 min-w-0">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full min-w-0 h-11 sm:h-12 px-3 sm:px-4 rounded-xl border border-gray-300 bg-gray-50 text-sm sm:text-base"
          >
            <option value="">Seleccionar cliente...</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="btn-secondary w-full h-11 sm:h-12 p-0 flex items-center justify-center" aria-label="Agregar cliente"><Plus size={20} /></button>
        </div>

        {draftItems.map((item) => (
          <div key={item.id} className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-sm mb-4 flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_2.25rem] min-[380px]:grid-cols-[4rem_minmax(0,1fr)_2.5rem] gap-2 items-center min-w-0">
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => handleRowChange(item.id, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full h-10 px-1 text-center border rounded-lg text-sm sm:text-base"
                aria-label="Cantidad"
              />
              <input
                value={item.productName}
                onChange={(e) => handleRowChange(item.id, 'productName', e.target.value)}
                disabled={!!item.productId}
                placeholder="Prenda"
                className="w-full min-w-0 h-10 px-3 border rounded-lg bg-gray-50 disabled:text-gray-500 text-sm sm:text-base"
              />
              <button type="button" onClick={() => setDraftItems((prev) => prev.filter((x) => x.id !== item.id))} className="w-full h-10 flex items-center justify-center text-red-500 rounded-lg hover:bg-red-50" aria-label="Eliminar prenda"><Trash2 size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 min-w-0">
              <input value={item.size || ''} onChange={(e) => handleRowChange(item.id, 'size', e.target.value)} placeholder="Talle" className="w-full min-w-0 h-9 px-3 border rounded-lg text-sm" />
              <input value={item.color || ''} onChange={(e) => handleRowChange(item.id, 'color', e.target.value)} placeholder="Color" className="w-full min-w-0 h-9 px-3 border rounded-lg text-sm" />
            </div>

            <div className="grid grid-cols-3 gap-1.5 min-[380px]:gap-2 min-w-0">
              <div className="min-w-0">
                <label className="text-[9px] min-[360px]:text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Costo</label>
                <input type="number" min="0" step="0.01" value={item.wholesaleCost} onChange={(e) => handleRowChange(item.id, 'wholesaleCost', e.target.value)} className="w-full min-w-0 h-10 px-1.5 min-[380px]:px-2 border rounded-lg text-sm" placeholder="$0" />
              </div>
              <div className="min-w-0">
                <label className="text-[9px] min-[360px]:text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Margen %</label>
                <input type="number" step="0.1" value={item.margin} onChange={(e) => handleRowChange(item.id, 'margin', e.target.value)} className="w-full min-w-0 h-10 px-1.5 min-[380px]:px-2 border rounded-lg text-sm" placeholder="0" />
              </div>
              <div className="min-w-0">
                <label className="text-[9px] min-[360px]:text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Venta</label>
                <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => handleRowChange(item.id, 'unitPrice', e.target.value)} className="w-full min-w-0 h-10 px-1.5 min-[380px]:px-2 border rounded-lg text-sm" placeholder="$0" />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 min-[360px]:p-3 min-w-0">
              <p className="text-[13px] sm:text-sm font-bold text-gray-700 mb-2 leading-snug">¿El costo de esta prenda ya fue pagado?</p>
              <div className="grid grid-cols-2 gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => handleRowChange(item.id, 'needsPurchase', false)}
                  className={`min-w-0 min-h-11 px-2 py-2 rounded-xl border text-xs min-[380px]:text-sm font-bold leading-tight flex items-center justify-center text-center ${!item.needsPurchase ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                  ✅ Sí, ya pagado
                </button>
                <button
                  type="button"
                  onClick={() => handleRowChange(item.id, 'needsPurchase', true)}
                  className={`min-w-0 min-h-11 px-2 py-2 rounded-xl border text-xs min-[380px]:text-sm font-bold leading-tight flex items-center justify-center text-center ${item.needsPurchase ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                  🛍️ No, falta comprar
                </button>
              </div>

              {!item.needsPurchase ? (
                <div className="mt-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">¿De dónde salió la plata?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['EFECTIVO', 'VIRTUAL'] as Account[]).map((account) => (
                      <button
                        key={account}
                        type="button"
                        onClick={() => handleRowChange(item.id, 'costAccount', account)}
                        className={`min-w-0 h-10 px-2 rounded-lg border text-xs min-[380px]:text-sm font-bold ${item.costAccount === account ? 'bg-ofit-pink/10 border-ofit-pink text-ofit-pink' : 'bg-white border-gray-200 text-gray-500'}`}
                      >
                        {account === 'EFECTIVO' ? '💵 Efectivo' : '📱 Virtual'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] min-[360px]:text-[11px] leading-snug text-emerald-700 mt-2">Se descuenta de Caja al crear el pedido.</p>
                </div>
              ) : (
                <p className="text-[10px] min-[360px]:text-[11px] leading-snug text-amber-700 mt-2">Todavía no se descuenta. Va a Compras Pendientes hasta que Cami la compre.</p>
              )}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-3 gap-2 min-w-0">
          <button type="button" onClick={() => { setIsCatalogModalOpen(true); if (!catalogProducts.length) fetchCatalog(); }} className="col-span-2 min-w-0 py-3 px-2 bg-ofit-pink text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs min-[380px]:text-sm"><PackageOpen size={17} className="shrink-0" /> <span className="truncate">Buscar en Catálogo</span></button>
          <button type="button" onClick={() => setDraftItems((prev) => [...prev, emptyItem()])} className="min-w-0 py-3 px-2 border-2 border-dashed rounded-xl font-bold text-gray-500 text-xs min-[380px]:text-sm"><Plus size={16} className="inline" /> Manual</button>
        </div>

        <div className="mt-6 border-t pt-4 text-right">
          <p className="text-xs font-bold text-gray-400 uppercase">Total General</p>
          <p className="text-2xl sm:text-3xl font-black break-words">${(totalAmountCents / 100).toLocaleString('es-AR')}</p>
        </div>

        <div className="mt-6 bg-gray-50 p-3 min-[380px]:p-4 rounded-2xl border min-w-0 overflow-hidden">
          <h2 className="text-base sm:text-lg font-bold mb-4">Cierre y Pago del Cliente</h2>
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3 mb-3 min-w-0">
            <div className="min-w-0">
              <label className="input-label mb-1">Seña / Pago inicial</label>
              <div className="relative"><DollarSign size={16} className="absolute left-3 top-3.5 text-gray-400" /><input type="number" min="0" step="0.01" value={clientPayment} onChange={(e) => setClientPayment(e.target.value)} className="w-full min-w-0 h-11 pl-9 pr-3 border rounded-xl" /></div>
            </div>
            <div className="min-w-0">
              <label className="input-label mb-1">Medio</label>
              <select value={paymentMethod} onChange={(e) => { const val = e.target.value; setPaymentMethod(val); setCuenta(val === 'EFECTIVO' ? 'EFECTIVO' : 'VIRTUAL'); }} className="w-full min-w-0 h-11 px-3 border rounded-xl">
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs min-[380px]:text-sm font-semibold mb-3"><input type="checkbox" checked={hasCommission} onChange={(e) => setHasCommission(e.target.checked)} /> Me cobraron comisión</label>
          {hasCommission && <input type="number" min="0" step="0.01" value={realIncome} onChange={(e) => setRealIncome(e.target.value)} placeholder="Plata real que ingresó" className="w-full min-w-0 h-11 px-3 border rounded-xl mb-3" />}

          <div className="grid grid-cols-2 gap-2 min-w-0">
            <button type="button" onClick={handleCopyBudget} className="min-w-0 py-3 px-2 bg-white border rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs min-[380px]:text-sm"><Copy size={17} className="shrink-0" /> WhatsApp</button>
            <button type="button" onClick={handleFinalOrderSubmit} disabled={isSubmitting || totalAmountCents === 0} className="min-w-0 py-3 px-2 bg-ofit-pink text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs min-[380px]:text-sm disabled:opacity-50">
              {isSubmitting ? <Loader2 className="animate-spin shrink-0" size={18} /> : <CheckCircle2 className="shrink-0" size={18} />} Crear Pedido
            </button>
          </div>
        </div>
      </div>

      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center">
          <form onSubmit={handleCreateCustomer} className="bg-white w-full sm:max-w-md p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Nuevo Cliente</h2><button type="button" onClick={() => setIsCustomerModalOpen(false)} aria-label="Cerrar"><X /></button></div>
            <input required value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Nombre" className="w-full h-11 px-3 border rounded-xl mb-3" />
            <input required value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="WhatsApp" className="w-full h-11 px-3 border rounded-xl mb-3" />
            <select value={newCustomerType} onChange={(e) => setNewCustomerType(e.target.value)} className="w-full h-11 px-3 border rounded-xl mb-4"><option value="MINORISTA">Minorista</option><option value="MAYORISTA">Mayorista</option></select>
            <button disabled={isSubmittingCustomer} className="w-full h-11 bg-ofit-pink text-white rounded-xl font-bold">{isSubmittingCustomer ? 'Guardando...' : 'Guardar cliente'}</button>
          </form>
        </div>
      )}

      {isCatalogModalOpen && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="p-3 sm:p-4 border-b flex items-center gap-3 pt-[calc(.75rem+env(safe-area-inset-top))] sm:pt-4"><button onClick={() => setIsCatalogModalOpen(false)} aria-label="Volver"><ChevronLeft /></button><h2 className="font-bold text-lg flex-1 min-w-0 truncate">Elegir del Catálogo</h2></div>
          <div className="p-3 sm:p-4 border-b"><div className="relative"><Search size={18} className="absolute left-3 top-3 text-gray-400" /><input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Buscar prenda..." className="w-full h-11 pl-10 pr-3 border rounded-xl" /></div></div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {loadingCatalog ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : filteredCatalog.map((p) => (
              <button key={p.id} type="button" onClick={() => addFromCatalog(p)} className="w-full min-w-0 bg-white p-3 rounded-2xl border shadow-sm flex gap-3 items-center mb-3 text-left overflow-hidden">
                <div className="w-14 h-14 min-[380px]:w-16 min-[380px]:h-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" />}</div>
                <div className="flex-1 min-w-0"><p className="font-bold truncate">{p.name}</p><p className="text-sm text-ofit-pink font-bold truncate">${((p.retail_price || 0) / 100).toLocaleString('es-AR')}</p></div><Plus className="text-ofit-pink shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NuevoPedidoPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-ofit-pink" /></div>}>
      <NuevoPedidoContent />
    </Suspense>
  );
}
