// app/dashboard/targets/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Target, TrendingUp, Calendar, Award } from 'lucide-react'

export default function TargetsPage() {
  const [targets, setTargets] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTargetsAndData()
  }, [])

  const fetchTargetsAndData = async () => {
    setLoading(true)
    
    // 1. Ambil List Target Sales dari Database
    const { data: targetList } = await supabase
      .from('targets')
      .select('*')
      .order('end_date', { ascending: true })

    if (!targetList) {
      setLoading(false); return;
    }

    // 2. Hitung Pencapaian (Real-time Calculation)
    const newAchievements: any = {}
    
    // Ambil semua order bulan ini untuk hitung revenue
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount, status')
      .neq('status', 'cancelled')
      .gte('created_at', firstDay)

    const currentRevenue = orders?.reduce((sum, o) => sum + o.total_amount, 0) || 0

    // Ambil kunjungan bulan ini
    const { count: visitCount } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('check_in_time', firstDay)

    // Mapping Data ke Target
    targetList.forEach(t => {
      if (t.type === 'revenue') {
        newAchievements[t.id] = currentRevenue
      } else if (t.type === 'visit_count') {
        newAchievements[t.id] = visitCount || 0
      } else {
        newAchievements[t.id] = 0 // Untuk tipe lain (produk) butuh query detail lagi
      }
    })

    setTargets(targetList)
    setAchievements(newAchievements)
    setLoading(false)
  }

  // Helper untuk Progress Bar
  const calculateProgress = (current: number, target: number) => {
    const percent = (current / target) * 100
    return Math.min(percent, 100)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Target & Performa</h2>
        <p className="text-sm text-gray-500">Monitor KPI (Key Performance Indicator) Anda</p>
      </div>

      {/* Info Promo (Statis dulu sebagai contoh fitur Promo) */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-yellow-300" />
              <span className="font-bold uppercase tracking-wider text-xs">Promo Aktif</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">Kejar Target Lebaran!</h3>
            <p className="text-purple-100 text-sm">Dapatkan bonus insentif 5% jika tembus omzet 50 Juta bulan ini.</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs opacity-75">Berakhir pada</p>
            <p className="font-bold">30 Jan 2026</p>
          </div>
        </div>
      </div>

      {/* Grid Target */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <p className="text-gray-400">Memuat data target...</p>
        ) : targets.length === 0 ? (
          <p className="text-gray-400">Belum ada target yang diset oleh Admin.</p>
        ) : (
          targets.map((t) => {
            const current = achievements[t.id] || 0
            const progress = calculateProgress(current, t.target_value)
            
            return (
              <div key={t.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">{t.title}</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">
                      {t.period} • {t.type}
                    </span>
                  </div>
                  <div className={`p-2 rounded-full ${progress >= 100 ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {progress >= 100 ? <Award size={24} /> : <Target size={24} />}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-2 flex justify-between text-sm font-medium">
                  <span className="text-gray-600">
                    Tercapai: {t.type === 'revenue' ? `Rp ${current.toLocaleString()}` : current}
                  </span>
                  <span className="text-gray-400">
                    Target: {t.type === 'revenue' ? `Rp ${parseInt(t.target_value).toLocaleString()}` : parseInt(t.target_value)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs font-bold mt-2 text-blue-600">
                  {progress.toFixed(1)}%
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}