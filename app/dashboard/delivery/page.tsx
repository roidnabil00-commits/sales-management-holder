// app/dashboard/delivery/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Truck, CheckCircle, Package, Search, Printer, AlertCircle, Trash2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Tipe Data
type Order = {
  id: number
  order_no: string
  created_at: string
  customer: { name: string; address: string; phone: string }
  total_amount: number
  status: string
  items?: any[]
}

export default function DeliveryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Load Pesanan (Pending Only) + Search
  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_no, created_at, status, total_amount,
        customer:customers(name, address, phone)
      `)
      .eq('status', 'pending') // Hanya ambil yang belum dikirim
      .order('created_at', { ascending: true }) 
    
    if (error) console.error(error)
    else setOrders((data as any) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Filter Search
  const filteredOrders = orders.filter(o => 
    o.order_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // --- LOGIC HAPUS ORDER (Sama seperti di SO) ---
  const handleDeleteOrder = async (id: number) => {
    if(!confirm("HAPUS PESANAN INI? \nData akan dihapus permanen dari database (termasuk dari menu SO).")) return;

    try {
      // Hapus item dulu
      await supabase.from('order_items').delete().eq('order_id', id)
      // Hapus header
      const { error } = await supabase.from('orders').delete().eq('id', id)
      
      if(error) throw error
      alert('Pesanan berhasil dihapus.')
      fetchOrders()
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  // --- LOGIC GABUNGAN: PROSES & POPUP PRINT ---
  const handleProcessAndPrint = async (orderId: number) => {
    if (!confirm('KONFIRMASI PENGIRIMAN:\n1. Stok akan dipotong.\n2. Status berubah jadi "Shipped".\n3. Surat Jalan akan terbuka.\n\nLanjutkan?')) return

    try {
      setLoading(true)

      // 1. Panggil RPC (Potong Stok & Update Status)
      const { error } = await supabase.rpc('process_delivery', { p_order_id: orderId })
      if (error) throw error

      // 2. Generate & Open PDF (Popup)
      await generateDeliveryNote(orderId)

      // 3. Refresh Data
      // Kita kasih delay sedikit biar PDF sempat kebuka sebelum list direfresh
      setTimeout(() => {
        alert('Pengiriman Berhasil Diproses!')
        fetchOrders()
      }, 500)

    } catch (err: any) {
      alert('Gagal proses: ' + err.message)
      setLoading(false)
    }
  }

  // --- LOGIC CETAK SURAT JALAN (Popup Mode) ---
  const generateDeliveryNote = async (orderId: number) => {
    try {
      // Ambil detail barang lengkap dengan Barcode
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(name, address, phone),
          items:order_items(qty, product:products(name, unit, barcode))
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) throw new Error('Data tidak ditemukan')

      const doc = new jsPDF()
      
      // HEADER
      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('SURAT JALAN', 14, 20)
      
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('XANDER SYSTEMS LOGISTICS', 14, 28)
      doc.text(`No. Dokumen: DO/${order.order_no}`, 140, 20)
      doc.text(`Tanggal Kirim: ${new Date().toLocaleDateString('id-ID')}`, 140, 28)

      doc.line(14, 35, 196, 35)

      // Info Penerima
      doc.text('Tujuan Pengiriman:', 14, 45)
      doc.setFont('helvetica', 'bold')
      doc.text(order.customer.name, 14, 50)
      doc.setFont('helvetica', 'normal')
      doc.text(order.customer.address || 'Alamat tidak tersedia', 14, 55)
      doc.text(`Telp: ${order.customer.phone || '-'}`, 14, 60)

      // Tabel Barang (Dengan Barcode)
      const tableRows = order.items.map((item: any) => [
        item.product.barcode || '-', // Kolom Barcode
        item.product.name,
        `${item.qty} ${item.product.unit}`,
        '[   ] Cek Fisik' // Kolom ceklis manual supir
      ])

      autoTable(doc, {
        startY: 70,
        head: [['Barcode', 'Nama Barang', 'Jumlah', 'Validasi']],
        body: tableRows,
        theme: 'grid', 
        headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 35 } } 
      })

      // Footer Tanda Tangan
      const finalY = (doc as any).lastAutoTable.finalY + 20
      
      doc.text('Diterima Oleh,', 14, finalY)
      doc.text('Supir / Pengirim,', 100, finalY)
      doc.text('Hormat Kami,', 160, finalY) 
      
      doc.text('( ........................... )', 14, finalY + 25)
      doc.text('( ........................... )', 100, finalY + 25)
      doc.text('( Admin Gudang )', 160, finalY + 25)

      // --- PERUBAHAN UTAMA: PREVIEW / POPUP ---
      // Mengaktifkan fitur auto-print dialog saat dibuka
      doc.autoPrint(); 
      
      // Membuat Blob URL agar bisa dibuka di tab baru
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank'); 

    } catch (err: any) {
      console.error('Print error:', err)
      alert('Gagal cetak PDF, tapi status pengiriman sudah sukses.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pengiriman Barang (DO)</h2>
          <p className="text-sm text-gray-600">Proses pesanan pending & cetak surat jalan</p>
        </div>
        <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-orange-100">
          <Truck size={18} />
          {filteredOrders.length} Pesanan Perlu Dikirim
        </div>
      </div>

      {/* --- SEARCH BAR --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari No. Order / Nama Pelanggan..." 
          className="flex-1 outline-none text-sm text-gray-900 font-medium placeholder:font-normal"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- LIST ANTRIAN PENGIRIMAN --- */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
           <p className="text-center text-gray-500 py-10 font-medium">Memuat antrian...</p>
        ) : filteredOrders.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
             <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
             <h3 className="text-lg font-bold text-gray-900">Semua Beres!</h3>
             <p className="text-gray-500">Tidak ada pesanan pending yang perlu dikirim.</p>
           </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-6 items-start md:items-center hover:shadow-md transition group">
              
              {/* Icon & Info Utama */}
              <div className="flex-shrink-0 bg-blue-50 p-4 rounded-full text-blue-600 hidden md:block">
                <Package size={24} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-lg font-bold text-gray-900">{order.customer.name}</h4>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200 font-bold">
                    {order.order_no}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{order.customer.address}</p>
                
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                  <AlertCircle size={12} />
                  <span>Jika ingin edit barang, silakan ke menu <b>Pesanan (SO)</b>.</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {/* Tombol Hapus */}
                <button 
                  onClick={() => handleDeleteOrder(order.id)}
                  className="px-4 py-3 border border-red-100 text-red-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center"
                  title="Hapus Pesanan"
                >
                  <Trash2 size={20} />
                </button>

                {/* Tombol SAKTI Gabungan */}
                <button 
                  onClick={() => handleProcessAndPrint(order.id)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 text-sm font-bold flex justify-center items-center gap-2 transition transform active:scale-95"
                >
                  <div className="flex flex-col items-start leading-none gap-1">
                    <span className="text-xs font-normal opacity-80">PROSES & CETAK</span>
                    <span className="flex items-center gap-2">SURAT JALAN <Printer size={16}/></span>
                  </div>
                </button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}