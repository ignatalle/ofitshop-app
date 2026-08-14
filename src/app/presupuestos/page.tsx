'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Plus, X, Copy, MessageCircle, User, ClipboardCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string | null;
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  cost: number;
  retailMargin: number;
  retailPrice: number;
  wholesaleMargin: number;
  wholesalePrice: number;
}

export default function PresupuestosPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [globalRetailMargin, setGlobalRetailMargin] = useState(100);
  const [globalWholesaleMargin, setGlobalWholesaleMargin] = useState(40);
  const [viewMode, setViewMode] = useState<'retail' | 'wholesale'>('retail');
  
  const [items, setItems] = useState<QuoteItem[]>([]);
  
  // New Item State
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState<number | ''>(1);
  const [cost, setCost] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
        if (error) throw error;
        setCustomers(data || []);
      } catch (error: any) {
        alert("Error al cargar clientes: " + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // When customer is selected, automatically switch viewMode based on customer type
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setViewMode(customer.type === 'MAYORISTA' ? 'wholesale' : 'retail');
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !cost) return;

    const parsedCost = parseFloat(cost);
    if (isNaN(parsedCost)) return;

    const quantity = typeof qty === 'number' ? qty : parseInt(qty.toString()) || 1;

    const newItem: QuoteItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      description: desc.trim(),
      quantity,
      cost: parsedCost,
      retailMargin: globalRetailMargin,
      retailPrice: parsedCost * (1 + globalRetailMargin / 100),
      wholesaleMargin: globalWholesaleMargin,
      wholesalePrice: parsedCost * (1 + globalWholesaleMargin / 100),
    };

    setItems([...items, newItem]);
    setDesc('');
    setQty(1);
    setCost('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItemQuantity = (id: string, newQty: number | string) => {
    const parsedQty = typeof newQty === 'number' ? newQty : parseInt(newQty.toString());
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, quantity: isNaN(parsedQty) || parsedQty < 1 ? 1 : parsedQty };
      }
      return item;
    }));
  };

  const updateItemBidirectional = (id: string, field: 'margin' | 'price', value: string) => {
    const numValue = parseFloat(value);
    
    setItems(items.map(item => {
      if (item.id === id) {
        const newItem = { ...item };
        
        if (field === 'margin') {
           const margin = isNaN(numValue) ? 0 : numValue;
           const price = item.cost * (1 + margin / 100);
           if (viewMode === 'retail') {
             newItem.retailMargin = margin;
             newItem.retailPrice = price;
           } else {
             newItem.wholesaleMargin = margin;
             newItem.wholesalePrice = price;
           }
        } else if (field === 'price') {
           const price = isNaN(numValue) ? item.cost : numValue;
           const margin = item.cost > 0 ? ((price - item.cost) / item.cost) * 100 : 0;
           if (viewMode === 'retail') {
             newItem.retailPrice = price;
             newItem.retailMargin = margin;
           } else {
             newItem.wholesalePrice = price;
             newItem.wholesaleMargin = margin;
           }
        }
        return newItem;
      }
      return item;
    }));
  };

  const totalAmount = items.reduce((acc, item) => {
    const price = viewMode === 'retail' ? item.retailPrice : item.wholesalePrice;
    return acc + (price * item.quantity);
  }, 0);

  const convertToOrder = async () => {
    if (!selectedCustomerId) {
      alert("Por favor, seleccioná un cliente para crear el pedido.");
      return;
    }
    
    if (items.length === 0) return;

    try {
      setIsSubmitting(true);
      
      const orderItems = items.map(item => {
        const price = viewMode === 'retail' ? item.retailPrice : item.wholesalePrice;
        const unitPriceCents = Math.round(price * 100);
        const wholesaleCostCents = item.cost ? Math.round(item.cost * 100) : undefined;
        
        return {
          id: item.id,
          productName: item.description,
          quantity: item.quantity,
          unitPrice: unitPriceCents,
          wholesaleCost: wholesaleCostCents,
          subtotal: unitPriceCents * item.quantity
        };
      });

      const totalAmountCents = Math.round(totalAmount * 100);

      const newOrder = {
        customer_id: selectedCustomerId,
        details: "Presupuesto convertido",
        items: orderItems,
        total_amount: totalAmountCents,
        advance_payment: 0,
        status: 'PENDIENTE'
      };

      const { error } = await supabase.from('orders').insert([newOrder]);
      if (error) throw error;

      alert("¡Pedido creado exitosamente! Redirigiendo a Pedidos...");
      router.push('/pedidos');
      
    } catch (error: any) {
      alert("Error al crear el pedido: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToWhatsApp = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    const customerName = customer ? customer.name : '';
    
    let text = `Hola ${customerName}! 🤍 Te paso el presupuesto:\n`;
    
    items.forEach(item => {
      const price = viewMode === 'retail' ? item.retailPrice : item.wholesalePrice;
      text += `• ${item.quantity}x ${item.description} - $${price.toLocaleString('es-AR', { maximumFractionDigits: 0 })}\n`;
    });
    
    text += `\nTotal: $${totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

    if (customer && customer.phone) {
      // Use wa.me link
      const phoneClean = customer.phone.replace(/\D/g, '');
      const url = `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    } else {
      // Copy to clipboard fallback
      navigator.clipboard.writeText(text).then(() => {
        alert('¡Presupuesto copiado al portapapeles!');
      }).catch(err => {
        alert('Error al copiar el texto. ' + err);
      });
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full pb-24">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1 flex items-center gap-2">
          <Calculator size={24} className="text-ofit-pink" />
          Armador de Presupuestos
        </h1>
        <p className="text-sm text-ofit-text-soft">
          Simulador rápido bidireccional (no afecta la caja)
        </p>
      </div>

      {/* Global Config & Customer Selector */}
      <div className="card p-5 border-none">
        
        <div className="mb-5">
           <label className="input-label mb-1.5">
             Cliente <span className="text-red-500">*</span>
           </label>
           <select
             value={selectedCustomerId}
             onChange={(e) => handleCustomerSelect(e.target.value)}
             className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-ofit-pink outline-none transition-all bg-gray-50 focus:bg-white text-ofit-text font-medium"
           >
             <option value="">Seleccionar cliente (opcional)...</option>
             {customers.map(c => (
               <option key={c.id} value={c.id}>{c.name}</option>
             ))}
           </select>
        </div>

        <h2 className="text-sm font-semibold text-ofit-text mb-3">Márgenes Globales</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="input-label mb-1">Minorista</label>
            <div className="relative">
              <input 
                type="number" min="0" step="1"
                value={globalRetailMargin}
                onChange={e => setGlobalRetailMargin(parseFloat(e.target.value) || 0)}
                className="input-field pr-8 font-bold text-ofit-pink bg-ofit-pink-soft/30"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ofit-pink text-xs font-bold">%</span>
            </div>
          </div>
          <div className="flex-1">
            <label className="input-label mb-1">Mayorista</label>
            <div className="relative">
              <input 
                type="number" min="0" step="1"
                value={globalWholesaleMargin}
                onChange={e => setGlobalWholesaleMargin(parseFloat(e.target.value) || 0)}
                className="input-field pr-8 font-bold text-purple-600 bg-purple-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-600 text-xs font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="card p-5 border-none">
        <h2 className="text-md font-semibold text-ofit-text mb-3">Agregar Prenda</h2>
        <form onSubmit={handleAddItem} className="flex flex-col gap-3">
          <div>
            <label className="input-label mb-1">Descripción</label>
            <input 
              type="text" 
              value={desc} 
              onChange={e => setDesc(e.target.value)}
              placeholder="Ej: Remerón negro"
              className="input-field"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="input-label mb-1">Costo Unitario</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft">$</span>
                <input 
                  type="number" min="0" step="0.01"
                  value={cost} 
                  onChange={e => setCost(e.target.value)}
                  placeholder="0.00"
                  className="input-field !pl-7 font-bold"
                />
              </div>
            </div>
            <div className="w-24">
              <label className="input-label mb-1">Cant.</label>
              <input 
                type="number" min="1" step="1"
                value={qty} 
                onChange={e => setQty(e.target.value ? parseInt(e.target.value) : '')}
                className="input-field text-center font-bold"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!desc.trim() || !cost}
            className="btn-secondary w-full py-2.5 mt-1 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Añadir al Presupuesto
          </button>
        </form>
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          
          <div className="flex items-center justify-between mb-1 mt-2">
            <h3 className="font-bold text-ofit-text text-lg">Cotización</h3>
            
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('retail')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'retail' ? 'bg-white text-ofit-pink shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Minorista
              </button>
              <button
                onClick={() => setViewMode('wholesale')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'wholesale' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Mayorista
              </button>
            </div>
          </div>

          {items.map(item => {
            const currentMargin = viewMode === 'retail' ? item.retailMargin : item.wholesaleMargin;
            const currentPrice = viewMode === 'retail' ? item.retailPrice : item.wholesalePrice;
            const accentColor = viewMode === 'retail' ? 'text-ofit-pink' : 'text-purple-600';
            
            return (
              <div key={item.id} className="card p-4 border-none relative group flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-6">
                    <input 
                      type="text"
                      value={item.description}
                      onChange={(e) => setItems(items.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                      className="font-bold text-ofit-text text-sm w-full outline-none bg-transparent border-b border-transparent hover:border-gray-200 focus:border-ofit-pink transition-colors"
                    />
                    <p className="text-xs text-ofit-text-soft mt-1 flex items-center gap-2">
                       Costo: ${item.cost.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute top-3 right-3 p-1.5 text-ofit-text-soft hover:text-red-500 bg-gray-50 rounded-full transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex gap-3 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 items-end">
                   
                   {/* Quantity Edit */}
                   <div className="w-16">
                     <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">Cant.</label>
                     <input 
                       type="number" min="1" step="1"
                       value={item.quantity}
                       onChange={(e) => updateItemQuantity(item.id, e.target.value)}
                       className="w-full h-8 text-center text-sm font-bold rounded-lg border border-gray-200 outline-none focus:border-ofit-pink"
                     />
                   </div>

                   {/* Margin Edit */}
                   <div className="flex-1">
                     <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">Margen</label>
                     <div className="relative">
                       <input 
                         type="number" step="0.1"
                         value={currentMargin.toFixed(1).replace(/\.0$/, '')}
                         onChange={(e) => updateItemBidirectional(item.id, 'margin', e.target.value)}
                         className={`w-full h-8 pl-2 pr-5 text-sm font-bold rounded-lg border border-gray-200 outline-none focus:border-ofit-pink ${accentColor}`}
                       />
                       <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold ${accentColor}`}>%</span>
                     </div>
                   </div>

                   {/* Price Edit */}
                   <div className="flex-1">
                     <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">P. Unit</label>
                     <div className="relative">
                       <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold ${accentColor}`}>$</span>
                       <input 
                         type="number" step="0.01"
                         value={currentPrice.toFixed(2).replace(/\.00$/, '')}
                         onChange={(e) => updateItemBidirectional(item.id, 'price', e.target.value)}
                         className={`w-full h-8 pl-5 pr-2 text-sm font-bold rounded-lg border border-gray-200 outline-none focus:border-ofit-pink bg-white ${accentColor}`}
                       />
                     </div>
                   </div>

                </div>
              </div>
            );
          })}

          {/* Export & Totals */}
          <div className="card p-5 border-none mt-4 bg-[#25D366]/10 border border-[#25D366]/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="block text-xs font-bold text-ofit-text uppercase tracking-wider mb-0.5">Total {viewMode === 'retail' ? 'Minorista' : 'Mayorista'}</span>
                <span className="text-3xl font-bold text-ofit-text">
                  ${totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={exportToWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition-colors"
              >
                <MessageCircle size={20} />
                Enviar Presupuesto por WhatsApp
              </button>

              <button
                onClick={convertToOrder}
                disabled={isSubmitting || !selectedCustomerId}
                className={`w-full font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors ${!selectedCustomerId ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-primary shadow-sm text-white'}`}
                title={!selectedCustomerId ? 'Seleccioná un cliente primero' : 'Crear pedido real'}
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ClipboardCheck size={20} />}
                Aprobar y crear Pedido
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
