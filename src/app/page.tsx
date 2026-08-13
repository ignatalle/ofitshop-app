'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Loader2, TrendingDown } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [ingresos, setIngresos] = useState(0);
  const [egresos, setEgresos] = useState(0);
  const [deuda, setDeuda] = useState(0);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const [txData, orderData] = await Promise.all([
        supabase.from('transactions').select('type, amount'),
        supabase.from('orders').select('total_amount, advance_payment')
      ]);

      if (txData.error) throw txData.error;
      if (orderData.error) throw orderData.error;

      let totalIngresos = 0;
      let totalEgresos = 0;

      txData.data?.forEach((t) => {
        if (t.type === 'INGRESO') totalIngresos += t.amount;
        if (t.type === 'EGRESO') totalEgresos += t.amount;
      });

      let totalDeuda = 0;
      orderData.data?.forEach((o) => {
        const saldo = (o.total_amount || 0) - (o.advance_payment || 0);
        if (saldo > 0) totalDeuda += saldo;
      });

      setIngresos(totalIngresos);
      setEgresos(totalEgresos);
      setDeuda(totalDeuda);
    } catch (error: any) {
      console.error('Error al cargar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const balance = ingresos - egresos;

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
        <div className="flex flex-col gap-4">
          
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
                ${(ingresos / 100).toLocaleString('es-AR')}
              </div>
            </div>

            {/* Egresos */}
            <div className="card bg-[#F7DEDE] p-4 flex flex-col justify-center gap-2 border-none">
              <div className="flex items-center gap-2 text-[#A44848] mb-1">
                <ArrowDownCircle size={20} />
                <span className="font-semibold text-sm">Egresos</span>
              </div>
              <div className="text-2xl font-bold text-[#A44848]">
                ${(egresos / 100).toLocaleString('es-AR')}
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

          <Link href="/finanzas" className="btn-primary mt-4 max-w-sm w-full shadow-md gap-2 mx-auto md:mx-0">
            <Wallet size={20} />
            Registrar Movimiento
          </Link>

        </div>
      )}
    </div>
  );
}
