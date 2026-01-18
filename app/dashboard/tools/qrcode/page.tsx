'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Printer, Search, Download, QrCode, Grid, List, 
  CheckCircle, RefreshCw, Building2, MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

type Customer = {
  id: number
  name: string
  address: string
  phone: string
}

export default function QRCodeGeneratorPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, phone')
      .order('name', { ascending: true })

    if (error) {
      toast.error('Gagal memuat data toko.')
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }

  // --- FUNGSI GENERATE QR CODE KE DATA URL ---
  const generateQRDataUrl = async (text: string) => {
    try {
      // Kita generate QR Code dengan kualitas tinggi
      return await QRCode.toDataURL(text, { 
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
    } catch (err) {
      console.error(err)
      return null
    }
  }

  // --- CETAK 1 QR CODE (Stiker Tunggal) ---
  const printSingleQR = async (customer: Customer) => {
    try {
      setIsGenerating(true)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 100] // Ukuran stiker kotak 10x10 cm (sesuaikan printer)
      })

      // 1. Generate QR Image (Isinya adalah ID Customer string)
      // PENTING: Ini harus cocok dengan logic di halaman Visit (scan ID)
      const qrDataUrl = await generateQRDataUrl(customer.id.toString())

      if (qrDataUrl) {
        // Bingkai
        doc.setLineWidth(1)
        doc.rect(5, 5, 90, 90)

        // Header
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text("SCAN DISINI", 50, 15, { align: 'center' })
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text("Absensi Sales & Kunjungan", 50, 20, { align: 'center' })

        // Gambar QR
        doc.addImage(qrDataUrl, 'PNG', 20, 25, 60, 60)

        // Footer (Nama Toko)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(customer.name.toUpperCase(), 50, 90, { align: 'center' })
        
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(`ID: ${customer.id} | Xander Systems`, 50, 94, { align: 'center' })

        doc.save(`QR_${customer.name.replace(/\s+/g, '_')}.pdf`)
        toast.success(`QR Code ${customer.name} siap dicetak!`)
      }
    } catch (err) {
      toast.error("Gagal membuat PDF")
    } finally {
      setIsGenerating(false)
    }
  }

  // --- CETAK MASSAL (A4 Sticker Sheet) ---
  const printAllQR = async () => {
    if(!confirm(`Cetak QR Code untuk ${filteredCustomers.length} toko sekaligus dalam format A4?`)) return

    try {
      setIsGenerating(true)
      const doc = new jsPDF('p', 'mm', 'a4') // A4 Portrait
      
      const colWidth = 60
      const rowHeight = 70
      const cols = 3 // 3 Kolom per baris
      const rows = 4 // 4 Baris per halaman
      
      let col = 0
      let row = 0
      let count = 0

      // Loop semua customer
      for (const cust of filteredCustomers) {
        // Jika halaman penuh, tambah halaman baru
        if (count > 0 && count % (cols * rows) === 0) {
          doc.addPage()
          col = 0
          row = 0
        }

        const x = 10 + (col * colWidth) + (col * 5) // Margin kiri 10, Gap 5
        const y = 10 + (row * rowHeight) + (row * 5) // Margin atas 10, Gap 5

        // Kotak Pembatas (Garis potong)
        doc.setLineWidth(0.1)
        doc.setDrawColor(200, 200, 200) // Abu-abu tipis
        doc.rect(x, y, colWidth, rowHeight)

        // Header
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text("SCAN VISIT", x + (colWidth/2), y + 8, { align: 'center' })

        // QR Code
        const qrUrl = await generateQRDataUrl(cust.id.toString())
        if (qrUrl) {
           doc.addImage(qrUrl, 'PNG', x + 10, y + 12, colWidth - 20, colWidth - 20)
        }

        // Nama Toko
        doc.setFontSize(9)
        doc.text(cust.name.substring(0, 18), x + (colWidth/2), y + rowHeight - 8, { align: 'center' })
        
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(`ID: ${cust.id}`, x + (colWidth/2), y + rowHeight - 4, { align: 'center' })

        // Pindah posisi
        count++
        col++
        if (col >= cols) {
          col = 0
          row++
        }
      }

      doc.save(`MASTER_QR_CODES_${new Date().toISOString().slice(0,10)}.pdf`)
      toast.success("Master QR Code berhasil didownload!")

    } catch (err) {
      console.error(err)
      toast.error("Gagal generate massal.")
    } finally {
      setIsGenerating(false)
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
       {/* HEADER */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <QrCode className="text-blue-600"/> Generator QR Toko
          </h2>
          <p className="text-sm text-gray-600 font-medium">Cetak stiker validasi fisik untuk ditempel di lokasi pelanggan.</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={printAllQR}
              disabled={isGenerating || filteredCustomers.length === 0}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={18}/> : <Printer size={18}/>}
              Cetak Semua (A4)
            </button>
        </div>
      </div>

      {/* SEARCH & FILTER */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="text-gray-400" size={20}/>
        <input 
          type="text" 
          placeholder="Cari nama toko untuk cetak satuan..." 
          className="flex-1 outline-none text-sm font-bold text-gray-900 placeholder:font-normal"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="text-xs font-bold bg-gray-100 px-3 py-1 rounded-lg text-gray-600">
          {filteredCustomers.length} Toko
        </span>
      </div>

      {/* LIST TOKO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
           <p className="col-span-full text-center py-10 text-gray-500">Memuat data toko...</p>
        ) : filteredCustomers.length === 0 ? (
           <div className="col-span-full text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
             <Building2 className="mx-auto mb-2 opacity-20" size={40}/>
             <p>Toko tidak ditemukan.</p>
           </div>
        ) : (
          filteredCustomers.map(cust => (
            <div key={cust.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition group relative overflow-hidden">
               {/* Hiasan BG */}
               <QrCode className="absolute -right-4 -bottom-4 text-gray-50 opacity-50 rotate-12" size={80}/>

               <div className="relative z-10">
                 <div className="flex justify-between items-start mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100">
                      {cust.name.charAt(0)}
                    </div>
                    <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                      ID: {cust.id}
                    </span>
                 </div>
                 
                 <h3 className="font-bold text-gray-900 text-lg truncate mb-1" title={cust.name}>{cust.name}</h3>
                 <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4 h-8 overflow-hidden">
                    <MapPin size={12} className="shrink-0"/>
                    <span className="line-clamp-2">{cust.address || 'Alamat belum diisi'}</span>
                 </div>

                 <button 
                   onClick={() => printSingleQR(cust)}
                   disabled={isGenerating}
                   className="w-full bg-white border border-blue-200 text-blue-700 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition flex items-center justify-center gap-2 group-hover:border-blue-400"
                 >
                   <Download size={16}/> Download PDF
                 </button>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}