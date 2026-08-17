'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, X, MinusCircle, ArrowRightLeft, Trash2 } from 'lucide-react';
import { calculateAccountBalance, calculateTotalCash, isInternalTransfer } from '../../lib/finance';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  cuenta: 'EFECTIVO' | 'VIRTUAL';
  created_at: string;
}

export default function FinanzasPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [cuenta, setCuenta] = useState<'EFECTIVO' | 'VIRTUAL'>('VIRTUAL');
  const [egresoCategory, setEgresoCategory] = useState<'MERCADERIA' | 'OPERATIVO' | 'RETIRO'>('OPERATIVO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data: txRes, error: txError } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });

      if (txError) throw txError;
      
      setTransactions(txRes || []);
    } catch (error: any) {
      alert('Error al cargar movimientos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const balanceEfectivo = calculateAccountBalance(transactions, 'EFECTIVO');
  const balanceVirtual = calculateAccountBalance(transactions, 'VIRTUAL');
  const balanceCents = calculateTotalCash(transactions);

  const realTransactions = transactions.filter(t => !isInternalTransfer(t));
  const totalIncomeCents = realTransactions.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenseCents = realTransactions.filter(t => t.type === 'EGRESO').reduce((acc, t) => acc + t.amount, 0);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferOrigin, setTransferOrigin] = useState<'EFECTIVO' | 'VIRTUAL'>('VIRTUAL');
  const [transferAmount, setTransferAmount] = useState('');

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount) return;
    try {
      setIsSubmitting(true);
      const amountCents = Math.round(parseFloat(transferAmount) * 100);
      const transferDest = transferOrigin === 'VIRTUAL' ? 'EFECTIVO' : 'VIRTUAL';
      
      const outTx = {
        type: 'EGRESO',
        amount: amountCents,
        description: `Transferencia hacia ${transferDest === 'EFECTIVO' ? 'Efectivo' : 'Virtual'}`,
        cuenta: transferOrigin
      };
      
      const inTx = {
        type: 'INGRESO',
        amount: amountCents,
        description: `Transferencia desde ${transferOrigin === 'EFECTIVO' ? 'Efectivo' : 'Virtual'}`,
        cuenta: transferDest
      };

      const { error } = await supabase.from('transactions').insert([outTx, inTx]);
      if (error) throw error;
      
      setTransferAmount('');
      setIsTransferModalOpen(false);
      fetchTransactions(); 
    } catch (error: any) {
      alert('Error al transferir: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description.trim()) return;

    try {
      setIsSubmitting(true);
      
      let finalDescription = description.trim();
      if (egresoCategory === 'RETIRO') finalDescription = `[RETIRO/AJUSTE] ${finalDescription}`;
      else if (egresoCategory === 'MERCADERIA') finalDescription = `[MERCADERIA] ${finalDescription}`;
      else if (egresoCategory === 'OPERATIVO') finalDescription = `[OPERATIVO] ${finalDescription}`;

      const newTransaction = {
        type: 'EGRESO',
        amount: Math.round(parseFloat(amount) * 100),
        description: finalDescription,
        cuenta: cuenta
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert([newTransaction])
        .select();

      if (error) throw error;
      
      setAmount('');
      setDescription('');
      setEgresoCategory('OPERATIVO');
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
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1 flex items-center gap-2">
          Finanzas
        </h1>
        <p className="text-sm text-ofit-text-soft">
          Control del libro diario y balance de caja
        </p>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-2 gap-4">
        {/* Balance en Caja */}
        <div className="col-span-2 bg-ofit-pink rounded-2xl p-4 text-white shadow-md">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <Wallet size={18} />
            <span className="text-sm font-medium">Balance en Caja</span>
          </div>
          <div className="text-3xl md:text-4xl font-bold truncate tracking-tighter mb-3">
            ${(balanceCents / 100).toLocaleString('es-AR')}
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold bg-white/10 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 flex-1">
              <span>💵</span> 
              <span>Efectivo: ${(balanceEfectivo / 100).toLocaleString('es-AR')}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-1.5 flex-1">
              <span>📱</span> 
              <span>Virtual: ${(balanceVirtual / 100).toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

        {/* Ingresos Totales */}
        <div className="bg-[#DDEFE4] rounded-2xl p-4 shadow-sm border-none min-w-0">
          <div className="flex items-center gap-2 mb-2 text-[#367A50]">
            <ArrowUpCircle size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Ingresos</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-ofit-text tracking-tighter truncate">
            +${(totalIncomeCents / 100).toLocaleString('es-AR')}
          </div>
        </div>

        {/* Egresos Totales */}
        <div className="bg-[#F7DEDE] rounded-2xl p-4 shadow-sm border-none min-w-0">
          <div className="flex items-center gap-2 mb-2 text-[#A44848]">
            <ArrowDownCircle size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Egresos</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-ofit-text tracking-tighter truncate">
            -${(totalExpenseCents / 100).toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex-1 h-14 bg-red-50 hover:bg-[#F7DEDE] active:bg-red-200 text-[#A44848] border border-red-200 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <MinusCircle size={22} />
          Egreso
        </button>
        <button
          onClick={() => setIsTransferModalOpen(true)}
          className="flex-1 h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 border border-gray-200 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          <ArrowRightLeft size={22} />
          Mover Plata
        </button>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ofit-text">Historial de Movimientos</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm border-dashed">
            <Wallet className="mx-auto text-ofit-text-soft mb-2" size={40} />
            <p className="text-ofit-text-soft">No hay movimientos registrados.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {transactions.map((transaction) => {
              const isIngreso = transaction.type === 'INGRESO';
              const isTransfer = transaction.type === 'TRANSFER';
              
              let bgColor = isIngreso ? 'bg-[#DDEFE4]' : (isTransfer ? 'bg-gray-100' : 'bg-[#F7DEDE]');
              let iconColor = isIngreso ? 'text-[#367A50]' : (isTransfer ? 'text-gray-500' : 'text-[#A44848]');
              
              return (
                <div 
                  key={transaction.id} 
                  className={`card p-4 border-none flex items-center gap-4 relative transition-all ${bgColor}`}
                >
                  <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${bgColor} ${iconColor} opacity-80 mix-blend-multiply`}>
                    {isIngreso ? <ArrowUpCircle size={24} /> : (isTransfer ? <ArrowRightLeft size={24} /> : <ArrowDownCircle size={24} />)}
                  </div>
                  
                  <div className="flex flex-col flex-1 pr-6 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-ofit-text leading-tight">
                        {transaction.description.replace(/^\[.*?\]\s*/, '')}
                      </span>
                      {transaction.description.includes('[RETIRO/AJUSTE]') && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 uppercase tracking-wider">
                          Retiro / Ajuste
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ofit-text-soft font-medium uppercase tracking-wider">
                      {new Date(transaction.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  <div className={`font-bold text-base md:text-lg whitespace-nowrap text-right shrink-0 tracking-tighter truncate ${
                    isIngreso ? 'text-[#367A50]' : 'text-[#A44848]'
                  }`}>
                    {isIngreso ? '+' : '-'}${(transaction.amount / 100).toLocaleString('es-AR')}
                  </div>

                  <button 
                    onClick={() => handleDelete(transaction.id)}
                    className="absolute top-2 right-2 text-ofit-text-soft hover:text-[#A44848] active:text-[#A44848] transition-colors p-1"
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
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-0">
          <div className="card w-full max-w-sm rounded-3xl sm:rounded-2xl overflow-hidden border-none animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-100 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-ofit-text flex items-center gap-2">
                <MinusCircle className="text-[#A44848]" size={20} />
                Registrar Gasto
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-ofit-text-soft hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 bg-gray-50/50">
              <div>
                <label className="block text-sm font-semibold text-ofit-text mb-1.5" htmlFor="amount">
                  Monto ($) <span className="text-[#A44848]">*</span>
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
                  className="input-field focus:ring-ofit-pink focus:border-ofit-pink text-lg font-bold text-ofit-text"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ofit-text mb-1.5" htmlFor="category">
                  Categoría <span className="text-[#A44848]">*</span>
                </label>
                <select
                  id="category"
                  value={egresoCategory}
                  onChange={(e) => setEgresoCategory(e.target.value as any)}
                  className="input-field focus:ring-ofit-pink focus:border-ofit-pink font-medium text-ofit-text"
                >
                  <option value="OPERATIVO">Gastos Operativos (Envíos, etc)</option>
                  <option value="MERCADERIA">Mercadería</option>
                  <option value="RETIRO">Retiro de Socio / Ajuste</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-ofit-text mb-1.5" htmlFor="description">
                  Descripción del Gasto <span className="text-[#A44848]">*</span>
                </label>
                <input
                  id="description"
                  type="text"
                  required
                  placeholder="Ej: Bolsas para envíos, Luz..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field focus:ring-ofit-pink focus:border-ofit-pink"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ofit-text mb-1.5">
                  ¿De dónde salió la plata?
                </label>
                <div className="flex bg-gray-200 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCuenta('VIRTUAL')}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${cuenta === 'VIRTUAL' ? 'bg-white shadow-sm text-ofit-text' : 'text-ofit-text-soft hover:text-ofit-text'}`}
                  >
                    📱 Virtual
                  </button>
                  <button
                    type="button"
                    onClick={() => setCuenta('EFECTIVO')}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${cuenta === 'EFECTIVO' ? 'bg-white shadow-sm text-ofit-text' : 'text-ofit-text-soft hover:text-ofit-text'}`}
                  >
                    💵 Efectivo
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !amount || !description.trim()}
                  className="btn-primary w-full"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  {isSubmitting ? 'Guardando...' : 'Confirmar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Transferencia */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-ofit-text flex items-center gap-2">
                <ArrowRightLeft size={24} className="text-gray-500" /> Transferencia
              </h2>
              <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-ofit-text-soft transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleTransferSubmit} className="flex flex-col gap-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label mb-1.5">Origen</label>
                  <select 
                    value={transferOrigin}
                    onChange={(e) => setTransferOrigin(e.target.value as any)}
                    className="input-field font-semibold"
                  >
                    <option value="VIRTUAL">📱 Virtual</option>
                    <option value="EFECTIVO">💵 Efectivo</option>
                  </select>
                </div>
                <div>
                  <label className="input-label mb-1.5 opacity-60">Destino (Automático)</label>
                  <div className="input-field font-semibold bg-gray-50 text-gray-500 flex items-center">
                    {transferOrigin === 'VIRTUAL' ? '💵 Efectivo' : '📱 Virtual'}
                  </div>
                </div>
              </div>

              <div>
                <label className="input-label mb-1.5">Monto a mover</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ofit-text-soft font-bold">$</span>
                  <input
                    required type="number" min="0" step="0.01"
                    value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
                    className="input-field !pl-8 font-semibold" placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="btn-secondary flex-1 py-3 text-base">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
