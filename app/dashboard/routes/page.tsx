'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Calendar, MapPin, Search, FileText, 
  ExternalLink, Image as ImageIcon, X, Loader2, 
  ChevronRight, ChevronLeft
} from 'lucide-react'
import { toast } from 'sonner' 

// Tipe Data
type VisitLog = {
  id: string
  visit_time: string
  sales_email: string
  customer_name: string
  customer_address: string
  customer_district: string
  location_lat: number
  location_long: number
  notes: string | null
  photo_url: string | null
}

export default function SupervisionPage() {
  const supabase = createClient()
  
  // State Data
  const [logs, setLogs] = useState<VisitLog[]>([])
  const [loading, setLoading] = useState(true)
  
  // State Filter & Search
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [searchTerm, setSearchTerm] = useState('')
  
  // State Pagination (BARU)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10 
  
  // State Modal Detail
  const [selectedLog, setSelectedLog] = useState<VisitLog | null>(null)

  // 1. Fetch Data
  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter])

  // Reset halaman ke 1 setiap kali user mengetik pencarian
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const startOfDay = `${dateFilter}T00:00:00`
      const endOfDay = `${dateFilter}T23:59:59`

      const { data, error } = await supabase
        .from('view_visit_logs') 
        .select('*')
        .gte('visit_time', startOfDay)
        .lte('visit_time', endOfDay)
        .order('visit_time', { ascending: false })

      if (error) throw error
      if (data) setLogs(data)

    } catch (err: any) {
      toast.error("Gagal memuat laporan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 2. Filter Logic
  const filteredLogs = logs.filter(log => 
    log.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.sales_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.customer_district && log.customer_district.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // 3. Pagination Logic (BARU)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)

  // Helper Pagination Buttons
  const getPageNumbers = () => {
    const pages = []
    // Tampilkan maksimal 5 tombol halaman agar tidak kepanjangan
    let startPage = Math.max(1, currentPage - 2)
    let endPage = Math.min(totalPages, startPage + 4)
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  // Helper Formatter
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit'
    }) + ' WIB'
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* HEADER & CONTROLS */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Laporan Kunjungan</h1>
              <p className="text-sm font-medium text-slate-500">Rekapitulasi aktivitas sales & validasi lapangan.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                {/* Date Picker */}
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
                    <Calendar size={16} className="text-slate-500"/>
                    <input 
                      type="date" 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input 
                      type="text" 
                      placeholder="Cari Sales / Toko..." 
                      className="pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition w-full sm:w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        {loading ? (
           <div className="flex flex-col items-center justify-center py-24 text-slate-400">
             <Loader2 size={40} className="animate-spin mb-4 text-blue-600"/>
             <span className="text-sm font-bold">Sinkronisasi Data...</span>
           </div>
        ) : filteredLogs.length === 0 ? (
           <div className="text-center py-24 bg-white rounded-xl border border-slate-200 border-dashed">
             <div className="bg-slate-50 p-4 rounded-full inline-block mb-3">
                <FileText size={32} className="text-slate-400"/>
             </div>
             <h3 className="text-slate-700 font-bold mb-1">Data Kosong</h3>
             <p className="text-slate-500 text-sm">Tidak ada laporan kunjungan yang sesuai filter.</p>
           </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            {/* Tabel */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold tracking-wider">
                    <th className="px-6 py-4">Waktu</th>
                    <th className="px-6 py-4">Petugas Sales</th>
                    <th className="px-6 py-4">Nama Toko & Area</th>
                    <th className="px-6 py-4 text-center">Bukti</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentLogs.map((log) => ( // MENGGUNAKAN currentLogs (Sliced)
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      {/* Waktu */}
                      <td className="px-6 py-4 whitespace-nowrap w-[150px]">
                        <span className="text-sm font-bold text-slate-700 font-mono bg-slate-100 px-2 py-1 rounded">
                            {formatTime(log.visit_time)}
                        </span>
                      </td>

                      {/* Sales */}
                      <td className="px-6 py-4 whitespace-nowrap w-[250px]">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                {log.sales_email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">{log.sales_email.split('@')[0]}</p>
                                <p className="text-[10px] font-medium text-slate-400 uppercase">Sales Executive</p>
                            </div>
                         </div>
                      </td>

                      {/* Toko */}
                      <td className="px-6 py-4">
                         <p className="text-sm font-bold text-slate-800 line-clamp-1">{log.customer_name}</p>
                         <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <MapPin size={12} className="shrink-0"/>
                            <span className="truncate max-w-[250px]">{log.customer_address}</span>
                            {log.customer_district && (
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold text-[10px] shrink-0">
                                    {log.customer_district}
                                </span>
                            )}
                         </div>
                      </td>

                      {/* Indikator Bukti */}
                      <td className="px-6 py-4 text-center w-[100px]">
                         <div className="flex items-center justify-center gap-2">
                            {log.photo_url ? (
                                <span className="text-green-600 bg-green-50 p-1.5 rounded-md" title="Foto Tersedia">
                                    <ImageIcon size={16}/>
                                </span>
                            ) : (
                                <span className="text-slate-300 bg-slate-50 p-1.5 rounded-md">
                                    <ImageIcon size={16}/>
                                </span>
                            )}
                            {log.location_lat ? (
                                <span className="text-blue-600 bg-blue-50 p-1.5 rounded-md" title="GPS Terkunci">
                                    <MapPin size={16}/>
                                </span>
                            ) : (
                                <span className="text-slate-300 bg-slate-50 p-1.5 rounded-md">
                                    <MapPin size={16}/>
                                </span>
                            )}
                         </div>
                      </td>

                      {/* Tombol Aksi */}
                      <td className="px-6 py-4 text-right w-[80px]">
                         <button className="text-slate-400 hover:text-blue-600 hover:bg-blue-100 p-2 rounded-full transition">
                            <ChevronRight size={20}/>
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* --- PAGINATION CONTROLS (FOOTER) --- */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                
                {/* Info Text */}
                <span className="text-xs font-bold text-slate-500">
                    Menampilkan {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredLogs.length)} dari {filteredLogs.length} data
                </span>

                {/* Tombol Angka */}
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 transition"
                        >
                            <ChevronLeft size={16}/>
                        </button>

                        {getPageNumbers().map(number => (
                            <button
                                key={number}
                                onClick={() => setCurrentPage(number)}
                                className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-bold transition ${
                                    currentPage === number
                                    ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                                }`}
                            >
                                {number}
                            </button>
                        ))}

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 transition"
                        >
                            <ChevronRight size={16}/>
                        </button>
                    </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL POP-UP DETAIL --- */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                
                {/* KOLOM KIRI: FOTO (Dominan) */}
                <div className="w-full md:w-1/2 bg-black flex items-center justify-center relative min-h-[300px] group bg-pattern">
                    {selectedLog.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                            src={selectedLog.photo_url} 
                            alt="Bukti Kunjungan" 
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="text-slate-500 flex flex-col items-center">
                            <ImageIcon size={48} className="opacity-50 mb-2"/>
                            <span className="text-sm font-medium">Tidak ada foto bukti</span>
                        </div>
                    )}
                    
                    {/* Overlay Info Foto */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                        <p className="text-xs font-bold opacity-80 uppercase tracking-wider">Waktu Upload</p>
                        <p className="font-mono text-sm">{new Date(selectedLog.visit_time).toLocaleString('id-ID')}</p>
                    </div>
                </div>

                {/* KOLOM KANAN: INFO DETAIL */}
                <div className="w-full md:w-1/2 flex flex-col bg-white">
                    
                    {/* Header Modal */}
                    <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start">
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Detail Kunjungan</h2>
                            <p className="text-xs text-slate-500 font-bold">ID: {selectedLog.id.slice(0,8)}...</p>
                        </div>
                        <button 
                            onClick={() => setSelectedLog(null)}
                            className="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 p-2 rounded-full transition"
                        >
                            <X size={20}/>
                        </button>
                    </div>

                    {/* Content Info */}
                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        
                        {/* Info Sales */}
                        <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                                {selectedLog.sales_email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-blue-600 uppercase mb-0.5">Dilaporkan Oleh</p>
                                <p className="font-bold text-slate-900">{selectedLog.sales_email}</p>
                            </div>
                        </div>

                        {/* Info Toko */}
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase mb-3 flex items-center gap-2">
                                <FileText size={16}/> Informasi Toko
                            </h3>
                            <div className="pl-2 border-l-2 border-slate-200 space-y-2">
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Nama Toko</p>
                                    <p className="text-sm font-bold text-slate-800">{selectedLog.customer_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium">Alamat</p>
                                    <p className="text-sm text-slate-700">{selectedLog.customer_address}</p>
                                </div>
                            </div>
                        </div>

                        {/* Catatan */}
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase mb-2">Catatan Lapangan</h3>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 italic">
                                "{selectedLog.notes || 'Tidak ada catatan tambahan.'}"
                            </div>
                        </div>

                    </div>

                    {/* Footer / Actions */}
                    <div className="p-6 border-t border-slate-100 bg-slate-50">
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedLog.location_lat},${selectedLog.location_long}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600 py-3 rounded-xl font-bold transition shadow-sm"
                        >
                            <ExternalLink size={18}/> Buka Lokasi GPS (Google Maps)
                        </a>
                    </div>
                </div>

            </div>
        </div>
      )}

    </div>
  )
}