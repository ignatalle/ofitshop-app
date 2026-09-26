'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronLeft, PackageOpen, DollarSign, CheckCircle2, Truck, Clock, Trash2, Edit } from 'lucide-react';
import Link from 'next/link';
import { getArgentinaDate, parsePesosToCents } from '@/lib/finance';

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

    } catch (error: any) {
      alert("Error al cargar el pedido: " + error.message);
      router.push('/pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (orderStatus === newStatus || !order) return;
    if (!['PENDIENTE', 'RECIBIDO', 'ENTREGADO'].includes(newStatus)) {
      alert('Estado de pedido inválido.');
      return;
    }

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

    const originalItem = order.items[index];
    const parsedCostCents = parsePesosToCents(tempCostValue);
    if (parsedCostCents === null || parsedCostCents < 0) {
      alert('Ingresá un costo válido.');
      return;
    }

    if (originalItem?.costPaid === true || originalItem?.needsPurchase === false) {
      alert('Este costo ya impactó en Caja. No se puede cambiar desde el pedido porque desincronizaría Finanzas.');
      return;
    }

    if (originalItem?.id) {
      const { data: purchaseState, error: purchaseError } = await supabase
        .from('pending_purchases')
        .select('status')
        .eq('order_id', order.id)
        .eq('item_id', originalItem.id)
        .maybeSingle();

      if (purchaseError) {
        alert('No se pudo verificar el estado financiero de la compra: ' + purchaseError.message);
        return;
      }

      if (purchaseState?.status === 'CONSEGUIDO') {
        alert('Esta compra ya fue pagada y registrada en Caja. No se puede modificar el costo desde el pedido.');
        return;
      }
    }

    try {
      const newItems = [...order.items];
      const newCostCents = parsedCostCents;

      newItems[index] = {
        ...newItems[index],
        wholesaleCost: newCostCents
      };

      const { error } = await supabase.from('orders').update({ items: newItems }).eq('id', order.id);
      if (error) throw error;

      setOrder({ ...order, items: newItems });
      setEditingCostIndex(null);
    } catch (error: any) {
      alert('Error al actualizar costo: ' + error.message);
    }
  };

  const handleEditPriceClick = (item: any, index: number) => {
    setEditingPriceIndex(index);
    setTempPriceValue((item.unitPrice / 100).toString());
  };

  const handleSavePrice = async (index: number) => {
    if (!order || !order.items) return;

    const parsedPriceCents = parsePesosToCents(tempPriceValue);
    if (parsedPriceCents === null || parsedPriceCents <= 0) {
      alert('El precio de venta debe ser mayor a $0.');
      return;
    }

    try {
      const newItems = [...order.items];
      const newPriceCents = parsedPriceCents;
      const quantity = Math.max(1, Number(newItems[index].quantity) || 1);

      newItems[index] = {
        ...newItems[index],
        unitPrice: newPriceCents,
        subtotal: newPriceCents * quantity,
      };

      const newTotalCents = newItems.reduce((sum, currentItem) => {
        const qty = Math.max(1, Number(currentItem.quantity) || 1);
        const unitPrice = Math.max(0, Number(currentItem.unitPrice) || 0);
        return sum + (unitPrice * qty);
      }, 0);

      if (newTotalCents < order.advance_payment) {
        alert('No podés bajar el total por debajo de lo que la clienta ya abonó.');
        return;
      }

      const { error } = await supabase.from('orders')
        .update({ items: newItems, total_amount: newTotalCents })
        .eq('id', order.id);

      if (error) throw error;

      setOrder({ ...order, items: newItems, total_amount: newTotalCents });
      setEditingPriceIndex(null);
    } catch (error: any) {
      alert('Error al actualizar precio: ' + error.message);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;

    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id);

    if (countError) {
      alert('No se pudo verificar el historial financiero: ' + countError.message);
      return;
    }

    if ((count || 0) > 0 || order.advance_payment > 0) {
      alert('Este pedido tiene movimientos financieros. Para proteger Caja e historial no se puede eliminar directamente.');
      return;
    }

    if (!window.confirm('¿Seguro que querés eliminar este pedido sin movimientos financieros?')) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      router.push('/pedidos');
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
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
    const d = getArgentinaDate(isoStr);
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(d);
  };

  const balance = Math.max(0, order.total_amount - order.advance_payment);

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
            className={`min-h-12 py-2 px-1 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors border ${orderStatus === 'PENDIENTE' ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
          >
            <Clock size={16} /> Pendiente
          </button>
          <button 
            onClick={() => handleStatusChange('RECIBIDO')}
            className={`min-h-12 py-2 px-1 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors border ${orderStatus === 'RECIBIDO' ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
          >
            <Truck size={16} /> Recibido
          </button>
          <button 
            onClick={() => handleStatusChange('ENTREGADO')}
            className={`min-h-12 py-2 px-1 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors border ${orderStatus === 'ENTREGADO' ? 'bg-[#25D366]/20 border-[#25D366]/30 text-[#1da650]' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
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
                          type="number" min="0.01" step="0.01" inputMode="decimal"
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
                            type="number" min="0" step="0.01" inputMode="decimal"
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

        <div className="flex flex-col gap-3">
          <p className="text-sm text-ofit-text-soft leading-relaxed">
            Los cobros ya no se editan manualmente desde el pedido. Cada nuevo abono se registra de forma atómica para que deuda y Caja siempre coincidan.
          </p>
          <Link
            href={`/clientes?expand=${order.customer_id}`}
            className="w-full min-h-11 px-4 btn-primary rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <DollarSign size={18} />
            Registrar abono desde la ficha
          </Link>
        </div>
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
