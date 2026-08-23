'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, X, PackageOpen, DollarSign, ChevronLeft, Trash2, CheckCircle2, Copy, Search, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string | null;
}

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
  modality: string | null;
  supplier_id: string | null;
  suppliers: { name: string } | { name: string }[] | null;
}

function NuevoPedidoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdUrl = searchParams.get('clienteId');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState(clienteIdUrl || '');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment and Closing states
  const [clientPayment, setClientPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [cuenta, setCuenta] = useState<'EFECTIVO' | 'VIRTUAL'>('VIRTUAL');
  const [hasCommission, setHasCommission] = useState(false);
  const [realIncome, setRealIncome] = useState('');

  // Quick Create Customer states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerType, setNewCustomerType] = useState('MINORISTA');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Catalog Modal states
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
        if (error) throw error;
        setCustomers(data || []);
      } catch (error: any) {
        alert("Error al cargar clientes: " + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
    
    // Si viene vacío por default agregar una fila vacía
    if (draftItems.length === 0) {
      addManualRow();
    }
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoadingCatalog(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, retail_price, cost_price, stock_quantity, image_url, size, color, modality, supplier_id, suppliers(name)')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setCatalogProducts(data || []);
    } catch (error: any) {
      alert("Error al cargar catálogo: " + error.message);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleOpenCatalog = () => {
    setIsCatalogModalOpen(true);
    if (catalogProducts.length === 0) {
      fetchCatalog();
    }
  };

  const addFromCatalog = (product: CatalogProduct) => {
    const cost = product.cost_price ? (product.cost_price / 100) : 0;
    const price = product.retail_price ? (product.retail_price / 100) : 0;
    let margin = '';
    if (cost > 0 && price > 0) {
      margin = (((price - cost) / cost) * 100).toFixed(1);
    }

    setDraftItems(prev => {
      // Remover filas vacías previas
      const cleanPrev = prev.filter(item => item.productName.trim() !== '' || item.unitPrice !== '');
      return [
        ...cleanPrev,
        {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          productId: product.id,
          quantity: 1,
          productName: product.name,
          wholesaleCost: cost > 0 ? cost.toString() : '',
          margin: margin,
          unitPrice: price > 0 ? price.toString() : '',
          size: product.size || '',
          color: product.color || '',
          needsPurchase: product.modality !== 'STOCK_PROPIO',
          supplierId: product.supplier_id || undefined,
          supplierName: Array.isArray(product.suppliers) ? product.suppliers[0]?.name : (product.suppliers?.name || undefined)
        }
      ];
    });
    setIsCatalogModalOpen(false);
  };

  const addManualRow = () => {
    setDraftItems(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        quantity: 1,
        productName: '',
        wholesaleCost: '',
        margin: '',
        unitPrice: '',
        needsPurchase: false
      }
    ]);
  };

  const totalAmountCents = draftItems.reduce((acc, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : 1;
    const price = parseFloat(item.unitPrice) || 0;
    return acc + Math.round(price * qty * 100);
  }, 0);

  const handleRowChange = (id: string, field: keyof DraftItem, value: string | number | boolean) => {
    setDraftItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const newItem = { ...item, [field]: value } as DraftItem;

      if (field === 'wholesaleCost') {
        const costNum = parseFloat(value as string);
        const marginNum = parseFloat(newItem.margin);
        if (!isNaN(costNum) && costNum > 0 && !isNaN(marginNum)) {
          newItem.unitPrice = (costNum * (1 + marginNum / 100)).toFixed(2);
        } else if (!value || isNaN(costNum)) {
          newItem.margin = '';
        }
      }

      if (field === 'margin') {
        const marginNum = parseFloat(value as string);
        const costNum = parseFloat(newItem.wholesaleCost);
        if (!isNaN(costNum) && costNum > 0 && !isNaN(marginNum)) {
          newItem.unitPrice = (costNum * (1 + marginNum / 100)).toFixed(2);
        }
      }

      if (field === 'unitPrice') {
        const priceNum = parseFloat(value as string);
        const costNum = parseFloat(newItem.wholesaleCost);
        if (!isNaN(costNum) && costNum > 0 && !isNaN(priceNum)) {
          newItem.margin = (((priceNum - costNum) / costNum) * 100).toFixed(1);
        }
      }

      return newItem;
    }));
  };

  const removeRow = (id: string) => {
    setDraftItems(prev => prev.filter(item => item.id !== id));
  };

  const cleanItemsForSave = () => {
    return draftItems.filter(item => item.productName.trim() !== '' && parseFloat(item.unitPrice) > 0).map(item => {
      const unitPriceCents = Math.round(parseFloat(item.unitPrice) * 100);
      const wholesaleCostNum = parseFloat(item.wholesaleCost);
      const wholesaleCostCents = (!isNaN(wholesaleCostNum) && wholesaleCostNum > 0) ? Math.round(wholesaleCostNum * 100) : 0;
      const quantity = typeof item.quantity === 'number' ? item.quantity : 1;

      return {
        id: item.id,
        productId: item.productId || null,
        productName: item.productName,
        size: item.size || null,
        color: item.color || null,
        quantity,
        unitPrice: unitPriceCents,
        wholesaleCost: wholesaleCostCents,
        subtotal: unitPriceCents * quantity,
        needsPurchase: item.needsPurchase,
        supplierId: item.supplierId,
        supplierName: item.supplierName
      };
    });
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) return;

    try {
      setIsSubmittingCustomer(true);
      const dataToInsert = {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        type: newCustomerType
      };

      const { data, error } = await supabase.from('customers').insert([dataToInsert]).select();
      if (error) {
        if (error.code === '23505' || error.message?.includes('unique')) {
           alert("Este número de WhatsApp ya existe en tu agenda.");
           return;
        }
        throw error;
      }

      if (data && data.length > 0) {
        const created = data[0];
        setCustomers([...customers, created].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedCustomerId(created.id);
        
        setIsCustomerModalOpen(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewCustomerType('MINORISTA');
      }
    } catch (error: any) {
      alert("Error al crear cliente: " + error.message);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleCopyBudget = async () => {
    const cleanItems = cleanItemsForSave();
    if (cleanItems.length === 0) {
      alert("Agregá al menos un ítem válido con nombre y precio.");
      return;
    }

    const totalAmountCents = cleanItems.reduce((acc, it) => acc + it.subtotal, 0);
    const totalFormatted = (totalAmountCents / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 });

    const lines = cleanItems.map(it => {
      const priceFormatted = (it.unitPrice / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 });
      let attrs = [];
      if (it.size) attrs.push(it.size);
      if (it.color) attrs.push(it.color);
      const attrStr = attrs.length > 0 ? ` (${attrs.join(', ')})` : '';
      return `▫️ ${it.quantity}x ${it.productName}${attrStr} - $${priceFormatted}`;
    });

    const textToCopy = `¡Hola! ✨ Te paso el detalle de tu pedido:\n\n${lines.join('\n')}\n\nTotal: $${totalFormatted}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      alert("Presupuesto copiado. ¡Listo para pegar en WhatsApp!");
    } catch (err) {
      alert("No se pudo copiar al portapapeles. Intentá copiando manualmente.");
    }
  };

  const handleFinalOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = cleanItemsForSave();
    
    try {
      setIsSubmitting(true);
      const advanceCents = clientPayment ? Math.round(parseFloat(clientPayment) * 100) : 0;
      const calculatedTotalCents = cleanItems.reduce((acc, it) => acc + it.subtotal, 0);
      
      const detailsText = cleanItems.map(i => `${i.quantity}x ${i.productName}`).join(', ');

      const newOrder = {
        customer_id: selectedCustomerId,
        details: detailsText,
        items: cleanItems,
        total_amount: calculatedTotalCents,
        advance_payment: advanceCents,
        status: 'PENDIENTE'
      };

      const { data: orderData, error: orderError } = await supabase.from('orders').insert([newOrder]).select();
      if (orderError) throw orderError;

      if (orderData && orderData.length > 0 && advanceCents > 0) {
        const transaction = {
          order_id: orderData[0].id,
          type: 'INGRESO',
          amount: advanceCents,
          description: `Pago inicial pedido (${paymentMethod}): ${customers.find(c => c.id === selectedCustomerId)?.name || 'Cliente'}`,
          cuenta: cuenta
        };
        const { error: txError } = await supabase.from('transactions').insert([transaction]);
        if (txError) console.error("Error al registrar pago inicial:", txError);
        
        if (hasCommission && realIncome) {
          const realIncomeCents = Math.round(parseFloat(realIncome) * 100);
          const comisionCents = advanceCents - realIncomeCents;
          if (comisionCents > 0) {
            const comisionTx = {
              order_id: orderData[0].id,
              type: 'EGRESO',
              amount: comisionCents,
              description: `Comisión de tarjeta (Pedido automático)`,
              cuenta: cuenta
            };
            await supabase.from('transactions').insert([comisionTx]);
          }
        }
      }
      
      // Upsert en pending_purchases para los ítems que lo requieran
      const pendingPurchasesToInsert = cleanItems
        .filter(i => i.needsPurchase)
        .map(i => ({
          order_id: orderData[0].id,
          item_id: i.id, // usamos el id generado localmente como identificador único del ítem en este pedido
          product_id: i.productId || null,
          supplier_id: i.supplierId || null,
          customer_id: selectedCustomerId,
          product_name: i.productName,
          supplier_name: i.supplierName || null,
          quantity: i.quantity,
          color: i.color || null,
          size: i.size || null,
          cost_price: i.wholesaleCost > 0 ? i.wholesaleCost : null,
          status: 'PENDIENTE',
          updated_at: new Date().toISOString()
        }));

      if (pendingPurchasesToInsert.length > 0) {
        const { error: ppError } = await supabase
          .from('pending_purchases')
          .upsert(pendingPurchasesToInsert, { onConflict: 'order_id,item_id' });
        
        if (ppError) console.error("Error al registrar compras pendientes:", ppError);
      }
      
      alert(advanceCents > 0 ? "¡Pedido creado y caja actualizada exitosamente!" : "¡Pedido creado exitosamente!");
      router.push(`/clientes?expand=${selectedCustomerId}`);
    } catch (error: any) {
      alert("Error al crear pedido: " + error.message);
      setIsSubmitting(false);
    }
  };

  const filteredCatalog = catalogProducts.filter(p => p.name.toLowerCase().includes(catalogSearch.toLowerCase()));

  return (
    <div className="p-4 flex flex-col gap-6 max-w-2xl mx-auto w-full mb-24">
      <div className="flex items-center gap-3 pt-2">
        <Link href={clienteIdUrl ? `/clientes?expand=${clienteIdUrl}` : "/pedidos"} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={24} className="text-ofit-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1">
            Carga Rápida
          </h1>
          <p className="text-sm text-ofit-text-soft">
            Armador de presupuestos y pedidos
          </p>
        </div>
      </div>

      <div className="card p-5 border-none shadow-sm">
        <div className="mb-6">
          <label className="input-label mb-1.5">
            Cliente <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-ofit-pink outline-none transition-all bg-gray-50 focus:bg-white text-ofit-text font-medium"
            >
              <option value="">Seleccionar cliente...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="btn-secondary w-12 h-12 p-0 shadow-none text-ofit-text shrink-0"
              title="Nuevo cliente rápido"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Dynamic Items List */}
        <div>
          {draftItems.map((item, index) => (
            <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm mb-3 flex flex-col gap-2 relative group border border-gray-200">
              
              {/* Row 1: Quantity, Product, Trash */}
              <div className="flex flex-row w-full gap-2 items-center">
                <input 
                  type="number" min="1" step="1" inputMode="numeric"
                  value={item.quantity}
                  onChange={(e) => handleRowChange(item.id, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="1"
                  className="w-16 shrink-0 h-10 px-1 text-center font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ofit-pink transition-all"
                />
                <input 
                  type="text" 
                  spellCheck={false}
                  autoComplete="off"
                  value={item.productName}
                  onChange={(e) => handleRowChange(item.id, 'productName', e.target.value)}
                  placeholder="Ej: Conjunto Nike"
                  disabled={!!item.productId}
                  className={`flex-1 min-w-0 w-full h-10 px-3 text-sm font-medium border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ofit-pink transition-all ${item.productId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 text-ofit-text'}`}
                />
                <button 
                  onClick={() => removeRow(item.id)}
                  className="shrink-0 p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                  title="Eliminar fila"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Fila de Origen de la prenda (Toggle) */}
              <div className="flex w-full pt-2 pb-1 border-b border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer select-none px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors w-full">
                  <input
                    type="checkbox"
                    checked={item.needsPurchase}
                    onChange={(e) => handleRowChange(item.id, 'needsPurchase', e.target.checked)}
                    className="w-4 h-4 rounded text-ofit-pink focus:ring-ofit-pink border-gray-300"
                  />
                  <span className="text-[13px] font-bold text-gray-700">
                    {item.needsPurchase ? '🛍️ Tengo que conseguirla' : '✅ Ya la tengo (Stock)'}
                  </span>
                </label>
              </div>

              {/* Row 2: Talle, Color */}
              <div className="flex flex-row w-full gap-2">
                 <input 
                    type="text" 
                    value={item.size || ''}
                    onChange={(e) => handleRowChange(item.id, 'size', e.target.value)}
                    placeholder="Talle"
                    className="flex-1 min-w-0 h-9 px-3 text-xs font-medium text-ofit-text bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ofit-pink transition-all"
                  />
                  <input 
                    type="text" 
                    value={item.color || ''}
                    onChange={(e) => handleRowChange(item.id, 'color', e.target.value)}
                    placeholder="Color"
                    className="flex-1 min-w-0 h-9 px-3 text-xs font-medium text-ofit-text bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ofit-pink transition-all"
                  />
              </div>

              {/* Row 3: Cost, Margin, Price */}
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block ml-1">Costo</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input 
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={item.wholesaleCost}
                      onChange={(e) => handleRowChange(item.id, 'wholesaleCost', e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 pl-7 pr-1 text-sm text-slate-900 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block ml-1">Margen</label>
                  <div className="relative">
                    <input 
                      type="number" min="0" step="0.1" inputMode="decimal"
                      value={item.margin}
                      onChange={(e) => handleRowChange(item.id, 'margin', e.target.value)}
                      placeholder="0"
                      className="w-full h-10 pr-4 text-center text-sm font-semibold text-slate-900 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block ml-1">Precio</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                    <input 
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={item.unitPrice}
                      onChange={(e) => handleRowChange(item.id, 'unitPrice', e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 pl-7 pr-1 text-sm font-bold text-slate-900 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-ofit-pink transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-2">
            <button 
              onClick={handleOpenCatalog}
              className="flex-[2] py-3 px-4 bg-ofit-pink hover:bg-ofit-pink-hover text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
            >
              <PackageOpen size={18} /> Buscar en Catálogo
            </button>
            <button 
              onClick={addManualRow}
              className="flex-1 py-3 px-4 border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-500 font-bold rounded-xl flex items-center justify-center gap-1 transition-all text-sm"
            >
              <Plus size={16} /> Manual
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-end border-t border-gray-100 pt-4">
          <span className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-1">Total General</span>
          <span className="text-3xl font-black text-ofit-text">${(totalAmountCents / 100).toLocaleString('es-AR')}</span>
        </div>

        {/* Formulario de Pago y Cierre */}
        <div className="mt-6 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-ofit-text mb-4">Cierre y Pago</h2>
          
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="input-label mb-2">💰 Seña o Pago Inicial</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <DollarSign size={18} />
                </span>
                <input
                  type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                  value={clientPayment} onChange={(e) => setClientPayment(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-ofit-pink text-lg font-bold text-ofit-text transition-all"
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="input-label mb-2">Medio de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value;
                  setPaymentMethod(val);
                  if (val === 'EFECTIVO') setCuenta('EFECTIVO');
                  else setCuenta('VIRTUAL');
                }}
                className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-ofit-pink font-semibold text-gray-700 transition-all cursor-pointer"
              >
                <option value="EFECTIVO">💵 Efectivo</option>
                <option value="TRANSFERENCIA">🏦 Transf.</option>
                <option value="TARJETA">💳 Tarjeta</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-50 p-3 rounded-xl border border-gray-100">
              <input
                type="checkbox"
                checked={hasCommission}
                onChange={(e) => setHasCommission(e.target.checked)}
                className="w-5 h-5 rounded text-ofit-pink focus:ring-ofit-pink border-gray-300"
              />
              <span className="text-sm font-semibold text-gray-700">Me cobraron comisión de plataforma</span>
            </label>

            {hasCommission && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                  <label className="block text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">
                    Plata real que te llegó al banco/app
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                      $
                    </span>
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                      value={realIncome} onChange={(e) => setRealIncome(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 font-bold"
                    />
                  </div>
                  {(() => {
                    const cPay = parseFloat(clientPayment) || 0;
                    const rInc = parseFloat(realIncome) || 0;
                    if (realIncome === '') return null;
                    if (rInc > cPay) {
                      return <p className="text-xs font-bold text-red-500 mt-2">❌ El ingreso real no puede ser mayor al pago del cliente.</p>;
                    }
                    if (cPay > rInc) {
                      return <p className="text-xs font-bold text-amber-600 mt-2">⚠️ Comisión descontada: -${(cPay - rInc).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>;
                    }
                    return null;
                  })()}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleCopyBudget}
              disabled={draftItems.length === 0}
              className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Copy size={18} className="text-gray-500" />
              Copiar a WhatsApp
            </button>
            <button
              type="button"
              onClick={(e) => handleFinalOrderSubmit(e as unknown as React.FormEvent)}
              disabled={isSubmitting || totalAmountCents === 0}
              className="flex-[1.5] py-3.5 px-4 bg-ofit-pink hover:bg-ofit-pink-dark text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(240,98,146,0.39)] hover:-translate-y-0.5 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
              Crear Pedido
            </button>
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-10 sm:pb-6 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-ofit-text">Nuevo Cliente Rápido</h2>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-ofit-text-soft transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCustomer} className="flex flex-col gap-4">
              <div>
                <label className="input-label mb-1.5">Nombre y Apellido *</label>
                <input
                  required type="text"
                  spellCheck={false}
                  autoComplete="off"
                  value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                  className="input-field h-12" placeholder="Ej: Camila Outfit"
                />
              </div>
              <div>
                <label className="input-label mb-1.5">Teléfono / WhatsApp *</label>
                <input
                  required type="tel"
                  value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="input-field h-12" placeholder="Ej: 1122334455"
                />
              </div>
              <div>
                <label className="input-label mb-1.5">Tipo de Cliente</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setNewCustomerType('MINORISTA')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${newCustomerType === 'MINORISTA' ? 'border-ofit-pink bg-ofit-pink/10 text-ofit-pink ring-2 ring-ofit-pink/20' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    Minorista
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomerType('MAYORISTA')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${newCustomerType === 'MAYORISTA' ? 'border-purple-600 bg-purple-100 text-purple-700 ring-2 ring-purple-600/20' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    Mayorista
                  </button>
                </div>
              </div>
              
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="btn-tertiary flex-1 h-12"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="btn-primary flex-1 h-12 flex items-center justify-center gap-2"
                >
                  {isSubmittingCustomer && <Loader2 size={18} className="animate-spin" />}
                  {isSubmittingCustomer ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Catalog Modal */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom-full duration-300">
          <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
            <button onClick={() => setIsCatalogModalOpen(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600">
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-bold flex-1">Elegir del Catálogo</h2>
          </div>

          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar prenda..."
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-ofit-pink focus:border-ofit-pink"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 pb-20">
            {loadingCatalog ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 size={32} className="animate-spin mb-2" />
                <p>Cargando prendas...</p>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">No hay prendas que coincidan.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCatalog.map(p => {
                  const retail = p.retail_price ? p.retail_price / 100 : 0;
                  const cost = p.cost_price ? p.cost_price / 100 : 0;
                  return (
                    <div 
                      key={p.id}
                      onClick={() => addFromCatalog(p)}
                      className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex gap-4 items-center cursor-pointer hover:border-ofit-pink transition-all active:scale-[0.98]"
                    >
                      <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center border border-gray-200">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={20} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 truncate">{p.name}</h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-xs font-bold text-ofit-pink bg-ofit-pink/10 px-2 py-0.5 rounded-md">${retail.toLocaleString('es-AR')}</span>
                          {cost > 0 && (
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 line-through">
                              C: ${cost.toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                        {(p.size || p.color) && (
                          <div className="text-[10px] text-gray-500 mt-1 truncate">
                            {p.size && <span>Talle: {p.size} </span>}
                            {p.color && <span>Color: {p.color}</span>}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-ofit-pink">
                        <Plus size={24} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NuevoPedidoPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <Loader2 size={32} className="animate-spin text-ofit-pink" />
      </div>
    }>
      <NuevoPedidoContent />
    </Suspense>
  );
}
