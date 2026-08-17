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

  const orders = ordersData || [];
  const products = productsData || [];
  const transactions = txData || [];

  const now = getArgentinaDate(new Date().toISOString());
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return (
    <div className="flex-1 max-w-lg mx-auto w-full relative">
      <CostosPendientesClient 
        initialOrders={orders} 
        products={products}
        transactions={transactions}
        currentMonth={currentMonth}
        currentYear={currentYear}
      />
    </div>
  );
}
