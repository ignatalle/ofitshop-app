'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Package, Wallet, Menu, X, ClipboardList, Calculator } from 'lucide-react';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = () => setIsOpen(false);

  const navItems = [
    { name: 'Inicio', href: '/', icon: Home },
    { name: 'Clientes', href: '/clientes', icon: Users },
    { name: 'Armar Pedidos', href: '/pedidos', icon: ClipboardList },
    { name: 'Presupuestos', href: '/presupuestos', icon: Calculator },
    { name: 'Catálogo Histórico', href: '/productos', icon: Package },
    { name: 'Finanzas', href: '/finanzas', icon: Wallet },
  ];

  return (
    <>
      {/* Top Bar Fija */}
      <header className="fixed top-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white border-b border-ofit-border shadow-sm z-40 flex items-center px-4 justify-between">
        <button 
          onClick={() => setIsOpen(true)}
          className="w-11 h-11 -ml-2 text-ofit-text hover:bg-ofit-pink-soft rounded-xl transition-colors flex items-center justify-center"
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold text-ofit-text absolute left-1/2 -translate-x-1/2">
          Outfit Shop
        </h1>
        <div className="w-11"></div> {/* Espaciador para centrar título */}
      </header>

      {/* Overlay Oscuro */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Drawer / Menú Lateral */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 w-[min(85vw,320px)] pt-[env(safe-area-inset-top)] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-ofit-border">
          <h2 className="text-xl font-bold text-ofit-text">Menú</h2>
          <button 
            onClick={closeSidebar}
            className="w-11 h-11 -mr-2 text-ofit-text-soft hover:bg-ofit-pink-soft rounded-xl transition-colors flex items-center justify-center"
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2 hide-scrollbar pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-4 min-h-[44px] py-3 rounded-xl font-medium transition-colors ${
                  isActive 
                    ? 'bg-ofit-pink-soft text-ofit-pink-hover' 
                    : 'text-ofit-text-soft hover:bg-ofit-bg'
                }`}
              >
                <Icon size={22} className={isActive ? 'text-ofit-pink' : 'text-ofit-text-soft'} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
