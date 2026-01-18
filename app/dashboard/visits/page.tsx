'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  MapPin, QrCode, Navigation, CheckCircle, Plus, RefreshCw, 
  Save, Clock, Info, User, ChevronLeft, ChevronRight, Download, Camera, X
} from 'lucide-react'
import { toast } from 'sonner' 
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Html5QrcodeScanner } from 'html5-qrcode'

// --- TIPE DATA ---
type Visit = {
  id: number
  customer: { name: string; address: string } | { name: string; address: string }[] | null
  check_in_time: string
  status: string
  notes: string | null
  visitor_name: string | null
}

type Customer = {
  id: number
  name: string
  address: string
}

export default function VisitsPage() {
  // Main Data State
  const [visits, setVisits] = useState<Visit[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [visitorName, setVisitorName] = useState('') 
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [isBarcodeValid, setIsBarcodeValid] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null)
  const [locationStatus, setLocationStatus] = useState('Menunggu GPS...')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  // 1. INITIAL LOAD
  useEffect(() => {
    fetchVisits()
    fetchCustomers()
    getLocation()
  }, [])

  const fetchVisits = async () => {
    setLoading(true)
    
    // Logic 1 Minggu
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - 7)
    const dateLimitStr = dateLimit.toISOString().split('T')[0]

    const { data: visitData, error } = await supabase
      .from('visits')
      .select(`
        id, check_in_time, status, notes, visitor_name,
        customer:customers(name, address) 
      `)
      .gte('check_in_time', dateLimitStr)
      .order('check_in_time', { ascending: false })

    if (error) {
      console.error(error)
      toast.error('Gagal load visit.')
    } else {
      setVisits((visitData as any) || [])
    }
    
    setLoading(false)
  }

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name, address')
    if (data) setCustomers(data)
  }

  // Helper
  const getCustomerName = (customer: any) => {
    if (!customer) return '-'
    return Array.isArray(customer) ? customer[0]?.name : customer.name
  }
  
  const getCustomerAddress = (customer: any) => {
    if (!customer) return '-'
    return Array.isArray(customer) ? customer[0]?.address : customer.address
  }

  const formatJakartaTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }) + ' WIB'
  }

  // 2. LOGIC GPS
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Browser tidak support GPS.')
      return
    }
    setLocationStatus('Mencari titik...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus(`Terkunci: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
        toast.success('GPS Terkunci!')
      },
      (err) => {
        setLocationStatus('Gagal GPS: ' + err.message)
        toast.error('Aktifkan GPS Anda!')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // 3. LOGIC SCANNER
  useEffect(() => {
    if (isScannerOpen && !scannerRef.current) {
        // Inisialisasi Scanner saat modal dibuka
        const scanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );
        
        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
    }

    return () => {
        if (!isScannerOpen && scannerRef.current) {
            scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
            scannerRef.current = null;
        }
    };
  }, [isScannerOpen]);

  const onScanSuccess = (decodedText: string) => {
      setScannedBarcode(decodedText);
      handleValidateBarcode(decodedText); // Auto validate saat terscan
      setIsScannerOpen(false); // Tutup scanner
      toast.success("Barcode Terdeteksi: " + decodedText);
  };

  const onScanFailure = (error: any) => {
      // console.warn(`Code scan error = ${error}`);
  };

  const handleValidateBarcode = (codeToCheck?: string) => {
    const code = codeToCheck || scannedBarcode;

    if(!selectedCustomerId) {
      toast.warning("Pilih Toko dulu sebelum validasi!")
      return
    }
    
    // KONSEP: Barcode yang ditempel di tembok berisi ID Customer
    // Jadi hasil scan harus SAMA dengan ID Customer yang dipilih di dropdown
    if(code === selectedCustomerId) {
      setIsBarcodeValid(true)
      toast.success("VALID! Anda berada di lokasi yang benar.")
    } else {
      setIsBarcodeValid(false)
      toast.error(`INVALID! Barcode Toko tidak cocok. (Scan: ${code} vs Toko: ${selectedCustomerId})`) 
    }
  }

  // 4. SUBMIT FORM
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!visitorName || !selectedCustomerId || !currentLocation || !isBarcodeValid) {
      toast.warning('Data belum lengkap (Nama, Toko, GPS, atau Barcode).')
      setIsSubmitting(false)
      return
    }

    try {
      const { error: visitError } = await supabase.from('visits').insert([{
        customer_id: parseInt(selectedCustomerId),
        visitor_name: visitorName,
        latitude_check: currentLocation.lat,
        longitude_check: currentLocation.lng,
        check_in_time: new Date().toISOString(),
        notes: notes,
        status: 'completed',
        photo_url: null 
      }])
      
      if (visitError) throw visitError

      toast.success('Visit Valid & Tersimpan!')
      setIsFormOpen(false)
      resetForm()
      fetchVisits()

    } catch (err: any) {
      toast.error('Gagal Proses: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setNotes('')
    setScannedBarcode('')
    setIsBarcodeValid(false)
    setVisitorName('')
    setIsScannerOpen(false)
    if(scannerRef.current) {
        scannerRef.current.clear()
        scannerRef.current = null
    }
    getLocation()
  }

  // 5. EXPORT PDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text(`Laporan Kunjungan Sales (7 Hari Terakhir)`, 14, 20)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`Dicetak pada: ${formatJakartaTime(new Date().toISOString())}`, 14, 26)

    const tableRows = visits.map(v => [
      formatJakartaTime(v.check_in_time),
      v.visitor_name || '-',
      getCustomerName(v.customer),
      v.notes || '-'
    ])

    autoTable(doc, {
      startY: 35,
      head: [['Waktu (WIB)', 'Nama Sales', 'Toko', 'Catatan']],
      body: tableRows,
      theme: 'grid',
    })

    doc.save(`Laporan_Visit.pdf`)
  }

  // 6. PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentVisits = visits.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(visits.length / itemsPerPage)

  return (
    <div className="space-y-6">
      {/* Header Statis */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Kunjungan (Visit)</h2>
          <p className="text-sm text-gray-600 font-medium">Validasi Barcode, GPS & Log Aktivitas</p>
        </div>
        <div className="flex gap-2">
           <button onClick={fetchVisits} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"><RefreshCw size={20}/></button>
           <button onClick={handleDownloadPDF} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition" title="Download PDF"><Download size={20}/></button>
           <button 
             onClick={() => { setIsFormOpen(true); getLocation(); }}
             className="bg-gray-900 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-black shadow-lg font-bold transition"
           >
             <Plus size={18} /> Visit Baru
           </button>
        </div>
      </div>

      {/* --- TABEL DATA --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock size={16}/> Riwayat 7 Hari Terakhir</h3>
            <span className="text-xs font-bold bg-white border border-gray-300 px-2 py-0.5 rounded text-gray-600">{visits.length} Data</span>
         </div>
         
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-white text-gray-900 font-bold uppercase border-b border-gray-200 text-xs">
               <tr>
                 <th className="px-6 py-4">Waktu (WIB)</th>
                 <th className="px-6 py-4">Nama Sales</th>
                 <th className="px-6 py-4">Toko / Mitra</th>
                 <th className="px-6 py-4">Status</th>
                 <th className="px-6 py-4">Catatan</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {loading ? (
                   <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-medium">Memuat data...</td></tr>
                ) : currentVisits.length === 0 ? (
                   <tr><td colSpan={5} className="p-8 text-center text-gray-500 italic">Belum ada data kunjungan minggu ini.</td></tr>
                ) : (
                   currentVisits.map((v) => (
                      <tr key={v.id} className="hover:bg-blue-50 transition">
                         <td className="px-6 py-4 font-medium text-gray-900">
                            {formatJakartaTime(v.check_in_time)}
                         </td>
                         <td className="px-6 py-4 font-bold text-gray-800">
                            {v.visitor_name || '-'}
                         </td>
                         <td className="px-6 py-4">
                            <p className="font-bold text-gray-900">{getCustomerName(v.customer)}</p>
                            <p className="text-xs text-gray-500">{getCustomerAddress(v.customer)}</p>
                         </td>
                         <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">
                               <CheckCircle size={10}/> Valid
                            </span>
                         </td>
                         <td className="px-6 py-4 text-gray-600 italic max-w-xs truncate">
                            {v.notes || '-'}
                         </td>
                      </tr>
                   ))
                )}
             </tbody>
           </table>
         </div>

         {/* Pagination */}
         {visits.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center items-center gap-4">
             <button onClick={() => setCurrentPage(c => Math.max(c - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 transition"><ChevronLeft size={18} className="text-gray-700"/></button>
             <span className="text-sm font-bold text-gray-700">Hal {currentPage} / {Math.ceil(visits.length / itemsPerPage)}</span>
             <button onClick={() => setCurrentPage(c => Math.min(c + 1, Math.ceil(visits.length / itemsPerPage)))} disabled={currentPage === Math.ceil(visits.length / itemsPerPage)} className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 transition"><ChevronRight size={18} className="text-gray-700"/></button>
          </div>
         )}
      </div>

      {/* --- MODAL FORM VISIT --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end md:items-center justify-center z-50 p-0 md:p-4 backdrop-blur-sm">
           <div className="bg-white rounded-t-2xl md:rounded-xl w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
              
              <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl sticky top-0 z-10">
                 <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900"><QrCode className="text-blue-600"/> Form Visit Sales</h3>
                 <button onClick={() => {setIsFormOpen(false); setIsScannerOpen(false)}} className="text-gray-400 font-bold hover:text-red-500">Tutup</button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-5">
                 
                 {/* 1. NAMA */}
                 <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1"><User size={14}/> Nama Sales / Petugas</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-bold"
                      placeholder="Masukkan nama Anda..."
                      value={visitorName}
                      onChange={e => setVisitorName(e.target.value)}
                      required
                    />
                 </div>

                 {/* 2. PILIH TOKO */}
                 <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1">Pilih Toko yg Dikunjungi</label>
                    <select 
                      className="w-full border border-blue-200 rounded-lg p-3 bg-white font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        setIsBarcodeValid(false); 
                        setScannedBarcode('');
                      }}
                      required
                    >
                      <option value="">-- Pilih Toko --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.address}</option>)}
                    </select>
                 </div>

                 {/* 3. VALIDASI LOKASI & BARCODE */}
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                    <h4 className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1"><MapPin size={14}/> Validasi</h4>

                    {/* GPS Status */}
                    <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                       <Navigation size={14} className={currentLocation ? "text-green-600" : "animate-pulse"}/> 
                       {locationStatus}
                    </div>

                    {/* SCANNER AREA */}
                    {!isBarcodeValid ? (
                        <div className="space-y-2">
                            {isScannerOpen ? (
                                <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-black">
                                    <div id="reader" className="w-full h-64"></div>
                                    <button type="button" onClick={() => setIsScannerOpen(false)} className="w-full bg-red-600 text-white py-2 text-xs font-bold">Stop Kamera</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setIsScannerOpen(true)} className="w-full bg-gray-900 text-white py-3 rounded-lg flex justify-center items-center gap-2 font-bold hover:bg-black transition">
                                    <Camera size={18}/> Buka Kamera Scan QR
                                </button>
                            )}
                            
                            {/* Manual Input Fallback */}
                            <div className="flex gap-2">
                                <input type="text" placeholder="Atau input kode manual..." className="flex-1 border p-2 rounded text-sm text-center font-mono font-bold text-gray-900" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)}/>
                                <button type="button" onClick={() => handleValidateBarcode()} className="bg-gray-200 text-gray-800 px-3 py-2 rounded text-xs font-bold">Cek</button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-100 p-3 rounded-lg flex items-center justify-center gap-2 text-green-800 font-bold border border-green-200">
                            <CheckCircle size={20}/> Barcode Valid & Terverifikasi
                        </div>
                    )}
                 </div>

                 {/* 4. CATATAN */}
                 <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1"><Info size={14}/> Catatan Lapangan</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-900" 
                      rows={2} 
                      placeholder="Catatan kunjungan..."
                      value={notes} onChange={e => setNotes(e.target.value)}
                      required
                    />
                 </div>

                 {/* Tombol Submit */}
                 <button 
                   type="submit" 
                   disabled={isSubmitting || !isBarcodeValid}
                   className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition flex justify-center items-center gap-2"
                 >
                   {isSubmitting ? <RefreshCw className="animate-spin"/> : <Save size={20}/>}
                   SIMPAN VISIT
                 </button>

              </form>
           </div>
        </div>
      )}
    </div>
  )
}