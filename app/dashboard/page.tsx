'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { 
  TrendingUp, Users, ShoppingCart, Clock, 
  ArrowUpRight, Package, Activity,
  Wallet, ChevronRight, MoreHorizontal, CalendarRange
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts'

// Palette Warna Premium (Tetap menggunakan warna visual yang bagus)
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function DashboardPage() {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, pending: 0, customers: 0 })
  const [revenueTrend, setRevenueTrend] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // --- AMBIL CONFIG DARI ENV ---
  const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Suri Roti Nusantara'
  const COMPANY_TAGLINE = process.env.NEXT_PUBLIC_COMPANY_TAGLINE || 'Roti Halal & Berkah'

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const { data: statsData } = await supabase.rpc('get_dashboard_stats')
      if (statsData) setStats(statsData)

      const { data: trendData } = await supabase.rpc('get_revenue_trend')
      if (trendData) setRevenueTrend(trendData)

      const { data: productsData } = await supabase.rpc('get_top_products')
      if (productsData) setTopProducts(productsData)

      const { data: recent } = await supabase.from('orders')
        .select(`id, order_no, total_amount, status, created_at, customer:customers(name)`)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (recent) setRecentActivities(recent)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* --- HEADER (Medium Size) --- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-gray-500 font-bold text-[10px] mb-1 uppercase tracking-widest">Executive Overview</h2>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Dashboard <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              {BRAND_NAME}
            </span>
          </h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            {COMPANY_TAGLINE} • Monitoring real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm">
           <div className="px-3 py-1.5 bg-slate-50 rounded-lg flex items-center gap-2">
             <CalendarRange size={14} className="text-slate-400"/>
             <span className="text-xs font-bold text-slate-600">
               {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
             </span>
           </div>
           <button 
             onClick={fetchAllData} 
             className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-200 active:scale-95"
             title="Refresh Data"
           >
             <Activity size={16} />
           </button>
        </div>
      </div>

      {/* --- KPI CARDS (Medium Size) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard 
          title="Total Omzet" 
          value={`Rp ${stats.revenue.toLocaleString('id-ID')}`} 
          icon={<Wallet size={20} className="text-white"/>} 
          gradient="from-blue-600 to-indigo-600" 
          trend="+12%" 
          isMoney
        />
        <KpiCard 
          title="Total Order" 
          value={stats.orders.toString()} 
          icon={<ShoppingCart size={20} className="text-white"/>} 
          gradient="from-emerald-500 to-teal-600" 
          subLabel="Transaksi"
        />
        <KpiCard 
          title="Butuh Proses" 
          value={stats.pending.toString()} 
          icon={<Clock size={20} className="text-white"/>} 
          gradient="from-orange-500 to-amber-600" 
          alert={stats.pending > 0} 
          subLabel="Pending"
        />
        <KpiCard 
          title="Pelanggan" 
          value={stats.customers.toString()} 
          icon={<Users size={20} className="text-white"/>} 
          gradient="from-violet-500 to-purple-600" 
          subLabel="Mitra Aktif"
        />
      </div>

      {/* --- MAIN CHARTS AREA (Medium Size) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* REVENUE TREND */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col relative overflow-hidden group">
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><TrendingUp size={18}/></div>
                Tren Pendapatan
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-medium pl-9">Performa penjualan 12 bulan terakhir</p>
            </div>
            <button className="text-slate-300 hover:text-blue-600 transition p-1.5 hover:bg-blue-50 rounded-full"><MoreHorizontal size={20}/></button>
          </div>

          <div className="h-[280px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRevenuePremium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <filter id="glow" height="300%" width="300%" x="-75%" y="-75%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748B', fontSize: 11, fontWeight: 700}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 500}} 
                  tickFormatter={(val) => `${val/1000000}M`}
                  dx={-10}
                />
                <RechartsTooltip 
                  cursor={{stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '5 5'}}
                  contentStyle={{
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.98)'
                  }}
                  itemStyle={{ color: '#1E293B', fontWeight: 700 }}
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Total Omzet']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3B82F6" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorRevenuePremium)" 
                  animationDuration={1500}
                  filter="url(#glow)" 
                  activeDot={{ r: 6, strokeWidth: 3, stroke: '#DBEAFE', fill: '#3B82F6' }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TOP PRODUCTS */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
             <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600"><Package size={18}/></div>
             Produk Favorit
          </h3>
          
          <div className="h-[200px] w-full relative mb-4">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                   <Pie 
                      data={topProducts} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value"
                      cornerRadius={6}
                   >
                      {topProducts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                      ))}
                   </Pie>
                   <RechartsTooltip 
                      contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px'}}
                      formatter={(val: any) => [val, 'Terjual']}
                   />
                </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-800 tracking-tight">{topProducts.length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Items</span>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {topProducts.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition border border-transparent hover:border-slate-100 group cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm ring-2 ring-white" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                  <span className="text-slate-600 font-bold group-hover:text-slate-900 truncate max-w-[120px]">{product.name}</span>
                </div>
                <span className="font-extrabold text-slate-700 bg-white px-2 py-0.5 rounded-lg shadow-sm text-[10px]">
                  {product.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- RECENT ACTIVITY TABLE (Medium Size) --- */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="font-bold text-lg text-slate-800">Aktivitas Transaksi</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">5 pesanan terbaru</p>
          </div>
          <Link 
            href="/dashboard/reports" 
            className="text-xs font-bold text-blue-600 hover:text-white hover:bg-blue-600 flex items-center gap-2 transition-all bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:border-blue-600"
          >
            Lihat Semua <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] border-b border-slate-100 font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4">No. Order</th>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Total Nilai</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                 <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium animate-pulse text-xs">Sedang memuat data...</td></tr>
              ) : recentActivities.length === 0 ? (
                 <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic text-xs">Belum ada aktivitas.</td></tr>
              ) : (
                recentActivities.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 group-hover:text-blue-700 transition font-mono text-sm">{item.order_no}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                        <Clock size={10}/> {new Date(item.created_at).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                         <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 border border-white shadow-sm">
                            {item.customer?.name?.charAt(0) || '?'}
                         </div>
                         <span className="font-bold text-slate-600 text-sm">{item.customer?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-slate-800 text-sm tracking-tight">
                        Rp {item.total_amount.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-slate-300 hover:text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-all">
                        <ChevronRight size={18}/>
                      </button>
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

// --- SUB-COMPONENTS (Medium Size) ---

function KpiCard({ title, value, icon, gradient, trend, subLabel, alert, isMoney }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
       <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${gradient} opacity-[0.08] rounded-full blur-xl group-hover:scale-150 transition-transform duration-700`}></div>
       {alert && <span className="absolute top-5 right-5 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span></span>}
       <div className="flex items-start justify-between mb-6 relative z-10">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-slate-300/50 text-white ring-2 ring-white`}>
             {icon}
          </div>
          {trend && (
             <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 border border-emerald-100 shadow-sm">
               <TrendingUp size={12}/> {trend}
             </span>
          )}
       </div>
       <div className="relative z-10">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <h3 className={`font-black text-slate-800 tracking-tight ${isMoney ? 'text-2xl' : 'text-3xl'}`}>{value}</h3>
          {subLabel && <p className="text-[10px] font-bold text-slate-400 mt-1.5 bg-slate-50 inline-block px-1.5 py-0.5 rounded-md">{subLabel}</p>}
       </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = { 
    pending: 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/20', 
    shipped: 'bg-blue-50 text-blue-700 border-blue-100 ring-blue-500/20', 
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-emerald-500/20', 
    cancelled: 'bg-slate-50 text-slate-500 border-slate-200 ring-slate-500/20' 
  }
  const labels: any = { pending: 'Menunggu', shipped: 'Dikirim', completed: 'Selesai', cancelled: 'Dibatalkan' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ring-1 ${styles[status] || 'bg-gray-100'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shadow-sm ${status === 'completed' ? 'bg-emerald-500' : status === 'pending' ? 'bg-amber-500' : status === 'shipped' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
      {labels[status] || status}
    </span>
  )
}