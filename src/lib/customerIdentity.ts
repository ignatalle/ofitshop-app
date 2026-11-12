import { supabase } from './supabase';

// Customer identity is the normalized WhatsApp number, not the display name.
// Argentina: +54 9 3884..., 54 3884..., 03884... and 3884... share one identity.
export function normalizeCustomerPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('54')) {
    digits = digits.slice(2);
    if (digits.startsWith('9') && digits.length === 11) digits = digits.slice(1);
  }
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  // Argentina's domestic 15 mobile prefix may appear after an area code.
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === '15') {
        const candidate = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        if (candidate.length === 10) return candidate;
      }
    }
  }
  return digits;
}

export async function findCustomerWithPhone(phone: string, exceptId?: string | null) {
  const key = normalizeCustomerPhone(phone);
  if (key.length < 8) throw new Error('Ingresá un WhatsApp válido con código de área.');
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('customers')
      .select('id,name,phone')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error; // Fail closed: do not create when validation cannot run.
    const existing = (data || []).find(row =>
      row.id !== exceptId &&
      row.phone &&
      normalizeCustomerPhone(row.phone) === key
    );
    if (existing) return existing;
    if (!data || data.length < pageSize) return null;
  }
}

export function duplicateCustomerMessage(name: string) {
  return `Este WhatsApp ya pertenece a la ficha de ${name}. Abrí esa ficha para agregar el pedido; no crees otra clienta.`;
}
