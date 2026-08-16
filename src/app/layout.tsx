import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Outfit Shop - Admin",
  description: "Gestión de inventario y finanzas para tu tienda de ropa",
  icons: {
    icon: '/img/LOGO.png',
    apple: '/img/LOGO.png',
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen relative`}
      >
        <Sidebar />
        
        {/* Main content with padding top for the fixed top bar and padding bottom for BottomNav */}
        <main className="pt-[calc(4rem+env(safe-area-inset-top))] pb-24 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))] min-h-[100dvh]">
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}
