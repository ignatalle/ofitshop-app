'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, X, PackageOpen, DollarSign, CheckCircle2, Clock, Truck, Percent, Pencil, Trash2, MessageCircle, Minus } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string | null;
}

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  priceType: 'retail' | 'wholesale';
  unitPrice: number;
  subtotal: number;
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

interface Product {
  id: string;
  sku: string;
  name: string;
  retail_price: number | null;
  wholesale_price: number | null;
  retail_list_price: number | null;
  wholesale_list_price: number | null;
  created_at: string;
}

const generateSmartSKU = (productName: string) => {
  const cleanName = productName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '')
    .toUpperCase();
    
  const letters = cleanName.replace(/[^A-Z]/g, '');
  const prefix = letters.length >= 3 ? letters.substring(0, 3) : 'OUT';
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  
  return `${prefix}-${randomNumber}`;
};

export default function PedidosPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderStatus, setOrderStatus] = useState('PENDIENTE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [advancePayment, setAdvancePayment] = useState('');

  const [useListPrice, setUseListPrice] = useState(false);
  const [cartMarkup, setCartMarkup] = useState('15');

  const subtotalCents = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const totalAmountCents = subtotalCents;
  // Quick Create Product Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCost, setNewProductCost] = useState('');
  const [newProductRetailMargin, setNewProductRetailMargin] = useState('');
  const [newProductRetailPrice, setNewProductRetailPrice] = useState('');
  const [newProductWholesaleMargin, setNewProductWholesaleMargin] = useState('');
  const [newProductWholesalePrice, setNewProductWholesalePrice] = useState('');
  const [newListMarkup, setNewListMarkup] = useState('15');
  const [isSubmittingNewProduct, setIsSubmittingNewProduct] = useState(false);

  // Quick Create Customer Modal states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerType, setNewCustomerType] = useState('MINORISTA');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [custRes, ordRes, prodRes] = await Promise.all([
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('name', { ascending: true })
      ]);

      if (custRes.error) throw custRes.error;
      if (ordRes.error) throw ordRes.error;
      if (prodRes.error) throw prodRes.error;

      setCustomers(custRes.data || []);
      setOrders(ordRes.data || []);
      setProducts(prodRes.data || []);
    } catch (error: any) {
      alert("Error al cargar pedidos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCart(prevCart => prevCart.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      
      let unitPrice = 0;
      if (item.priceType === 'wholesale') {
        unitPrice = useListPrice 
          ? Math.round((product.wholesale_price || 0) * (1 + (parseFloat(cartMarkup) || 0) / 100))
          : (product.wholesale_price || 0);
      } else {
        unitPrice = useListPrice 
          ? Math.round((product.retail_price || 0) * (1 + (parseFloat(cartMarkup) || 0) / 100))
          : (product.retail_price || 0);
      }
      
      return { ...item, unitPrice, subtotal: unitPrice * item.quantity };
    }));
  }, [useListPrice, cartMarkup, products]);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
  };

  const handleAddToCart = (productId: string) => {
    if (!productId) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const customer = customers.find(c => c.id === selectedCustomerId);
    const priceType = customer?.type === 'MAYORISTA' ? 'wholesale' : 'retail';
    
    let unitPrice = 0;
    if (priceType === 'wholesale') {
      unitPrice = useListPrice 
        ? Math.round((product.wholesale_price || 0) * (1 + (parseFloat(cartMarkup) || 0) / 100))
        : (product.wholesale_price || 0);
    } else {
      unitPrice = useListPrice 
        ? Math.round((product.retail_price || 0) * (1 + (parseFloat(cartMarkup) || 0) / 100))
        : (product.retail_price || 0);
    }

    const newItem: CartItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      priceType,
      unitPrice,
      subtotal: unitPrice
    };

    setCart([...cart, newItem]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ, subtotal: newQ * item.unitPrice };
      }
      return item;
    }));
  };

  const setPriceType = (id: string, newType: 'retail' | 'wholesale') => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === item.productId);
        if (!product) return item;
        
        let newUnitPrice = 0;
        if (newType === 'wholesale') {
          newUnitPrice = useListPrice 
            ? Math.round((product.wholesale_price || 0) * (1 + (parseFloat(cartMarkup) || 0) / 100))
            : (product.wholesale_price || 0);
        } else {
          newUnitPrice = useListPrice 
            ? Math.round((product.retail_price || 0) * (1 + (parseFloat(cartMarkup) || 0) / 100))
            : (product.retail_price || 0);
        }
        
        return { ...item, priceType: newType, unitPrice: newUnitPrice, subtotal: newUnitPrice * item.quantity };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCostChange = (val: string) => {
    setNewProductCost(val);
    const cost = parseFloat(val);
    if (!isNaN(cost) && cost > 0) {
      if (newProductRetailMargin) {
        const rm = parseFloat(newProductRetailMargin);
        if (!isNaN(rm)) setNewProductRetailPrice((cost * (1 + rm / 100)).toFixed(2));
      }
      if (newProductWholesaleMargin) {
        const wm = parseFloat(newProductWholesaleMargin);
        if (!isNaN(wm)) setNewProductWholesalePrice((cost * (1 + wm / 100)).toFixed(2));
      }
    }
  };

  const handleRetailMarginChange = (val: string) => {
    setNewProductRetailMargin(val);
    const margin = parseFloat(val);
    const cost = parseFloat(newProductCost);
    if (!isNaN(margin) && !isNaN(cost) && cost > 0) {
      setNewProductRetailPrice((cost * (1 + margin / 100)).toFixed(2));
    }
  };

  const handleRetailPriceChange = (val: string) => {
    setNewProductRetailPrice(val);
    const price = parseFloat(val);
    const cost = parseFloat(newProductCost);
    if (!isNaN(price) && !isNaN(cost) && cost > 0) {
      setNewProductRetailMargin((((price - cost) / cost) * 100).toFixed(1));
    }
  };

  const handleWholesaleMarginChange = (val: string) => {
    setNewProductWholesaleMargin(val);
    const margin = parseFloat(val);
    const cost = parseFloat(newProductCost);
    if (!isNaN(margin) && !isNaN(cost) && cost > 0) {
      setNewProductWholesalePrice((cost * (1 + margin / 100)).toFixed(2));
    }
  };

  const handleWholesalePriceChange = (val: string) => {
    setNewProductWholesalePrice(val);
    const price = parseFloat(val);
    const cost = parseFloat(newProductCost);
    if (!isNaN(price) && !isNaN(cost) && cost > 0) {
      setNewProductWholesaleMargin((((price - cost) / cost) * 100).toFixed(1));
    }
  };

  const handleQuickCreateProduct = async (e: React.FormEvent, customerType: string) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    try {
      setIsSubmittingNewProduct(true);
      const generatedSku = generateSmartSKU(newProductName.trim());
      const productData = {
        name: newProductName.trim(),
        sku: generatedSku,
        cost_price: newProductCost ? Math.round(parseFloat(newProductCost) * 100) : null,
        retail_price: newProductRetailPrice ? Math.round(parseFloat(newProductRetailPrice) * 100) : null,
        wholesale_price: newProductWholesalePrice ? Math.round(parseFloat(newProductWholesalePrice) * 100) : null,
        retail_list_price: newProductRetailPrice ? Math.round(parseFloat(newProductRetailPrice) * 1.15 * 100) : null,
        wholesale_list_price: newProductWholesalePrice ? Math.round(parseFloat(newProductWholesalePrice) * 1.15 * 100) : null,
      };

      const { data, error } = await supabase.from('products').insert([productData]).select();
      if (error) throw error;

      if (data && data.length > 0) {
        const createdProduct = data[0];
        const updatedProducts = [...products, createdProduct].sort((a, b) => a.name.localeCompare(b.name));
        setProducts(updatedProducts);
        
        handleAddToCart(createdProduct.id);
        setIsProductModalOpen(false);
        setNewProductName('');
        setNewProductCost('');
        setNewProductRetailMargin('');
        setNewProductRetailPrice('');
        setNewProductWholesaleMargin('');
        setNewProductWholesalePrice('');
        setNewListMarkup('15');
      }
    } catch (error: any) {
      alert("Error al crear el producto: " + error.message);
    } finally {
      setIsSubmittingNewProduct(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) return;

    try {
      setIsSubmittingCustomer(true);
      const dataToInsert = {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        type: newCustomerType
      };

      const { data, error } = await supabase.from('customers').insert([dataToInsert]).select();
      if (error) {
        if (error.code === '23505' || error.message?.includes('unique')) {
           alert("Este número de WhatsApp ya existe en tu agenda.");
           return;
        }
        throw error;
      }

      if (data && data.length > 0) {
        const created = data[0];
        setCustomers([...customers, created].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedCustomerId(created.id);
        
        setIsCustomerModalOpen(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewCustomerType('MINORISTA');
      }
    } catch (error: any) {
      alert("Error al crear cliente: " + error.message);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setSelectedCustomerId(order.customer_id);
    setOrderStatus(order.status);
    setAdvancePayment(order.advance_payment ? (order.advance_payment / 100).toString() : '');
    
    if (order.items && Array.isArray(order.items)) {
      setCart(order.items);
    } else {
      setCart([]);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditOrder = () => {
    setEditingOrderId(null);
    setSelectedCustomerId('');
    setCart([]);
    setOrderStatus('PENDIENTE');
    setAdvancePayment('');
    setUseListPrice(false);
    setCartMarkup('15');
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm("¿Seguro que querés eliminar este pedido? Se borrarán también las transacciones de caja asociadas.")) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      if (editingOrderId === id) cancelEditOrder();
    } catch (error: any) {
      alert("Error al eliminar pedido: " + error.message);
    }
  };

  const generateWhatsAppLink = (order: Order, customer: Customer, isListPriceContext?: boolean) => {
    if (!customer.phone) return '#';
    
    let subtotalCents = 0;
    if (order.items && Array.isArray(order.items)) {
      subtotalCents = order.items.reduce((acc: number, item: any) => acc + item.subtotal, 0);
    } else {
      subtotalCents = order.total_amount;
    }
    
    let isListPrice = isListPriceContext !== undefined ? isListPriceContext : false;
    if (isListPriceContext === undefined && order.items && order.items.length > 0) {
      const firstItem = order.items[0];
      const prod = products.find(p => p.id === firstItem.productId);
      if (prod) {
        const cashPrice = firstItem.priceType === 'wholesale' ? prod.wholesale_price : prod.retail_price;
        if (firstItem.unitPrice !== cashPrice) {
          isListPrice = true;
        }
      }
    }

    let text = `¡Hola ${customer.name}! 👋 Acá te paso el detalle y presupuesto de tu pedido en Outfit Shop:\n\n`;
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      order.items.forEach((item: any) => {
        text += `${item.quantity}x ${item.productName} - $${(item.subtotal / 100).toLocaleString('es-AR')}\n`;
      });
    } else {
      text += `${order.details}\n`;
    }
    
    if (!isListPrice) {
      text += `\n💰 *Total a pagar* (Efectivo/Transferencia): $${(order.total_amount / 100).toLocaleString('es-AR')}`;
    } else {
      text += `\n💳 *Total a pagar* (Tarjeta/QR): $${(order.total_amount / 100).toLocaleString('es-AR')}`;
    }

    if (order.advance_payment && order.advance_payment > 0) {
      text += `\n\n💰 *Entregaste:* $${(order.advance_payment / 100).toLocaleString('es-AR')}`;
      const pendingFinal = order.total_amount - order.advance_payment;
      if (pendingFinal > 0) {
        text += `\n🚨 *Saldo restante:* $${(pendingFinal / 100).toLocaleString('es-AR')}`;
      } else {
        text += `\n✅ *¡Pedido totalmente saldado!*`;
      }
    } else {
      text += `\n\nAvisame si te separo todo y te paso los datos para abonar.`;
    }
    
    const cleanPhone = customer.phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || cart.length === 0) return;

    const advanceCents = advancePayment ? Math.round(parseFloat(advancePayment) * 100) : 0;
    const detailsText = cart.map(item => `${item.quantity}x ${item.productName}`).join(' | ');

    try {
      setIsSubmitting(true);
      
      if (editingOrderId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            customer_id: selectedCustomerId,
            details: detailsText,
            items: cart,
            total_amount: totalAmountCents,
            advance_payment: advanceCents,
            status: orderStatus
          })
          .eq('id', editingOrderId);
          
        if (updateError) throw updateError;
        
        // Sincronizar transacción inicial en caso de edición
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('order_id', editingOrderId)
          .like('description', 'Pago inicial pedido:%')
          .limit(1);

        const netAdvanceCents = advanceCents;

        if (advanceCents > 0) {
          if (existingTx && existingTx.length > 0) {
            // Update existing transaction
            await supabase.from('transactions').update({ amount: netAdvanceCents }).eq('id', existingTx[0].id);
          } else {
            // Create new transaction
            const transaction = {
              order_id: editingOrderId,
              type: 'INGRESO',
              amount: netAdvanceCents,
              description: `Pago inicial pedido: ${customers.find(c => c.id === selectedCustomerId)?.name || 'Cliente'}`
            };
            await supabase.from('transactions').insert([transaction]);
          }
        } else {
          // If advanceCents is 0, delete the initial transaction if it exists
          if (existingTx && existingTx.length > 0) {
            await supabase.from('transactions').delete().eq('id', existingTx[0].id);
          }
        }

        await fetchData();
        alert("¡Presupuesto actualizado exitosamente!");
        cancelEditOrder();
      } else {
        const newOrder = {
          customer_id: selectedCustomerId,
          details: detailsText,
          items: cart,
          total_amount: totalAmountCents,
          advance_payment: advanceCents,
          status: 'PENDIENTE'
        };

        const { data: orderData, error: orderError } = await supabase.from('orders').insert([newOrder]).select();
        if (orderError) throw orderError;

        if (orderData && orderData.length > 0) {
          if (advanceCents > 0) {
            const netAdvanceCents = advanceCents;
            const transaction = {
              order_id: orderData[0].id,
              type: 'INGRESO',
              amount: netAdvanceCents,
              description: `Pago inicial pedido: ${customers.find(c => c.id === selectedCustomerId)?.name || 'Cliente'}`
            };
            const { error: txError } = await supabase.from('transactions').insert([transaction]);
            if (txError) console.error("Error al registrar pago inicial:", txError);
          }
          await fetchData();
          
          const confirmMsg = "¡Presupuesto guardado exitosamente!\n\n¿Querés enviarlo por WhatsApp?";
          if (window.confirm(confirmMsg)) {
             const cust = customers.find(c => c.id === selectedCustomerId);
             if (cust) {
               window.open(generateWhatsAppLink(orderData[0], cust, useListPrice), '_blank');
             }
          }
          cancelEditOrder();
        }
      }
    } catch (error: any) {
      alert("Error al guardar pedido: " + error.message);
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
          Armar Pedidos
        </h1>
        <p className="text-sm text-gray-500">
          Gestiona encargos y automatiza sus señas
        </p>
      </div>

      {/* FORMULARIO DE NUEVO PEDIDO */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <PackageOpen size={20} className="text-blue-600" />
          Anotar Nuevo Pedido
        </h2>
        
        <form onSubmit={handleSubmitOrder} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cliente <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="flex-1 h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-800"
              >
                <option value="">Seleccionar cliente...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-12 h-12 shrink-0 border border-gray-300 rounded-xl flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all bg-white shadow-sm"
                title="Nuevo cliente rápido"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>


          {/* CART LIST */}
          {cart.length > 0 && (
            <div className="flex flex-col gap-3 mt-2 border-t pt-4">
              <h3 className="font-semibold text-gray-800 text-sm">Detalle del Pedido</h3>
              {cart.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-3 sm:items-center p-3 bg-gray-50 rounded-xl border border-gray-100 relative group">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm leading-tight pr-8">{item.productName}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <span className="text-gray-500">${(item.unitPrice / 100).toLocaleString('es-AR')} u.</span>
                      <select 
                        value={item.priceType}
                        onChange={(e) => setPriceType(item.id, e.target.value as 'retail' | 'wholesale')}
                        className="px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border border-gray-200 bg-white text-gray-700 outline-none focus:border-blue-400"
                      >
                        <option value="retail">Precio Minorista</option>
                        <option value="wholesale">Precio Mayorista</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg">
                      <button type="button" onClick={() => updateQuantity(item.id, -1)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-l-lg"><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, 1)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-r-lg"><Plus size={14} /></button>
                    </div>
                    
                    <div className="font-bold text-gray-900 w-24 text-right">
                      ${(item.subtotal / 100).toLocaleString('es-AR')}
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 bg-white sm:bg-transparent rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shadow-sm sm:shadow-none"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Agregar Prenda <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  handleAddToCart(e.target.value);
                  e.target.value = "";
                }}
                disabled={!selectedCustomerId}
                className="flex-1 h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 disabled:opacity-50"
              >
                <option value="">{selectedCustomerId ? "Seleccionar prenda..." : "Primero selecciona un cliente"}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(true)}
                className="w-12 h-12 shrink-0 border border-gray-300 rounded-xl flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all bg-white shadow-sm"
                title="Nuevo producto rápido"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* DISCOUNT */}
          {cart.length > 0 && (
            <div className="flex flex-col gap-1 mt-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useListPrice}
                  onChange={(e) => setUseListPrice(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm font-semibold text-gray-800">💳 Pago con Tarjeta, QR o App</span>
              </label>
              {useListPrice && (
                <div className="flex items-center gap-2 mt-1 ml-6">
                  <label className="text-xs font-semibold text-gray-700">Recargo:</label>
                  <div className="relative">
                    <input
                      type="number" step="1" min="0"
                      value={cartMarkup}
                      onChange={(e) => setCartMarkup(e.target.value)}
                      className="w-16 h-7 pl-2 pr-5 rounded-md border border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-blue-700 bg-white"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-500 text-[10px] font-bold">%</span>
                  </div>
                </div>
              )}
              {!useListPrice && (
                <span className="text-xs text-gray-500 ml-6">Cambia los precios al valor de lista para cubrir comisiones.</span>
              )}
            </div>
          )}

          {/* TOTAL & ADVANCE */}
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <div className="flex-1 flex flex-col justify-end">
              <span className="block text-sm font-medium text-gray-500 mb-1">Total a pagar</span>
              <div className="h-12 flex items-center px-4 rounded-xl bg-gray-100 border border-gray-200 font-bold text-xl text-gray-900">
                ${(totalAmountCents / 100).toLocaleString('es-AR')}
              </div>
            </div>
            

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Estado
              </label>
              <select
                value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-gray-800"
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="RECIBIDO">RECIBIDO</option>
                <option value="ENTREGADO">ENTREGADO</option>
              </select>
            </div>
          </div>

          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              💰 Dinero entregado ahora (Seña / Total)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <DollarSign size={16} />
              </span>
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <button
              type="submit"
              disabled={isSubmitting || !selectedCustomerId || cart.length === 0}
              className={`w-full h-12 font-bold text-white rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                editingOrderId ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isSubmitting ? 'Guardando...' : (editingOrderId ? 'Actualizar Pedido' : 'Registrar Pedido')}
            </button>
            
            {editingOrderId && (
              <button
                type="button"
                onClick={cancelEditOrder}
                disabled={isSubmitting}
                className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* LISTA DE PEDIDOS */}
      <div className="flex flex-col gap-4 pb-4">
        <h2 className="text-lg font-semibold text-gray-800">Tablero de Pedidos</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm border-dashed">
            <p className="text-gray-500">No hay pedidos registrados.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map(order => {
              const customer = customers.find(c => c.id === order.customer_id);
              
              let StatusIcon = Clock;
              let statusColor = "bg-amber-100 text-amber-800 border-amber-200";
              let selectColor = "focus:ring-amber-500 border-amber-300 text-amber-900 bg-amber-50";
              
              if (order.status === 'RECIBIDO') {
                StatusIcon = Truck;
                statusColor = "bg-blue-100 text-blue-800 border-blue-200";
                selectColor = "focus:ring-blue-500 border-blue-300 text-blue-900 bg-blue-50";
              } else if (order.status === 'ENTREGADO') {
                StatusIcon = CheckCircle2;
                statusColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                selectColor = "focus:ring-emerald-500 border-emerald-300 text-emerald-900 bg-emerald-50";
              }

              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 flex flex-col gap-3">
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900">{customer?.name || 'Cliente Desconocido'}</h3>
                        {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                          <div className="flex flex-col gap-1 mt-1">
                            {order.items.map((it: any, i: number) => (
                              <span key={i} className="text-sm text-gray-600 leading-tight">
                                {it.quantity}x {it.productName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 leading-tight mt-0.5">{order.details}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`shrink-0 px-2.5 py-1 rounded-lg border flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                          <StatusIcon size={14} />
                          {order.status}
                        </div>
                        <div className="flex gap-1">
                          {customer && customer.phone && (
                            <a 
                              href={generateWhatsAppLink(order, customer)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebd5a] transition-colors shadow-sm"
                              title="Enviar ticket por WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </a>
                          )}
                          <button onClick={() => handleEditOrder(order)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm py-2 border-y border-gray-50">
                      <div className="text-gray-500">
                        Total Presupuestado: <span className="font-semibold text-gray-800">${(order.total_amount / 100).toLocaleString('es-AR')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">Cambiar estado:</span>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, order.status, e.target.value)}
                        className={`flex-1 h-9 px-2 text-sm font-bold rounded-lg border outline-none transition-colors cursor-pointer ${selectColor}`}
                      >
                        <option value="PENDIENTE">PENDIENTE</option>
                        <option value="RECIBIDO">RECIBIDO</option>
                        <option value="ENTREGADO">ENTREGADO</option>
                      </select>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CREACIÓN RÁPIDA DE CLIENTE */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Nuevo Cliente Rápido</h3>
              <button 
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCustomer} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" required placeholder="Ej. Ana García"
                  value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel" required placeholder="Ej. 11 1234 5678"
                  value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tipo de Cliente
                </label>
                <select
                  value={newCustomerType} onChange={(e) => setNewCustomerType(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50 focus:bg-white font-medium"
                >
                  <option value="MINORISTA">Minorista</option>
                  <option value="MAYORISTA">Mayorista</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()}
                className="w-full h-12 mt-2 font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingCustomer && <Loader2 size={18} className="animate-spin" />}
                {isSubmittingCustomer ? 'Guardando...' : 'Guardar y Seleccionar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREACIÓN RÁPIDA DE PRODUCTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Creación Rápida de Producto</h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                const activeCust = customers.find(c => c.id === selectedCustomerId);
                handleQuickCreateProduct(e, activeCust?.type || 'MINORISTA');
              }} 
              className="p-5 overflow-y-auto flex flex-col gap-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre de la prenda <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" required placeholder="Ej. Buzo Gris Oversize"
                  value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md mb-1 mt-1">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <span className="text-xl">💡</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-blue-800">
                      ¿Cómo funcionan los precios?
                    </h3>
                    <div className="mt-1 text-sm text-blue-700">
                      Vos solo elegí cuánto querés ganar en Efectivo. El sistema le sumará automáticamente un porcentaje de cobertura para crear tu "Precio de Lista", asegurando que no pierdas dinero cuando te paguen con Tarjeta o QR.
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-sm font-semibold text-blue-800">Porcentaje de Cobertura:</label>
                      <div className="relative w-24">
                        <input
                          type="number" step="1" min="0"
                          value={newListMarkup} onChange={(e) => setNewListMarkup(e.target.value)}
                          className="w-full h-8 pl-3 pr-6 rounded-md border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-700 bg-white"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 text-xs font-bold">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">Costo Base</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={16} /></span>
                    <input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      value={newProductCost} onChange={(e) => handleCostChange(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold"
                    />
                  </div>
                </div>
                
                <hr className="border-gray-200" />
                
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-2">Venta Minorista</label>
                  <div className="flex gap-4">
                    <div className="w-1/3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Margen</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Percent size={14} /></span>
                        <input
                          type="number" step="0.1" placeholder="0.0"
                          value={newProductRetailMargin} onChange={(e) => handleRetailMarginChange(e.target.value)}
                          className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Precio Final</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={14} /></span>
                        <input
                          type="number" step="0.01" min="0" placeholder="0.00"
                          value={newProductRetailPrice} onChange={(e) => handleRetailPriceChange(e.target.value)}
                          className="w-full h-10 pl-8 pr-3 rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-blue-700 bg-blue-50/30"
                        />
                      </div>
                    </div>
                  </div>
                  {newProductRetailPrice && !isNaN(parseFloat(newProductRetailPrice)) && parseFloat(newProductRetailPrice) > 0 && (
                    <div className="mt-2 text-xs font-medium text-gray-500">
                      Precio de Lista Sugerido (Tarjeta): ${(parseFloat(newProductRetailPrice) * (1 + (parseFloat(newListMarkup) || 0) / 100)).toFixed(2)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-purple-800 mb-2">Venta Mayorista</label>
                  <div className="flex gap-4">
                    <div className="w-1/3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Margen</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Percent size={14} /></span>
                        <input
                          type="number" step="0.1" placeholder="0.0"
                          value={newProductWholesaleMargin} onChange={(e) => handleWholesaleMarginChange(e.target.value)}
                          className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Precio Final</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={14} /></span>
                        <input
                          type="number" step="0.01" min="0" placeholder="0.00"
                          value={newProductWholesalePrice} onChange={(e) => handleWholesalePriceChange(e.target.value)}
                          className="w-full h-10 pl-8 pr-3 rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-500 outline-none transition-all font-bold text-purple-700 bg-purple-50/30"
                        />
                      </div>
                    </div>
                  </div>
                  {newProductWholesalePrice && !isNaN(parseFloat(newProductWholesalePrice)) && parseFloat(newProductWholesalePrice) > 0 && (
                    <div className="mt-2 text-xs font-medium text-gray-500">
                      Precio de Lista Sugerido (Tarjeta): ${(parseFloat(newProductWholesalePrice) * (1 + (parseFloat(newListMarkup) || 0) / 100)).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingNewProduct || !newProductName.trim()}
                className="w-full h-12 mt-2 font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingNewProduct && <Loader2 size={18} className="animate-spin" />}
                {isSubmittingNewProduct ? 'Creando...' : 'Crear Producto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
