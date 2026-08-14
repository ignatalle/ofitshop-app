'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Loader2, TrendingDown, Lightbulb } from 'lucide-react';
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
  total_amount: number;
  advance_payment: number;
  items: any[];
  created_at: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, number>>({});
  
  const [businessPercent, setBusinessPercent] = useState(30);
  const [personalPercent, setPersonalPercent] = useState(70);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const [txRes, orderRes, prodRes] = await Promise.all([
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, cost_price')
      ]);

      if (txRes.error) throw txRes.error;
      if (orderRes.error) throw orderRes.error;

      setTransactions(txRes.data || []);
      setOrders(orderRes.data || []);
      
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

  // 1. Basic Metrics
  const totalIncomeCents = transactions.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenseCents = transactions.filter(t => t.type === 'EGRESO').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncomeCents - totalExpenseCents;

  let deuda = 0;
  orders.forEach((o) => {
    const saldo = (o.total_amount || 0) - (o.advance_payment || 0);
    if (saldo > 0) deuda += saldo;
  });

  // 2. Rendimiento del Mes Current Month Logic
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
        }
      });
    }
  });

  const comisionesCents = currentMonthTransactions
    .filter(t => t.type === 'EGRESO' && t.description.toLowerCase().includes('comisión'))
    .reduce((acc, t) => acc + t.amount, 0);

  const otrosEgresosCents = currentMonthTransactions
    .filter(t => t.type === 'EGRESO' && !t.description.toLowerCase().includes('comisión'))
    .reduce((acc, t) => acc + t.amount, 0);

  let gananciaNetaCents = facturacionTotalCents - costoMercaderiaCents - comisionesCents - otrosEgresosCents;
  if (gananciaNetaCents < 0) gananciaNetaCents = 0;
  
  let netProfitCurrentMonthCents = gananciaNetaCents;

  return (
    <div className="p-4 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1">
          Hola, Camila 👋
        </h1>
        <p className="text-sm text-ofit-text-soft">
          Este es el resumen financiero de tu negocio
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* Grid de Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Tarjeta de Balance Principal */}
            <div className="col-span-2 md:col-span-1 bg-ofit-pink rounded-2xl p-5 text-white shadow-sm relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Wallet size={64} />
              </div>
              <div className="relative z-10">
                <h2 className="text-pink-50 font-medium mb-1">Balance Actual</h2>
                <div className="text-3xl font-bold tracking-tight">
                  ${(balance / 100).toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            {/* Ingresos */}
            <div className="card bg-[#DDEFE4] p-4 flex flex-col justify-center gap-2 border-none">
              <div className="flex items-center gap-2 text-[#367A50] mb-1">
                <ArrowUpCircle size={20} />
                <span className="font-semibold text-sm">Ingresos</span>
              </div>
              <div className="text-2xl font-bold text-[#367A50]">
                ${(totalIncomeCents / 100).toLocaleString('es-AR')}
              </div>
            </div>

            {/* Egresos */}
            <div className="card bg-[#F7DEDE] p-4 flex flex-col justify-center gap-2 border-none">
              <div className="flex items-center gap-2 text-[#A44848] mb-1">
                <ArrowDownCircle size={20} />
                <span className="font-semibold text-sm">Egresos</span>
              </div>
              <div className="text-2xl font-bold text-[#A44848]">
                ${(totalExpenseCents / 100).toLocaleString('es-AR')}
              </div>
            </div>

            {/* Por cobrar */}
            <div className="card bg-[#FFF0D8] p-4 flex flex-col justify-center gap-2 border-none">
              <div className="flex items-center gap-2 text-[#9A641D] mb-1">
                <TrendingDown size={20} />
                <span className="font-semibold text-sm">Plata en la Calle</span>
              </div>
              <div className="text-2xl font-bold text-[#9A641D]">
                ${(deuda / 100).toLocaleString('es-AR')}
              </div>
            </div>
          </div>
          
          <Link href="/finanzas" className="btn-primary max-w-sm w-full shadow-md gap-2 mx-auto md:mx-0">
            <Wallet size={20} />
            Caja Registradora
          </Link>

          {/* Módulo de Rendimiento del Mes */}
          <div className="card p-5 border-none shadow-sm flex flex-col gap-4 mt-2 max-w-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">📊</span>
              <h2 className="font-bold text-lg text-ofit-text">Rendimiento del Mes</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Facturación</span>
                <span className="font-bold text-ofit-text text-sm sm:text-base">${(facturacionTotalCents / 100).toLocaleString('es-AR')}</span>
              </div>
              <div className="bg-red-50 rounded-xl p-2 border border-red-100">
                <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Costos</span>
                <span className="font-bold text-red-700 text-sm sm:text-base">-${(costoMercaderiaCents / 100).toLocaleString('es-AR')}</span>
              </div>
              <div className="bg-green-50 rounded-xl p-2 border border-green-100">
                <span className="block text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Ganancia</span>
                <span className="font-bold text-green-700 text-sm sm:text-base">${(gananciaNetaCents / 100).toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Barra de rentabilidad */}
            {facturacionTotalCents > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] font-bold text-ofit-text-soft mb-1.5 px-1 uppercase tracking-wide">
                  <span>Costos + Egresos ({Math.round(((costoMercaderiaCents + comisionesCents + otrosEgresosCents) / facturacionTotalCents) * 100)}%)</span>
                  <span className="text-green-600">Ganancia ({Math.round((gananciaNetaCents / facturacionTotalCents) * 100)}%)</span>
                </div>
                <div className="h-4 w-full bg-[#25D366] rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-red-400" 
                    style={{ width: `${Math.min(100, ((costoMercaderiaCents + comisionesCents + otrosEgresosCents) / facturacionTotalCents) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta de Distribución Sugerida */}
          <div className="card p-5 border-none shadow-sm flex flex-col gap-4 max-w-lg">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="text-amber-500" size={20} />
              <h2 className="font-bold text-lg text-ofit-text">Distribución Sugerida (Mes Actual)</h2>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ofit-text-soft">Negocio (Re-inversión) %</label>
                <input 
                  type="number" min="0" max="100" 
                  value={businessPercent}
                  onChange={(e) => handleBusinessPercentChange(e.target.value)}
                  className="input-field text-center font-bold text-blue-600 bg-blue-50" 
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ofit-text-soft">Retiro Personal %</label>
                <input 
                  type="number" min="0" max="100" 
                  value={personalPercent}
                  onChange={(e) => handlePersonalPercentChange(e.target.value)}
                  className="input-field text-center font-bold text-purple-600 bg-purple-50" 
                />
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <div className="flex-1 bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col justify-center text-center">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Para el Negocio</span>
                <span className="font-bold text-blue-700">${(Math.round((netProfitCurrentMonthCents * (businessPercent / 100))) / 100).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex-1 bg-purple-50/50 rounded-xl p-3 border border-purple-100 flex flex-col justify-center text-center">
                <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Tu Sueldo</span>
                <span className="font-bold text-purple-700">${(Math.round((netProfitCurrentMonthCents * (personalPercent / 100))) / 100).toLocaleString('es-AR')}</span>
              </div>
            </div>
            
            <button 
              onClick={handleSavePercentages}
              className="btn-secondary w-full h-10 mt-2 text-sm"
            >
              Guardar porcentajes por defecto
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
