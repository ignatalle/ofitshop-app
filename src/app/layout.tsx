import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile-audit.css";
import "./luxe-theme.css";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFF9F7",
};

const themeBootScript = `
  try {
    const savedTheme = localStorage.getItem('ofitshop_theme');
    if (savedTheme === 'luxe') {
      document.documentElement.dataset.theme = 'luxe';
      document.documentElement.style.backgroundColor = '#09090B';
    } else {
      delete document.documentElement.dataset.theme;
      document.documentElement.style.backgroundColor = '#FFF9F7';
    }
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-[100dvh] relative overflow-x-hidden`}
      >
        <Sidebar />

        <main className="pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom))] min-h-[100dvh] w-full min-w-0 overflow-x-hidden">
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}
