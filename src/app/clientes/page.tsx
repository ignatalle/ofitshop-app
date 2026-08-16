'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Phone, AtSign, Loader2, Mail, FileText, Trash2, Pencil, ChevronDown, ChevronUp, DollarSign, CheckCircle2, History, MessageCircle, Plus, Check, X } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  created_at: string;
}

interface Sale {
  id: string;
  customer_id: string;
  details: string;
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  created_at: string;
}

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

const generateWhatsAppLink = (order: Order, customer: Customer) => {
  if (!customer.phone) return '#';
  let text = `¡Hola ${customer.name}! 👋 Te paso el resumen de tu cuenta en Outfit Shop:\n\n*Detalle del pedido:*\n`;
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    order.items.forEach((item: any) => {
      text += `${item.quantity}x ${item.productName} - $${(item.subtotal / 100).toLocaleString('es-AR')}\n`;
    });
  } else {
    text += `${order.details}\n`;
  }
  text += `\n*Total del Pedido:* $${(order.total_amount / 100).toLocaleString('es-AR')}`;
  const pending = order.total_amount - order.advance_payment;
  if (pending > 0) {
    text += `\n*Saldo Pendiente:* $${(pending / 100).toLocaleString('es-AR')}`;
    text += `\n\nPodés abonar por transferencia al alias: ALIAS.DE.PRUEBA`;
  } else {
    text += `\n\n¡Cuenta saldada! Muchas gracias.`;
  }
  
  const cleanPhone = customer.phone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
};

function CustomerProfileCard({
  customer,
  orders,
  setOrders,
  debt,
  productsMap,
  isExpanded,
  onToggleAccordion,
  handleAbonarGlobal,
  isSubmitting,
  handleEditCustomer,
  handleDeleteCustomer,
  handleStatusChange
}: any) {
  const [activeTab, setActiveTab] = useState<'pendientes' | 'completados'>('pendientes');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(5);
  const [editingItem, setEditingItem] = useState<{orderId: string, itemIndex: number} | null>(null);
  const [editItemQuantity, setEditItemQuantity] = useState('1');
  const [editItemName, setEditItemName] = useState('');
  const [editItemCost, setEditItemCost] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);

  const customerOrdersAll = orders.filter((o: any) => o.customer_id === customer.id && o.status !== 'CANCELADO' && o.status !== 'Cancelado');
  
  let totalFacturado = 0;
  let costoTotal = 0;

  customerOrdersAll.forEach((order: any) => {
    totalFacturado += order.total_amount;
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const itemCost = item.wholesaleCost || (item.productId ? productsMap[item.productId] : 0) || 0;
        costoTotal += itemCost * (item.quantity || 1);
      });
    }
  });

  const gananciaNeta = totalFacturado - costoTotal;

  const pendientes = customerOrdersAll.filter((o: any) => o.status !== 'ENTREGADO' || (o.total_amount - o.advance_payment) > 0);
  const completados = customerOrdersAll.filter((o: any) => o.status === 'ENTREGADO' && (o.total_amount - o.advance_payment) <= 0);

  const displayedCompletados = completados.slice(0, visibleCount);

  const handleEditClick = (orderId: string, itemIndex: number, it: any, defaultCost: number) => {
    setEditingItem({ orderId, itemIndex });
    setEditItemQuantity((it.quantity || 1).toString());
    setEditItemName(it.productName || '');
    setEditItemCost((it.wholesaleCost ? it.wholesaleCost / 100 : defaultCost / 100).toString());
    const unitPrice = it.unitPrice || (it.subtotal / (it.quantity || 1));
    setEditItemPrice((unitPrice / 100).toString());
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const handleSaveItemEdit = async (order: any, itemIndex: number) => {
    setIsSavingItem(true);
    try {
      const newItems = [...order.items];
      const parsedCost = Math.max(0, parseFloat(editItemCost) || 0) * 100;
      const parsedPrice = Math.max(0, parseFloat(editItemPrice) || 0) * 100;
      const parsedQuantity = Math.max(1, parseInt(editItemQuantity) || 1);

      newItems[itemIndex] = {
        ...newItems[itemIndex],
        productName: editItemName || 'Producto',
        wholesaleCost: parsedCost,
        unitPrice: parsedPrice,
        quantity: parsedQuantity,
        subtotal: parsedPrice * parsedQuantity
      };

      const newTotal = newItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);

      const { error } = await supabase
        .from('orders')
        .update({ items: newItems, total_amount: newTotal })
        .eq('id', order.id);

      if (error) throw error;

      setOrders((prev: any[]) => prev.map(o => 
        o.id === order.id ? { ...o, items: newItems, total_amount: newTotal } : o
      ));
      setEditingItem(null);
    } catch (err: any) {
      alert('Error guardando ítem: ' + err.message);
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async (order: any, itemIndex: number) => {
    if (!window.confirm('¿Seguro que querés eliminar este artículo del pedido?')) return;
    setIsSavingItem(true);
    try {
      const newItems = [...order.items];
      newItems.splice(itemIndex, 1);
      
      if (newItems.length === 0) {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', order.id);
        
        if (error) throw error;
        
        setOrders((prev: any[]) => prev.filter(o => o.id !== order.id));
      } else {
        const newTotal = newItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
        
        const { error } = await supabase
          .from('orders')
          .update({ items: newItems, total_amount: newTotal })
          .eq('id', order.id);

        if (error) throw error;

        setOrders((prev: any[]) => prev.map(o => 
          o.id === order.id ? { ...o, items: newItems, total_amount: newTotal } : o
        ));
      }
    } catch (err: any) {
      alert('Error eliminando ítem: ' + err.message);
    } finally {
      setIsSavingItem(false);
    }
  };

  const toggleOrderAccordion = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const renderOrderTicket = (order: any, isCollapsedByDefault: boolean) => {
    const pending = order.total_amount - order.advance_payment;
    const hasMissingCost = order.items && order.items.some((it: any) => (!it.wholesaleCost || it.wholesaleCost === 0) && !it.productId);
    const isOrderExpanded = isCollapsedByDefault ? expandedOrders[order.id] : true;

    return (
      <div key={order.id} className={`bg-white border rounded-xl p-0 shadow-[0_2px_10px_rgba(48,40,42,0.02)] flex flex-col relative overflow-hidden ${hasMissingCost ? 'border-amber-300/50' : 'border-gray-200'}`}>
        {isCollapsedByDefault && !isOrderExpanded ? (
          <div 
            onClick={() => toggleOrderAccordion(order.id)}
            className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ofit-text-soft">
                {new Date(order.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-sm font-bold text-ofit-text">${(order.total_amount / 100).toLocaleString('es-AR')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-500 uppercase">
                {order.status}
              </span>
              <ChevronDown size={18} className="text-gray-400" />
            </div>
          </div>
        ) : (
          <>
            {/* Cabecera Ticket */}
            <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100/80 transition-colors" onClick={() => isCollapsedByDefault && toggleOrderAccordion(order.id)}>
              <span className="text-xs font-bold text-ofit-text-soft">
                {new Date(order.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                 {customer.phone && (
                  <a 
                    href={generateWhatsAppLink(order, customer)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 bg-[#25D366] text-white rounded-full shadow-sm hover:bg-[#1ebd5a] transition-colors"
                    title="Enviar ticket por WhatsApp"
                  >
                    <MessageCircle size={14} />
                  </a>
                )}
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, order.status, e.target.value)}
                  className="text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-ofit-pink outline-none border border-blue-200 cursor-pointer focus:ring-2 focus:ring-blue-400 uppercase"
                >
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="RECIBIDO">RECIBIDO</option>
                  <option value="ENTREGADO">ENTREGADO</option>
                </select>
                {isCollapsedByDefault && (
                  <ChevronUp size={18} className="text-gray-400 ml-1" />
                )}
              </div>
            </div>
            
            {/* Cuerpo Ticket: Lista de items */}
            <div className="px-4 py-3">
              {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                <div className="w-full text-sm">
                  {/* Header tabla */}
                  <div className="grid grid-cols-[32px_1fr_60px_60px_40px] gap-2 pb-1.5 border-b border-dashed border-gray-200 text-[10px] uppercase font-bold text-gray-400 mb-2">
                    <div className="text-center">Cant</div>
                    <div>Producto</div>
                    <div className="text-right">Costo</div>
                    <div className="text-right">Precio</div>
                    <div></div>
                  </div>
                  {/* Filas */}
                  <div className="flex flex-col gap-2">
                    {order.items.map((it: any, i: number) => {
                      const itemCost = it.wholesaleCost || (it.productId ? productsMap[it.productId] : 0) || 0;
                      const unitPrice = it.unitPrice || (it.subtotal / (it.quantity || 1));
                      const isEditing = editingItem?.orderId === order.id && editingItem?.itemIndex === i;

                      return (
                        <div key={i} className="group grid grid-cols-[32px_1fr_60px_60px_40px] gap-2 items-center text-xs font-medium text-ofit-text">
                          {isEditing ? (
                            <>
                              <input
                                type="number"
                                min="1"
                                value={editItemQuantity}
                                onChange={(e) => setEditItemQuantity(e.target.value)}
                                className="w-full bg-white border border-blue-200 rounded px-1 py-0.5 text-[10px] text-center font-bold text-gray-600 outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={isSavingItem}
                              />
                              <input
                                type="text"
                                value={editItemName}
                                onChange={(e) => setEditItemName(e.target.value)}
                                className="w-full bg-white border border-blue-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={isSavingItem}
                              />
                              <input
                                type="number"
                                min="0"
                                value={editItemCost}
                                onChange={(e) => setEditItemCost(e.target.value)}
                                className="w-full bg-white border border-blue-200 rounded px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={isSavingItem}
                              />
                              <input
                                type="number"
                                min="0"
                                value={editItemPrice}
                                onChange={(e) => setEditItemPrice(e.target.value)}
                                className="w-full bg-white border border-blue-200 rounded px-1.5 py-0.5 text-xs font-bold text-right outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={isSavingItem}
                              />
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleSaveItemEdit(order, i)} disabled={isSavingItem} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50">
                                  <Check size={14} />
                                </button>
                                <button onClick={cancelEdit} disabled={isSavingItem} className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors disabled:opacity-50">
                                  <X size={14} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-center bg-gray-100 rounded text-[10px] h-fit px-1 py-0.5 font-bold text-gray-600">x{it.quantity}</div>
                              <div className="leading-tight truncate pr-1" title={it.productName || order.details}>{it.productName || order.details}</div>
                              <div className={`text-right ${!itemCost ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>
                                ${(itemCost / 100).toLocaleString('es-AR')}
                              </div>
                              <div className="text-right font-semibold">
                                ${(unitPrice / 100).toLocaleString('es-AR')}
                              </div>
                              <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(order.id, i, it, itemCost)} disabled={isSavingItem} className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDeleteItem(order, i)} disabled={isSavingItem} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-ofit-text py-1 leading-tight">{order.details}</p>
              )}
            </div>

            {/* Pie Ticket: Resumen */}
            <div className="bg-[#fcfcfa] border-t border-gray-100 px-4 py-3 flex items-center justify-between mt-auto">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Abono</span>
                <span className="text-xs font-bold text-gray-600">${(order.advance_payment / 100).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex flex-col gap-0.5 items-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total</span>
                <span className="text-xs font-bold text-gray-800">${(order.total_amount / 100).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex flex-col gap-0.5 items-end">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pendiente</span>
                <span className={`text-sm font-black ${pending > 0 ? 'text-[#A44848]' : 'text-[#367A50]'}`}>
                  ${(pending / 100).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border transition-all overflow-hidden ${
      isExpanded ? 'border-ofit-border ring-2 ring-blue-50' : 'border-gray-100 hover:border-blue-100'
    }`}>
      {/* Tarjeta Principal (Clickable) */}
      <div 
        onClick={() => onToggleAccordion(customer.id)}
        className="p-4 flex items-center justify-between cursor-pointer select-none relative"
      >
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-ofit-text text-lg leading-tight">{customer.name}</h3>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
              customer.type === 'MAYORISTA' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-ofit-pink'
            }`}>
              {customer.type}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-ofit-text-soft font-medium flex items-center gap-1">
              <Phone size={14} className="text-ofit-text-soft" />
              {customer.phone}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Badge de Deuda */}
          <div className={`px-3 py-1.5 rounded-xl flex flex-col items-center justify-center border ${
            debt > 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5">
              {debt > 0 ? 'Debe' : 'Al Día'}
            </span>
            {debt > 0 && (
              <span className="font-black leading-none text-sm">
                ${(debt / 100).toLocaleString('es-AR')}
              </span>
            )}
          </div>
          
          <div className="text-ofit-text-soft">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* Contenido Expandido (Ficha del Cliente) */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          
          {/* Financial Metrics Dashboard */}
          <div className="p-4 bg-white/50 border-b border-gray-100">
            <h4 className="text-[11px] font-bold text-ofit-text-soft uppercase tracking-wider mb-3">Valor Comercial</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-2xl shadow-[0_2px_10px_rgba(48,40,42,0.02)] border border-gray-50 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-ofit-text-soft mb-1">Total Comprado</span>
                <span className="text-lg font-black text-ofit-text">${(totalFacturado / 100).toLocaleString('es-AR')}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-[0_2px_10px_rgba(48,40,42,0.02)] border border-gray-50 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-ofit-text-soft mb-1">Costo Mercadería</span>
                <span className="text-lg font-black text-gray-400">${(costoTotal / 100).toLocaleString('es-AR')}</span>
              </div>
              <div className="bg-emerald-50/30 p-3 rounded-2xl shadow-[0_2px_10px_rgba(48,40,42,0.02)] border border-emerald-100/50 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600/80 mb-1">Ganancia Neta</span>
                <span className="text-lg font-black text-emerald-600">${(gananciaNeta / 100).toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>
        
          {/* Botón Global de Abono */}
          {debt > 0 && (
            <div className="px-4 py-3 bg-red-50/70 border-b border-red-100 flex items-center justify-between">
              <span className="text-sm text-red-800 font-semibold">Saldo Pendiente: ${(debt / 100).toLocaleString('es-AR')}</span>
              <button 
                onClick={() => handleAbonarGlobal(customer.id, customer.name)}
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <DollarSign size={16} />
                Abonar a la Cuenta
              </button>
            </div>
          )}

          <div className="p-4">
            <div className="mb-4">
              <Link 
                href={`/pedidos/nuevo?clienteId=${customer.id}`}
                className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 hover:-translate-y-0.5"
              >
                <Plus size={18} />
                Nuevo Pedido
              </Link>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-ofit-text uppercase tracking-wider">Historial del Cliente</h4>
                <div className="flex gap-1">
                  <button onClick={(e) => handleEditCustomer(customer, e)} className="p-1.5 text-ofit-text-soft hover:text-amber-500 hover:bg-white rounded-lg border border-transparent hover:border-amber-100 shadow-sm transition-all" aria-label="Editar">
                    <Pencil size={14} />
                  </button>
                  <button onClick={(e) => handleDeleteCustomer(customer.id, e)} className="p-1.5 text-ofit-text-soft hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-red-100 shadow-sm transition-all" aria-label="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* TABS */}
              {customerOrdersAll.length > 0 ? (
                <>
                  <div className="flex bg-gray-200 p-1 rounded-xl mb-2">
                    <button
                      onClick={() => setActiveTab('pendientes')}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'pendientes' ? 'bg-white shadow-sm text-ofit-text' : 'text-ofit-text-soft hover:text-ofit-text'}`}
                    >
                      Pendientes ({pendientes.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('completados')}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'completados' ? 'bg-white shadow-sm text-ofit-text' : 'text-ofit-text-soft hover:text-ofit-text'}`}
                    >
                      Completados ({completados.length})
                    </button>
                  </div>

                  {activeTab === 'pendientes' && (
                    <div className="flex flex-col gap-3">
                      {pendientes.length === 0 ? (
                        <p className="text-sm text-ofit-text-soft italic text-center py-4">No hay pedidos pendientes.</p>
                      ) : (
                        pendientes.map((order: any) => renderOrderTicket(order, false))
                      )}
                    </div>
                  )}

                  {activeTab === 'completados' && (
                    <div className="flex flex-col gap-3">
                      {displayedCompletados.length === 0 ? (
                        <p className="text-sm text-ofit-text-soft italic text-center py-4">No hay pedidos completados.</p>
                      ) : (
                        displayedCompletados.map((order: any) => renderOrderTicket(order, true))
                      )}
                      
                      {visibleCount < completados.length && (
                        <button
                          onClick={() => setVisibleCount(prev => prev + 5)}
                          className="w-full py-2.5 mt-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl transition-colors"
                        >
                          Cargar más historial
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-ofit-text-soft italic text-center py-4">Este cliente aún no tiene pedidos ni encargos registrados.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientesContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Estados Formulario Cliente
  const [name, setName] = useState('');
  const [type, setType] = useState('MINORISTA');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados Ficha Cliente (Acordeón)
  const searchParams = useSearchParams();
  const expandParam = searchParams.get('expand');
  const [expandedId, setExpandedId] = useState<string | null>(expandParam);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [customersResponse, salesResponse, ordersResponse, productsResponse] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, cost_price')
      ]);

      if (customersResponse.error) throw customersResponse.error;
      if (salesResponse.error) throw salesResponse.error;
      if (ordersResponse.error) throw ordersResponse.error;
      if (productsResponse.error) throw productsResponse.error;

      const pMap: Record<string, number> = {};
      if (productsResponse.data) {
        productsResponse.data.forEach((p: any) => {
          if (p.cost_price) pMap[p.id] = p.cost_price;
        });
      }
      setProductsMap(pMap);

      setCustomers(customersResponse.data || []);
      setSales(salesResponse.data || []);
      setOrders(ordersResponse.data || []);
    } catch (error: any) {
      alert('Error al cargar los datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -----------------------------------------------------------
  // LÓGICA DE CLIENTES
  // -----------------------------------------------------------
  const handleEditCustomer = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setName(customer.name);
    setType(customer.type || 'MINORISTA');
    setEmail(customer.email || '');
    setPhone(customer.phone || '');
    setInstagram(customer.instagram || '');
    setNotes(customer.notes || '');
    setEditingId(customer.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditCustomer = () => {
    setName('');
    setType('MINORISTA');
    setEmail('');
    setPhone('');
    setInstagram('');
    setNotes('');
    setEditingId(null);
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!phone.trim()) {
      alert("Cami, acordate de poner el número de WhatsApp. Es la única forma de que el sistema no te duplique a los clientes si un día los anotás con otro nombre o apodo.");
      return;
    }

    try {
      setIsSubmitting(true);
      const customerData = {
        name: name.trim(),
        type,
        email: email.trim() || null,
        phone: phone.trim() || null,
        instagram: instagram.trim() || null,
        notes: notes.trim() || null,
      };

      if (editingId) {
        const { data, error } = await supabase.from('customers').update(customerData).eq('id', editingId).select();
        if (error) throw error;
        if (data && data.length > 0) {
          setCustomers(customers.map(c => c.id === editingId ? data[0] : c));
        }
      } else {
        const { data, error } = await supabase.from('customers').insert([customerData]).select();
        if (error) throw error;
        if (data && data.length > 0) {
          setCustomers([data[0], ...customers]);
        }
      }
      cancelEditCustomer();
    } catch (error: any) {
      if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
        alert("Cami, este número de WhatsApp ya lo tenés guardado para otro cliente. Buscalo en la lista de abajo.");
      } else {
        alert(`Error al ${editingId ? 'actualizar' : 'agregar'} el cliente: ` + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Estás seguro de que deseas eliminar este cliente y TODAS sus ventas?')) return;

    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      setCustomers(customers.filter(customer => customer.id !== id));
      setSales(sales.filter(s => s.customer_id !== id));
      setOrders(orders.filter(o => o.customer_id !== id));
      if (editingId === id) cancelEditCustomer();
    } catch (error: any) {
      alert('Error al eliminar el cliente: ' + error.message);
    }
  };

  // -----------------------------------------------------------
  // LÓGICA DE VENTAS Y CUENTA CORRIENTE
  // -----------------------------------------------------------
  const toggleAccordion = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  const getCustomerDebt = (customerId: string) => {
    const customerOrders = orders.filter(o => o.customer_id === customerId);
    let debt = 0;
    customerOrders.forEach(o => {
      debt += (o.total_amount - o.advance_payment);
    });
    return debt;
  };

  const handleAbonarGlobal = async (customerId: string, customerName: string) => {
    const debt = getCustomerDebt(customerId);
    if (debt <= 0) return;

    const amountStr = window.prompt(`Deuda total: $${(debt / 100).toLocaleString('es-AR')}\n¿Cuánto entregó hoy a la cuenta? (sólo números, ej: 5000)`);
    if (!amountStr) return;

    const abonado = parseFloat(amountStr);
    if (isNaN(abonado) || abonado <= 0) {
      alert("Por favor, ingresa un monto válido mayor a 0.");
      return;
    }

    const abonadoCents = Math.round(abonado * 100);
    if (abonadoCents > debt) {
      alert("El monto ingresado es mayor a la deuda total.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const pendingOrders = orders
        .filter(o => o.customer_id === customerId && o.total_amount > o.advance_payment)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let remainingPayment = abonadoCents;
      const updatedOrdersLocal = [...orders];

      for (const order of pendingOrders) {
        if (remainingPayment <= 0) break;

        const orderDebt = order.total_amount - order.advance_payment;
        const amountToApply = Math.min(orderDebt, remainingPayment);
        const newAdvancePayment = order.advance_payment + amountToApply;
        
        let newStatus = order.status;
        if (newAdvancePayment >= order.total_amount && order.status !== 'ENTREGADO') {
          // Si está pagado completamente, podríamos dejarlo como estaba o no tocar el status
          // Generalmente el pago no cambia el estado logístico, así que no lo cambiamos
        }

        const { error: orderError } = await supabase
          .from('orders')
          .update({ advance_payment: newAdvancePayment })
          .eq('id', order.id);

        if (orderError) throw orderError;

        const transaction = {
          order_id: order.id,
          type: 'INGRESO',
          amount: amountToApply,
          description: `Abono a cuenta de ${customerName} (aplicado a encargo)`
        };
        
        const { error: txError } = await supabase.from('transactions').insert([transaction]);
        if (txError) console.error("Error al registrar el pago en finanzas:", txError);

        const orderIndex = updatedOrdersLocal.findIndex(o => o.id === order.id);
        if (orderIndex >= 0) {
          updatedOrdersLocal[orderIndex] = { ...order, advance_payment: newAdvancePayment };
        }

        remainingPayment -= amountToApply;
      }

      await fetchData();
      alert("Abono procesado y distribuido en los encargos más antiguos correctamente.");

    } catch (error: any) {
      alert('Error al procesar el pago: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, currentStatus: string, newStatus: string) => {
    if (currentStatus === newStatus) return;
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error: any) {
       alert("Error al actualizar estado: " + error.message);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1">
          Fichas de Clientes
        </h1>
      </div>

      {/* ------------------------------------------------------
          FORMULARIO SUPERIOR DE CLIENTES (Crear/Editar)
          ------------------------------------------------------ */}
      {/* ------------------------------------------------------
          FORMULARIO SUPERIOR DE CLIENTES (Crear/Editar)
          ------------------------------------------------------ */}
      {editingId && (
        <div className="card p-5 border-none">
          <h2 className="text-lg font-semibold text-ofit-text mb-4">
            Editar Cliente
          </h2>
        <form onSubmit={handleSubmitCustomer} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex-1 min-w-0">
              <label className="input-label mb-1.5" htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                spellCheck={false}
                autoComplete="off"
                placeholder="Ej. Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="input-label mb-1.5" htmlFor="type">
                Tipo
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-ofit-text"
              >
                <option value="MINORISTA">Minorista</option>
                <option value="MAYORISTA">Mayorista</option>
              </select>
            </div>
          </div>

          <div>
            <label className="input-label mb-1.5" htmlFor="phone">
              Teléfono (WhatsApp) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ofit-text-soft">
                <Phone size={18} />
              </span>
              <input
                id="phone"
                type="tel"
                required
                placeholder="Ej. 11 1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !phone.trim()}
              className={`w-full h-12 font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                editingId 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isSubmitting ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Agregar Cliente')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEditCustomer}
                disabled={isSubmitting}
                className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-ofit-text font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
      )}

      {/* ------------------------------------------------------
          LISTA DE CLIENTES Y FICHAS (Acordeones)
          ------------------------------------------------------ */}
      <div className="flex flex-col gap-4 pb-4">
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={32} className="animate-spin text-ofit-pink" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 card border-none border-dashed">
            <p className="text-ofit-text-soft">No hay clientes en la agenda.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {customers.map((customer) => {
              const debt = getCustomerDebt(customer.id);
              const isExpanded = expandedId === customer.id;
              return (
                <CustomerProfileCard
                  key={customer.id}
                  customer={customer}
                  orders={orders}
                  setOrders={setOrders}
                  debt={debt}
                  productsMap={productsMap}
                  isExpanded={isExpanded}
                  onToggleAccordion={toggleAccordion}
                  handleAbonarGlobal={handleAbonarGlobal}
                  isSubmitting={isSubmitting}
                  handleEditCustomer={handleEditCustomer}
                  handleDeleteCustomer={handleDeleteCustomer}
                  handleStatusChange={handleStatusChange}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <Loader2 size={32} className="animate-spin text-ofit-pink" />
      </div>
    }>
      <ClientesContent />
    </Suspense>
  );
}
