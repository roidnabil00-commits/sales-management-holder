// app/dashboard/targets/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Target, TrendingUp, Calendar, Award, Settings, Plus, Trash2, X } from 'lucide-react'

export default function TargetsPage() {
  const [targets, setTargets] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any>({})
  const [loading, setLoading] = useState(true)

  // State Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [newTarget, setNewTarget] = useState({
    title: '',
    type: 'revenue', // revenue / visit_count
    period: 'monthly',
    target_value: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0] // Akhir bulan
  })

  useEffect(() => {
    fetchTargetsAndData()
  }, [])

  const fetchTargetsAndData = async () => {
    setLoading(true)
    
    // 1. Ambil List Target
    const { data: targetList } = await supabase
      .from('targets')
      .select('*')
      .order('end_date', { ascending: false }) // Yang terbaru diatas

    if (!targetList) {
      setLoading(false); return;
    }

    // 2. Hitung Pencapaian (Real-time Calculation)
    const newAchievements: any = {}
    
    // Ambil data bulan ini untuk hitungan cepat
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    
    // Hitung Revenue Bulan Ini
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount')
      .neq('status', 'cancelled')
      .gte('created_at', firstDay)
    const currentRevenue = orders?.reduce((sum, o) => sum + o.total_amount, 0) || 0

    // Hitung Visit Bulan Ini
    const { count: visitCount } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('check_in_time', firstDay)

    // Mapping Data
    targetList.forEach(t => {
      if (t.type === 'revenue') {
        newAchievements[t.id] = currentRevenue
      } else if (t.type === 'visit_count') {
        newAchievements[t.id] = visitCount || 0
      } else {
        newAchievements[t.id] = 0
      }
    })

    setTargets(targetList)
    setAchievements(newAchievements)
    setLoading(false)
  }

  // --- LOGIC TAMBAH TARGET ---
  const handleSaveTarget = async () => {
    if (!newTarget.title || newTarget.target_value <= 0) {
      alert('Judul dan Nilai Target wajib diisi!')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase.from('targets').insert([{
        sales_id: user?.id,
        title: newTarget.title,
        type: newTarget.type,
        period: newTarget.period,
        target_value: newTarget.target_value,
        start_date: newTarget.start_date,
        end_date: newTarget.end_date
      }])

      if (error) throw error

      alert('Target berhasil dibuat!')
      setIsSettingsOpen(false)
      fetchTargetsAndData()
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    }
  }

  // --- LOGIC HAPUS TARGET ---
  const handleDeleteTarget = async (id: number) => {
    if(!confirm('Hapus target ini?')) return
    await supabase.from('targets').delete().eq('id', id)
    fetchTargetsAndData()
  }

  const calculateProgress = (current: number, target: number) => {
    const percent = (current / target) * 100
    return Math.min(percent, 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Target & Performa</h2>
          <p className="text-sm text-gray-500">Monitor KPI (Key Performance Indicator)</p>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 font-medium"
        >
          <Settings size={18} /> Atur Target
        </button>
      </div>

      {/* Info Promo / Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-yellow-300" />
              <span className="font-bold uppercase tracking-wider text-xs">KPI Tracker</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">Kejar Target Bulan Ini!</h3>
            <p className="text-purple-100 text-sm">Pantau terus progress penjualan dan kunjungan Anda.</p>
          </div>
        </div>
      </div>

      {/* Grid Target */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <p className="text-gray-400">Memuat data target...</p>
        ) : targets.length === 0 ? (
          <div className="col-span-2 text-center py-10 border border-dashed rounded-xl">
            <p className="text-gray-400">Belum ada target yang diset.</p>
            <button onClick={() => setIsSettingsOpen(true)} className="text-blue-600 font-bold text-sm mt-2">Buat Target Sekarang</button>
          </div>
        ) : (
          targets.map((t) => {
            const current = achievements[t.id] || 0
            const progress = calculateProgress(current, t.target_value)
            
            return (
              <div key={t.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative group">
                {/* Info Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">{t.title}</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">
                      {t.period} • {t.type === 'revenue' ? 'Omzet' : 'Kunjungan'}
                    </span>
                  </div>
                  <div className={`p-2 rounded-full ${progress >= 100 ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {progress >= 100 ? <Award size={24} /> : <Target size={24} />}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-2 flex justify-between text-sm font-medium">
                  <span className="text-gray-700 font-bold">
                    {t.type === 'revenue' ? `Rp ${current.toLocaleString()}` : `${current} Kunjungan`}
                  </span>
                  <span className="text-gray-400">
                    / {t.type === 'revenue' ? `Rp ${parseInt(t.target_value).toLocaleString()}` : t.target_value}
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

                {/* Tombol Hapus (Muncul saat hover di Desktop, atau selalu di Mobile) */}
                <button 
                  onClick={() => handleDeleteTarget(t.id)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  title="Hapus Target"
                >
                  <Trash2 size={18}/>
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* MODAL SETTINGS */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Pengaturan Target</h3>
              <button onClick={() => setIsSettingsOpen(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1">Judul Target</label>
                <input type="text" className="w-full border rounded p-2 text-gray-900" placeholder="Contoh: Omzet Lebaran"
                  value={newTarget.title} onChange={e => setNewTarget({...newTarget, title: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1">Tipe</label>
                  <select className="w-full border rounded p-2 text-gray-900 bg-white"
                    value={newTarget.type} onChange={e => setNewTarget({...newTarget, type: e.target.value})}>
                    <option value="revenue">Revenue (Omzet)</option>
                    <option value="visit_count">Jumlah Kunjungan</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1">Nilai Target</label>
                  <input type="number" className="w-full border rounded p-2 text-gray-900 font-bold" placeholder="0"
                    value={newTarget.target_value} onChange={e => setNewTarget({...newTarget, target_value: parseInt(e.target.value)})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1">Mulai</label>
                  <input type="date" className="w-full border rounded p-2 text-gray-900"
                    value={newTarget.start_date} onChange={e => setNewTarget({...newTarget, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1">Selesai</label>
                  <input type="date" className="w-full border rounded p-2 text-gray-900"
                    value={newTarget.end_date} onChange={e => setNewTarget({...newTarget, end_date: e.target.value})} />
                </div>
              </div>

              <button onClick={handleSaveTarget} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 mt-4 flex justify-center items-center gap-2">
                <Plus size={18}/> SIMPAN TARGET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}