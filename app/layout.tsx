import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner'; // Pastikan Toaster ada untuk notifikasi

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// --- EDIT BAGIAN INI ---
export const metadata: Metadata = {
  title: "Xander Tech Systems | Integrated Sales Solution",
  description: "Sistem Manajemen Penjualan, Stok, dan Kunjungan Sales berbasis AI.",
  icons: {
    icon: '/favicon.ico', // Pastikan punya favicon logo perusahaan
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}