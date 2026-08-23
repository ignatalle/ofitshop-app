import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("=== AUDITORIA FASE 4 ===");
  
  // 1. Orders items structure
  console.log("\n1. Structure of orders.items:");
  const { data: orders, error: oError } = await supabase.from('orders').select('items, details').limit(5).not('items', 'is', null);
  if (oError) console.error(oError);
  else {
    orders.forEach((o, i) => {
      console.log(`Order ${i+1} items:`, JSON.stringify(o.items, null, 2));
    });
  }

  // 2. Products modality
  console.log("\n2. Values in products.modality:");
  const { data: products, error: pError } = await supabase.from('products').select('*').limit(1);
  if (pError) console.error(pError);
  else {
    if (products.length > 0) {
      console.log("Product schema fields:", Object.keys(products[0]));
      // check if modality exists
      if ('modality' in products[0]) {
        const { data: modData } = await supabase.from('products').select('modality').not('modality', 'is', null).limit(10);
        console.log("Sample modalities:", modData);
      } else {
        console.log("modality field DOES NOT exist in products.");
      }
    }
  }

  // 3. Suppliers structure
  console.log("\n3. Structure of suppliers:");
  const { data: suppliers, error: sError } = await supabase.from('suppliers').select('*').limit(2);
  if (sError) console.error(sError);
  else {
    console.log(suppliers);
  }

  // 4. Existing purchase-related tables?
  console.log("\n4. Checking for pending purchases tables:");
  // try to select from a hypothetical table
  const { error: tError } = await supabase.from('pending_purchases').select('id').limit(1);
  if (tError) console.log("pending_purchases table error:", tError.message);
  else console.log("pending_purchases table EXISTS.");
  
  const { error: p2Error } = await supabase.from('purchases').select('id').limit(1);
  if (p2Error) console.log("purchases table error:", p2Error.message);
  else console.log("purchases table EXISTS.");
}

runAudit();
