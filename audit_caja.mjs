import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjhltclbnsxgjdmvehxk.supabase.co';
const supabaseAnonKey = 'sb_publishable_0P8rNNiGPkLUTHm6eYjxlQ_e8kS4VRy';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runCajaAudit() {
  const { data: transactions } = await supabase.from('transactions').select('*');
  
  if (!transactions) {
    console.error("No transactions found.");
    return;
  }

  // Lógica calc (directamente de finance.ts)
  let efectivoCalc = 0;
  let virtualCalc = 0;

  for (const tx of transactions) {
    if (tx.cuenta === 'EFECTIVO') {
      efectivoCalc += (tx.type === 'INGRESO' ? tx.amount : -tx.amount);
    } else if (tx.cuenta === 'VIRTUAL') {
      virtualCalc += (tx.type === 'INGRESO' ? tx.amount : -tx.amount);
    }
  }

  const totalCalc = efectivoCalc + virtualCalc;

  const realEfectivo = 7500000;
  const realVirtual = 5164171;
  const realTotal = 12664171;

  console.log("---- SALDOS CALCULADOS VS REALES ----");
  console.log(`EFECTIVO : Sistema $${efectivoCalc/100} | Real $${realEfectivo/100} | Dif $${(realEfectivo - efectivoCalc)/100}`);
  console.log(`VIRTUAL  : Sistema $${virtualCalc/100} | Real $${realVirtual/100} | Dif $${(realVirtual - virtualCalc)/100}`);
  console.log(`TOTAL    : Sistema $${totalCalc/100} | Real $${realTotal/100} | Dif $${(realTotal - totalCalc)/100}`);

  console.log("\n---- DESGLOSE DE TRANSACCIONES ----");
  transactions.forEach(t => {
    console.log(`[${t.created_at}] ${t.type} | ${t.cuenta} | $${t.amount/100} | ${t.description}`);
  });
}

runCajaAudit();
