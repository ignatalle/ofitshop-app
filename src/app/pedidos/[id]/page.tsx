'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronLeft, PackageOpen, DollarSign, CheckCircle2, Truck, Clock, Trash2, Edit } from 'lucide-react';
import Link from 'next/link';

interface Order {
  id: string;
  customer_id: string;
  details: string;
  items?: any[];
  total_amount: number;
  advance_payment: number;
  status: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  type: string;
}

export default function FichaPedidoPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment states
  const [clientPayment, setClientPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [cuenta, setCuenta] = useState<'EFECTIVO' | 'VIRTUAL'>('VIRTUAL');
  const [hasCommission, setHasCommission] = useState(false);
  const [realIncome, setRealIncome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Status state
  const [orderStatus, setOrderStatus] = useState('');
  
  // Cost editing state
  const [editingCostIndex, setEditingCostIndex] = useState<number | null>(null);
  const [tempCostValue, setTempCostValue] = useState<string>('');
  const [productsMap, setProductsMap] = useState<Record<string, number>>({});

  // Price editing state
  const [editingPriceIndex, setEditingPriceIndex] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
        
      if (orderError) throw orderError;
      
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', orderData.customer_id)
        .single();

      const { data: prodData } = await supabase.from('products').select('id, cost_price');
      const pMap: Record<string, number> = {};
      if (prodData) {
        prodData.forEach((p: any) => {
          if (p.cost_price) pMap[p.id] = p.cost_price;
        });
      }
      setProductsMap(pMap);

      setOrder(orderData);
      setCustomer(customerData);
      setOrderStatus(orderData.status);
      
      // Initialize payment state
      if (orderData.advance_payment > 0) {
        setClientPayment((orderData.advance_payment / 100).toString());
      } else {
        setClientPayment('');
      }

      // Check for existing commission transaction
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('order_id', orderId);
        
      if (txs) {
        const inicialTx = txs.find(t => t.type === 'INGRESO' && t.description.includes('Pago inicial pedido'));
        if (inicialTx) {
          if (inicialTx.description.includes('(TRANSFERENCIA)')) setPaymentMethod('TRANSFERENCIA');
          else if (inicialTx.description.includes('(TARJETA)')) setPaymentMethod('TARJETA');
          else setPaymentMethod('EFECTIVO');
          
          if (inicialTx.cuenta) setCuenta(inicialTx.cuenta);
        }

        const comisionTx = txs.find(t => t.type === 'EGRESO' && t.description.includes('Comisión'));
        if (comisionTx) {
          setHasCommission(true);
          const advance = orderData.advance_payment || 0;
          const rIncome = advance - comisionTx.amount;
          setRealIncome((rIncome / 100).toString());
        } else {
          setHasCommission(false);
          setRealIncome('');
        }
      }

    } catch (error: any) {
      alert("Error al cargar el pedido: " + error.message);
      router.push('/pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      setIsSubmitting(true);
      
      const advanceCents = clientPayment ? Math.round(parseFloat(clientPayment) * 100) : 0;
      
      // Update order advance payment
      const { error: updateError } = await supabase
        .from('orders')
        .update({ advance_payment: advanceCents })
        .eq('id', order.id);
        
      if (updateError) throw updateError;
      
      setOrder({ ...order, advance_payment: advanceCents });

      // Sincronizar transacción inicial
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('order_id', order.id)
        .like('description', 'Pago inicial pedido:%')
        .limit(1);

      if (advanceCents > 0) {
        if (existingTx && existingTx.length > 0) {
          await supabase.from('transactions').update({ 
            amount: advanceCents,
            description: `Pago inicial pedido (${paymentMethod}): ${customer?.name || 'Cliente'}`,
            cuenta: cuenta
          }).eq('id', existingTx[0].id);
        } else {
          const transaction = {
            order_id: order.id,
            type: 'INGRESO',
            amount: advanceCents,
            description: `Pago inicial pedido (${paymentMethod}): ${customer?.name || 'Cliente'}`,
            cuenta: cuenta
          };
          await supabase.from('transactions').insert([transaction]);
        }
      } else {
        if (existingTx && existingTx.length > 0) {
          await supabase.from('transactions').delete().eq('id', existingTx[0].id);
        }
      }

      // Sincronizar transacción de comisión
      const { data: existingComisionTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('order_id', order.id)
        .like('description', 'Comisión de tarjeta%')
        .limit(1);

      if (advanceCents > 0 && hasCommission && realIncome) {
        const realIncomeCents = Math.round(parseFloat(realIncome) * 100);
        const comisionCents = advanceCents - realIncomeCents;
        
        if (comisionCents > 0) {
          if (existingComisionTx && existingComisionTx.length > 0) {
            await supabase.from('transactions').update({ amount: comisionCents, cuenta: cuenta }).eq('id', existingComisionTx[0].id);
          } else {
            const comisionTx = {
              order_id: order.id,
              type: 'EGRESO',
              amount: comisionCents,
              description: `Comisión de tarjeta (Pedido automático)`,
              cuenta: cuenta
            };
            await supabase.from('transactions').insert([comisionTx]);
          }
        } else {
          if (existingComisionTx && existingComisionTx.length > 0) {
            await supabase.from('transactions').delete().eq('id', existingComisionTx[0].id);
          }
        }
      } else {
        if (existingComisionTx && existingComisionTx.length > 0) {
          await supabase.from('transactions').delete().eq('id', existingComisionTx[0].id);
        }
      }

      alert("¡Pagos y finanzas actualizados exitosamente!");
      
    } catch (error: any) {
      alert("Error al actualizar pagos: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (orderStatus === newStatus || !order) return;

    try {
      setOrderStatus(newStatus);
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
      if (error) throw error;
      setOrder({ ...order, status: newStatus });
    } catch (error: any) {
      alert("Error al actualizar estado: " + error.message);
      setOrderStatus(order.status); // revert
    }
  };

  const handleEditCostClick = (item: any, index: number) => {
    setEditingCostIndex(index);
    const costoReal = item.wholesaleCost || (item.productId ? productsMap[item.productId] : 0) || 0;
    setTempCostValue(costoReal ? (costoReal / 100).toString() : '');
  };

  const handleSaveCost = async (index: number) => {
    if (!order || !order.items) return;
    
    try {
      const newItems = [...order.items];
      const newCostCents = tempCostValue ? Math.round(parseFloat(tempCostValue) * 100) : 0;
      
      newItems[index] = {
        ...newItems[index],
        wholesaleCost: newCostCents
      };

      const { error } = await supabase.from('orders').update({ items: newItems }).eq('id', order.id);
      if (error) throw error;

      setOrder({ ...order, items: newItems });
      setEditingCostIndex(null);
    } catch (error: any) {
      alert("Error al actualizar costo: " + error.message);
    }
  };

  const handleEditPriceClick = (item: any, index: number) => {
    setEditingPriceIndex(index);
    setTempPriceValue((item.unitPrice / 100).toString());
  };

  const handleSavePrice = async (index: number) => {
    if (!order || !order.items) return;
    
    try {
      const newItems = [...order.items];
      const newPriceCents = tempPriceValue ? Math.round(parseFloat(tempPriceValue) * 100) : 0;
      
      newItems[index] = {
        ...newItems[index],
        unitPrice: newPriceCents
      };

      // Recalcular total del pedido iterando sobre los items
      const newTotalCents = newItems.reduce((sum, currentItem) => {
        return sum + (currentItem.unitPrice * currentItem.quantity);
      }, 0);

      // Actualizar en base de datos items y total
      const { error } = await supabase.from('orders')
        .update({ items: newItems, total_amount: newTotalCents })
        .eq('id', order.id);
        
      if (error) throw error;

      // Actualizar UI optimistamente
      setOrder({ ...order, items: newItems, total_amount: newTotalCents });
      setEditingPriceIndex(null);
    } catch (error: any) {
      alert("Error al actualizar precio: " + error.message);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    if (!window.confirm("¿Seguro que querés eliminar este pedido? Se borrarán también las transacciones de caja asociadas.")) return;
    
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      
      router.push('/pedidos');
    } catch (error: any) {
      alert("Error al eliminar: " + error.message);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-ofit-pink" />
      </div>
    );
  }

  if (!order) return null;

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  const balance = order.total_amount - order.advance_payment;

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/pedidos" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={24} className="text-ofit-text" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-0.5">
            {customer?.name || 'Cliente'}
          </h1>
          <p className="text-xs text-ofit-text-soft">
            Pedido del {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* Quick Status Buttons */}
      <div className="card p-4 border-none">
        <h2 className="text-sm font-semibold text-ofit-text mb-3">Estado del Pedido</h2>
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => handleStatusChange('PENDIENTE')}
            className={`py-2 px-1 text-xs font-bold rounded-xl flex flex-col items-center gap-1.5 transition-colors border ${orderStatus === 'PENDIENTE' ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
          >
            <Clock size={16} /> Pendiente
          </button>
          <button 
            onClick={() => handleStatusChange('RECIBIDO')}
            className={`py-2 px-1 text-xs font-bold rounded-xl flex flex-col items-center gap-1.5 transition-colors border ${orderStatus === 'RECIBIDO' ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
          >
            <Truck size={16} /> Recibido
          </button>
          <button 
            onClick={() => handleStatusChange('ENTREGADO')}
            className={`py-2 px-1 text-xs font-bold rounded-xl flex flex-col items-center gap-1.5 transition-colors border ${orderStatus === 'ENTREGADO' ? 'bg-[#25D366]/20 border-[#25D366]/30 text-[#1da650]' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
          >
            <CheckCircle2 size={16} /> Entregado
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="card p-5 border-none">
        <h2 className="text-md font-semibold text-ofit-text mb-4 flex items-center gap-2">
          <PackageOpen size={18} className="text-ofit-pink" />
          Prendas Encargadas
        </h2>
        
        <div className="flex flex-col gap-3">
          {order.items && order.items.length > 0 ? (
            order.items.map((item, idx) => {
              const costoReal = item.wholesaleCost || (item.productId ? productsMap[item.productId] : 0) || 0;
              const isEditing = editingCostIndex === idx;
              const hasNoCost = !costoReal || costoReal === 0;

              return (
              <div key={item.id || idx} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ofit-text text-sm">{item.quantity}x {item.productName || item.description}</p>
                    {hasNoCost && !isEditing && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-100">
                        ⚠️ Falta costo
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {editingPriceIndex === idx ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-gray-500">$</span>
                        <input 
                          type="number" min="0" step="0.01" 
                          value={tempPriceValue}
                          onChange={(e) => setTempPriceValue(e.target.value)}
                          className="w-16 h-6 px-1 text-xs border border-gray-300 rounded font-bold"
                          autoFocus
                        />
                        <button onClick={() => handleSavePrice(idx)} className="p-1 text-green-600 hover:bg-green-50 rounded ml-1" title="Guardar Precio">
                          <CheckCircle2 size={14} />
                        </button>
                        <button onClick={() => setEditingPriceIndex(null)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded" title="Cancelar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-ofit-text-soft">${(item.unitPrice / 100).toLocaleString('es-AR')} u.</span>
                        <button onClick={() => handleEditPriceClick(item, idx)} className="p-1 text-gray-400 hover:text-ofit-pink transition-colors">
                          <Edit size={12} />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-gray-500">$</span>
                          <input 
                            type="number" min="0" step="0.01" 
                            value={tempCostValue}
                            onChange={(e) => setTempCostValue(e.target.value)}
                            className="w-16 h-6 px-1 text-xs border border-gray-300 rounded font-bold"
                            autoFocus
                          />
                          <button onClick={() => handleSaveCost(idx)} className="p-1 text-green-600 hover:bg-green-50 rounded ml-1" title="Guardar Costo">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => setEditingCostIndex(null)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded" title="Cancelar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Costo:</span>
                          <span className={`text-xs font-bold ${hasNoCost ? 'text-amber-600' : 'text-gray-500'}`}>
                            ${costoReal ? (costoReal / 100).toLocaleString('es-AR') : '0'}
                          </span>
                          <button onClick={() => handleEditCostClick(item, idx)} className="p-1 text-gray-400 hover:text-ofit-pink transition-colors">
                            <Edit size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="font-bold text-ofit-text text-sm ml-4 whitespace-nowrap">
                  ${(item.subtotal / 100).toLocaleString('es-AR')}
                </div>
              </div>
            )})
          ) : (
            <p className="text-sm text-ofit-text-soft">{order.details}</p>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-end">
           <span className="text-sm font-bold text-gray-500 uppercase">Total</span>
           <span className="text-2xl font-bold text-ofit-text">
             ${(order.total_amount / 100).toLocaleString('es-AR')}
           </span>
        </div>
      </div>

      {/* Payments & Finances */}
      <div className="card p-5 border-none">
        <h2 className="text-md font-semibold text-ofit-text mb-4 flex items-center gap-2">
          <DollarSign size={18} className="text-[#25D366]" />
          Pagos y Finanzas
        </h2>
        
        {/* Balances */}
        <div className="flex gap-4 mb-5">
          <div className="flex-1 bg-green-50 p-3 rounded-xl border border-green-100">
            <span className="block text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Abonado</span>
            <span className="font-bold text-green-700 text-lg">${(order.advance_payment / 100).toLocaleString('es-AR')}</span>
          </div>
          <div className={`flex-1 p-3 rounded-xl border ${balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${balance > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Resta Pagar</span>
            <span className={`font-bold text-lg ${balance > 0 ? 'text-amber-700' : 'text-gray-600'}`}>${(Math.max(0, balance) / 100).toLocaleString('es-AR')}</span>
          </div>
        </div>

        <form onSubmit={handleUpdatePayment} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="input-label mb-1.5">
                💰 Total cobrado (Seña / Total)
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



          <div className="flex flex-col gap-2">
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
              <div className="mt-1 ml-6 relative animate-in fade-in slide-in-from-top-1">
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 font-bold text-white rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 btn-primary mt-2"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <DollarSign size={18} />}
            {isSubmitting ? 'Guardando...' : 'Actualizar Finanzas'}
          </button>
        </form>
      </div>
      
      {/* Danger Zone */}
      <div className="flex justify-center mt-4">
         <button 
           onClick={handleDeleteOrder}
           disabled={isSubmitting}
           className="text-xs font-bold text-red-500/70 hover:text-red-600 transition-colors py-2 px-4 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
         >
           <Trash2 size={14} /> Eliminar Pedido
         </button>
      </div>

    </div>
  );
}
