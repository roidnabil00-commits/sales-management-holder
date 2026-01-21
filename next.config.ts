import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Matikan 'X-Powered-By: Next.js' agar hacker tidak tahu kita pakai teknologi apa
  poweredByHeader: false,

  // 2. Security Headers Wajib
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload' // Paksa HTTPS selama 2 tahun
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY' // Anti-Clickjacking: Website tidak bisa di-embed di iframe orang lain
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff' // Mencegah browser menebak-nebak tipe file (Anti-MIME sniffing)
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin' // Privasi user terjaga saat klik link keluar
          },
          {
            key: 'Permissions-Policy',
            value: "camera=(self), microphone=(), geolocation=(self)" // Hanya izinkan kamera/GPS di domain sendiri
          }
        ],
      },
    ];
  },
};

export default nextConfig;