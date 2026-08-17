'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle2, ChevronRight, Save, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  isValidSale, parseOrderItems, getItemUnitCostCents, getItemQuantity, isItemPendingCost,
  calculateSales, calculateCOGS, calculateOperatingExpenses, calculateCommissions, calculateNetProfit
} from '@/lib/finance';

interface PendingItem {
  orderId: string;
  orderAmount: number;
  orderDate: string;
  customerName: string;
  itemIndex: number;
  name: string;
  qty: number;
  originalItem: any;
}

interface PendingGroup {
  orderId: string;
  customerName: string;
  orderDate: string;
  orderAmount: number;
  totalPendingUnits: number;
  items: PendingItem[];
}

export default function CostosPendientesClient({ 
  initialOrders, 
  products, 
  transactions, 
  currentMonth, 
  currentYear 
}: any) {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  
  // State for Repeated Items Modal
  const [repeatedModalData, setRepeatedModalData] = useState<{
    itemName: string;
    newCostCents: number;
    matchingItems: PendingItem[];
  } | null>(null);
  
  // Build product catalog map
  const productsMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p: any) => {
      map[p.id] = Number(p.cost_price) || 0;
    });
    return map;
  }, [products]);

  // Calculate live profit
  const facturacion = calculateSales(orders, currentMonth, currentYear);
  const { cogs, hasIncompleteCosts } = calculateCOGS(orders, productsMap, currentMonth, currentYear);
  const ops = calculateOperatingExpenses(transactions, currentMonth, currentYear);
  const com = calculateCommissions(transactions, currentMonth, currentYear);
  const ganancia = calculateNetProfit(facturacion, cogs, com, ops);

  // Group pending items
  const pendingGroups = useMemo(() => {
    const groupsMap = new Map<string, PendingGroup>();
    let totalPendingItemsCount = 0;

    orders.forEach(o => {
      if (!isValidSale(o)) return;
      const items = parseOrderItems(o);
      
      items.forEach((item, index) => {
        if (isItemPendingCost(item, productsMap)) {
          totalPendingItemsCount++;
          const qty = getItemQuantity(item);
          const name = item.productName || item.name || 'Sin nombre';

          if (!groupsMap.has(o.id)) {
            groupsMap.set(o.id, {
              orderId: o.id,
              customerName: o.customers?.name || 'Cliente',
              orderDate: o.created_at,
              orderAmount: o.total_amount || 0,
              totalPendingUnits: 0,
              items: []
            });
          }
          
          const g = groupsMap.get(o.id)!;
          g.totalPendingUnits += qty;
          g.items.push({
            orderId: o.id,
            orderAmount: o.total_amount || 0,
            orderDate: o.created_at,
            customerName: o.customers?.name || 'Cliente',
            itemIndex: index,
            name,
            qty,
            originalItem: item
          });
        }
      });
    });

    const groupsArray = Array.from(groupsMap.values());
    
    // Sort logic
    groupsArray.sort((a, b) => {
      if (b.totalPendingUnits !== a.totalPendingUnits) return b.totalPendingUnits - a.totalPendingUnits;
      if (b.orderAmount !== a.orderAmount) return b.orderAmount - a.orderAmount;
      return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
    });

    return { groups: groupsArray, totalPendingItemsCount };
  }, [orders, productsMap]);

  // To track progress
  const [initialPendingCount] = useState(pendingGroups.totalPendingItemsCount);
  const reviewedCount = initialPendingCount - pendingGroups.totalPendingItemsCount;

  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const handleInputChange = (itemId: string, val: string) => {
    setInputValues(prev => ({ ...prev, [itemId]: val }));
  };

  const executeUpdate = async (item: PendingItem, newCost: number, sinCosto: boolean) => {
    // 1. Fetch fresh order
    const { data: freshOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', item.orderId)
      .single();
    
    if (fetchErr || !freshOrder) throw new Error("No se pudo obtener el pedido");

    // 2. Parse and update specific item safely
    const items = parseOrderItems(freshOrder);
    if (!items[item.itemIndex]) throw new Error("El ítem no existe en el pedido");

    const targetItem = { ...items[item.itemIndex] };
    
    if (sinCosto) {
      targetItem.sinCostoConfirmado = true;
    } else {
      targetItem.costCents = newCost;
      targetItem.sinCostoConfirmado = false; // clear if it was set
    }

    items[item.itemIndex] = targetItem;

    // 3. Persist to DB
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ items })
      .eq('id', item.orderId);

    if (updateErr) throw updateErr;
    return items;
  };

  const handleSaveCost = async (item: PendingItem, newCost: number, sinCosto: boolean = false) => {
    const uniqueId = `${item.orderId}-${item.itemIndex}`;
    setLoadingItemId(uniqueId);
    try {
      const newItems = await executeUpdate(item, newCost, sinCosto);

      // 4. Update local state for optimistic UI
      setOrders(prev => prev.map(o => {
        if (o.id === item.orderId) {
          return { ...o, items: newItems };
        }
        return o;
      }));

      // 5. Check for repeated items if a cost was saved
      if (!sinCosto) {
        const matching = pendingGroups.groups.flatMap(g => g.items).filter(i => 
          i.orderId !== item.orderId || i.itemIndex !== item.itemIndex
        ).filter(i => 
          i.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (matching.length > 0) {
          setRepeatedModalData({
            itemName: item.name,
            newCostCents: newCost,
            matchingItems: matching
          });
        }
      }

    } catch (e) {
      alert("Error al guardar el costo");
      console.error(e);
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleApplyToRepeated = async () => {
    if (!repeatedModalData) return;
    const { newCostCents, matchingItems } = repeatedModalData;
    
    setRepeatedModalData(null);
    setLoadingItemId('modal-loading');
    
    try {
      for (const item of matchingItems) {
        const newItems = await executeUpdate(item, newCostCents, false);
        setOrders(prev => prev.map(o => {
          if (o.id === item.orderId) {
            return { ...o, items: newItems };
          }
          return o;
        }));
      }
    } catch(e) {
      alert("Error al aplicar a repetidos.");
    } finally {
      setLoadingItemId(null);
    }
  };

  const isBaggiBordo = (name: string) => name.toLowerCase().trim() === 'baggi bordo';

  if (pendingGroups.totalPendingItemsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
        <h2 className="text-2xl font-black text-ofit-text">¡Todo listo!</h2>
        <p className="text-ofit-text-soft font-medium mt-2 mb-6">No hay costos pendientes por resolver.</p>
        <Link href="/" className="bg-ofit-navy text-white px-6 py-3 rounded-xl font-bold">
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const firstGroup = pendingGroups.groups[0];

  return (
    <div className="flex flex-col w-full min-h-screen bg-ofit-bg pb-24 relative">
      {/* Repeated Modal */}
      {repeatedModalData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full flex flex-col gap-4 animate-fade-in">
            <h3 className="font-black text-xl text-ofit-text">Encontramos este producto en otros pedidos</h3>
            <p className="text-sm font-medium text-ofit-text-soft">
              ¿Querés usar también ${(repeatedModalData.newCostCents / 100).toLocaleString('es-AR')} en {repeatedModalData.matchingItems.length} {repeatedModalData.matchingItems.length === 1 ? 'producto igual' : 'productos iguales'}?
            </p>
            <div className="bg-gray-50 rounded-xl p-3 text-xs font-bold text-gray-500 max-h-32 overflow-y-auto">
              {repeatedModalData.matchingItems.map(m => (
                <div key={`${m.orderId}-${m.itemIndex}`} className="py-1">
                  • {m.name} ({m.qty} un.)
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={handleApplyToRepeated}
                className="bg-ofit-navy text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                Aplicar a todos los iguales
              </button>
              <button 
                onClick={() => setRepeatedModalData(null)}
                className="bg-white border border-gray-200 text-ofit-text-soft font-bold py-3 rounded-xl active:bg-gray-50"
              >
                Revisarlos uno por uno
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Overlay for Bulk Updates */}
      {loadingItemId === 'modal-loading' && (
        <div className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-ofit-pink" />
        </div>
      )}

      {/* Header Fijo */}
      <div className="sticky top-0 z-10 bg-ofit-bg/80 backdrop-blur-md border-b border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border shadow-sm text-ofit-navy">
              <ArrowLeft size={20} />
            </div>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-ofit-text">Costos pendientes</h1>
            <span className="text-xs font-bold text-ofit-text-soft">
              {reviewedCount > 0 ? `${reviewedCount} de ${initialPendingCount} revisados` : `${pendingGroups.totalPendingItemsCount} pendientes`}
            </span>
          </div>
        </div>

        {/* Ganancia Estimada Faja */}
        <div className="bg-ofit-navy p-4 rounded-xl text-white shadow-lg flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-white/70 font-bold">Ganancia {hasIncompleteCosts ? 'Estimada' : 'Neta'}</span>
            <span className="text-2xl font-black">${(ganancia / 100).toLocaleString('es-AR')}</span>
          </div>
          {hasIncompleteCosts && <AlertCircle size={20} className="text-amber-400 opacity-80" />}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        <p className="text-sm text-ofit-text-soft font-medium px-2">
          Completalos para saber cuánto ganó realmente Outfit Shop.
        </p>

        {/* Grupos de Pendientes */}
        <div className="flex flex-col gap-8">
          {pendingGroups.groups.map((group, groupIdx) => (
            <div key={group.orderId} className="flex flex-col gap-3">
              <div className="flex justify-between items-end px-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-ofit-text-soft uppercase tracking-wider">
                    Pedido {new Date(group.orderDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="text-lg font-black text-ofit-text">{group.customerName}</span>
                </div>
                <span className="text-xs font-bold bg-white border px-2 py-1 rounded-md text-ofit-text-soft shadow-sm">
                  {group.totalPendingUnits} unid. sin costo
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {group.items.map((item) => {
                  const uniqueId = `${item.orderId}-${item.itemIndex}`;
                  const inputVal = inputValues[uniqueId] || '';
                  const numVal = parseInt(inputVal, 10) || 0;
                  const isSugBaggi = isBaggiBordo(item.name);
                  const isSaving = loadingItemId === uniqueId;

                  return (
                    <div key={uniqueId} className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col gap-4 relative overflow-hidden">
                      {isSaving && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                          <Loader2 size={32} className="animate-spin text-ofit-pink" />
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col pr-4">
                          <span className="font-bold text-ofit-text text-base leading-tight">{item.name}</span>
                          <span className="text-sm font-medium text-ofit-text-soft mt-1">{item.qty} {item.qty === 1 ? 'unidad' : 'unidades'}</span>
                        </div>
                      </div>

                      {isSugBaggi && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex flex-col gap-2">
                          <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Costo sugerido: $13.990</span>
                          <span className="text-xs font-medium text-emerald-800/80">Encontramos "Baggy Bordo" en un pedido anterior. Coincidencia probable.</span>
                          <button 
                            onClick={() => handleSaveCost(item, 1399000)}
                            className="bg-emerald-600 text-white font-bold text-xs py-2 rounded-lg mt-1"
                          >
                            Usar $13.990
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-ofit-text-soft">Costo Unitario</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                          <input 
                            type="number"
                            value={inputVal}
                            onChange={(e) => handleInputChange(uniqueId, e.target.value)}
                            placeholder="0"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-8 pr-4 font-bold text-ofit-navy focus:outline-none focus:border-ofit-navy transition-colors text-lg"
                          />
                        </div>
                        {numVal > 0 && (
                          <div className="text-xs font-bold text-ofit-pink mt-1 ml-1 animate-fade-in">
                            {item.qty} {item.qty === 1 ? 'unidad' : 'unidades'} × ${(numVal).toLocaleString('es-AR')} = ${(numVal * item.qty).toLocaleString('es-AR')} total
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex gap-2">
                          <button 
                            disabled={numVal <= 0}
                            onClick={() => handleSaveCost(item, numVal * 100)}
                            className="flex-1 bg-ofit-navy text-white font-bold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
                          >
                            Guardar y siguiente <ChevronRight size={16} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              const proceed = confirm(`¿Querés dejar "${item.name}" sin determinar? Podés continuar, pero la Ganancia seguirá siendo estimada.`);
                              if (proceed) handleSaveCost(item, 0, true);
                            }}
                            className="flex-1 bg-white border border-gray-200 text-ofit-text-soft font-bold text-xs py-3 rounded-xl active:bg-gray-50"
                          >
                            No tengo este costo
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
