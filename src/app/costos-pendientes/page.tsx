import { supabase } from '@/lib/supabase';
import CostosPendientesClient from './client';
import { getArgentinaDate } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export default async function CostosPendientesPage() {
  const { data: ordersData } = await supabase
    .from('orders')
    .select('*, customers(name)')
    .order('created_at', { ascending: false });

  const { data: productsData } = await supabase
    .from('products')
    .select('*');

  const { data: txData } = await supabase
    .from('transactions')
    .select('*');

  const { data: purchaseStatesData } = await supabase
    .from('pending_purchases')
    .select('order_id, item_id, status');

  const orders = ordersData || [];
  const products = productsData || [];
  const transactions = txData || [];
  const purchaseStates = purchaseStatesData || [];

  const now = getArgentinaDate(new Date().toISOString());
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return (
    <div className="costos-mobile-page flex-1 max-w-lg mx-auto w-full relative min-w-0 overflow-x-hidden">
      <CostosPendientesClient 
        initialOrders={orders} 
        products={products}
        transactions={transactions}
        purchaseStates={purchaseStates}
        currentMonth={currentMonth}
        currentYear={currentYear}
      />
    </div>
  );
}
