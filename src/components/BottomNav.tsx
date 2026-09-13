'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Plus, Users, Wallet } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const itemClass = (href: string) =>
    `flex flex-col items-center justify-center flex-1 min-w-0 h-full gap-0.5 min-[360px]:gap-1 px-0.5 ${
      isActive(href) ? 'text-ofit-pink' : 'text-ofit-text-soft'
    }`;

  const iconClass = (href: string) =>
    `p-1 min-[360px]:p-1.5 rounded-xl transition-colors ${
      isActive(href) ? 'bg-ofit-pink-soft text-ofit-pink' : 'text-ofit-text-soft hover:bg-gray-50'
    }`;

  const labelClass = (href: string) =>
    `text-[9px] min-[360px]:text-[10px] font-bold leading-none max-w-full truncate ${
      isActive(href) ? 'text-ofit-pink' : 'text-ofit-text-soft'
    }`;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed left-0 right-0 bottom-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-ofit-border/60 shadow-[0_-4px_20px_rgba(48,40,42,0.05)] pb-[env(safe-area-inset-bottom)] supports-[backdrop-filter]:bg-white/88"
    >
      <div className="mx-auto flex items-center justify-around w-full max-w-xl h-[64px] min-[360px]:h-[68px] px-1 min-[360px]:px-2">
        <Link href="/" aria-current={isActive('/') ? 'page' : undefined} className={itemClass('/')}>
          <div className={iconClass('/')}>
            <Home size={21} strokeWidth={isActive('/') ? 2.5 : 2} />
          </div>
          <span className={labelClass('/')}>Inicio</span>
        </Link>

        <Link href="/pedidos" aria-current={isActive('/pedidos') && pathname !== '/pedidos/nuevo' ? 'page' : undefined} className={itemClass('/pedidos')}>
          <div className={iconClass('/pedidos')}>
            <Package size={21} strokeWidth={isActive('/pedidos') ? 2.5 : 2} />
          </div>
          <span className={labelClass('/pedidos')}>Pedidos</span>
        </Link>

        <div className="flex flex-col items-center justify-start flex-1 min-w-0 h-full relative">
          <Link
            href="/pedidos/nuevo"
            aria-label="Nuevo pedido"
            aria-current={pathname === '/pedidos/nuevo' ? 'page' : undefined}
            className={`absolute -top-4 min-[360px]:-top-5 flex items-center justify-center w-12 h-12 min-[360px]:w-14 min-[360px]:h-14 rounded-full shadow-lg transition-transform active:scale-95 ${
              pathname === '/pedidos/nuevo'
                ? 'bg-ofit-pink-hover text-white ring-4 ring-ofit-pink-soft'
                : 'bg-ofit-pink text-white shadow-ofit-pink/30 hover:scale-105'
            }`}
          >
            <Plus size={26} strokeWidth={3} />
          </Link>
          <span className={`text-[9px] min-[360px]:text-[10px] font-bold absolute bottom-1 min-[360px]:bottom-1.5 ${pathname === '/pedidos/nuevo' ? 'text-ofit-pink' : 'text-ofit-text-soft'}`}>
            Nuevo
          </span>
        </div>

        <Link href="/clientes" aria-current={isActive('/clientes') ? 'page' : undefined} className={itemClass('/clientes')}>
          <div className={iconClass('/clientes')}>
            <Users size={21} strokeWidth={isActive('/clientes') ? 2.5 : 2} />
          </div>
          <span className={labelClass('/clientes')}>Clientes</span>
        </Link>

        <Link href="/finanzas" aria-current={isActive('/finanzas') ? 'page' : undefined} className={itemClass('/finanzas')}>
          <div className={iconClass('/finanzas')}>
            <Wallet size={21} strokeWidth={isActive('/finanzas') ? 2.5 : 2} />
          </div>
          <span className={labelClass('/finanzas')}>Finanzas</span>
        </Link>
      </div>
    </nav>
  );
}
