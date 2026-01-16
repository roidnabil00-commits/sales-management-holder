// app/dashboard/layout.tsx
'use client'

import { appConfig } from '@/lib/appConfig'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  ShoppingCart, 
  Truck, 
  Receipt, 
  Users, 
  Target, 
  MapPin, 
  LogOut, 
  Menu,
  BarChart3 // Icon Baru untuk Laporan
} from 'lucide-react'

// Definisi Menu Lengkap
const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Stock Barang', href: '/dashboard/stock', icon: Package },
  { name: 'Penawaran', href: '/dashboard/quotation', icon: FileText },
  { name: 'Pesanan (SO)', href: '/dashboard/orders', icon: ShoppingCart },
  { name: 'Pengiriman', href: '/dashboard/delivery', icon: Truck },
  { name: 'Faktur', href: '/dashboard/invoices', icon: Receipt },
  { name: 'Laporan', href: '/dashboard/reports', icon: BarChart3 }, // <-- MENU BARU
  { name: 'Pelanggan', href: '/dashboard/customers', icon: Users },
  { name: 'Target Sales', href: '/dashboard/targets', icon: Target },
  { name: 'Check Point', href: '/dashboard/visits', icon: MapPin },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // Cek user login saat layout dimuat
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login') // Tendang ke login kalau belum masuk
      } else {
        setUserEmail(user.email || 'Sales')
      }
    }
    getUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* --- SIDEBAR (Desktop) --- */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-200 fixed h-full z-10">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-blue-600">{appConfig.brandName}</h1>
          <p className="text-xs text-gray-500 mt-1">Sistem Distribusi</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="mb-4 px-3">
            <p className="text-xs font-semibold text-gray-400 uppercase">User</p>
            <p className="text-sm font-medium text-gray-700 truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      {/* --- MOBILE HEADER (Muncul di HP) --- */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-gray-200 z-20 flex items-center justify-between p-4">
        <span className="font-bold text-blue-600">{appConfig.brandName}</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <Menu className="text-gray-600" />
        </button>
      </div>

      {/* --- MOBILE MENU OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-white md:hidden flex flex-col pt-16 px-4">
          {menuItems.map((item) => {
             const Icon = item.icon
             return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-4 py-4 border-b border-gray-100 text-gray-700 font-medium"
              >
                <Icon size={20} />
                {item.name}
              </Link>
             )
          })}
          <button onClick={handleLogout} className="mt-8 flex items-center gap-4 py-4 text-red-600 font-bold border-t border-gray-100">
            <LogOut size={20} /> Logout
          </button>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}