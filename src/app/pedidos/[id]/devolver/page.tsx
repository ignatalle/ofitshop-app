'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PackageCheck, ArrowLeft } from 'lucide-react';

type Order = {id:string;customer_id:string;items:any[];total_amount:number;advance_payment:number;status:string};
const money = (n:number) => '$' + (n/100).toLocaleString('es-AR');

export default function DevolverPedidoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order|null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState<'STOCK'|'NO_APTO'>('STOCK');

  useEffect(() => {
    let active = true;
    supabase.from('orders').select('id,customer_id,items,total_amount,advance_payment,status').eq('id', id).single()
      .then(({data,error}) => { if (!active) return; if(error) setError(error.message); else setOrder(data as Order); });
    return () => { active=false; };
  }, [id]);

  const submit = async () => {
    if (!order || selected === '' || reason.trim().length < 3) {
      setError('Seleccioná una prenda y explicá el motivo (mínimo 3 caracteres).');
      return;
    }
    const item = order.items[Number(selected)];
    const amount = (Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 1);
    const overpayment = Math.max(0, order.advance_payment - (order.total_amount - amount));
    const warning = overpayment > 0
      ? '\nAtención: quedará ' + money(overpayment) + ' a resolver con la clienta. Esto NO devuelve dinero de Caja.'
      : '';
    if (!window.confirm('¿Registrar la devolución de ' + (item.productName || item.description || 'esta prenda') + '?' + warning)) return;
    setBusy(true);setError('');
    const { error: rpcError } = await supabase.rpc('register_order_return', {
      p_order_id: order.id,
      p_item_index: Number(selected),
      p_reason: reason.trim(),
      p_disposition: disposition,
    });
    setBusy(false);
    if (rpcError) {setError(rpcError.message);return;}
    router.push('/pedidos/' + order.id);
    router.refresh();
  };

  return <main className="p-4 max-w-lg mx-auto space-y-5 pb-24">
    <Link href={'/pedidos/'+id} className="inline-flex gap-2 text-sm font-semibold items-center"><ArrowLeft size={18}/> Volver al pedido</Link>
    <h1 className="text-2xl font-bold">Registrar devolución</h1>
    <p className="text-sm text-gray-600">Se devuelve el renglón completo. El pedido y la deuda se actualizan juntos; los pagos existentes se conservan.</p>
    {error && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}
    {order && <>
      {['CANCELADO','ANULADO'].includes(order.status) ? <p>Este pedido ya fue anulado.</p> : <>
        <label className="block text-sm font-bold">Prenda a devolver</label>
        <select className="w-full border rounded-xl p-3 bg-white" value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">Elegí la prenda</option>
          {(Array.isArray(order.items) ? order.items : []).map((item,i)=><option key={i} value={i}>
            {item.quantity || 1}x {item.productName || item.description || 'Prenda'} — {money((Number(item.unitPrice)||0)*(Number(item.quantity)||1))}
          </option>)}
        </select>
        <label className="block text-sm font-bold">Motivo</label>
        <textarea className="w-full border rounded-xl p-3" rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ej.: la clienta no quiso retirar la prenda" maxLength={500}/>
        <label className="block text-sm font-bold">¿Qué pasó con la prenda?</label>
        <select className="w-full border rounded-xl p-3 bg-white" value={disposition} onChange={e=>setDisposition(e.target.value as 'STOCK'|'NO_APTO')}>
          <option value="STOCK">Está en buen estado y la tengo: agregar a stock</option>
          <option value="NO_APTO">No está disponible para revender</option>
        </select>
        {selected !== '' && (() => {
          const item = order.items[Number(selected)];
          const amount = (Number(item?.unitPrice)||0)*(Number(item?.quantity)||1);
          const newTotal=order.total_amount-amount;
          const credit=Math.max(0,order.advance_payment-newTotal);
          return <div className="p-4 rounded-xl bg-amber-50 space-y-1 text-sm">
            <p>Deuda posterior: <strong>{money(Math.max(0,newTotal-order.advance_payment))}</strong></p>
            {credit>0&&<p className="text-amber-800 font-semibold">Saldo a resolver con la clienta: {money(credit)}. No se genera reintegro automático.</p>}
          </div>;
        })()}
        <button disabled={busy || selected===''} onClick={submit} className="btn-primary w-full min-h-12 flex items-center justify-center gap-2 disabled:opacity-50">
          <PackageCheck size={19}/>{busy?'Registrando...':'Confirmar devolución'}
        </button>
      </>}
    </>}
  </main>;
}
