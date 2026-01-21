'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  TrendingUp, Users, MapPin, Activity, 
  Wallet, Calendar, Clock, ArrowUpRight, 
  BarChart3, Loader2, CheckCircle, Package
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// Tipe Data Statistik
type DashboardStats = {
  totalCustomers: number
  visitsToday: number
  revenueToday: number
  revenueMonth: number
  activeSalesToday: number
  recentLogs: any[]
  chartData: any[]
  topSales: any[]
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    visitsToday: 0,
    revenueToday: 0,
    revenueMonth: 0,
    activeSalesToday: 0,
    recentLogs: [],
    chartData: [],
    topSales: []
  })

  useEffect(() => {
    determineGreeting()
    fetchDashboardData()
    // Refresh otomatis tiap 60 detik
    const interval = setInterval(fetchDashboardData, 60000)
    return () => clearInterval(interval)
  }, [])

  const determineGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 11) setGreeting('Selamat Pagi')
    else if (hour < 15) setGreeting('Selamat Siang')
    else if (hour < 18) setGreeting('Selamat Sore')
    else setGreeting('Selamat Malam')
  }

  const fetchDashboardData = async () => {
    try {
      const today = new Date()
      const yyyyMmDd = today.toISOString().split('T')[0]
      const startOfDay = `${yyyyMmDd}T00:00:00`
      const endOfDay = `${yyyyMmDd}T23:59:59`
      
      // Hitung awal bulan untuk Omzet Bulanan
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

      // 1. DATA CUSTOMER
      const { count: custCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

      // 2. DATA KUNJUNGAN HARI INI
      const { count: visitCountToday } = await supabase
        .from('visit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)

      // 3. SALES AKTIF (Log Visit Hari Ini)
      const { data: activeSalesData } = await supabase
        .from('visit_logs')
        .select('sales_id')
        .gte('created_at', startOfDay)
      const uniqueSales = new Set(activeSalesData?.map(item => item.sales_id)).size

      // 4. DATA ORDER (KEUANGAN)
      const { data: ordersMonth } = await supabase
        .from('orders')
        .select('total_amount, created_at, sales_id, maker_name')
        .gte('created_at', startOfMonth)
        .order('created_at', { ascending: true })

      let revToday = 0
      let revMonth = 0
      const salesPerformance: Record<string, number> = {}

      // Proses Data Order (Hitung Omzet & Leaderboard)
      ordersMonth?.forEach(order => {
        revMonth += order.total_amount
        
        // Cek jika order hari ini
        if (order.created_at.startsWith(yyyyMmDd)) {
          revToday += order.total_amount
        }

        // Leaderboard logic
        const salesName = order.maker_name || 'Admin'
        salesPerformance[salesName] = (salesPerformance[salesName] || 0) + order.total_amount
      })

      // Sort Leaderboard (Top 3)
      const topSalesList = Object.entries(salesPerformance)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)

      // 5. CHART DATA (7 Hari Terakhir)
      const chartDataRaw: any[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const displayDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
        
        const dayTotal = ordersMonth?.filter(o => o.created_at.startsWith(dateStr))
          .reduce((sum, ord) => sum + ord.total_amount, 0) || 0
        
        chartDataRaw.push({ name: displayDate, total: dayTotal })
      }

      // 6. LIVE FEED ACTIVITY
      const { data: recentActivity } = await supabase
        .from('view_visit_logs')
        .select('*')
        .order('visit_time', { ascending: false })
        .limit(4)

      setStats({
        totalCustomers: custCount || 0,
        visitsToday: visitCountToday || 0,
        revenueToday: revToday,
        revenueMonth: revMonth,
        activeSalesToday: uniqueSales || 0,
        recentLogs: recentActivity || [],
        chartData: chartDataRaw,
        topSales: topSalesList
      })

    } catch (error) {
      console.error("Dashboard Error:", error)
    } finally {
      setLoading(false)
    }
  }

  // --- PERBAIKAN DI SINI (Gunakan 'any' untuk bypass error TypeScript) ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 text-white p-3 rounded-lg shadow-xl text-xs">
          <p className="font-bold mb-1">{label}</p>
          <p>Rp {payload[0].value?.toLocaleString('id-ID')}</p>
        </div>
      )
    }
    return null
  }

  const currentDate = new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Executive Dashboard</p>
              <h1 className="text-2xl font-black text-slate-900">
                {greeting}.<span className="text-2xl"></span>
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                <Calendar size={14}/> {currentDate}
              </p>
            </div>
            
            <div className="flex gap-3">
               <Link href="/dashboard/orders" className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-slate-200 transition">
                  <Package size={18}/> Order Baru
               </Link>
               <Link href="/dashboard/visits" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-200 transition">
                  <MapPin size={18}/> Visit Baru
               </Link>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* 1. KEY METRICS (KEUANGAN & VISIT) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
           
           {/* Card: Omzet Hari Ini */}
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-green-400 transition group">
              <div className="flex justify-between items-start mb-3">
                 <div className="p-3 bg-green-50 text-green-600 rounded-xl group-hover:scale-110 transition">
                    <Wallet size={24}/>
                 </div>
                 <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">+Today</span>
              </div>
              <p className="text-sm font-bold text-slate-400">Omzet Hari Ini</p>
              <h3 className="text-2xl font-black text-slate-800">
                {loading ? <Loader2 className="animate-spin" size={20}/> : `Rp ${stats.revenueToday.toLocaleString('id-ID')}`}
              </h3>
           </div>

           {/* Card: Total Omzet Bulan Ini */}
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 transition group">
              <div className="flex justify-between items-start mb-3">
                 <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition">
                    <TrendingUp size={24}/>
                 </div>
                 <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Bulan Ini</span>
              </div>
              <p className="text-sm font-bold text-slate-400">Total Revenue</p>
              <h3 className="text-2xl font-black text-slate-800">
                {loading ? <Loader2 className="animate-spin" size={20}/> : `Rp ${stats.revenueMonth.toLocaleString('id-ID')}`}
              </h3>
           </div>

           {/* Card: Kunjungan (Visit) */}
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-orange-400 transition group">
              <div className="flex justify-between items-start mb-3">
                 <div className="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:scale-110 transition">
                    <MapPin size={24}/>
                 </div>
                 <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">Live</span>
              </div>
              <p className="text-sm font-bold text-slate-400">Visit Sales Hari Ini</p>
              <h3 className="text-2xl font-black text-slate-800">
                {loading ? <Loader2 className="animate-spin" size={20}/> : stats.visitsToday}
              </h3>
           </div>

           {/* Card: Sales Aktif */}
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-400 transition group">
              <div className="flex justify-between items-start mb-3">
                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition">
                    <Users size={24}/>
                 </div>
                 <Link href="/dashboard/customers" className="text-slate-300 hover:text-blue-600">
                    <ArrowUpRight size={20}/>
                 </Link>
              </div>
              <p className="text-sm font-bold text-slate-400">Sales Bergerak</p>
              <h3 className="text-2xl font-black text-slate-800">
                {loading ? <Loader2 className="animate-spin" size={20}/> : `${stats.activeSalesToday} Org`}
              </h3>
           </div>

        </div>

        {/* 2. CHART & LEADERBOARD SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* GRAFIK PENJUALAN (2/3 Lebar) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <BarChart3 className="text-blue-600" size={20}/> Trend Penjualan
                        </h3>
                        <p className="text-sm text-slate-500">Omzet dalam 7 hari terakhir</p>
                    </div>
                </div>
                
                <div className="h-[300px] w-full">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-slate-300">Memuat Grafik...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12, fill: '#64748b', fontWeight: 'bold'}}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12, fill: '#64748b'}}
                                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                                <Bar 
                                    dataKey="total" 
                                    fill="#2563eb" 
                                    radius={[6, 6, 0, 0]} 
                                    barSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* LEADERBOARD (1/3 Lebar) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-1">
                    <CheckCircle className="text-green-600" size={20}/> Top Sales
                </h3>
                <p className="text-sm text-slate-500 mb-6">Penjualan Tertinggi Bulan Ini</p>

                <div className="flex-1 space-y-4">
                    {stats.topSales.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic text-sm">Belum ada data penjualan</div>
                    ) : (
                        stats.topSales.map((sales, index) => (
                            <div key={index} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition border border-transparent hover:border-slate-100">
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md
                                    ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-400' : 'bg-orange-700'}
                                `}>
                                    #{index + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">{sales.name}</p>
                                    <p className="text-xs font-medium text-slate-500">Sales Executive</p>
                                </div>
                                <p className="text-sm font-black text-blue-600">
                                    Rp {(sales.total / 1000000).toFixed(1)}jt
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* 3. LIVE ACTIVITY FEED */}
        <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                     <Activity className="text-orange-500" size={20}/> Aktivitas Lapangan (Live)
                  </h3>
                  <Link href="/dashboard/routes" className="text-sm font-bold text-blue-600 hover:underline">
                     Lihat Semua
                  </Link>
               </div>
               
               <div className="p-0">
                  {stats.recentLogs.length === 0 ? (
                     <div className="p-12 text-center text-slate-400 text-sm italic">Belum ada kunjungan hari ini.</div>
                  ) : (
                     <div className="divide-y divide-slate-50">
                        {stats.recentLogs.map((log: any) => (
                           <div key={log.id} className="p-5 hover:bg-slate-50 transition flex items-start gap-4">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200">
                                 {log.sales_email.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                 <div className="flex justify-between items-start">
                                    <p className="text-sm font-bold text-slate-800">
                                       {log.sales_email.split('@')[0]}
                                       <span className="font-normal text-slate-500"> mengunjungi </span>
                                       {log.customer_name}
                                    </p>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
                                       <Clock size={10}/>
                                       {new Date(log.visit_time).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                 </div>
                                 <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <MapPin size={12}/> {log.customer_district || 'Lokasi Terdeteksi'}
                                 </p>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
        </div>
      </div>
    </div>
  )
}