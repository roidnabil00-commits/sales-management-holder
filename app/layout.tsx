import { appConfig } from '@/lib/appConfig';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 1. Import Toaster
import { Toaster } from 'sonner'; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: appConfig.brandName,
  description: `Sistem Manajemen Distribusi oleh ${appConfig.companyName}`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* 2. Pasang Komponen Toaster disini. 
            'richColors' membuat notifikasi error jadi merah & sukses jadi hijau otomatis */}
        <Toaster position="top-center" richColors closeButton /> 
      </body>
    </html>
  );
}