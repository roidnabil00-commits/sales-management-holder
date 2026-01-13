// app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { TrendingUp, Users, MapPin, AlertTriangle, ArrowUpRight, DollarSign } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    revenue: 0,
    visits: 0,
    customers: 0,
    lowStockCount: 0
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    const today = new Date()
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    // 1. Hitung Total Omzet Bulan Ini (Status != cancelled)
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount')
      .neq('status', 'cancelled')
      .gte('created_at', firstDayOfMonth)
    
    const totalRevenue = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0

    // 2. Hitung Total Kunjungan Bulan Ini
    const { count: visitCount } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('check_in_time', firstDayOfMonth)

    // 3. Hitung Total Pelanggan Aktif
    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })

    // 4. Cek Stok Menipis (Di bawah 10) - Mengambil dari tabel 'inventory' di Gudang Utama
    const { count: lowStock } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .lt('qty_on_hand', 10)
      .eq('warehouse_id', 1) 

    // 5. Ambil 5 Transaksi Terakhir
    const { data: recent } = await supabase
      .from('orders')
      .select('id, order_no, total_amount, status, customer:customers(name)')
      .order('created_at', { ascending: false })
      .limit(5)

    setStats({
      revenue: totalRevenue,
      visits: visitCount || 0,
      customers: customerCount || 0,
      lowStockCount: lowStock || 0
    })
    setRecentOrders(recent || [])
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Ringkasan Bisnis</h2>
          <p className="text-sm text-gray-500">
            Overview bulan {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button 
          onClick={fetchDashboardData} 
          className="text-sm text-blue-600 hover:underline"
        >
          Refresh Data
        </button>
      </div>

      {/* --- KARTU KPI UTAMA --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Omzet */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600">
              <DollarSign size={24} />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+Realtime</span>
          </div>
          <p className="text-sm text-gray-500">Omzet Bulan Ini</p>
          <h3 className="text-2xl font-bold text-gray-800">
            Rp {stats.revenue.toLocaleString('id-ID')}
          </h3>
        </div>

        {/* Card 2: Kunjungan */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <MapPin size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-500">Kunjungan Sales</p>
          <h3 className="text-2xl font-bold text-gray-800">
            {stats.visits} <span className="text-sm font-normal text-gray-400">Titik</span>
          </h3>
        </div>

        {/* Card 3: Pelanggan */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600">
              <Users size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-500">Total Mitra/Warung</p>
          <h3 className="text-2xl font-bold text-gray-800">
            {stats.customers}
          </h3>
        </div>

        {/* Card 4: Stok Alert */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-full ${stats.lowStockCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
              <AlertTriangle size={24} />
            </div>
            {stats.lowStockCount > 0 && (
               <span className="animate-ping absolute top-6 right-6 w-3 h-3 bg-red-500 rounded-full"></span>
            )}
          </div>
          <p className="text-sm text-gray-500">Stok Menipis</p>
          <h3 className="text-2xl font-bold text-gray-800">
            {stats.lowStockCount} <span className="text-sm font-normal text-gray-400">Item</span>
          </h3>
        </div>
      </div>

      {/* --- TRANSAKSI TERBARU --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Transaksi Terakhir</h3>
          <a href="/dashboard/orders" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Lihat Semua <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3">No. Order</th>
                <th className="px-6 py-3">Pelanggan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">Loading...</td></tr>
              ) : recentOrders.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">Belum ada data</td></tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{order.order_no}</td>
                    <td className="px-6 py-4">{order.customer?.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize 
                        ${order.status === 'completed' || order.status === 'shipped' ? 'bg-green-100 text-green-700' : 
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        {order.status === 'shipped' ? 'Dikirim' : order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      Rp {order.total_amount.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}