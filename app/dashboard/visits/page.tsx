'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Clock, Search, CheckCircle, AlertCircle, 
  ChevronRight, Camera, X, MapPin, UploadCloud, Loader2, RefreshCw, 
  Image as ImageIcon
} from 'lucide-react'
import { toast } from 'sonner' 

// Definisi Tipe Data
type Customer = {
  id: number
  name: string
  address: string
  district?: string
  visit_frequency_days: number
  last_visit_at: string | null
}

export default function VisitsPage() {
  const supabase = createClient()
  
  // State Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // State Form & Upload
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null)
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Fetch Data
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('last_visit_at', { ascending: true, nullsFirst: true })
      
      if (error) throw error
      if (data) setCustomers(data)
    } catch (err: any) {
      toast.error("Gagal memuat data pelanggan")
    } finally {
      setLoading(false)
    }
  }

  // 2. Logic Prioritas (Business Logic)
  const getSortedCustomers = () => {
    const today = new Date().getTime()

    return customers.map(cust => {
      let status = 'regular'
      let daysDiff = 0
      
      if (!cust.last_visit_at) {
        status = 'priority' // Belum pernah dikunjungi
        daysDiff = 999 
      } else {
        const lastVisit = new Date(cust.last_visit_at).getTime()
        const diffTime = Math.abs(today - lastVisit)
        daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) 
        
        if (daysDiff >= cust.visit_frequency_days) {
          status = 'priority'
        }
      }

      return { ...cust, status, daysSince: daysDiff }
    }).sort((a, b) => {
        // Prioritas Tinggi selalu di atas
        if (a.status === 'priority' && b.status !== 'priority') return -1
        if (a.status !== 'priority' && b.status === 'priority') return 1
        return b.daysSince - a.daysSince
    })
  }

  const filteredCustomers = getSortedCustomers().filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 3. Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Ukuran file maksimal 5MB")
            return
        }
        setPhotoFile(file)
        setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const resetForm = () => {
      setActiveCustomer(null)
      setNotes('')
      setPhotoFile(null)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
      setIsSubmitting(false)
  }

  // --- 4. CORE FIX: HANDLE CHECK-IN ---
  const handleCheckIn = async () => {
    if (!activeCustomer) return
    if (!photoFile) {
        toast.warning("Wajib upload foto bukti kunjungan!")
        return
    }

    setIsSubmitting(true)
    // Tampilkan loading toast yang tidak akan hilang sampai selesai atau error
    const toastId = toast.loading("Mengunggah foto & data...")

    try {
      // A. Cek GPS
      if (!navigator.geolocation) throw new Error("GPS tidak aktif/didukung browser ini.")
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude, longitude } = pos.coords
            
            // B. Cek User Session
            const { data: { user } } = await supabase.auth.getUser()
            if(!user) throw new Error("Sesi login berakhir. Silakan login ulang.")

            // C. UPLOAD FOTO (Bagian yang sering error)
            const fileExt = photoFile.name.split('.').pop()
            // Nama file: user_id/timestamp.ext
            const fileName = `${user.id}/${Date.now()}.${fileExt}`
            
            // C.1 Proses Upload
            const { error: uploadError } = await supabase.storage
                .from('visit-photos') // Pastikan nama bucket ini 'visit-photos' (persis)
                .upload(fileName, photoFile)
            
            if (uploadError) {
                console.error("Storage Error:", uploadError)
                throw new Error("Gagal Upload Foto: " + uploadError.message)
            }

            // C.2 Ambil URL
            const { data: urlData } = supabase.storage
                .from('visit-photos')
                .getPublicUrl(fileName)

            if (!urlData.publicUrl) throw new Error("Gagal mendapatkan URL foto.")

            // D. INSERT DATABASE LOG
            const { error: logError } = await supabase.from('visit_logs').insert({
              sales_id: user.id,
              customer_id: activeCustomer.id,
              check_in_time: new Date().toISOString(),
              location_lat: latitude,
              location_long: longitude,
              notes: notes || null,
              photo_url: urlData.publicUrl
            })
            
            if (logError) throw new Error("Gagal Simpan Log: " + logError.message)

            // E. UPDATE CUSTOMER TIMER
            const { error: updateError } = await supabase
              .from('customers')
              .update({ last_visit_at: new Date().toISOString() })
              .eq('id', activeCustomer.id)
            
            if (updateError) throw new Error("Gagal Update Status Toko: " + updateError.message)

            // SUKSES
            toast.dismiss(toastId)
            toast.success("Kunjungan Berhasil Disimpan!")
            resetForm()
            fetchData()

        } catch (innerErr: any) {
            toast.dismiss(toastId)
            toast.error(innerErr.message)
            setIsSubmitting(false)
        }
        
      }, (gpsErr) => {
          toast.dismiss(toastId)
          toast.error("Gagal GPS: " + gpsErr.message + ". Pastikan Izin Lokasi Aktif.")
          setIsSubmitting(false)
      }, {enableHighAccuracy: true, timeout: 20000})

    } catch (err: any) {
      toast.dismiss(toastId)
      toast.error(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-black text-blue-900">Manajemen Kunjungan</h1>
              <p className="text-sm font-medium text-slate-500">Daftar prioritas & validasi lapangan</p>
            </div>
            <button 
              onClick={fetchData} 
              className="self-start md:self-center flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-bold transition"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh Data
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input 
              type="text" 
              placeholder="Cari nama toko atau alamat..." 
              className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-inner"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        
        {loading ? (
           <div className="flex flex-col items-center justify-center py-20 text-slate-400">
             <Loader2 size={40} className="animate-spin mb-3 text-blue-600"/>
             <span className="text-sm font-bold text-slate-500">Memuat Data Kunjungan...</span>
           </div>
        ) : filteredCustomers.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-xl border-2 border-slate-200 border-dashed">
             <p className="text-slate-500 font-bold">Tidak ada data ditemukan.</p>
           </div>
        ) : (
          // GRID LAYOUT
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCustomers.map((cust) => {
              const isPriority = cust.status === 'priority'
              
              return (
                <div 
                  key={cust.id} 
                  className={`group bg-white rounded-xl border-2 transition-all hover:shadow-lg ${
                    isPriority 
                    ? 'border-blue-600 shadow-blue-100' // PRIORITAS: Border Biru Tebal
                    : 'border-slate-200'               // REGULER: Border Abu
                  }`}
                >
                   <div className="p-5 flex flex-col h-full justify-between">
                     <div>
                       <div className="flex justify-between items-start mb-3">
                         {/* LABEL STATUS */}
                         <span className={`px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-wide border flex items-center gap-1 ${
                           isPriority 
                             ? 'bg-blue-600 text-white border-blue-600'  // PRIORITAS: Background Biru Solid
                             : 'bg-slate-100 text-slate-600 border-slate-200' // REGULER: Abu-abu
                         }`}>
                           {isPriority ? <AlertCircle size={12}/> : <CheckCircle size={12}/>}
                           {isPriority ? 'PRIORITAS UTAMA' : 'JADWAL REGULER'}
                         </span>
                         
                         {cust.district && (
                           <span className="text-xs text-slate-500 font-bold bg-slate-50 px-2 py-1 rounded">{cust.district}</span>
                         )}
                       </div>

                       <h3 className="text-lg font-black text-slate-800 mb-1 leading-snug">{cust.name}</h3>
                       <p className="text-sm font-medium text-slate-500 mb-4 line-clamp-2 flex items-start gap-1.5">
                         <MapPin size={14} className="shrink-0 mt-0.5 text-blue-500"/>
                         {cust.address}
                       </p>

                       <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <Clock size={14} className="text-blue-600" />
                          {cust.last_visit_at 
                            ? <span>Visit Terakhir: <span className="font-bold text-slate-900">{cust.daysSince} hari lalu</span></span>
                            : <span>Status: <span className="font-bold text-slate-900">Belum pernah dikunjungi</span></span>
                          }
                       </div>
                     </div>

                     {/* TOMBOL ACTION */}
                     <button 
                       onClick={() => setActiveCustomer(cust)}
                       className={`mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-transform active:scale-95 shadow-md ${
                          isPriority 
                          ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-200' // Tombol Biru Gelap
                          : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50' // Tombol Outline
                       }`}
                     >
                       <Camera size={18}/> {isPriority ? 'PROSES SEKARANG' : 'Visit Manual'}
                     </button>
                   </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL FORM VALIDASI */}
      {activeCustomer && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               
               {/* Modal Header */}
               <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Validasi Kunjungan</h2>
                    <p className="text-xs font-bold text-blue-600 truncate max-w-[200px]">{activeCustomer.name}</p>
                  </div>
                  <button onClick={resetForm} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-red-500 transition">
                    <X size={20}/>
                  </button>
               </div>

               {/* Modal Body */}
               <div className="p-6 overflow-y-auto space-y-6">
                  
                  {/* UPLOAD SECTION */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2 flex justify-between">
                        Foto Bukti Lapangan <span className="text-red-500 text-[10px] normal-case">*Wajib Diisi</span>
                    </label>
                    
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {!photoPreview ? (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition group"
                        >
                            <div className="p-3 bg-white text-blue-600 rounded-full mb-2 shadow-sm group-hover:scale-110 transition">
                                <ImageIcon size={28}/>
                            </div>
                            <span className="text-sm font-bold text-blue-800">Ambil Foto Toko</span>
                            <span className="text-xs text-blue-600/70 mt-1 font-medium">Kamera / Galeri</span>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 bg-black">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoPreview} alt="Preview" className="w-full h-48 object-contain"/>
                            <button 
                                onClick={() => {setPhotoFile(null); setPhotoPreview(null)}}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow hover:bg-red-700 transition"
                            >
                                <X size={16}/>
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1.5 text-center font-bold backdrop-blur-sm">
                                Foto Siap Diupload
                            </div>
                        </div>
                    )}
                  </div>

                  {/* NOTES SECTION */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                        Catatan Tambahan
                    </label>
                    <textarea 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
                      rows={3}
                      placeholder="Contoh: Stok habis, Owner minta diskon..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

               </div>

               {/* Modal Footer */}
               <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                  <button 
                    onClick={handleCheckIn}
                    disabled={isSubmitting || !photoFile}
                    className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={20} className="animate-spin"/> Sedang Upload...
                        </>
                    ) : (
                        <>
                            <UploadCloud size={20}/> SIMPAN KUNJUNGAN
                        </>
                    )}
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  )
}