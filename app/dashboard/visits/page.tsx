'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { MapPin, Camera, Clock, Navigation, CheckCircle, Plus, RefreshCw, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner' 

// Tipe data
type Visit = {
  id: number
  // Kita buat fleksibel: bisa object, bisa array, bisa null
  customer: { name: string } | { name: string }[] | null 
  check_in_time: string
  photo_url: string | null
  status: string
  notes: string | null
}

type Customer = {
  id: number
  name: string
  address: string
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  // State Form Kunjungan
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null)
  const [locationStatus, setLocationStatus] = useState('Menunggu GPS...')
  const [photo, setPhoto] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  useEffect(() => {
    fetchVisits()
    fetchCustomers()
  }, [])

  const fetchVisits = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const { data, error } = await supabase
      .from('visits')
      .select(`
        id,
        check_in_time,
        status,
        notes,
        photo_url,
        customer:customers(name) 
      `)
      .gte('check_in_time', today)
      .order('check_in_time', { ascending: false })

    if (error) {
      console.error('Error fetching visits:', error)
      toast.error('Gagal memuat data kunjungan.')
    } else {
      // --- PERBAIKAN DI SINI ---
      // Kita cast ke 'any' agar TypeScript tidak protes soal tipe data customer
      setVisits((data as any) || [])
    }
    setLoading(false)
  }

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name, address')
    if (data) setCustomers(data)
  }

  // --- HELPER UNTUK AMBIL NAMA CUSTOMER DENGAN AMAN ---
  const getCustomerName = (customer: Visit['customer']) => {
    if (!customer) return 'Customer Terhapus'
    if (Array.isArray(customer)) {
      // Jika dikembalikan sebagai array, ambil item pertama
      return customer[0]?.name || 'Tanpa Nama'
    }
    // Jika object
    return (customer as { name: string }).name
  }

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Browser tidak support GPS.')
      return
    }

    setLocationStatus('Sedang mencari titik akurat...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setLocationStatus(`Terkunci: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`)
        toast.success('Lokasi berhasil dikunci!')
      },
      (error) => {
        let errMsg = 'Gagal ambil lokasi.'
        if(error.code === 1) errMsg = 'Izin GPS ditolak. Mohon aktifkan.'
        else if(error.code === 2) errMsg = 'Sinyal GPS lemah/tidak tersedia.'
        else if(error.code === 3) errMsg = 'Waktu habis mencari GPS.'
        
        setLocationStatus(errMsg)
        toast.error(errMsg)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  }

  const uploadPhotoToStorage = async (file: File): Promise<string | null> => {
    try {
      setUploadProgress('Mengupload foto...')
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('visits')
        .upload(filePath, file)

      if (uploadError) {
        if(uploadError.message.includes("Bucket not found")) {
            throw new Error("Bucket 'visits' belum dibuat di Supabase Storage.")
        }
        throw uploadError
      }

      const { data } = supabase.storage.from('visits').getPublicUrl(filePath)
      return data.publicUrl

    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error('Gagal upload foto: ' + error.message)
      return null
    } finally {
      setUploadProgress('')
    }
  }

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!selectedCustomerId) {
      toast.warning('Pilih Toko/Mitra dulu!')
      setIsSubmitting(false)
      return
    }
    if (!currentLocation) {
      toast.warning('Lokasi GPS belum terkunci. Klik tombol GPS atau refresh.')
      setIsSubmitting(false)
      return
    }

    let finalPhotoUrl = null
    if (photo) {
      finalPhotoUrl = await uploadPhotoToStorage(photo)
      if (!finalPhotoUrl && photo) {
         setIsSubmitting(false)
         return 
      }
    }

    const { error } = await supabase.from('visits').insert([
      {
        customer_id: parseInt(selectedCustomerId),
        latitude_check: currentLocation.lat,
        longitude_check: currentLocation.lng,
        check_in_time: new Date().toISOString(),
        notes: notes,
        status: 'completed',
        photo_url: finalPhotoUrl
      }
    ])

    if (error) {
      toast.error('Gagal menyimpan data: ' + error.message)
    } else {
      toast.success('Kunjungan berhasil dicatat!')
      setIsFormOpen(false)
      setNotes('')
      setPhoto(null)
      setCurrentLocation(null)
      setLocationStatus('Menunggu GPS...')
      fetchVisits()
    }
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Kunjungan (Visit)</h2>
          <p className="text-sm text-gray-500">Log aktivitas sales lapangan</p>
        </div>
        <div className="flex gap-2">
            <button 
            onClick={fetchVisits}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
            title="Refresh Data"
            >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
            onClick={() => { setIsFormOpen(true); getLocation(); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition font-bold"
            >
            <Plus size={18} /> Check-In
            </button>
        </div>
      </div>

      {/* --- FORM MODAL CHECK-IN --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end md:items-center justify-center z-50 p-0 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl md:rounded-xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-10 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center mb-4 border-b pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <MapPin className="text-blue-600" /> Form Kunjungan
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500 font-bold">Tutup</button>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-5 overflow-y-auto p-1">
              
              {/* 1. Pilih Toko */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Warung / Mitra <span className="text-red-500">*</span></label>
                <select 
                  className="w-full border border-gray-300 rounded-xl p-3 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                >
                  <option value="">-- Cari Lokasi --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
                  ))}
                </select>
              </div>

              {/* 2. Status GPS */}
              <div className={`p-4 rounded-xl border flex items-center gap-3 transition ${currentLocation ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <Navigation className={currentLocation ? "text-green-600" : "text-red-500 animate-pulse"} size={24} />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold uppercase opacity-70">Koordinat GPS</p>
                    <button type="button" onClick={getLocation} className="text-xs text-blue-600 underline font-bold">Refresh GPS</button>
                  </div>
                  <p className="text-sm font-bold text-gray-800 leading-tight mt-1">{locationStatus}</p>
                </div>
              </div>

              {/* 3. Upload Foto */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Foto Bukti (Wajib) <span className="text-red-500">*</span></label>
                <div className="relative group">
                    <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center pointer-events-none group-hover:bg-blue-100 transition">
                        <Camera className="text-blue-400 mb-1" size={24} />
                        <span className="text-xs text-blue-500 font-medium">{photo ? 'Ganti Foto' : 'Ambil Foto'}</span>
                    </div>
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        required 
                        className="w-full h-24 opacity-0 cursor-pointer"
                        onChange={(e) => setPhoto(e.target.files ? e.target.files[0] : null)}
                    />
                </div>
                {photo && (
                    <p className="text-xs text-green-600 mt-2 font-bold flex items-center gap-1">
                        <CheckCircle size={12}/> {photo.name}
                    </p>
                )}
              </div>

              {/* 4. Catatan */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Catatan Lapangan</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-xl p-3 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                  placeholder="Kondisi stok, komplain, atau request barang..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Tombol Submit */}
              <button 
                type="submit" 
                disabled={isSubmitting || !currentLocation}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95 flex justify-center items-center gap-2"
              >
                {isSubmitting ? (
                    <span className="flex items-center gap-2">
                        <RefreshCw className="animate-spin" size={20}/> {uploadProgress || 'Menyimpan...'}
                    </span>
                ) : (
                    'CHECK IN SEKARANG'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TIMELINE KUNJUNGAN --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
            <Clock className="text-blue-600" /> Aktivitas Hari Ini
            </h3>
            <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{visits.length} Visit</span>
        </div>
        
        <div className="space-y-0 relative border-l-2 border-gray-100 ml-3">
          {loading ? (
             <div className="p-8 text-center"><RefreshCw className="animate-spin mx-auto text-gray-400"/></div>
          ) : visits.length === 0 ? (
             <div className="ml-8 text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
               <MapPin className="mx-auto mb-2 opacity-20" size={32} />
               <p className="font-medium">Belum ada kunjungan hari ini.</p>
               <p className="text-xs mt-1">Ayo mulai keliling!</p>
             </div>
          ) : (
            visits.map((visit) => (
              <div key={visit.id} className="mb-8 ml-6 relative group">
                <div className="absolute -left-[31px] top-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white shadow-sm group-hover:scale-110 transition"></div>
                
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition hover:border-blue-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        {/* Panggil Helper Function di sini */}
                        <h4 className="font-bold text-gray-900 text-base">{getCustomerName(visit.customer)}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Clock size={12}/> {new Date(visit.check_in_time).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} WIB
                        </p>
                      </div>
                      {visit.photo_url && (
                          <a href={visit.photo_url} target="_blank" rel="noopener noreferrer" className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition" title="Lihat Foto">
                              <ImageIcon size={18}/>
                          </a>
                      )}
                    </div>
                    
                    {visit.notes ? (
                      <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 italic border border-gray-100">
                        "{visit.notes}"
                      </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">Tidak ada catatan.</p>
                    )}

                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-green-700 bg-green-50 w-fit px-2 py-1 rounded border border-green-100">
                      <CheckCircle size={12} /> Kunjungan Selesai
                    </div>
                  </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}