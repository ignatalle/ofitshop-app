'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Loader2, Plus, X, PackageOpen, DollarSign, Minus, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string | null;
}

interface CartItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  wholesaleCost?: number;
  subtotal: number;
}

function NuevoPedidoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdUrl = searchParams.get('clienteId');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState(clienteIdUrl || '');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Payment states (Initial)
  const [clientPayment, setClientPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [cuenta, setCuenta] = useState<'EFECTIVO' | 'VIRTUAL'>('VIRTUAL');
  const [hasCommission, setHasCommission] = useState(false);
  const [realIncome, setRealIncome] = useState('');

  // Item form states
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number | ''>(1);
  const [itemPrice, setItemPrice] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [itemMargin, setItemMargin] = useState('');

  // Quick Create Customer states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerType, setNewCustomerType] = useState('MINORISTA');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

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
  }, []);

  const handleCostChange = (val: string) => {
    setItemCost(val);
    const costNum = parseFloat(val);
    const marginNum = parseFloat(itemMargin);
    if (!isNaN(costNum) && costNum > 0 && !isNaN(marginNum)) {
      setItemPrice((costNum * (1 + marginNum / 100)).toFixed(2));
    } else if (!val || isNaN(costNum)) {
      setItemMargin('');
    }
  };

  const handleMarginChange = (val: string) => {
    setItemMargin(val);
    const marginNum = parseFloat(val);
    const costNum = parseFloat(itemCost);
    if (!isNaN(costNum) && costNum > 0 && !isNaN(marginNum)) {
      setItemPrice((costNum * (1 + marginNum / 100)).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setItemPrice(val);
    const priceNum = parseFloat(val);
    const costNum = parseFloat(itemCost);
    if (!isNaN(costNum) && costNum > 0 && !isNaN(priceNum)) {
      setItemMargin((((priceNum - costNum) / costNum) * 100).toFixed(1));
    }
  };

  const subtotalCents = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const totalAmountCents = subtotalCents;

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemPrice || !itemQuantity) return;

    const unitPrice = Math.round(parseFloat(itemPrice) * 100);
    const quantity = itemQuantity as number;
    const wholesaleCost = itemCost ? Math.round(parseFloat(itemCost) * 100) : undefined;

    const newItem: CartItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      productName: itemName,
      quantity,
      unitPrice,
      wholesaleCost,
      subtotal: unitPrice * quantity
    };

    setCart([...cart, newItem]);
    setItemName('');
    setItemQuantity(1);
    setItemPrice('');
    setItemCost('');
    setItemMargin('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ, subtotal: newQ * item.unitPrice };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
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

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || cart.length === 0) return;

    const hasItemsWithoutCost = cart.some(item => !item.wholesaleCost || item.wholesaleCost === 0);
    if (hasItemsWithoutCost) {
      const confirmSave = window.confirm("¡Ojo! Tenés prendas en este pedido sin costo cargado. Si lo guardás así, tu ganancia neta del mes no será exacta. ¿Querés guardar el pedido de todas formas?");
      if (!confirmSave) return;
    }

    try {
      setIsSubmitting(true);
      const advanceCents = clientPayment ? Math.round(parseFloat(clientPayment) * 100) : 0;
      
      const detailsText = cart.map(i => `${i.quantity}x ${i.productName}`).join(', ');

      const newOrder = {
        customer_id: selectedCustomerId,
        details: detailsText,
        items: cart,
        total_amount: totalAmountCents,
        advance_payment: advanceCents,
        status: 'PENDIENTE'
      };

      const { data: orderData, error: orderError } = await supabase.from('orders').insert([newOrder]).select();
      if (orderError) throw orderError;

      if (orderData && orderData.length > 0) {
        if (advanceCents > 0) {
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
        
        if (clienteIdUrl) {
          router.push(`/clientes?expand=${clienteIdUrl}`);
        } else {
          router.push(`/pedidos/${orderData[0].id}`);
        }
      }
    } catch (error: any) {
      alert("Error al guardar pedido: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full pb-24">
      <div className="flex items-center gap-3 pt-2">
        <Link href={clienteIdUrl ? `/clientes?expand=${clienteIdUrl}` : "/pedidos"} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={24} className="text-ofit-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1">
            Nuevo Pedido
          </h1>
          <p className="text-sm text-ofit-text-soft">
            Cargá los ítems y registrá la seña
          </p>
        </div>
      </div>

      <div className="card p-5 border-none">
        <h2 className="text-lg font-semibold text-ofit-text mb-4 flex items-center gap-2">
          <PackageOpen size={20} className="text-ofit-pink" />
          Anotar Pedido Exprés
        </h2>
        
        <form onSubmit={handleSubmitOrder} className="flex flex-col gap-4">
          <div>
            <label className="input-label mb-1.5">
              Cliente <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="flex-1 h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white text-ofit-text"
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

          {/* CART LIST */}
          {cart.length > 0 && (
            <div className="flex flex-col gap-3 mt-2 border-t pt-4">
              <h3 className="font-semibold text-ofit-text text-sm">Detalle del Pedido</h3>
              {cart.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-3 sm:items-center p-3 bg-ofit-bg rounded-xl border border-ofit-border relative group">
                  <div className="flex-1">
                    <p className="font-bold text-ofit-text text-sm leading-tight pr-8">{item.productName}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <span className="text-ofit-text-soft">${(item.unitPrice / 100).toLocaleString('es-AR')} u.</span>
                      {item.wholesaleCost && item.wholesaleCost > 0 && (
                        <span className="text-gray-400 ml-2">Costo: ${(item.wholesaleCost / 100).toLocaleString('es-AR')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg">
                      <button type="button" onClick={() => updateQuantity(item.id, -1)} className="p-1.5 text-ofit-text-soft hover:text-ofit-pink hover:bg-ofit-pink-soft rounded-l-lg"><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, 1)} className="p-1.5 text-ofit-text-soft hover:text-ofit-pink hover:bg-ofit-pink-soft rounded-r-lg"><Plus size={14} /></button>
                    </div>
                    
                    <div className="font-bold text-ofit-text w-24 text-right">
                      ${(item.subtotal / 100).toLocaleString('es-AR')}
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute top-2 right-2 p-1.5 text-ofit-text-soft hover:text-red-500 bg-white sm:bg-transparent rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shadow-sm sm:shadow-none"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white p-4 rounded-xl border border-ofit-border flex flex-col gap-3">
            <h3 className="font-semibold text-ofit-text flex items-center gap-2">
              <Plus size={16} className="text-ofit-pink" /> Agregar Ítem
            </h3>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="input-label mb-1">Descripción / Prenda</label>
                <input 
                  type="text" 
                  value={itemName} 
                  onChange={e => setItemName(e.target.value)}
                  placeholder="Ej: Vestido Zara"
                  className="input-field"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="input-label mb-1">Precio Cobrado</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft">$</span>
                    <input 
                      type="number" min="0" step="0.01"
                      value={itemPrice} 
                      onChange={e => handlePriceChange(e.target.value)}
                      placeholder="0.00"
                      className="input-field !pl-7"
                    />
                  </div>
                </div>

                <div className="w-24">
                  <label className="input-label mb-1">Cant.</label>
                  <input 
                    type="number" min="1" step="1"
                    value={itemQuantity} 
                    onChange={e => setItemQuantity(e.target.value ? parseInt(e.target.value) : '')}
                    className="input-field text-center font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="input-label mb-1">Costo unitario (Opcional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft">$</span>
                    <input 
                      type="number" min="0" step="0.01"
                      value={itemCost} 
                      onChange={e => handleCostChange(e.target.value)}
                      placeholder="0.00"
                      className="input-field !pl-7 text-sm"
                    />
                  </div>
                  {(!itemCost || parseFloat(itemCost) <= 0) && (
                    <p className="text-[10px] text-amber-600 font-medium flex items-start gap-1 mt-1.5 leading-tight">
                      ⚠️ Sin costo, la ganancia de esta prenda no se sumará a tus estadísticas.
                    </p>
                  )}
                </div>

                <div className="w-24">
                  <label className="input-label mb-1">Margen %</label>
                  <div className="relative">
                    <input 
                      type="number" min="0" step="0.1"
                      value={itemMargin} 
                      onChange={e => handleMarginChange(e.target.value)}
                      placeholder={itemCost ? "0.0" : "-"}
                      disabled={!itemCost}
                      className="input-field pr-6 text-center font-bold disabled:opacity-50 disabled:bg-gray-100"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ofit-text-soft text-xs">%</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 -mt-1">El costo y margen calculan automáticamente tu ganancia.</p>

              <button
                type="button"
                onClick={handleAddCustomItem}
                disabled={!itemName || !itemPrice || !itemQuantity || !selectedCustomerId}
                className="btn-secondary w-full py-2.5 mt-1 disabled:opacity-50"
              >
                Agregar al Carrito
              </button>
            </div>
          </div>

          {/* TOTAL & ADVANCE */}
          <div className="mt-4 flex flex-col justify-end">
             <span className="block text-sm font-medium text-ofit-text-soft mb-1">Total del Pedido</span>
             <div className="h-12 flex items-center px-4 rounded-xl bg-ofit-bg border border-ofit-border font-bold text-xl text-ofit-text">
               ${(totalAmountCents / 100).toLocaleString('es-AR')}
             </div>
          </div>

          <div className="mt-2 flex gap-3">
            <div className="flex-1">
              <label className="input-label mb-1.5">
                💰 Pago inicial (Seña o Total)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ofit-text-soft">
                  <DollarSign size={16} />
                </span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={clientPayment} onChange={(e) => setClientPayment(e.target.value)}
                  className="input-field !pl-10 font-semibold"
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="input-label mb-1.5">Medio de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value;
                  setPaymentMethod(val);
                  if (val === 'EFECTIVO') setCuenta('EFECTIVO');
                  else setCuenta('VIRTUAL');
                }}
                className="input-field font-semibold text-sm cursor-pointer"
              >
                <option value="EFECTIVO">💵 Efectivo</option>
                <option value="TRANSFERENCIA">🏦 Transferencia</option>
                <option value="TARJETA">💳 Tarjeta</option>
              </select>
            </div>
          </div>



          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasCommission}
                onChange={(e) => setHasCommission(e.target.checked)}
                className="w-4 h-4 rounded text-ofit-pink focus:ring-ofit-pink border-gray-300"
              />
              <span className="text-sm font-semibold text-ofit-text">💳 Me cobraron comisión de plataforma</span>
            </label>

            {hasCommission && (
              <div className="mt-1 ml-6 relative">
                 <label className="block text-xs font-semibold text-ofit-text-soft mb-1">
                   Plata real que te llegó al banco/app
                 </label>
                 <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft text-sm font-bold">
                     $
                   </span>
                   <input
                     type="number" min="0" step="0.01" placeholder="0.00"
                     value={realIncome} onChange={(e) => setRealIncome(e.target.value)}
                     className="input-field !pl-8 h-10 font-semibold"
                   />
                 </div>
                 {(() => {
                   const cPay = parseFloat(clientPayment) || 0;
                   const rInc = parseFloat(realIncome) || 0;
                   if (realIncome === '') return null;
                   if (rInc > cPay) {
                     return <p className="text-xs font-bold text-[#A44848] mt-1.5">❌ El ingreso real no puede ser mayor al pago del cliente.</p>;
                   }
                   if (cPay > rInc) {
                     return <p className="text-xs font-bold text-[#A44848] opacity-90 mt-1.5">⚠️ Comisión descontada: -${(cPay - rInc).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>;
                   }
                   return null;
                 })()}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <button
              type="submit"
              disabled={isSubmitting || !selectedCustomerId || cart.length === 0}
              className={`w-full h-12 font-bold text-white rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 btn-primary`}
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isSubmitting ? 'Guardando...' : 'Crear Pedido'}
            </button>
          </div>
        </form>
      </div>

      {/* Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-ofit-text">Nuevo Cliente</h2>
              <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-ofit-text-soft transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCustomer} className="flex flex-col gap-4">
              <div>
                <label className="input-label mb-1.5">Nombre y Apellido *</label>
                <input
                  required type="text"
                  value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                  className="input-field" placeholder="Ej: Camila Outfit"
                />
              </div>
              <div>
                <label className="input-label mb-1.5">Teléfono / WhatsApp *</label>
                <input
                  required type="tel"
                  value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="input-field" placeholder="Ej: 1122334455"
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
                  className="btn-tertiary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isSubmittingCustomer && <Loader2 size={18} className="animate-spin" />}
                  {isSubmittingCustomer ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
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
