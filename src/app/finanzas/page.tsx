'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, ArrowUpCircle, ArrowDownCircle, Trash2, Wallet, X, PlusCircle, MinusCircle } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function FinanzasPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      alert('Error al cargar movimientos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const totalIncomeCents = transactions.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenseCents = transactions.filter(t => t.type === 'EGRESO').reduce((acc, t) => acc + t.amount, 0);
  const balanceCents = totalIncomeCents - totalExpenseCents;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description.trim()) return;

    try {
      setIsSubmitting(true);
      
      const newTransaction = {
        type: 'EGRESO',
        amount: Math.round(parseFloat(amount) * 100),
        description: description.trim()
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([newTransaction])
        .select();

      if (error) throw error;
      
      setAmount('');
      setDescription('');
      setIsModalOpen(false);
      
      if (data && data.length > 0) {
        setTransactions([data[0], ...transactions]);
      } else {
        fetchTransactions();
      }
      
    } catch (error: any) {
      alert('Error al registrar gasto: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este movimiento? (Esta acción no se puede deshacer)')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error: any) {
      alert('Error al eliminar movimiento: ' + error.message);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full pb-24">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1 flex items-center gap-2">
          Finanzas
        </h1>
        <p className="text-sm text-gray-500">
          Control del libro diario y balance de caja
        </p>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x -mx-4 px-4 hide-scrollbar">
        {/* Balance en Caja */}
        <div className="shrink-0 w-48 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md snap-start">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <Wallet size={18} />
            <span className="text-sm font-medium">Balance en Caja</span>
          </div>
          <div className="text-2xl font-bold">
            ${(balanceCents / 100).toLocaleString('es-AR')}
          </div>
        </div>

        {/* Ingresos Totales */}
        <div className="shrink-0 w-40 bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 snap-start">
          <div className="flex items-center gap-2 mb-2 text-emerald-600">
            <ArrowUpCircle size={18} />
            <span className="text-sm font-medium">Ingresos</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            +${(totalIncomeCents / 100).toLocaleString('es-AR')}
          </div>
        </div>

        {/* Egresos Totales */}
        <div className="shrink-0 w-40 bg-white rounded-2xl p-4 shadow-sm border border-red-100 snap-start">
          <div className="flex items-center gap-2 mb-2 text-red-500">
            <ArrowDownCircle size={18} />
            <span className="text-sm font-medium">Egresos</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            -${(totalExpenseCents / 100).toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full h-14 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 border border-red-200 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-sm"
      >
        <MinusCircle size={22} />
        Registrar Gasto
      </button>

      {/* Lista */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-800">Historial de Movimientos</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm border-dashed">
            <Wallet className="mx-auto text-gray-300 mb-2" size={40} />
            <p className="text-gray-500">No hay movimientos registrados.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {transactions.map((transaction) => {
              const isIngreso = transaction.type === 'INGRESO';
              return (
                <div 
                  key={transaction.id} 
                  className={`bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-4 relative transition-all ${
                    isIngreso ? 'border-emerald-100' : 'border-red-100'
                  }`}
                >
                  <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    isIngreso ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {isIngreso ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                  </div>
                  
                  <div className="flex flex-col flex-1 pr-8">
                    <span className="font-semibold text-gray-900 leading-tight mb-1">{transaction.description}</span>
                    <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                      {new Date(transaction.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  <div className={`font-bold text-lg whitespace-nowrap ${
                    isIngreso ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {isIngreso ? '+' : '-'}${(transaction.amount / 100).toLocaleString('es-AR')}
                  </div>

                  <button 
                    onClick={() => handleDelete(transaction.id)}
                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 active:text-red-600 transition-colors p-1"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Registrar Gasto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-0">
          <div className="bg-white w-full max-w-sm rounded-3xl sm:rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-100 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <MinusCircle className="text-red-500" size={20} />
                Registrar Gasto
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 bg-gray-50/50">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="amount">
                  Monto ($) <span className="text-red-500">*</span>
                </label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-white text-lg font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="description">
                  Descripción del Gasto <span className="text-red-500">*</span>
                </label>
                <input
                  id="description"
                  type="text"
                  required
                  placeholder="Ej: Bolsas para envíos, Luz..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !amount || !description.trim()}
                  className="w-full h-12 font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  {isSubmitting ? 'Guardando...' : 'Confirmar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
