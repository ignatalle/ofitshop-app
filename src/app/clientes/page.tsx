'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Phone, AtSign, Loader2, Mail, FileText, Trash2, Pencil, ChevronDown, ChevronUp, DollarSign, CheckCircle2, History, MessageCircle } from 'lucide-react';

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

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [customersResponse, salesResponse, ordersResponse] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false })
      ]);

      if (customersResponse.error) throw customersResponse.error;
      if (salesResponse.error) throw salesResponse.error;
      if (ordersResponse.error) throw ordersResponse.error;

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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Editar Cliente
          </h2>
        <form onSubmit={handleSubmitCustomer} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="type">
                Tipo
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white font-medium text-gray-700"
              >
                <option value="MINORISTA">Minorista</option>
                <option value="MAYORISTA">Mayorista</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="phone">
              Teléfono (WhatsApp) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Phone size={18} />
              </span>
              <input
                id="phone"
                type="tel"
                required
                placeholder="Ej. 11 1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
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
                className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
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
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm border-dashed">
            <p className="text-gray-500">No hay clientes en la agenda.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {customers.map((customer) => {
              const debt = getCustomerDebt(customer.id);
              const isExpanded = expandedId === customer.id;
              const customerSales = sales.filter(s => s.customer_id === customer.id);
              
              return (
                <div 
                  key={customer.id} 
                  className={`bg-white rounded-2xl shadow-sm border transition-all overflow-hidden ${
                    isExpanded ? 'border-blue-300 ring-2 ring-blue-50' : 'border-gray-100 hover:border-blue-100'
                  }`}
                >
                  {/* Tarjeta Principal (Clickable) */}
                  <div 
                    onClick={() => toggleAccordion(customer.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none relative"
                  >
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{customer.name}</h3>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          customer.type === 'MAYORISTA' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {customer.type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                          <Phone size={14} className="text-gray-400" />
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
                      
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Contenido Expandido (Ficha del Cliente) */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      
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
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Historial del Cliente</h4>
                            <div className="flex gap-1">
                              <button onClick={(e) => handleEditCustomer(customer, e)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-white rounded-lg border border-transparent hover:border-amber-100 shadow-sm transition-all" aria-label="Editar">
                                <Pencil size={14} />
                              </button>
                              <button onClick={(e) => handleDeleteCustomer(customer.id, e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-red-100 shadow-sm transition-all" aria-label="Eliminar">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>



                            {/* ENCARGOS */}
                            {(() => {
                              const customerOrders = orders.filter(o => o.customer_id === customer.id);
                              if (customerOrders.length === 0) return null;
                              return (
                                <div className="mt-2">
                                  <h5 className="text-xs font-bold text-gray-500 mb-2">PEDIDOS / ENCARGOS</h5>
                                  <div className="flex flex-col gap-3">
                                    {customerOrders.map(order => {
                                      const pending = order.total_amount - order.advance_payment;
                                      return (
                                        <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2 relative">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                                                <div className="flex flex-col gap-1 pr-4">
                                                  {order.items.map((it: any, i: number) => (
                                                    <span key={i} className="font-semibold text-gray-900 leading-tight">
                                                      {it.quantity}x {it.productName} - ${(it.subtotal / 100).toLocaleString('es-AR')}
                                                    </span>
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="font-semibold text-gray-900 pr-6 leading-tight">{order.details}</p>
                                              )}
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                              <select
                                                value={order.status}
                                                onChange={(e) => handleStatusChange(order.id, order.status, e.target.value)}
                                                className="text-[10px] font-bold px-1.5 py-1 rounded-md bg-blue-100 text-blue-700 outline-none border border-blue-200 cursor-pointer focus:ring-2 focus:ring-blue-400 uppercase"
                                              >
                                                <option value="PENDIENTE">PENDIENTE</option>
                                                <option value="RECIBIDO">RECIBIDO</option>
                                                <option value="ENTREGADO">ENTREGADO</option>
                                              </select>
                                              {customer.phone && (
                                                <a 
                                                  href={generateWhatsAppLink(order, customer)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1.5 bg-[#25D366] text-white rounded-full shadow-sm hover:bg-[#1ebd5a] transition-colors"
                                                  title="Enviar ticket por WhatsApp"
                                                >
                                                  <MessageCircle size={14} />
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                                            <span>{new Date(order.created_at).toLocaleDateString('es-AR')}</span>
                                            <span>Total: ${(order.total_amount / 100).toLocaleString('es-AR')}</span>
                                          </div>
                                          
                                          <div className="mt-1 pt-2 border-t border-gray-100 flex items-center justify-between">
                                            <div className={`flex items-center gap-1.5 font-semibold text-sm ${pending <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                              {pending <= 0 ? (
                                                <><CheckCircle2 size={16} /> Pagado</>
                                              ) : (
                                                <><DollarSign size={16} /> Saldo ${(pending / 100).toLocaleString('es-AR')}</>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {orders.filter(o => o.customer_id === customer.id).length === 0 && (
                              <p className="text-sm text-gray-500 italic text-center py-4">Este cliente aún no tiene pedidos ni encargos registrados.</p>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
