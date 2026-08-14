'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Search, Loader2 } from 'lucide-react';

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

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-ofit-text-soft">
        <Loader2 size={32} className="animate-spin mb-4 text-ofit-pink" />
        <p className="font-medium animate-pulse">Cargando catálogo histórico...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-12 animate-fade-in p-4 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-ofit-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ofit-pink/5 rounded-bl-full -z-10" />
        <div>
          <h1 className="text-2xl font-black text-ofit-text flex items-center gap-2">
            <Package size={28} className="text-ofit-pink" />
            Catálogo Histórico
          </h1>
          <p className="text-ofit-text-soft mt-1">Consulta de costos y márgenes de tu base de datos antigua.</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ofit-text-soft" size={20} />
        <input 
          type="text" 
          placeholder="Buscar prenda por nombre o SKU..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-ofit-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-ofit-text"
        />
      </div>

      {/* Lista de Productos */}
      <div className="flex flex-col gap-4">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-ofit-border shadow-sm">
            <p className="text-ofit-text-soft font-medium">No se encontraron productos.</p>
          </div>
        ) : (
          filteredProducts.map(product => {
            const cost = product.cost_price ? product.cost_price / 100 : 0;
            const retail = product.retail_price ? product.retail_price / 100 : 0;
            const wholesale = product.wholesale_price ? product.wholesale_price / 100 : 0;
            
            const retailMargin = cost > 0 && retail > 0 ? (((retail - cost) / cost) * 100).toFixed(1) : '-';
            const wholesaleMargin = cost > 0 && wholesale > 0 ? (((wholesale - cost) / cost) * 100).toFixed(1) : '-';

            return (
              <div key={product.id} className="bg-white p-5 rounded-2xl border border-ofit-border shadow-sm flex flex-col md:flex-row gap-4 md:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">
                      {product.sku}
                    </span>
                  </div>
                  <h3 className="font-bold text-ofit-text text-lg leading-tight mb-2">{product.name}</h3>
                  <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100">
                    <span className="text-xs font-bold uppercase tracking-wider">Costo Fabrica:</span>
                    <span className="font-black">${cost.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                <div className="flex gap-4 sm:gap-8 flex-wrap mt-2 md:mt-0 bg-gray-50 p-4 rounded-xl border border-gray-100 md:bg-transparent md:p-0 md:border-none">
                  {/* Mayorista */}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ofit-text-soft uppercase tracking-wider mb-1">Mayorista</span>
                    <span className="font-bold text-ofit-text text-lg">${wholesale.toLocaleString('es-AR')}</span>
                    <span className="text-xs font-bold text-green-600">+{wholesaleMargin}% Margen</span>
                  </div>

                  {/* Minorista */}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ofit-text-soft uppercase tracking-wider mb-1">Minorista</span>
                    <span className="font-bold text-ofit-text text-lg">${retail.toLocaleString('es-AR')}</span>
                    <span className="text-xs font-bold text-green-600">+{retailMargin}% Margen</span>
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
