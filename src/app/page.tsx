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
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">
          Hola, Camila 👋
        </h1>
        <p className="text-sm text-gray-500">
          Este es el resumen financiero de tu negocio
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          
          {/* Tarjeta de Balance Principal */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Wallet size={80} />
            </div>
            <div className="relative z-10">
              <h2 className="text-blue-100 font-medium mb-1">Balance Actual</h2>
              <div className="text-4xl font-bold tracking-tight">
                ${(balance / 100).toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          {/* Grid de Ingresos y Egresos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <ArrowUpCircle size={20} />
                <span className="font-medium text-sm">Ingresos</span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                ${(ingresos / 100).toLocaleString('es-AR')}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <ArrowDownCircle size={20} />
                <span className="font-medium text-sm">Egresos</span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                ${(egresos / 100).toLocaleString('es-AR')}
              </div>
            </div>

            <div className="col-span-2 bg-orange-50 rounded-2xl p-4 shadow-sm border border-orange-200 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <TrendingDown size={20} />
                <span className="font-medium text-sm">Plata en la Calle (Por cobrar)</span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                ${(deuda / 100).toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          <Link href="/finanzas" className="mt-4 bg-gray-900 text-white font-semibold rounded-xl h-14 flex items-center justify-center gap-2 shadow-md hover:bg-gray-800 active:bg-gray-700 transition-colors">
            <Wallet size={20} />
            Registrar Movimiento
          </Link>

        </div>
      )}
    </div>
  );
}
