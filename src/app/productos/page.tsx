'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Pencil, Trash2, Loader2, DollarSign, Percent } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  cost_price: number | null;
  retail_price: number | null;
  wholesale_price: number | null;
  retail_list_price: number | null;
  wholesale_list_price: number | null;
  created_at: string;
}

const generateSmartSKU = (productName: string) => {
  const cleanName = productName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/\s+/g, '') // Quitar espacios
    .toUpperCase();
    
  const letters = cleanName.replace(/[^A-Z]/g, '');
  const prefix = letters.length >= 3 ? letters.substring(0, 3) : 'OUT';
  const randomNumber = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
  
  return `${prefix}-${randomNumber}`;
};

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [retailMargin, setRetailMargin] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [wholesaleMargin, setWholesaleMargin] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  
  const [listMarkup, setListMarkup] = useState('15');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      alert('Error al cargar los productos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCostChange = (val: string) => {
    setCostPrice(val);
    const cost = parseFloat(val);
    if (!isNaN(cost) && cost > 0) {
      if (retailMargin) {
        const rm = parseFloat(retailMargin);
        if (!isNaN(rm)) setRetailPrice((cost * (1 + rm / 100)).toFixed(2));
      }
      if (wholesaleMargin) {
        const wm = parseFloat(wholesaleMargin);
        if (!isNaN(wm)) setWholesalePrice((cost * (1 + wm / 100)).toFixed(2));
      }
    }
  };

  const handleRetailMarginChange = (val: string) => {
    setRetailMargin(val);
    const margin = parseFloat(val);
    const cost = parseFloat(costPrice);
    if (!isNaN(margin) && !isNaN(cost) && cost > 0) {
      setRetailPrice((cost * (1 + margin / 100)).toFixed(2));
    }
  };

  const handleRetailPriceChange = (val: string) => {
    setRetailPrice(val);
    const price = parseFloat(val);
    const cost = parseFloat(costPrice);
    if (!isNaN(price) && !isNaN(cost) && cost > 0) {
      setRetailMargin((((price - cost) / cost) * 100).toFixed(1));
    }
  };

  const handleWholesaleMarginChange = (val: string) => {
    setWholesaleMargin(val);
    const margin = parseFloat(val);
    const cost = parseFloat(costPrice);
    if (!isNaN(margin) && !isNaN(cost) && cost > 0) {
      setWholesalePrice((cost * (1 + margin / 100)).toFixed(2));
    }
  };

  const handleWholesalePriceChange = (val: string) => {
    setWholesalePrice(val);
    const price = parseFloat(val);
    const cost = parseFloat(costPrice);
    if (!isNaN(price) && !isNaN(cost) && cost > 0) {
      setWholesaleMargin((((price - cost) / cost) * 100).toFixed(1));
    }
  };

  const handleEdit = (product: Product) => {
    setName(product.name);
    
    const cost = product.cost_price !== null ? product.cost_price / 100 : null;
    const retail = product.retail_price !== null ? product.retail_price / 100 : null;
    const wholesale = product.wholesale_price !== null ? product.wholesale_price / 100 : null;

    setCostPrice(cost !== null ? cost.toString() : '');
    setRetailPrice(retail !== null ? retail.toString() : '');
    setWholesalePrice(wholesale !== null ? wholesale.toString() : '');

    if (cost && cost > 0) {
      if (retail !== null) setRetailMargin((((retail - cost) / cost) * 100).toFixed(1));
      else setRetailMargin('');
      
      if (wholesale !== null) setWholesaleMargin((((wholesale - cost) / cost) * 100).toFixed(1));
      else setWholesaleMargin('');
    } else {
      setRetailMargin('');
      setWholesaleMargin('');
    }

    if (product.retail_list_price !== null && product.retail_price !== null && product.retail_price > 0) {
      const computedMarkup = ((product.retail_list_price - product.retail_price) / product.retail_price) * 100;
      setListMarkup(Math.round(computedMarkup).toString());
    } else {
      setListMarkup('15');
    }

    setEditingId(product.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setName('');
    setCostPrice('');
    setRetailMargin('');
    setRetailPrice('');
    setWholesaleMargin('');
    setWholesalePrice('');
    setListMarkup('15');
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      
      const productData = {
        name: name.trim(),
        cost_price: costPrice ? Math.round(parseFloat(costPrice) * 100) : null,
        retail_price: retailPrice ? Math.round(parseFloat(retailPrice) * 100) : null,
        wholesale_price: wholesalePrice ? Math.round(parseFloat(wholesalePrice) * 100) : null,
        retail_list_price: retailPrice ? Math.round(parseFloat(retailPrice) * (1 + parseFloat(listMarkup) / 100) * 100) : null,
        wholesale_list_price: wholesalePrice ? Math.round(parseFloat(wholesalePrice) * (1 + parseFloat(listMarkup) / 100) * 100) : null,
      };

      if (editingId) {
        // En UPDATE no enviamos el SKU para no sobreescribirlo
        const { data, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingId)
          .select();

        if (error) throw error;
        
        if (data && data.length > 0) {
          setProducts(products.map(p => p.id === editingId ? data[0] : p));
        } else {
          fetchProducts();
        }
      } else {
        // En INSERT generamos el SKU automático
        const generatedSku = generateSmartSKU(name.trim());
        const { data, error } = await supabase
          .from('products')
          .insert([{ ...productData, sku: generatedSku }])
          .select();

        if (error) throw error;
        
        if (data && data.length > 0) {
          setProducts([data[0], ...products]);
        } else {
          fetchProducts();
        }
      }

      cancelEdit();
      
    } catch (error: any) {
      alert(`Error al ${editingId ? 'actualizar' : 'agregar'} el producto: ` + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== id));
      if (editingId === id) cancelEdit();
      
    } catch (error: any) {
      alert('Error al eliminar el producto: ' + error.message);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1">
          Listado de Precios
        </h1>
      </div>

      {/* Formulario */}
      {editingId && (
        <div className="card border-none p-5">
          <h2 className="text-lg font-semibold text-ofit-text mb-4">
            Editar Precios
          </h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="input-label mb-1.5" htmlFor="name">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="Ej. Remera Oversize"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white"
            />
          </div>

          <div className="bg-ofit-pink-soft border-l-4 border-blue-500 p-4 rounded-md mb-1 mt-1">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-xl">💡</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-blue-800">
                  ¿Cómo funcionan los precios?
                </h3>
                <div className="mt-1 text-sm text-ofit-pink">
                  Vos solo elegí cuánto querés ganar en Efectivo. El sistema le sumará automáticamente un porcentaje de cobertura para crear tu "Precio de Lista", asegurando que no pierdas dinero cuando te paguen con Tarjeta o QR.
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm font-semibold text-blue-800">Porcentaje de Cobertura:</label>
                  <div className="relative w-24">
                    <input
                      type="number" step="1" min="0"
                      value={listMarkup} onChange={(e) => setListMarkup(e.target.value)}
                      className="w-full h-8 pl-3 pr-6 rounded-md border border-blue-200 focus:ring-2 focus:ring-ofit-pink outline-none text-sm font-bold text-ofit-pink bg-white"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ofit-pink text-xs font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-5">
            {/* Costo */}
            <div>
              <label className="block text-sm font-bold text-ofit-text mb-1.5">
                Costo Base
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ofit-text-soft">
                  <DollarSign size={16} />
                </span>
                <input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={costPrice} onChange={(e) => handleCostChange(e.target.value)}
                  className="w-full h-12 !pl-10 pr-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all font-semibold"
                />
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Minorista */}
            <div>
              <label className="block text-sm font-bold text-blue-800 mb-2">Venta Minorista</label>
              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-xs font-medium text-ofit-text-soft mb-1">Margen</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft">
                      <Percent size={14} />
                    </span>
                    <input
                      type="number" step="0.1" placeholder="0.0"
                      value={retailMargin} onChange={(e) => handleRetailMarginChange(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ofit-text-soft mb-1">Precio Final</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft">
                      <DollarSign size={14} />
                    </span>
                    <input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      value={retailPrice} onChange={(e) => handleRetailPriceChange(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-ofit-border focus:ring-2 focus:ring-ofit-pink focus:border-blue-500 outline-none transition-all font-bold text-ofit-pink bg-ofit-pink-soft/30"
                    />
                  </div>
                </div>
              </div>
              {retailPrice && !isNaN(parseFloat(retailPrice)) && parseFloat(retailPrice) > 0 && (
                <div className="mt-2 text-xs font-medium text-ofit-text-soft">
                  Precio de Lista Sugerido (Tarjeta): ${(parseFloat(retailPrice) * (1 + (parseFloat(listMarkup) || 0) / 100)).toFixed(2)}
                </div>
              )}
            </div>

            {/* Mayorista */}
            <div>
              <label className="block text-sm font-bold text-purple-800 mb-2">Venta Mayorista</label>
              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-xs font-medium text-ofit-text-soft mb-1">Margen</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft">
                      <Percent size={14} />
                    </span>
                    <input
                      type="number" step="0.1" placeholder="0.0"
                      value={wholesaleMargin} onChange={(e) => handleWholesaleMarginChange(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ofit-text-soft mb-1">Precio Final</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ofit-text-soft">
                      <DollarSign size={14} />
                    </span>
                    <input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      value={wholesalePrice} onChange={(e) => handleWholesalePriceChange(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-bold text-purple-700 bg-purple-50/30"
                    />
                  </div>
                </div>
              </div>
              {wholesalePrice && !isNaN(parseFloat(wholesalePrice)) && parseFloat(wholesalePrice) > 0 && (
                <div className="mt-2 text-xs font-medium text-ofit-text-soft">
                  Precio de Lista Sugerido (Tarjeta): ${(parseFloat(wholesalePrice) * (1 + (parseFloat(listMarkup) || 0) / 100)).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className={`w-full h-12 font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                editingId 
                  ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              }`}
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isSubmitting 
                ? (editingId ? 'Guardando...' : 'Agregando...') 
                : (editingId ? 'Guardar Cambios' : 'Agregar Producto')
              }
            </button>
            
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSubmitting}
                className="w-full h-12 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-ofit-text font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
      )}

      {/* Lista */}
      <div className="flex flex-col gap-4 pb-4">
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={32} className="animate-spin text-ofit-pink" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm border-dashed">
            <Package className="mx-auto text-gray-300 mb-2" size={40} />
            <p className="text-ofit-text-soft">No hay productos registrados.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((product) => (
              <div 
                key={product.id} 
                className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-3 relative transition-all ${
                  editingId === product.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col pr-16">
                    <span className="text-[10px] font-mono text-ofit-text-soft uppercase tracking-wider">{product.sku}</span>
                    <h3 className="font-semibold text-ofit-text text-base leading-tight mb-1">{product.name}</h3>
                  </div>
                  
                  <div className="absolute top-3 right-3 flex gap-1">
                    <button 
                      onClick={() => handleEdit(product)}
                      className="text-ofit-text-soft hover:text-amber-500 active:text-amber-600 transition-colors p-1.5 rounded-lg hover:bg-amber-50"
                    >
                      <Pencil size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className="text-ofit-text-soft hover:text-red-500 active:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100/50 text-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-ofit-text-soft font-semibold mb-0.5">Costo</span>
                    <span className="font-medium text-ofit-text">
                      {product.cost_price !== null ? `$${(product.cost_price / 100).toLocaleString('es-AR')}` : '-'}
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-r border-gray-200">
                    <span className="text-[10px] uppercase text-ofit-text-soft font-semibold mb-0.5">Unidad</span>
                    <span className="font-bold text-ofit-pink">
                      {product.retail_price !== null ? `$${(product.retail_price / 100).toLocaleString('es-AR')}` : '-'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-ofit-text-soft font-semibold mb-0.5">Mayorista</span>
                    <span className="font-bold text-purple-600">
                      {product.wholesale_price !== null ? `$${(product.wholesale_price / 100).toLocaleString('es-AR')}` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
