'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Search, Plus, Loader2, Image as ImageIcon, Eye, EyeOff, MoreHorizontal, Share2 } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  sku: string;
  name: string;
  cost_price: number | null;
  retail_price: number | null;
  wholesale_price: number | null;
  retail_list_price: number | null;
  wholesale_list_price: number | null;
  stock_quantity: number;
  is_visible: boolean;
  show_price: boolean;
  image_url: string | null;
  created_at: string;
}

type FilterTab = 'TODOS' | 'VISIBLES' | 'OCULTOS' | 'SIN_COSTO';

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('TODOS');

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

  const handleShare = async (product: Product) => {
    let text = `✨ ${product.name}\n`;
    
    if (product.show_price !== false) {
      const priceNum = product.retail_price ? product.retail_price / 100 : 0;
      text += `$ ${priceNum.toLocaleString('es-AR')}\nDisponible en Outfit Shop 💕`;
    } else {
      text += `Consultanos por precio 💕\nOutfit Shop`;
    }

    if (product.image_url) {
      text += `\n\n${product.image_url}`;
    }

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Texto copiado al portapapeles');
      }
    } catch (error) {
      console.log('Error al compartir', error);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (activeFilter === 'VISIBLES') matchesFilter = p.is_visible === true;
    if (activeFilter === 'OCULTOS') matchesFilter = p.is_visible === false || p.is_visible === null; // Históricos default a false
    if (activeFilter === 'SIN_COSTO') matchesFilter = !p.cost_price || p.cost_price === 0;

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-ofit-text-soft">
        <Loader2 size={32} className="animate-spin mb-4 text-ofit-pink" />
        <p className="font-medium animate-pulse">Cargando Mi Catálogo...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto animate-fade-in p-4 sm:p-0 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-ofit-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ofit-pink/5 rounded-bl-full -z-10" />
        <div>
          <h1 className="text-2xl font-black text-ofit-text flex items-center gap-2">
            <Package size={28} className="text-ofit-pink" />
            Mi Catálogo
          </h1>
          <p className="text-ofit-text-soft mt-1">Tus prendas listas para vender.</p>
        </div>
        <Link 
          href="/productos/nuevo"
          className="w-full sm:w-auto bg-ofit-pink hover:bg-ofit-pink-hover text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Agregar producto
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative mt-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ofit-text-soft" size={20} />
        <input 
          type="text" 
          placeholder="Buscar prenda..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-ofit-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-ofit-text"
        />
      </div>

      {/* Chips de Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {(['TODOS', 'VISIBLES', 'OCULTOS', 'SIN_COSTO'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all border ${
              activeFilter === tab 
                ? 'bg-ofit-pink text-white border-ofit-pink' 
                : 'bg-white text-ofit-text-soft border-ofit-border hover:border-ofit-pink/50'
            }`}
          >
            {tab === 'TODOS' && 'Todos'}
            {tab === 'VISIBLES' && 'Visibles'}
            {tab === 'OCULTOS' && 'Ocultos'}
            {tab === 'SIN_COSTO' && 'Sin Costo'}
          </button>
        ))}
      </div>

      {/* Lista de Productos (Cards) */}
      <div className="flex flex-col gap-4 mt-2">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-ofit-border shadow-sm">
            <p className="text-ofit-text-soft font-medium">No se encontraron prendas.</p>
          </div>
        ) : (
          filteredProducts.map(product => {
            const cost = product.cost_price ? product.cost_price / 100 : 0;
            const retail = product.retail_price ? product.retail_price / 100 : 0;
            const stock = product.stock_quantity || 0;
            const isVisible = product.is_visible;

            return (
              <div key={product.id} className="bg-white p-4 rounded-2xl border border-ofit-border shadow-sm flex flex-col sm:flex-row gap-4 relative group">
                {/* Image Placeholder */}
                <div className="w-full sm:w-28 h-40 sm:h-28 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-gray-300" size={32} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-ofit-text text-lg leading-tight">{product.name}</h3>
                      <button 
                        onClick={() => handleShare(product)}
                        className="text-gray-400 hover:text-ofit-pink p-2 -m-1 transition-colors rounded-full hover:bg-pink-50"
                        title="Compartir"
                      >
                        <Share2 size={20} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-ofit-pink bg-ofit-pink/10 px-2 py-0.5 rounded-md">
                        ${retail.toLocaleString('es-AR')}
                      </span>
                      {cost > 0 ? (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md line-through decoration-gray-400">
                          C: ${cost.toLocaleString('es-AR')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Sin costo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1.5">
                      {isVisible ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                          <Eye size={12} />
                          Visible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                          <EyeOff size={12} />
                          Oculto
                        </span>
                      )}
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${stock > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {stock} disp.
                      </span>
                    </div>

                    <Link 
                      href={`/productos/${product.id}`}
                      className="text-sm font-bold text-ofit-pink hover:text-ofit-pink-hover"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
