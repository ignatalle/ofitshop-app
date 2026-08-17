import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findMatch() {
  const { data: transactions } = await supabase.from('transactions').select('*');
  const target = 149858200; // 1.498.582 en centavos
  const ventasTarget = 130340738; // 1.303.407,38
  
  // Imprimir sumas varias
  const egresos = transactions.filter(t => t.type === 'EGRESO').map(t => t.amount);
  const sumEgresos = egresos.reduce((a, b) => a + b, 0);
  console.log(`Suma todos egresos históricos: ${sumEgresos}`);
  
  // Podria el CMV ser diferente? 
  // Qué pasa si Ventas - Costos = -195.174,62 ?
  // Costos = Ventas - GananciaNeta = 1303407.38 - (-195174.62) = 1.498.582!
  console.log('Sí, la matemática del user Ventas - (Costos+Gastos) = Ganancia Neta es perfecta.');
  
  // Vamos a imprimir TODOS los egresos históricos, para ver si suman algo cercano
  console.log('TODOS LOS EGRESOS:');
  transactions.filter(t => t.type === 'EGRESO').forEach(t => {
    console.log(`[${t.created_at}] $${t.amount/100} | ${t.description}`);
  });
}

findMatch();
