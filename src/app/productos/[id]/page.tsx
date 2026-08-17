'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Loader2, Image as ImageIcon, ChevronDown, Eye, EyeOff, DollarSign, Share2 } from 'lucide-react';
import Link from 'next/link';

export default function EditarProductoPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [isVisible, setIsVisible] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  
  // More options
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProduct() {
      try {
        setInitialLoading(true);
        const { data: product, error } = await supabase
          .from('products')
          .select(`*, suppliers(name)`)
          .eq('id', productId)
          .single();

        if (error) throw error;
        if (product) {
          setName(product.name || '');
          setRetailPrice(product.retail_price ? (product.retail_price / 100).toString() : '');
          setCostPrice(product.cost_price ? (product.cost_price / 100).toString() : '');
          setWholesalePrice(product.wholesale_price ? (product.wholesale_price / 100).toString() : '');
          setStock((product.stock_quantity || 0).toString());
          setIsVisible(!!product.is_visible);
          setShowPrice(product.show_price ?? true);
          setImageUrl(product.image_url || '');
          setSize(product.size || '');
          setColor(product.color || '');
          setNotes(product.notes || '');
          if (product.suppliers && (product.suppliers as any).name) {
            setSupplierName((product.suppliers as any).name);
          }
        }
      } catch (error: any) {
        alert('Error al cargar el producto: ' + error.message);
        router.push('/productos');
      } finally {
        setInitialLoading(false);
      }
    }
    
    if (productId) loadProduct();
  }, [productId, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede pesar más de 5MB.');
      return;
    }

    try {
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrlData.publicUrl);
    } catch (error: any) {
      alert('Error al subir la imagen: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const parseCurrency = (val: string) => {
    if (!val) return null;
    const num = parseFloat(val.replace(/[^0-9.-]+/g, ''));
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  const getOrCreateSupplier = async (sName: string) => {
    if (!sName.trim()) return null;
    const cleanName = sName.trim();
    
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .ilike('name', cleanName)
      .limit(1);
      
    if (existing && existing.length > 0) {
      return existing[0].id;
    }
    
    const { data: inserted, error } = await supabase
      .from('suppliers')
      .insert([{ name: cleanName }])
      .select('id')
      .single();
      
    if (error) {
      console.error('Error creando proveedor', error);
      return null;
    }
    return inserted?.id || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('El nombre es obligatorio.');
    if (!retailPrice) return alert('El precio de venta es obligatorio.');

    try {
      setLoading(true);

      const supplierId = await getOrCreateSupplier(supplierName);
      
      const updateData = {
        name: name.trim(),
        retail_price: parseCurrency(retailPrice),
        cost_price: costPrice ? parseCurrency(costPrice) : null,
        wholesale_price: wholesalePrice ? parseCurrency(wholesalePrice) : null,
        stock_quantity: parseInt(stock) || 0,
        is_visible: isVisible,
        show_price: showPrice,
        image_url: imageUrl || null,
        size: size.trim() || null,
        color: color.trim() || null,
        notes: notes.trim() || null,
        supplier_id: supplierId,
      };

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;

      router.push('/productos');
    } catch (error: any) {
      alert('Error al actualizar el producto: ' + error.message);
      setLoading(false);
    }
  };

  const handleShare = async () => {
    let text = `✨ ${name}\n`;
    
    if (showPrice) {
      const priceNum = parseFloat(retailPrice || '0');
      text += `$ ${priceNum.toLocaleString('es-AR')}\nDisponible en Outfit Shop 💕`;
    } else {
      text += `Consultanos por precio 💕\nOutfit Shop`;
    }

    if (imageUrl) {
      text += `\n\n${imageUrl}`;
    }

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Texto copiado al portapapeles');
      }
    } catch (error) {
      console.log('Error sharing', error);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-ofit-text-soft">
        <Loader2 size={32} className="animate-spin mb-4 text-ofit-pink" />
        <p className="font-medium animate-pulse">Cargando prenda...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-gray-50 min-h-screen pb-24">
      {/* Header Fijo */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between shadow-sm">
        <Link href="/productos" className="p-2 -ml-2 text-gray-600 hover:text-ofit-pink transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-lg font-black text-ofit-text">Editar Producto</h1>
        <button onClick={handleShare} className="p-2 -mr-2 text-ofit-pink hover:bg-pink-50 rounded-full transition-colors" title="Compartir">
          <Share2 size={22} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-6 animate-fade-in">
        
        {/* Foto */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-700">Foto</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-48 bg-white border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 hover:border-ofit-pink transition-all overflow-hidden relative group"
          >
            {imageUrl ? (
              <>
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-bold text-sm flex items-center gap-2">
                    <Camera size={18} /> Cambiar Foto
                  </span>
                </div>
              </>
            ) : uploadingImage ? (
              <div className="flex flex-col items-center gap-2 text-ofit-pink">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm font-medium">Subiendo...</span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center text-ofit-pink mb-1">
                  <ImageIcon size={24} />
                </div>
                <span className="text-sm font-bold text-gray-600">Tocar para agregar foto</span>
                <span className="text-xs text-gray-400 font-medium">JPG, PNG o WebP (Max 5MB)</span>
              </>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/jpeg, image/png, image/webp" 
            className="hidden" 
          />
        </div>

        {/* Nombre */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-700">Nombre de la prenda *</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Conjunto deportivo importado"
            required
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-medium text-ofit-text text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Precio Venta */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">Precio Venta *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input 
                type="number"
                value={retailPrice}
                onChange={e => setRetailPrice(e.target.value)}
                placeholder="0"
                required
                className="w-full bg-white border border-gray-300 rounded-xl pl-8 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-black text-ofit-text text-base"
              />
            </div>
          </div>

          {/* Costo */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700 flex items-center justify-between">
              Costo <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Opcional</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input 
                type="number"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="0"
                className="w-full bg-white border border-gray-300 rounded-xl pl-8 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-bold text-ofit-text text-base"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer" onClick={() => setShowPrice(!showPrice)}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${showPrice ? 'bg-ofit-pink/10 text-ofit-pink' : 'bg-gray-100 text-gray-500'}`}>
                <DollarSign size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-800">Mostrar Precio</p>
                <p className="text-xs text-gray-500">{showPrice ? 'El precio es visible al compartir' : 'Consultar por precio'}</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${showPrice ? 'bg-ofit-pink' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showPrice ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
        </div>

        {/* Stock y Visible */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">¿Cuántas tenés? (Stock)</label>
            <input 
              type="number"
              value={stock}
              onChange={e => setStock(e.target.value)}
              min="0"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-bold text-ofit-text text-base text-center"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">Estado</label>
            <div 
              onClick={() => setIsVisible(!isVisible)}
              className={`w-full flex items-center justify-center gap-2 cursor-pointer border rounded-xl px-4 py-3.5 font-bold transition-all select-none ${
                isVisible ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'
              }`}
            >
              {isVisible ? (
                <><span className="text-green-600 font-black text-xl leading-none">●</span> Visible</>
              ) : (
                <><span className="text-gray-400 font-black text-xl leading-none">●</span> Oculto</>
              )}
            </div>
          </div>
        </div>

        {/* Más Opciones (Acordeón) */}
        <div className="mt-2 border-t border-gray-200 pt-4">
          <button 
            type="button" 
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="w-full flex items-center justify-between text-gray-600 font-bold p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <span>Más opciones (Mayorista, Talles, Proveedor...)</span>
            <ChevronDown size={20} className={`transition-transform duration-300 ${showMoreOptions ? 'rotate-180' : ''}`} />
          </button>

          {showMoreOptions && (
            <div className="flex flex-col gap-4 mt-4 animate-fade-in bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Precio Mayorista</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input 
                    type="number"
                    value={wholesalePrice}
                    onChange={e => setWholesalePrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-bold text-gray-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Talle</label>
                  <input 
                    type="text"
                    value={size}
                    onChange={e => setSize(e.target.value)}
                    placeholder="Ej: S, M, Único"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-gray-700"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Color</label>
                  <input 
                    type="text"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    placeholder="Ej: Negro"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-gray-700"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Proveedor</label>
                <input 
                  type="text"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="Ej: Mandarina (Texto libre)"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-gray-700"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Notas privadas</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Detalles de tela, ubicación en depósito..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-gray-700 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sticky Botón Guardar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10 flex justify-center">
          <div className="w-full max-w-lg">
            <button 
              type="submit" 
              disabled={loading || uploadingImage}
              className="w-full bg-ofit-pink hover:bg-ofit-pink-hover text-white py-4 rounded-xl font-black text-lg transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={24} /> Actualizando...</>
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
