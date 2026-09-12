'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Camera, Loader2, Image as ImageIcon, ChevronDown, AlertCircle, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function NuevoProductoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const [name, setName] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [isVisible, setIsVisible] = useState(false);
  const [showPrice, setShowPrice] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');

  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (name.length > 2) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(async () => {
        const { data } = await supabase
          .from('products')
          .select('id, name')
          .ilike('name', `%${name}%`)
          .limit(1);

        if (data && data.length > 0) setDuplicateWarning(data[0]);
        else setDuplicateWarning(null);
      }, 500);
    } else {
      setDuplicateWarning(null);
    }
  }, [name]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert('La imagen no puede pesar más de 5MB.');

    try {
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
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
    const { data: existing } = await supabase.from('suppliers').select('id').ilike('name', cleanName).limit(1);
    if (existing && existing.length > 0) return existing[0].id;

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
      const newProduct = {
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
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        status: 'ACTIVO',
        modality: 'STOCK_PROPIO'
      };

      const { error } = await supabase.from('products').insert([newProduct]);
      if (error) throw error;
      router.push('/productos');
    } catch (error: any) {
      alert('Error al guardar el producto: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-gray-50 min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between shadow-sm">
        <Link href="/productos" className="p-2 -ml-2 text-gray-600 hover:text-ofit-pink transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-base sm:text-lg font-black text-ofit-text">Nuevo Producto</h1>
        <div className="w-8" />
      </div>

      <form onSubmit={handleSubmit} className="p-3 sm:p-4 flex flex-col gap-5 sm:gap-6 animate-fade-in min-w-0">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-700">Foto</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-44 sm:h-48 bg-white border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 hover:border-ofit-pink transition-all overflow-hidden relative group"
          >
            {imageUrl ? (
              <>
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-bold text-sm flex items-center gap-2"><Camera size={18} /> Cambiar Foto</span>
                </div>
              </>
            ) : uploadingImage ? (
              <div className="flex flex-col items-center gap-2 text-ofit-pink"><Loader2 size={24} className="animate-spin" /><span className="text-sm font-medium">Subiendo...</span></div>
            ) : (
              <>
                <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center text-ofit-pink mb-1"><ImageIcon size={24} /></div>
                <span className="text-sm font-bold text-gray-600">Tocar para agregar foto</span>
                <span className="text-xs text-gray-400 font-medium">JPG, PNG o WebP (Max 5MB)</span>
              </>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg, image/png, image/webp" className="hidden" />
        </div>

        {duplicateWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center gap-2 text-amber-800 font-bold"><AlertCircle size={18} /> Ya existe un producto parecido</div>
            <p className="text-sm text-amber-700 font-medium">"{duplicateWarning.name}"</p>
            <Link href={`/productos/${duplicateWarning.id}`} className="mt-1 text-sm font-bold text-ofit-pink hover:underline">Editar existente</Link>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-700">Nombre de la prenda *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Conjunto deportivo importado" required className="w-full min-w-0 bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-medium text-ofit-text text-base" />
        </div>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <label className="text-sm font-bold text-gray-700">Precio Venta *</label>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span><input type="number" value={retailPrice} onChange={e => setRetailPrice(e.target.value)} placeholder="0" required className="w-full min-w-0 bg-white border border-gray-300 rounded-xl pl-8 pr-3 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-black text-ofit-text text-base" /></div>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <label className="text-sm font-bold text-gray-700 flex items-center justify-between gap-2">Costo <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Opcional</span></label>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span><input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0" className="w-full min-w-0 bg-white border border-gray-300 rounded-xl pl-8 pr-3 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-bold text-ofit-text text-base" /></div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-700">Proveedor</label>
          <input
            type="text"
            value={supplierName}
            onChange={e => setSupplierName(e.target.value)}
            placeholder="Ej: Mandarina"
            className="w-full min-w-0 bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-medium text-ofit-text text-base"
          />
          <p className="text-xs text-gray-400">Si no existe, se crea automáticamente al guardar.</p>
        </div>

        <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer" onClick={() => setShowPrice(!showPrice)}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${showPrice ? 'bg-ofit-pink/10 text-ofit-pink' : 'bg-gray-100 text-gray-500'}`}><DollarSign size={20} /></div>
            <div className="min-w-0"><p className="font-bold text-gray-800">Mostrar Precio</p><p className="text-xs text-gray-500 leading-snug">{showPrice ? 'El precio es visible al compartir' : 'Consultar por precio'}</p></div>
          </div>
          <div className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${showPrice ? 'bg-ofit-pink' : 'bg-gray-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showPrice ? 'translate-x-6' : 'translate-x-0'}`} /></div>
        </div>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <label className="text-sm font-bold text-gray-700">¿Cuántas tenés? (Stock)</label>
            <input type="number" value={stock} onChange={e => setStock(e.target.value)} min="0" className="w-full min-w-0 bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 focus:border-ofit-pink transition-all font-bold text-ofit-text text-base text-center" />
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <label className="text-sm font-bold text-gray-700">Estado</label>
            <div onClick={() => setIsVisible(!isVisible)} className={`w-full flex items-center justify-center gap-2 cursor-pointer border rounded-xl px-4 py-3.5 font-bold transition-all select-none ${isVisible ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
              {isVisible ? <><span className="text-green-600 font-black text-xl leading-none">●</span> Visible</> : <><span className="text-gray-400 font-black text-xl leading-none">●</span> Oculto</>}
            </div>
          </div>
        </div>

        <div className="mt-2 border-t border-gray-200 pt-4">
          <button type="button" onClick={() => setShowMoreOptions(!showMoreOptions)} className="w-full flex items-center justify-between gap-2 text-gray-600 font-bold p-2 hover:bg-gray-100 rounded-xl transition-colors text-left">
            <span className="min-w-0">Más opciones (Mayorista, Talles, Notas...)</span>
            <ChevronDown size={20} className={`shrink-0 transition-transform duration-300 ${showMoreOptions ? 'rotate-180' : ''}`} />
          </button>

          {showMoreOptions && (
            <div className="flex flex-col gap-4 mt-4 animate-fade-in bg-white p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-sm min-w-0">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Precio Mayorista</label>
                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span><input type="number" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} placeholder="0" className="w-full min-w-0 bg-gray-50 border border-gray-300 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-bold text-gray-700" /></div>
              </div>

              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex flex-col gap-2 min-w-0"><label className="text-sm font-bold text-gray-700">Talle</label><input type="text" value={size} onChange={e => setSize(e.target.value)} placeholder="Ej: S, M, Único" className="w-full min-w-0 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-gray-700" /></div>
                <div className="flex flex-col gap-2 min-w-0"><label className="text-sm font-bold text-gray-700">Color</label><input type="text" value={color} onChange={e => setColor(e.target.value)} placeholder="Ej: Negro" className="w-full min-w-0 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-gray-700" /></div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Notas privadas</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles de tela, ubicación en depósito..." rows={3} className="w-full min-w-0 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ofit-pink/20 transition-all font-medium text-gray-700 resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-3 sm:px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] bg-white border-t border-gray-200 z-30 flex justify-center">
          <div className="w-full max-w-lg">
            <button type="submit" disabled={loading || uploadingImage} className="w-full bg-ofit-pink hover:bg-ofit-pink-hover text-white py-3.5 sm:py-4 rounded-xl font-black text-base sm:text-lg transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <><Loader2 className="animate-spin" size={24} /> Guardando...</> : 'Guardar producto'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
