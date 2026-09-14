'use client';

import { useState, useEffect, Suspense } from 'react';
import { Save, Loader2, Palette, Check } from 'lucide-react';

type AppTheme = 'classic' | 'luxe';

function AjustesContent() {
  const [alias, setAlias] = useState('');
  const [titular, setTitular] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [theme, setTheme] = useState<AppTheme>('classic');

  useEffect(() => {
    const savedAlias = localStorage.getItem('ofitshop_alias');
    const savedTitular = localStorage.getItem('ofitshop_titular');
    const savedTheme = localStorage.getItem('ofitshop_theme');
    if (savedAlias) setAlias(savedAlias);
    if (savedTitular) setTitular(savedTitular);
    if (savedTheme === 'luxe') {
      setTheme('luxe');
      document.documentElement.dataset.theme = 'luxe';
    }
  }, []);

  const changeTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    localStorage.setItem('ofitshop_theme', nextTheme);
    if (nextTheme === 'luxe') {
      document.documentElement.dataset.theme = 'luxe';
      document.documentElement.style.backgroundColor = '#09090B';
    } else {
      delete document.documentElement.dataset.theme;
      document.documentElement.style.backgroundColor = '#FFF9F7';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ofitshop_alias', alias.trim());
    localStorage.setItem('ofitshop_titular', titular.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="ajustes-mobile-page p-3 min-[360px]:p-4 flex flex-col gap-5 sm:gap-6 max-w-lg mx-auto w-full animate-in fade-in duration-300 pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      <div className="pt-2 min-w-0">
        <h1 className="text-xl min-[360px]:text-2xl font-bold tracking-tight text-ofit-text mb-1">
          Ajustes
        </h1>
        <p className="text-sm text-ofit-text-soft font-medium leading-snug">
          Configurá los datos y el estilo de Outfit Shop
        </p>
      </div>

      <div className="card p-4 min-[360px]:p-5 sm:p-6 border-none shadow-sm flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <Palette size={20} className="text-ofit-pink" />
          <h2 className="text-base min-[360px]:text-lg font-bold text-ofit-text">Estilo de la app</h2>
        </div>
        <p className="text-sm text-ofit-text-soft leading-relaxed">
          Podés cambiar el look cuando quieras. No modifica datos, pedidos ni finanzas.
        </p>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => changeTheme('classic')}
            className={`relative min-h-[118px] rounded-2xl border-2 p-3 text-left transition-all ${
              theme === 'classic' ? 'border-ofit-pink ring-2 ring-ofit-pink/15' : 'border-ofit-border'
            }`}
          >
            {theme === 'classic' && (
              <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-ofit-pink text-white flex items-center justify-center">
                <Check size={14} strokeWidth={3} />
              </span>
            )}
            <div className="flex gap-1.5 mb-3">
              <span className="w-7 h-7 rounded-full bg-[#FFF9F7] border border-[#EBD9DE]" />
              <span className="w-7 h-7 rounded-full bg-[#D98FA0]" />
              <span className="w-7 h-7 rounded-full bg-[#1C2B4B]" />
            </div>
            <span className="block font-black text-ofit-text">Clásico</span>
            <span className="block text-xs text-ofit-text-soft mt-1">Claro, suave y femenino.</span>
          </button>

          <button
            type="button"
            onClick={() => changeTheme('luxe')}
            className={`relative min-h-[118px] rounded-2xl border-2 p-3 text-left transition-all bg-[#111014] shadow-[0_10px_26px_rgba(0,0,0,.28)] ${
              theme === 'luxe' ? 'border-[#C9A55C] ring-2 ring-[#C9A55C]/20' : 'border-[#302831]'
            }`}
          >
            {theme === 'luxe' && (
              <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#C9A55C] text-black flex items-center justify-center">
                <Check size={14} strokeWidth={3} />
              </span>
            )}
            <div className="flex gap-1.5 mb-3">
              <span className="w-7 h-7 rounded-full bg-[#09090B] border border-[#302831]" />
              <span className="w-7 h-7 rounded-full bg-[#D66F91]" />
              <span className="w-7 h-7 rounded-full bg-[#C9A55C]" />
            </div>
            <span className="block font-black text-[#F7F2F4]">Premium Dark</span>
            <span className="block text-xs text-[#B8ABB2] mt-1">Rosa · negro · dorado.</span>
          </button>
        </div>
      </div>

      <div className="card p-4 min-[360px]:p-5 sm:p-6 border-none shadow-sm flex flex-col gap-5 sm:gap-6 min-w-0">
        <div className="min-w-0">
          <h2 className="text-base min-[360px]:text-lg font-bold text-ofit-text mb-3 sm:mb-4 border-b border-ofit-border pb-2">
            Datos de Cobro
          </h2>
          <p className="text-sm text-ofit-text-soft mb-4 leading-relaxed">
            Estos datos se van a agregar automáticamente al final de los mensajes de WhatsApp cuando le mandes el saldo a tus clientas.
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-4 min-w-0">
            <div className="min-w-0">
              <label className="block text-sm font-semibold text-ofit-text mb-1.5" htmlFor="alias">
                Alias de MercadoPago / CBU
              </label>
              <input
                id="alias"
                type="text"
                spellCheck={false}
                autoComplete="off"
                placeholder="Ej: CAMILA.OUTFIT"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="input-field focus:ring-ofit-pink focus:border-ofit-pink font-semibold text-base"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-sm font-semibold text-ofit-text mb-1.5" htmlFor="titular">
                Nombre del Titular
              </label>
              <input
                id="titular"
                type="text"
                spellCheck={false}
                autoComplete="name"
                placeholder="Ej: Camila Silva"
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                className="input-field focus:ring-ofit-pink focus:border-ofit-pink text-base"
              />
            </div>

            <div className="pt-2 sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:static bg-[var(--bg-card)]/95 backdrop-blur-sm -mx-1 px-1 pb-1 z-10">
              <button
                type="submit"
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Guardar Datos
              </button>
            </div>
            
            {isSaved && (
              <div className="text-center text-sm font-bold badge-success px-3 py-2 rounded-xl border border-ofit-border leading-snug">
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
