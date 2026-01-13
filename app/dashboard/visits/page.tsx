// app/dashboard/visits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { MapPin, Camera, Clock, Navigation, CheckCircle, Plus } from 'lucide-react'

// Tipe data
type Visit = {
  id: number
  customer: { name: string } // Relasi ke tabel customers
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

  // 1. Load Data (History Kunjungan & List Customer)
  useEffect(() => {
    fetchVisits()
    fetchCustomers()
    getLocation() // Langsung cari lokasi saat halaman dibuka
  }, [])

  const fetchVisits = async () => {
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
      .gte('check_in_time', today) // Hanya tampilkan kunjungan HARI INI
      .order('check_in_time', { ascending: false })

    if (error) console.error('Error fetching visits:', error)
    else setVisits(data || [])
    setLoading(false)
  }

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name, address')
    if (data) setCustomers(data)
  }

  // 2. Fungsi Get Location (GPS)
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS tidak didukung di browser ini.')
      return
    }

    setLocationStatus('Mencari lokasi...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setLocationStatus('Lokasi terkunci akurat ✅')
      },
      (error) => {
        setLocationStatus('Gagal ambil lokasi. Pastikan GPS aktif!')
        console.error(error)
      }
    )
  }

  // 3. Fungsi Submit Check-In
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!selectedCustomerId || !currentLocation) {
      alert('Pilih warung dan pastikan GPS sudah terkunci!')
      setIsSubmitting(false)
      return
    }

    // A. Upload Foto dulu (kalau ada)
    let photoUrl = null
    if (photo) {
      const fileName = `visit-${Date.now()}.jpg`
      // Catatan: Pastikan kamu sudah buat Bucket 'visits' di Storage Supabase
      // Untuk MVP ini kita simpan nama filenya saja dulu kalau bucket belum siap
      photoUrl = fileName 
    }

    // B. Simpan Data Kunjungan ke Database
    const { error } = await supabase.from('visits').insert([
      {
        customer_id: parseInt(selectedCustomerId),
        latitude_check: currentLocation.lat,
        longitude_check: currentLocation.lng,
        check_in_time: new Date().toISOString(),
        notes: notes,
        status: 'completed', // Langsung completed untuk versi simpel
        photo_url: photoUrl
      }
    ])

    if (error) {
      alert('Gagal Check-in: ' + error.message)
    } else {
      alert('Berhasil Check-in! Selamat bekerja.')
      setIsFormOpen(false)
      setNotes('')
      setPhoto(null)
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
          <p className="text-sm text-gray-500">Log aktivitas lapangan hari ini</p>
        </div>
        <button 
          onClick={() => { setIsFormOpen(true); getLocation(); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
        >
          <Plus size={18} /> Visit Baru
        </button>
      </div>

      {/* --- FORM MODAL CHECK-IN --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-10">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="text-blue-600" /> Check-In Toko
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">Tutup</button>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-5">
              
              {/* 1. Pilih Toko */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Pilih Warung / Mitra</label>
                <select 
                  className="w-full border rounded-xl p-3 bg-gray-50 text-black text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Lokasi --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
                  ))}
                </select>
              </div>

              {/* 2. Status GPS */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                <Navigation className={`text-blue-600 ${locationStatus.includes('Mencari') ? 'animate-pulse' : ''}`} />
                <div>
                  <p className="text-xs text-blue-500 font-bold uppercase">Lokasi Anda</p>
                  <p className="text-sm text-blue-800 font-medium">{locationStatus}</p>
                </div>
              </div>

              {/* 3. Upload Foto */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Foto Bukti (Selfie/Toko)</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" // Ini trigger kamera belakang di HP
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    onChange={(e) => setPhoto(e.target.files ? e.target.files[0] : null)}
                  />
                  <Camera className="absolute right-3 top-2 text-gray-400 pointer-events-none" size={20} />
                </div>
              </div>

              {/* 4. Catatan */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Catatan Kunjungan</label>
                <textarea 
                  className="w-full border rounded-xl p-3 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                  placeholder="Contoh: Stok roti tawar habis, minta dikirim besok."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Tombol Submit */}
              <button 
                type="submit" 
                disabled={isSubmitting || !currentLocation}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95"
              >
                {isSubmitting ? 'Menyimpan...' : 'CHECK IN SEKARANG'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TIMELINE KUNJUNGAN HARI INI --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-gray-400" /> Riwayat Hari Ini
        </h3>
        
        <div className="space-y-6">
          {loading ? (
             <p className="text-center text-gray-400">Loading...</p>
          ) : visits.length === 0 ? (
             <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
               <MapPin className="mx-auto mb-2 opacity-20" size={32} />
               <p>Belum ada kunjungan hari ini.</p>
               <p className="text-xs mt-1">Klik tombol "Visit Baru" untuk mulai.</p>
             </div>
          ) : (
            visits.map((visit) => (
              <div key={visit.id} className="flex gap-4 relative">
                {/* Garis Timeline */}
                <div className="w-10 flex flex-col items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full z-10 ring-4 ring-white"></div>
                  <div className="w-0.5 bg-gray-100 h-full absolute top-3"></div>
                </div>
                
                {/* Content Card */}
                <div className="flex-1 pb-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-gray-800">{visit.customer?.name}</h4>
                      <span className="text-xs font-mono text-gray-500 bg-white px-2 py-1 rounded border">
                        {new Date(visit.check_in_time).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    {visit.notes && (
                      <p className="text-sm text-gray-600 mt-2 italic">"{visit.notes}"</p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-600 font-medium">
                      <CheckCircle size={14} /> Selesai Dikunjungi
                    </div>
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