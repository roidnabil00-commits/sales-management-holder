'use client'

import { appConfig } from '@/lib/appConfig'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client' // Update Import Client biar modern
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
  BarChart3,
  QrCode,
  Calendar // TAMBAHKAN ICON INI
} from 'lucide-react'

// Definisi Menu Master
const allMenuItems = [
  // Common (Semua bisa lihat)
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'sales'] },
  
  // Admin Only Features
  { name: 'Penawaran', href: '/dashboard/quotation', icon: FileText, roles: ['admin', 'sales'] },
  { name: 'Pesanan (SO)', href: '/dashboard/orders', icon: ShoppingCart, roles: ['admin'] },
  { name: 'Pengiriman', href: '/dashboard/delivery', icon: Truck, roles: ['admin'] },
  { name: 'Faktur', href: '/dashboard/invoices', icon: Receipt, roles: ['admin'] },
  { name: 'Stock Barang', href: '/dashboard/stock', icon: Package, roles: ['admin'] },
  { name: 'Laporan', href: '/dashboard/reports', icon: BarChart3, roles: ['admin'] },
  { name: 'Pelanggan', href: '/dashboard/customers', icon: Users, roles: ['admin'] },
  
  // --- MENU BARU (PCP MANAGER) ---
  { name: 'Kunjungan (Track)', href: '/dashboard/routes', icon: Calendar, roles: ['admin'] }, 
  
  { name: 'Generator QR', href: '/dashboard/tools/qrcode', icon: QrCode, roles: ['admin'] },

  // Sales & Admin Features
  { name: 'Target Sales', href: '/dashboard/targets', icon: Target, roles: ['admin', 'sales'] },
  { name: 'Check Point', href: '/dashboard/visits', icon: MapPin, roles: ['admin', 'sales'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient() // Gunakan helper modern
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Cek user login & Role saat layout dimuat
  useEffect(() => {
    const getUserAndRole = async () => {
      // 1. Ambil User
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.replace('/login')
        return
      } 
      
      setUserEmail(user.email || 'User')

      // 2. Ambil Role dari tabel profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // Default role sales jika tidak ketemu
      setUserRole(profile?.role || 'sales') 
      setLoading(false)
    }

    getUserAndRole()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Filter Menu berdasarkan Role
  const filteredMenu = allMenuItems.filter(item => 
    userRole ? item.roles.includes(userRole) : false
  )

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 text-blue-600 font-bold animate-pulse">Memuat Sistem Xander...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* --- SIDEBAR (Desktop) --- */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-200 fixed h-full z-10">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {appConfig.brandLogo && (
              <img 
                src={appConfig.brandLogo} 
                alt="Logo" 
                className="h-10 w-auto object-contain" 
              />
            )}
            
            <div>
              <h1 className="text-xl font-bold text-blue-600 leading-tight">
                {appConfig.brandName}
              </h1>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Role: <span className="font-bold uppercase text-blue-600">{userRole}</span>
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {filteredMenu.map((item) => {
            const Icon = item.icon
            // Logic Active State (Menyala jika URL diawali href menu)
            // Khusus Dashboard utama (/dashboard), harus exact match agar tidak menyala terus
            const isActive = item.href === '/dashboard' 
                ? pathname === '/dashboard' 
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
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
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      {/* --- MOBILE HEADER (Muncul di HP) --- */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-gray-200 z-20 flex items-center justify-between p-4 shadow-sm">
        <div className="flex items-center gap-2">
           {appConfig.brandLogo && (
              <img src={appConfig.brandLogo} alt="Logo" className="h-8 w-auto" />
           )}
           <span className="font-bold text-blue-600 text-lg">{appConfig.brandName}</span>
        </div>
        
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-gray-100 rounded-lg">
          <Menu className="text-gray-600" />
        </button>
      </div>

      {/* --- MOBILE MENU OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-white md:hidden flex flex-col pt-20 px-4 animate-in slide-in-from-right duration-200">
          <div className="flex-1 overflow-y-auto">
             {filteredMenu.map((item) => {
               const Icon = item.icon
               return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-4 py-4 border-b border-gray-100 text-gray-700 font-medium active:bg-gray-50"
                >
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                    <Icon size={20} />
                  </div>
                  {item.name}
                </Link>
               )
             })}
          </div>
          <button onClick={handleLogout} className="mt-4 mb-8 flex items-center justify-center gap-2 py-4 text-red-600 font-bold border rounded-xl border-red-100 bg-red-50">
            <LogOut size={20} /> Logout Sistem
          </button>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-24 md:pt-8 overflow-x-hidden min-h-screen">
        {children}
      </main>
    </div>
  )
}