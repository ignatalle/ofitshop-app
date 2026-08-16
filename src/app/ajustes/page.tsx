'use client';

import { useState, useEffect, Suspense } from 'react';
import { Save, Loader2 } from 'lucide-react';

function AjustesContent() {
  const [alias, setAlias] = useState('');
  const [titular, setTitular] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Cargar datos guardados si existen
    const savedAlias = localStorage.getItem('ofitshop_alias');
    const savedTitular = localStorage.getItem('ofitshop_titular');
    if (savedAlias) setAlias(savedAlias);
    if (savedTitular) setTitular(savedTitular);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ofitshop_alias', alias.trim());
    localStorage.setItem('ofitshop_titular', titular.trim());
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg mx-auto w-full animate-in fade-in duration-300">
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-ofit-text mb-1">
          Ajustes
        </h1>
        <p className="text-sm text-ofit-text-soft font-medium">
          Configurá los datos de tu negocio
        </p>
      </div>

      <div className="card p-6 border-none shadow-sm flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-ofit-text mb-4 border-b border-gray-100 pb-2">
            Datos de Cobro
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Estos datos se van a agregar automáticamente al final de los mensajes de WhatsApp cuando le mandes el saldo a tus clientas.
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-ofit-text mb-1.5" htmlFor="alias">
                Alias de MercadoPago / CBU
              </label>
              <input
                id="alias"
                type="text"
                spellCheck={false}
                placeholder="Ej: CAMILA.OUTFIT"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="input-field focus:ring-ofit-pink focus:border-ofit-pink font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-ofit-text mb-1.5" htmlFor="titular">
                Nombre del Titular
              </label>
              <input
                id="titular"
                type="text"
                spellCheck={false}
                placeholder="Ej: Camila Silva"
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                className="input-field focus:ring-ofit-pink focus:border-ofit-pink"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Guardar Datos
              </button>
            </div>
            
            {isSaved && (
              <div className="text-center text-sm font-bold text-emerald-600 bg-emerald-50 py-2 rounded-xl border border-emerald-100">
                ¡Datos guardados correctamente!
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <Loader2 size={32} className="animate-spin text-ofit-pink" />
      </div>
    }>
      <AjustesContent />
    </Suspense>
  );
}
