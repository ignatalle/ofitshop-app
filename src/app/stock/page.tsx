'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Package, RefreshCw } from 'lucide-react';

type StockRow = {id:string;product_name:string;size:string|null;color:string|null;quantity:number;unit_price:number;unit_cost:number;status:'DISPONIBLE'|'VENDIDO';sold_order_id:string|null;created_at:string;return_id:string};
const money = (cents:number) => '$'+(cents/100).toLocaleString('es-AR');

export default function StockDevolucionesPage(){
  const [rows,setRows]=useState<StockRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [tab,setTab]=useState<'DISPONIBLE'|'VENDIDO'>('DISPONIBLE');
  const load=async()=>{
    setLoading(true);setError('');
    const {data,error}=await supabase.from('returned_stock').select('*').order('created_at',{ascending:false});
    if(error)setError(error.message);
    else setRows((data||[]) as StockRow[]);
    setLoading(false);
  };
  useEffect(()=>{void load();},[]);
  const filtered=rows.filter(x=>x.status===tab);
  return <main className="max-w-lg mx-auto p-4 space-y-5 pb-24">
    <div className="flex justify-between items-center">
      <div><h1 className="text-2xl font-bold">Stock disponible</h1>
        <p className="text-sm text-gray-500">Prendas recuperadas de devoluciones</p></div>
      <button type="button" aria-label="Actualizar stock" onClick={load} className="p-3 rounded-xl bg-gray-100"><RefreshCw size={20}/></button>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <button className={'rounded-xl p-3 text-sm font-bold '+(tab==='DISPONIBLE'?'bg-pink-100 text-pink-800':'bg-gray-100')} onClick={()=>setTab('DISPONIBLE')}>Disponible ({rows.filter(x=>x.status==='DISPONIBLE').reduce((a,r)=>a+r.quantity,0)})</button>
      <button className={'rounded-xl p-3 text-sm font-bold '+(tab==='VENDIDO'?'bg-pink-100 text-pink-800':'bg-gray-100')} onClick={()=>setTab('VENDIDO')}>Vendido ({rows.filter(x=>x.status==='VENDIDO').length})</button>
    </div>
    {error&&<p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">No se pudo cargar stock: {error}. Verificá que la migración esté aplicada.</p>}
    {loading?<p>Cargando stock...</p>:filtered.length===0?<div className="text-center rounded-xl bg-gray-50 p-10 text-gray-500"><Package size={28} className="mx-auto mb-2"/>No hay prendas en esta vista.</div>:filtered.map(row=><div key={row.id} className="card p-4 space-y-2">
      <div className="flex justify-between gap-3">
        <div><h2 className="font-bold">{row.product_name}</h2><p className="text-sm text-gray-500">{[row.size&&'Talle '+row.size,row.color].filter(Boolean).join(' · ') || 'Sin variante'}</p></div>
        <span className="font-bold">{money(row.unit_price)}</span>
      </div>
      <p className="text-sm text-gray-600">Cantidad: {row.quantity} · Costo original: {money(row.unit_cost)}</p>
      {row.status==='VENDIDO'&&row.sold_order_id&&<Link className="text-sm text-pink-700 underline" href={'/pedidos/'+row.sold_order_id}>Ver pedido de reventa</Link>}
      {row.status==='DISPONIBLE'&&<p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg">Para revender, creá el nuevo pedido con la misma prenda. La vinculación automática y descuento de stock todavía no están habilitados; no marques esta unidad como vendida manualmente.</p>}
    </div>)}
  </main>;
}
