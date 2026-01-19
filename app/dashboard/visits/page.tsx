'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  MapPin, QrCode, Navigation, CheckCircle, Plus, RefreshCw, 
  Save, Clock, Info, User, ChevronLeft, ChevronRight, Download, Camera, X,
  Map, Calendar
} from 'lucide-react'
import { toast } from 'sonner' 
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { generateDailySchedule } from '@/app/actions/generateSchedule'

// --- TIPE DATA ---
type Visit = {
  id: number | string
  customer_id: number // Pastikan ini ada
  customer: { id?: number; name: string; address: string; district?: string } | { name: string; address: string }[] | null
  check_in_time: string | null
  status: string
  notes: string | null
  visitor_name: string | null
  scheduled_date?: string
}

type Customer = {
  id: number
  name: string
  address: string
  district?: string
}

export default function VisitsPage() {
  const supabase = createClient()

  // Main Data State
  const [visits, setVisits] = useState<Visit[]>([]) 
  const [todaysRoute, setTodaysRoute] = useState<Visit[]>([]) 
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
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null) 

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  // 1. INITIAL LOAD
  useEffect(() => {
    fetchData()
    getLocation()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([fetchTodaysRoute(), fetchHistoryVisits(), fetchCustomers()])
    setLoading(false)
  }

  // --- FETCH PCP (RUTE HARI INI) ---
  const fetchTodaysRoute = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // FIX 1: Tambahkan 'id' di select customer untuk jaga-jaga, 
    // tapi utamanya kita akan pakai kolom 'customer_id' dari tabel utama
    let { data: schedules } = await supabase
      .from('visit_schedules')
      .select(`*, customer:customers(id, name, address, district)`)
      .eq('sales_id', user.id)
      .eq('scheduled_date', today)
      .order('district', { foreignTable: 'customers', ascending: true }) 
      .order('status', { ascending: true })

    if ((!schedules || schedules.length === 0)) {
      await generateDailySchedule(user.id, new Date())
      // Fetch ulang setelah generate
      const { data: newSchedules } = await supabase
        .from('visit_schedules')
        .select(`*, customer:customers(id, name, address, district)`)
        .eq('sales_id', user.id)
        .eq('scheduled_date', today)
        .order('district', { foreignTable: 'customers', ascending: true }) 
      
      schedules = newSchedules
    }

    if (schedules) setTodaysRoute(schedules as any)
  }

  // --- FETCH HISTORY ---
  const fetchHistoryVisits = async () => {
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - 7)
    const dateLimitStr = dateLimit.toISOString().split('T')[0]

    const { data: visitData, error } = await supabase
      .from('visit_schedules')
      .select(`
        id, customer_id, check_in_time, status, visit_notes, 
        customer:customers(name, address) 
      `)
      .eq('status', 'visited')
      .gte('check_in_time', dateLimitStr)
      .order('check_in_time', { ascending: false })

    if (!error) {
      const mappedVisits = (visitData || []).map((v: any) => ({
        ...v,
        notes: v.visit_notes, 
        visitor_name: 'Sales' 
      }))
      setVisits(mappedVisits)
    }
  }

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name, address, district')
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

  const formatJakartaTime = (isoString: string | null) => {
    if (!isoString) return '-'
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
        const scanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
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
      handleValidateBarcode(decodedText); 
      setIsScannerOpen(false); 
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
    if(code === selectedCustomerId.toString()) {
      setIsBarcodeValid(true)
      toast.success("VALID! Anda berada di lokasi yang benar.")
    } else {
      setIsBarcodeValid(false)
      toast.error(`INVALID! Barcode Toko tidak cocok.`) 
    }
  }

  // --- SUBMIT FUNCTION ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!selectedCustomerId || !currentLocation) { 
      toast.warning('Data belum lengkap (Toko atau GPS).')
      setIsSubmitting(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (activeVisitId) {
        // UPDATE JADWAL YG SUDAH ADA (PCP)
        const { error } = await supabase
          .from('visit_schedules')
          .update({
            status: 'visited',
            check_in_time: new Date().toISOString(),
            location_lat: currentLocation.lat,
            location_long: currentLocation.lng,
            visit_notes: notes,
          })
          .eq('id', activeVisitId)
        
        if (error) throw error
      } else {
        // INSERT KUNJUNGAN BARU (UNPLANNED)
        const { error } = await supabase.from('visit_schedules').insert([{
          sales_id: user?.id,
          customer_id: parseInt(selectedCustomerId),
          scheduled_date: new Date().toISOString().split('T')[0],
          status: 'visited', 
          check_in_time: new Date().toISOString(),
          location_lat: currentLocation.lat,
          location_long: currentLocation.lng,
          visit_notes: notes,
        }])
        
        if (error) throw error
      }

      toast.success('Visit Valid & Tersimpan!')
      setIsFormOpen(false)
      resetForm()
      fetchData()

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
    setActiveVisitId(null) 
    setIsScannerOpen(false)
    if(scannerRef.current) {
        scannerRef.current.clear()
        scannerRef.current = null
    }
    getLocation()
  }

  // --- FIX START VISIT ---
  const startVisit = (schedule: any) => {
    // FIX: Gunakan schedule.customer_id (FK langsung) 
    // daripada schedule.customer.id (yang mungkin undefined kalau join selectnya kurang)
    const custId = schedule.customer_id || schedule.customer?.id; 
    
    if (!custId) {
      toast.error("Data Customer Error. Refresh halaman.");
      return;
    }

    setSelectedCustomerId(custId.toString())
    setActiveVisitId(schedule.id)
    setVisitorName('Sales') 
    setIsFormOpen(true)
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
      getCustomerName(v.customer),
      v.status,
      v.notes || '-'
    ])

    autoTable(doc, {
      startY: 35,
      head: [['Waktu', 'Toko', 'Status', 'Catatan']],
      body: tableRows,
      theme: 'grid',
    })

    doc.save(`Laporan_Visit.pdf`)
  }

  // 6. PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentVisits = visits.slice(indexOfFirstItem, indexOfLastItem)

  return (
    <div className="space-y-8 pb-20">
      
      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Kunjungan (Visit)</h2>
          <p className="text-sm text-gray-600 font-medium">Manajemen Jadwal & Validasi Lapangan</p>
        </div>
        <div className="flex gap-2">
           <button onClick={fetchData} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"><RefreshCw size={20}/></button>
           <button onClick={handleDownloadPDF} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition" title="Download PDF"><Download size={20}/></button>
           <button 
             onClick={() => { setIsFormOpen(true); getLocation(); setSelectedCustomerId(''); setActiveVisitId(null); }}
             className="bg-gray-900 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-black shadow-lg font-bold transition"
           >
             <Plus size={18} /> Visit Luar Jadwal
           </button>
        </div>
      </div>

      {/* --- RUTE HARI INI (PCP) --- */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10"><Map size={150} /></div>
        
        <div className="relative z-10">
          <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Calendar className="text-blue-200" /> Rute Hari Ini (PCP)
          </h3>
          
          <div className="mb-6 bg-blue-900/30 rounded-full h-3 max-w-md backdrop-blur-sm border border-blue-500/30">
             <div 
               className="bg-green-400 h-3 rounded-full transition-all duration-1000" 
               style={{ width: `${todaysRoute.length ? (todaysRoute.filter(v=>v.status==='visited').length / todaysRoute.length * 100) : 0}%` }}
             ></div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
             {todaysRoute.length === 0 && (
                <div className="bg-white/10 p-4 rounded-xl min-w-[200px] text-center border border-white/20">
                  <p className="text-sm opacity-80">Tidak ada jadwal PCP hari ini.</p>
                </div>
             )}
             
             {todaysRoute.map((item: any) => {
               const isVisited = item.status === 'visited';
               return (
                 <div key={item.id} className={`snap-center min-w-[280px] bg-white rounded-xl p-4 text-gray-800 shadow-lg border-2 relative flex flex-col justify-between ${isVisited ? 'border-green-500' : 'border-transparent'}`}>
                    
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {item.customer?.district || 'Area Umum'}
                    </span>

                    <div>
                      <h4 className="font-bold text-lg mb-1 truncate">{getCustomerName(item.customer)}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3 h-8">{getCustomerAddress(item.customer)}</p>
                    </div>

                    {isVisited ? (
                       <div className="mt-2 bg-green-100 text-green-700 text-xs font-bold py-2 px-3 rounded-lg text-center flex items-center justify-center gap-1">
                         <CheckCircle size={14}/> SELESAI
                       </div>
                    ) : (
                       <button 
                         onClick={() => startVisit(item)}
                         className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-lg transition"
                       >
                         CHECK IN
                       </button>
                    )}
                 </div>
               )
             })}
          </div>
        </div>
      </div>

      {/* --- TABEL RIWAYAT --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock size={16}/> Riwayat Kunjungan</h3>
            <span className="text-xs font-bold bg-white border border-gray-300 px-2 py-0.5 rounded text-gray-600">{visits.length} Data</span>
         </div>
         
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-white text-gray-900 font-bold uppercase border-b border-gray-200 text-xs">
               <tr>
                 <th className="px-6 py-4">Waktu</th>
                 <th className="px-6 py-4">Toko</th>
                 <th className="px-6 py-4">Status</th>
                 <th className="px-6 py-4">Catatan</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {loading ? (
                   <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-medium">Memuat data...</td></tr>
                ) : currentVisits.length === 0 ? (
                   <tr><td colSpan={4} className="p-8 text-center text-gray-500 italic">Belum ada data kunjungan.</td></tr>
                ) : (
                   currentVisits.map((v) => (
                      <tr key={v.id} className="hover:bg-blue-50 transition">
                          <td className="px-6 py-4 font-medium text-gray-900">{formatJakartaTime(v.check_in_time)}</td>
                          <td className="px-6 py-4">
                             <p className="font-bold text-gray-900">{getCustomerName(v.customer)}</p>
                             <p className="text-xs text-gray-500">{getCustomerAddress(v.customer)}</p>
                          </td>
                          <td className="px-6 py-4">
                             <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">
                                <CheckCircle size={10}/> Visited
                             </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600 italic max-w-xs truncate">{v.notes || '-'}</td>
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
                 <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900">
                   <QrCode className="text-blue-600"/> 
                   {activeVisitId ? 'Check-in Jadwal' : 'Visit Luar Jadwal'}
                 </h3>
                 <button onClick={() => {setIsFormOpen(false); setIsScannerOpen(false)}} className="text-gray-400 font-bold hover:text-red-500">Tutup</button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-5">
                 
                 <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1"><User size={14}/> Petugas</label>
                    <input type="text" className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 font-bold text-gray-500" value={visitorName || 'Sales'} disabled />
                 </div>

                 <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1">Toko yg Dikunjungi</label>
                    <select 
                      className={`w-full border border-blue-200 rounded-lg p-3 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${activeVisitId ? 'bg-gray-100' : 'bg-white'}`}
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        setIsBarcodeValid(false); 
                      }}
                      disabled={!!activeVisitId} 
                      required
                    >
                      <option value="">-- Pilih Toko --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.address}</option>)}
                    </select>
                 </div>

                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                    <h4 className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1"><MapPin size={14}/> Validasi Lapangan</h4>

                    <div className="flex items-center gap-2 text-xs text-blue-700 font-medium">
                       <Navigation size={14} className={currentLocation ? "text-green-600" : "animate-pulse"}/> 
                       {locationStatus}
                    </div>

                    {!isBarcodeValid ? (
                        <div className="space-y-2">
                            {isScannerOpen ? (
                                <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-black">
                                    <div id="reader" className="w-full h-64"></div>
                                    <button type="button" onClick={() => setIsScannerOpen(false)} className="w-full bg-red-600 text-white py-2 text-xs font-bold">Stop Kamera</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setIsScannerOpen(true)} className="w-full bg-gray-900 text-white py-3 rounded-lg flex justify-center items-center gap-2 font-bold hover:bg-black transition">
                                    <Camera size={18}/> Scan QR Toko
                                </button>
                            )}
                            
                            <div className="flex gap-2">
                                <input type="text" placeholder="Input kode manual..." className="flex-1 border p-2 rounded text-sm text-center font-mono font-bold text-gray-900" value={scannedBarcode} onChange={e => setScannedBarcode(e.target.value)}/>
                                <button type="button" onClick={() => handleValidateBarcode()} className="bg-gray-200 text-gray-800 px-3 py-2 rounded text-xs font-bold">Cek</button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-100 p-3 rounded-lg flex items-center justify-center gap-2 text-green-800 font-bold border border-green-200">
                            <CheckCircle size={20}/> Barcode Valid!
                        </div>
                    )}
                 </div>

                 <div>
                    <label className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1"><Info size={14}/> Catatan Lapangan</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-900" 
                      rows={2} 
                      placeholder="Stok habis? Owner marah?..."
                      value={notes} onChange={e => setNotes(e.target.value)}
                    />
                 </div>

                 <button 
                   type="submit" 
                   disabled={isSubmitting || !currentLocation} 
                   className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition flex justify-center items-center gap-2"
                 >
                   {isSubmitting ? <RefreshCw className="animate-spin"/> : <Save size={20}/>}
                   {activeVisitId ? 'CHECK-IN' : 'SIMPAN VISIT'}
                 </button>

              </form>
           </div>
        </div>
      )}
    </div>
  )
}