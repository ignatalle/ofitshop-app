'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Users, Package, Wallet, Menu, X, ClipboardList, Calculator, Settings, ShoppingBag } from 'lucide-react';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navItems = [
    { name: 'Inicio', href: '/', icon: Home },
    { name: 'Clientes', href: '/clientes', icon: Users },
    { name: 'Pedidos', href: '/pedidos', icon: ClipboardList },
    { name: 'Carga Rápida', href: '/pedidos/nuevo', icon: Calculator },
    { name: 'Mi Catálogo', href: '/productos', icon: Package },
    { name: 'Compras Pendientes', href: '/compras-pendientes', icon: ShoppingBag },
    { name: 'Finanzas', href: '/finanzas', icon: Wallet },
    { name: 'Ajustes', href: '/ajustes', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/pedidos' && pathname === '/pedidos/nuevo') return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white/95 backdrop-blur-md border-b border-ofit-border shadow-sm z-40 flex items-center px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-11 h-11 text-ofit-text hover:bg-ofit-pink-soft rounded-xl transition-colors flex items-center justify-center shrink-0"
          aria-label="Abrir menú"
          aria-expanded={isOpen}
        >
          <Menu size={24} />
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 min-[360px]:gap-2 max-w-[62vw] min-w-0 pointer-events-none">
          <Image
            src="/img/LOGO.png"
            alt="Outfit Shop Logo"
            width={36}
            height={36}
            className="object-contain rounded-full shrink-0 w-8 h-8 min-[360px]:w-9 min-[360px]:h-9"
          />
          <h1 className="text-base min-[360px]:text-lg font-bold text-ofit-text truncate">
            Outfit Shop
          </h1>
        </div>
        <div className="w-11 shrink-0" />
      </header>

      {isOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 bg-black/50 z-40 transition-opacity cursor-default"
          onClick={closeSidebar}
        />
      )}

      <aside
        aria-hidden={!isOpen}
        className={`fixed top-0 left-0 bottom-0 w-[min(88vw,320px)] max-w-[calc(100vw-2rem)] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-3 min-[360px]:px-4 border-b border-ofit-border shrink-0">
          <div className="w-[145px] min-[360px]:w-[160px] flex items-center min-w-0">
            <Image
              src="/img/BANNER.png"
              alt="Outfit Shop Banner"
              width={160}
              height={40}
              className="object-contain max-w-full h-auto"
            />
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="w-11 h-11 text-ofit-text-soft hover:bg-ofit-pink-soft rounded-xl transition-colors flex items-center justify-center shrink-0"
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 min-[360px]:py-4 px-2.5 min-[360px]:px-3 flex flex-col gap-1.5 min-[360px]:gap-2 hide-scrollbar pb-[calc(1rem+env(safe-area-inset-bottom))] overscroll-contain">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 min-[360px]:px-4 min-h-[46px] py-2.5 min-[360px]:py-3 rounded-xl font-medium transition-colors min-w-0 ${
                  active
                    ? 'bg-ofit-pink-soft text-ofit-pink-hover'
                    : 'text-ofit-text-soft hover:bg-ofit-bg'
                }`}
              >
                <Icon size={21} className={`shrink-0 ${active ? 'text-ofit-pink' : 'text-ofit-text-soft'}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
