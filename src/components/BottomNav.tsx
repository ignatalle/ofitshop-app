'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Plus, Users, Wallet } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  // Ocultar en rutas donde quizás no queremos barra inferior (ej. formularios de creación si quisiéramos)
  // Pero por ahora la mostramos en todo móvil.
  
  return (
    <nav className="fixed left-0 right-0 bottom-0 z-50 bg-white/90 backdrop-blur-md border-t border-ofit-border/50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(48,40,42,0.03)] md:hidden">
      <div className="flex items-center justify-around h-[68px] px-2">
        
        {/* Inicio */}
        <Link href="/" className="flex flex-col items-center justify-center flex-1 h-full gap-1">
          <div className={`p-1.5 rounded-xl transition-colors ${pathname === '/' ? 'bg-ofit-pink-soft text-ofit-pink' : 'text-ofit-text-soft hover:bg-gray-50'}`}>
            <Home size={22} strokeWidth={pathname === '/' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] font-bold ${pathname === '/' ? 'text-ofit-pink' : 'text-ofit-text-soft'}`}>
            Inicio
          </span>
        </Link>

        {/* Pedidos */}
        <Link href="/pedidos" className="flex flex-col items-center justify-center flex-1 h-full gap-1">
          <div className={`p-1.5 rounded-xl transition-colors ${pathname === '/pedidos' ? 'bg-ofit-pink-soft text-ofit-pink' : 'text-ofit-text-soft hover:bg-gray-50'}`}>
            <Package size={22} strokeWidth={pathname === '/pedidos' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] font-bold ${pathname === '/pedidos' ? 'text-ofit-pink' : 'text-ofit-text-soft'}`}>
            Pedidos
          </span>
        </Link>

        {/* + Nuevo Pedido (Protagonista) */}
        <div className="flex flex-col items-center justify-start flex-1 h-full relative">
          <Link href="/pedidos/nuevo" className="absolute -top-5 flex items-center justify-center w-14 h-14 bg-ofit-pink text-white rounded-full shadow-lg shadow-ofit-pink/30 hover:scale-105 active:scale-95 transition-transform">
            <Plus size={28} strokeWidth={3} />
          </Link>
          <span className="text-[10px] font-bold text-ofit-text-soft absolute bottom-1.5">
            Nuevo
          </span>
        </div>

        {/* Clientes */}
        <Link href="/clientes" className="flex flex-col items-center justify-center flex-1 h-full gap-1">
          <div className={`p-1.5 rounded-xl transition-colors ${pathname === '/clientes' ? 'bg-ofit-pink-soft text-ofit-pink' : 'text-ofit-text-soft hover:bg-gray-50'}`}>
            <Users size={22} strokeWidth={pathname === '/clientes' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] font-bold ${pathname === '/clientes' ? 'text-ofit-pink' : 'text-ofit-text-soft'}`}>
            Clientes
          </span>
        </Link>

        {/* Finanzas */}
        <Link href="/finanzas" className="flex flex-col items-center justify-center flex-1 h-full gap-1">
          <div className={`p-1.5 rounded-xl transition-colors ${pathname === '/finanzas' ? 'bg-ofit-pink-soft text-ofit-pink' : 'text-ofit-text-soft hover:bg-gray-50'}`}>
            <Wallet size={22} strokeWidth={pathname === '/finanzas' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] font-bold ${pathname === '/finanzas' ? 'text-ofit-pink' : 'text-ofit-text-soft'}`}>
            Finanzas
          </span>
        </Link>

      </div>
    </nav>
  );
}
