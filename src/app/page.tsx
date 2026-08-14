'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Wallet, Loader2, TrendingDown, Lightbulb, 
  Plus, AlertCircle, CheckCircle2, ChevronRight, Package, Clock, CreditCard, Banknote, Users
} from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  cuenta: 'EFECTIVO' | 'VIRTUAL';
  created_at: string;
}

interface Order {
  id: string;
  customer_id: string;
  total_amount: number;
  advance_payment: number;
  items: any[];
  status: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, number>>({});
  
  const [businessPercent, setBusinessPercent] = useState(30);
  const [personalPercent, setPersonalPercent] = useState(70);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const [txRes, orderRes, prodRes, custRes] = await Promise.all([
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, cost_price'),
        supabase.from('customers').select('id, name')
      ]);

      if (txRes.error) throw txRes.error;
      if (orderRes.error) throw orderRes.error;

      setTransactions(txRes.data || []);
      setOrders(orderRes.data || []);
      setCustomers(custRes.data || []);
      
      const pMap: Record<string, number> = {};
      if (prodRes.data) {
        prodRes.data.forEach((p: any) => {
          if (p.cost_price) pMap[p.id] = p.cost_price;
        });
      }
      setProductsMap(pMap);
    } catch (error: any) {
      console.error('Error al cargar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    const savedBusiness = localStorage.getItem('ofit_business_percent');
    if (savedBusiness) {
      const b = parseInt(savedBusiness);
      if (!isNaN(b) && b >= 0 && b <= 100) {
        setBusinessPercent(b);
        setPersonalPercent(100 - b);
      }
    }
  }, []);

  const handleBusinessPercentChange = (val: string) => {
    let p = parseInt(val) || 0;
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    setBusinessPercent(p);
    setPersonalPercent(100 - p);
  };

  const handlePersonalPercentChange = (val: string) => {
    let p = parseInt(val) || 0;
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    setPersonalPercent(p);
    setBusinessPercent(100 - p);
  };

  const handleSavePercentages = () => {
    localStorage.setItem('ofit_business_percent', businessPercent.toString());
    alert('¡Preferencias de distribución guardadas!');
  };

  // --- CALCULOS BASICOS ---

  // 1. Efectivo y Virtual
  const totalEfectivo = transactions
    .filter(t => t.cuenta === 'EFECTIVO')
    .reduce((acc, t) => t.type === 'INGRESO' ? acc + t.amount : acc - t.amount, 0);
    
  const totalVirtual = transactions
    .filter(t => t.cuenta === 'VIRTUAL')
    .reduce((acc, t) => t.type === 'INGRESO' ? acc + t.amount : acc - t.amount, 0);

  // 2. Plata en la calle (Deuda total y clientes)
  let deuda = 0;
  const clientesConDeuda = new Set<string>();
  
  orders.forEach((o) => {
    const saldo = (o.total_amount || 0) - (o.advance_payment || 0);
    if (saldo > 0) {
      deuda += saldo;
      clientesConDeuda.add(o.customer_id);
    }
  });

  // 3. Rendimiento del Mes Current Month Logic
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthTransactions = transactions.filter(t => {
    const d = new Date(t.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const currentMonthOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && o.advance_payment > 0;
  });

  let facturacionTotalCents = 0;
  let costoMercaderiaCents = 0;
  let pedidosSinCostoCount = 0;

  currentMonthOrders.forEach(o => {
    facturacionTotalCents += Number(o.total_amount) || 0;
    
    let itemsArr = o.items;
    if (typeof itemsArr === 'string') {
      try { itemsArr = JSON.parse(itemsArr); } catch(e) { itemsArr = []; }
    }
    
    if (itemsArr && !Array.isArray(itemsArr) && typeof itemsArr === 'object') {
      if (Array.isArray((itemsArr as any).items)) itemsArr = (itemsArr as any).items;
      else if (Array.isArray((itemsArr as any).cart)) itemsArr = (itemsArr as any).cart;
      else itemsArr = Object.values(itemsArr);
    }

    let orderHasMissingCost = false;

    if (itemsArr && Array.isArray(itemsArr)) {
      itemsArr.forEach((item: any) => {
        let rawCost = item.wholesaleCost || item.costo || item.costoUnitario || item.cost || item.wholesaleCostCents || item.costCents || 0;
        if (typeof rawCost === 'string') rawCost = parseFloat(rawCost.replace(/[^0-9.-]+/g,""));
        let cost = Number(rawCost) || 0;
        
        if (cost === 0 && item.productId && productsMap[item.productId]) {
          cost = Number(productsMap[item.productId]) || 0;
        }
        
        let rawQty = item.quantity || item.cantidad || item.qty || 1;
        if (typeof rawQty === 'string') rawQty = parseInt(rawQty, 10);
        const qty = Number(rawQty) || 1;
        
        if (cost > 0) {
          costoMercaderiaCents += (cost * qty);
        } else {
          orderHasMissingCost = true;
        }
      });
    }

    if (orderHasMissingCost) pedidosSinCostoCount++;
  });

  const comisionesCents = currentMonthTransactions
    .filter(t => t.type === 'EGRESO' && t.description.toLowerCase().includes('comisión'))
    .reduce((acc, t) => acc + t.amount, 0);

  const otrosEgresosCents = currentMonthTransactions
    .filter(t => t.type === 'EGRESO' && !t.description.toLowerCase().includes('comisión'))
    .reduce((acc, t) => acc + t.amount, 0);

  const totalCostosGastos = costoMercaderiaCents + comisionesCents + otrosEgresosCents;
  let gananciaNetaCents = facturacionTotalCents - totalCostosGastos;
  if (gananciaNetaCents < 0) gananciaNetaCents = 0;
  
  const netProfitCurrentMonthCents = gananciaNetaCents;

  // 4. Qué necesita tu atención
  const atencionItems = [];
  if (clientesConDeuda.size > 0) {
    atencionItems.push({
      id: 'deudas',
      icon: <TrendingDown size={18} className="text-amber-600" />,
      text: `${clientesConDeuda.size} ${clientesConDeuda.size === 1 ? 'clienta tiene' : 'clientas tienen'} saldo pendiente`,
      color: 'bg-amber-50 text-amber-800 border-amber-100',
      link: '/clientes'
    });
  }
  if (pedidosSinCostoCount > 0) {
    atencionItems.push({
      id: 'costos',
      icon: <AlertCircle size={18} className="text-red-500" />,
      text: `${pedidosSinCostoCount} ${pedidosSinCostoCount === 1 ? 'pedido de este mes no tiene' : 'pedidos de este mes no tienen'} costo cargado`,
      color: 'bg-red-50 text-red-800 border-red-100',
      link: '/pedidos'
    });
  }
  const pedidosPendientes = orders.filter(o => o.status === 'PENDIENTE').length;
  if (pedidosPendientes > 0) {
    atencionItems.push({
      id: 'pendientes',
      icon: <Clock size={18} className="text-blue-500" />,
      text: `${pedidosPendientes} ${pedidosPendientes === 1 ? 'pedido está pendiente' : 'pedidos están pendientes'} de entrega`,
      color: 'bg-blue-50 text-blue-800 border-blue-100',
      link: '/pedidos'
    });
  }

  // 5. Pedidos Recientes
  const pedidosRecientes = orders.slice(0, 5);
  const customerMap = new Map(customers.map(c => [c.id, c.name]));

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] text-ofit-text-soft">
        <Loader2 size={32} className="animate-spin mb-4 text-ofit-pink" />
        <p className="font-medium animate-pulse">Cargando tu negocio...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto pb-24 animate-fade-in p-4 sm:p-6 lg:p-8 gap-8">
      
      {/* 1. HEADER */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] sm:text-3xl font-black text-ofit-text tracking-tight">
          Hola, Cami 👋
        </h1>
        <p className="text-base text-ofit-text-soft font-medium">
          Así está tu negocio hoy.
        </p>
      </div>

      {/* 2. ACCIÓN PRINCIPAL */}
      <Link href="/pedidos/nuevo" className="w-full">
        <button className="btn-primary w-full shadow-lg shadow-ofit-pink/20 hover:shadow-ofit-pink/30 text-lg gap-2 active:scale-[0.98] transition-transform">
          <Plus size={24} strokeWidth={3} />
          Nuevo Pedido
        </button>
      </Link>

      {/* 3. PLATA EN LA CALLE */}
      <div className="card bg-[#FFF8ED] p-6 border-none relative overflow-hidden flex flex-col gap-4">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col gap-1 relative z-10">
          <h2 className="text-amber-800/80 font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
            <TrendingDown size={16} /> Plata en la Calle
          </h2>
          <div className="text-4xl sm:text-5xl font-black text-amber-900 tracking-tighter">
            ${(deuda / 100).toLocaleString('es-AR')}
          </div>
          <p className="text-amber-800/70 font-medium text-sm mt-1">
            Esto es lo que todavía te falta cobrar.
          </p>
        </div>
        
        {clientesConDeuda.size > 0 && (
          <div className="pt-4 border-t border-amber-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <span className="text-amber-900 font-semibold text-sm">
              {clientesConDeuda.size} {clientesConDeuda.size === 1 ? 'clienta tiene' : 'clientas tienen'} saldo pendiente
            </span>
            <Link href="/clientes" className="text-amber-700 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors inline-flex items-center justify-center gap-1">
              Ver quién me debe <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {/* 4. NECESITA TU ATENCIÓN */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-lg text-ofit-text px-1">Necesita tu atención</h3>
        {atencionItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            {atencionItems.map((item) => (
              <Link href={item.link} key={item.id}>
                <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-colors hover:brightness-95 ${item.color}`}>
                  <div className="shrink-0">{item.icon}</div>
                  <span className="font-medium text-sm flex-1">{item.text}</span>
                  <ChevronRight size={16} className="opacity-50 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--sage-green)] border border-[var(--sage-green)]/50 p-5 rounded-2xl flex items-center gap-3">
            <div className="bg-white p-2 rounded-full shadow-sm text-[var(--sage-green-text)] shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[var(--sage-green-text)] text-base">Todo al día ✨</span>
              <span className="text-[var(--sage-green-text)]/80 text-sm font-medium">No tenés nada urgente por resolver.</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. MI PLATA (Efectivo / Virtual) */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-lg text-ofit-text px-1">Mi Plata</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="card p-5 border-none bg-emerald-50/50 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-700/70 font-bold text-xs uppercase tracking-wider mb-1">
              <Banknote size={16} /> Efectivo
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-800">${(totalEfectivo / 100).toLocaleString('es-AR')}</div>
          </div>
          <div className="card p-5 border-none bg-blue-50/50 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-blue-700/70 font-bold text-xs uppercase tracking-wider mb-1">
              <CreditCard size={16} /> Virtual
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-800">${(totalVirtual / 100).toLocaleString('es-AR')}</div>
          </div>
        </div>
      </div>

      {/* 6. DISTRIBUCIÓN SUGERIDA */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-lg text-ofit-text px-1">Distribución Sugerida</h3>
        <div className="card p-5 sm:p-6 border-none shadow-sm flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            
            {/* Negocio */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ofit-navy/60 uppercase tracking-wider">Para el Negocio</span>
                <input 
                  type="number" min="0" max="100" 
                  value={businessPercent}
                  onChange={(e) => handleBusinessPercentChange(e.target.value)}
                  className="w-12 text-right bg-transparent font-bold text-ofit-navy focus:outline-none border-b border-ofit-navy/20 focus:border-ofit-navy"
                  onBlur={handleSavePercentages}
                />
                <span className="text-xs font-bold text-ofit-navy ml-0.5">%</span>
              </div>
              <div className="text-2xl font-black text-ofit-navy">
                ${(Math.round((netProfitCurrentMonthCents * (businessPercent / 100))) / 100).toLocaleString('es-AR')}
              </div>
            </div>

            {/* Para vos */}
            <div className="flex flex-col gap-2 border-l border-gray-100 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ofit-pink/80 uppercase tracking-wider">Para vos</span>
                <input 
                  type="number" min="0" max="100" 
                  value={personalPercent}
                  onChange={(e) => handlePersonalPercentChange(e.target.value)}
                  className="w-12 text-right bg-transparent font-bold text-ofit-pink focus:outline-none border-b border-ofit-pink/20 focus:border-ofit-pink"
                  onBlur={handleSavePercentages}
                />
                <span className="text-xs font-bold text-ofit-pink ml-0.5">%</span>
              </div>
              <div className="text-2xl font-black text-ofit-pink">
                ${(Math.round((netProfitCurrentMonthCents * (personalPercent / 100))) / 100).toLocaleString('es-AR')}
              </div>
            </div>

          </div>
          <p className="text-xs text-ofit-text-soft text-center font-medium">
            Calculado sobre la ganancia neta de este mes. Podés editar los % tocando los números.
          </p>
        </div>
      </div>

      {/* 7. RENDIMIENTO DEL MES */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-lg text-ofit-text px-1">Rendimiento del mes</h3>
        <div className="card p-6 border-none shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-sm font-bold text-ofit-text-soft uppercase tracking-widest">Ganancia Neta</span>
            <div className="text-[40px] leading-none sm:text-5xl font-black text-ofit-text tracking-tighter">
              ${(gananciaNetaCents / 100).toLocaleString('es-AR')}
            </div>
          </div>

          <div className="flex gap-4 items-center w-full px-2">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[11px] font-bold text-ofit-text-soft uppercase tracking-wider">Ventas</span>
              <span className="font-bold text-base text-ofit-text">${(facturacionTotalCents / 100).toLocaleString('es-AR')}</span>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div className="flex flex-col gap-1 flex-1 text-right">
              <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Costos + Gst</span>
              <span className="font-bold text-base text-red-500">-${(totalCostosGastos / 100).toLocaleString('es-AR')}</span>
            </div>
          </div>

          {facturacionTotalCents > 0 && (
            <div className="w-full flex h-3 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-400 transition-all duration-500" 
                style={{ width: `${Math.min(100, (totalCostosGastos / facturacionTotalCents) * 100)}%` }}
              ></div>
              <div 
                className="h-full bg-ofit-navy transition-all duration-500" 
                style={{ width: `${Math.min(100, (gananciaNetaCents / facturacionTotalCents) * 100)}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>

      {/* 8. PEDIDOS RECIENTES */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-lg text-ofit-text">Pedidos recientes</h3>
          <Link href="/pedidos" className="text-ofit-pink font-bold text-sm hover:underline flex items-center gap-1">
            Ver todos <ChevronRight size={16} />
          </Link>
        </div>
        
        {pedidosRecientes.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pedidosRecientes.map(order => {
              const saldo = order.total_amount - order.advance_payment;
              return (
                <Link key={order.id} href={`/pedidos/${order.id}`}>
                  <div className="card p-4 sm:p-5 border-none shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-bold text-base text-ofit-text truncate">
                        {customerMap.get(order.customer_id) || 'Cliente Desconocido'}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          order.status === 'ENTREGADO' ? 'bg-emerald-100 text-emerald-700' :
                          order.status === 'RECIBIDO' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {order.status}
                        </span>
                        <span className="text-xs font-medium text-ofit-text-soft truncate">
                          {new Date(order.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-black text-lg text-ofit-text">
                        ${(order.total_amount / 100).toLocaleString('es-AR')}
                      </span>
                      {saldo > 0 ? (
                        <span className="text-xs font-bold text-amber-600">
                          Debe ${(saldo / 100).toLocaleString('es-AR')}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600">
                          Pagado
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card p-8 border-none shadow-sm flex flex-col items-center text-center gap-3">
            <Package size={32} className="text-ofit-text-soft opacity-50" />
            <span className="text-ofit-text-soft font-medium">Aún no hay pedidos este mes.</span>
          </div>
        )}
      </div>

    </div>
  );
}
