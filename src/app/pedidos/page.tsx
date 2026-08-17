'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Clock, Truck, CheckCircle2, ChevronRight, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calculateOrderBalance } from '@/lib/finance';

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string | null;
}

interface Order {
  id: string;
  customer_id: string;
  details: string;
  items?: any[];
  total_amount: number;
  advance_payment: number;
  status: string; // PENDIENTE, RECIBIDO, ENTREGADO
  created_at: string;
}

type FilterTab = 'TODOS' | 'PENDIENTES' | 'COMPLETADOS';

export default function PedidosDashboardPage() {
  const router = useRouter();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<FilterTab>('PENDIENTES');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [custRes, ordRes] = await Promise.all([
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('orders').select('*').order('created_at', { ascending: false })
      ]);

      if (custRes.error) throw custRes.error;
      if (ordRes.error) throw ordRes.error;

      setCustomers(custRes.data || []);
      setOrders(ordRes.data || []);
    } catch (error: any) {
      alert("Error al cargar pedidos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCustomerName = (id: string) => {
    const c = customers.find(c => c.id === id);
    return c ? c.name : 'Cliente desconocido';
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PENDIENTE': return <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md"><Clock size={10} /> Pendiente</span>;
      case 'RECIBIDO': return <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md"><Truck size={10} /> Recibido</span>;
      case 'ENTREGADO': return <span className="flex items-center gap-1 text-[10px] font-bold text-[#1da650] bg-[#25D366]/20 px-2 py-0.5 rounded-md"><CheckCircle2 size={10} /> Entregado</span>;
      default: return null;
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'TODOS') return true;
    
    const isPaid = calculateOrderBalance(order as any) <= 0;
    const isDelivered = order.status === 'ENTREGADO';
    
    if (activeTab === 'COMPLETADOS') {
      return isPaid && isDelivered;
    }
    
    if (activeTab === 'PENDIENTES') {
      return !isPaid || !isDelivered;
    }
    
    return true;
  });

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
      
      {/* Header & New Button */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1">
            Pedidos
          </h1>
          <p className="text-sm text-ofit-text-soft">
            Historial y seguimiento
          </p>
        </div>
        <Link 
          href="/pedidos/nuevo"
          className="btn-primary py-2.5 px-4 rounded-xl flex items-center gap-2 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 hover:-translate-y-0.5"
        >
          <Plus size={18} />
          Carga Rápida
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('PENDIENTES')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'PENDIENTES' ? 'bg-white text-ofit-pink shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Pendientes
        </button>
        <button
          onClick={() => setActiveTab('COMPLETADOS')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'COMPLETADOS' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Completados
        </button>
        <button
          onClick={() => setActiveTab('TODOS')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'TODOS' ? 'bg-white text-ofit-text shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Todos
        </button>
      </div>

      {/* Order List */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-ofit-pink" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 card border-none border-dashed bg-transparent">
            <PackageOpen size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-ofit-text-soft font-medium">No hay pedidos en esta vista.</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isPaid = order.advance_payment >= order.total_amount;
            const hasMissingCost = order.items && order.items.some((item: any) => (!item.wholesaleCost || item.wholesaleCost === 0) && !item.productId);
            
            return (
              <Link 
                key={order.id} 
                href={`/clientes?expand=${order.customer_id}`}
                className={`card p-4 hover:shadow-md transition-shadow group cursor-pointer block relative ${hasMissingCost ? 'border-2 border-amber-300/50' : 'border-none'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="pr-6">
                    <h3 className="font-bold text-ofit-text text-sm">
                      {getCustomerName(order.customer_id)}
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="font-bold text-ofit-text text-sm block">
                      ${(order.total_amount / 100).toLocaleString('es-AR')}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isPaid ? 'Pagado' : 'Pago Pendiente'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
                  <div className="flex gap-2">
                    {getStatusBadge(order.status)}
                    <span className="text-[10px] font-medium text-gray-400 flex items-center px-2 bg-gray-50 rounded-md">
                      {order.items?.length || 0} ítems
                    </span>
                    {hasMissingCost && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 flex items-center rounded border border-amber-100">
                        ⚠️ Costo
                      </span>
                    )}
                  </div>
                  
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-ofit-pink transition-colors" />
                </div>
              </Link>
            );
          })
        )}
      </div>
      
    </div>
  );
}
