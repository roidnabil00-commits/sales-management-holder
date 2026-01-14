// app/dashboard/delivery/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Truck, CheckCircle, Package, Search, Printer, 
  AlertCircle, Trash2, RefreshCw, Clock, CreditCard 
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Tipe Data
type Order = {
  id: number
  order_no: string
  created_at: string
  customer: { name: string; address: string; phone: string }
  total_amount: number
  status: string         // pending, shipped, completed
  payment_status: string // paid, unpaid
  items?: any[]
}

export default function DeliveryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [])

  // Load Pesanan (Riwayat Lengkap + Search)
  const fetchOrders = async (query = '') => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_no, created_at, status, payment_status, total_amount,
        customer:customers(name, address, phone),
        items:order_items(qty, product:products(name, unit, barcode))
      `)
      // Hapus filter .eq('status', 'pending') agar riwayat muncul
      .order('created_at', { ascending: false }) // Urutkan terbaru
      .limit(50) 
    
    if (error) console.error(error)
    else {
      // Client-side search filter
      const filtered = (data as any[]).filter(o => 
        o.order_no.toLowerCase().includes(query.toLowerCase()) || 
        o.customer?.name.toLowerCase().includes(query.toLowerCase())
      )
      setOrders(filtered)
    }
    setLoading(false)
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    fetchOrders(e.target.value)
  }

  // --- LOGIC HAPUS ORDER ---
  const handleDeleteOrder = async (id: number) => {
    if(!confirm("HAPUS PESANAN INI? \nData akan dihapus permanen dari database.")) return;

    try {
      await supabase.from('order_items').delete().eq('order_id', id)
      const { error } = await supabase.from('orders').delete().eq('id', id)
      
      if(error) throw error
      alert('Pesanan berhasil dihapus.')
      fetchOrders()
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  // --- LOGIC PROSES (POTONG STOK) & PRINT ---
  const handleProcessAndPrint = async (orderId: number) => {
    if (!confirm('KONFIRMASI PENGIRIMAN:\n1. Stok akan dipotong.\n2. Status berubah jadi "Shipped".\n3. Surat Jalan akan terbuka.\n\nLanjutkan?')) return

    try {
      setLoading(true)

      // 1. Panggil RPC (Potong Stok & Update Status)
      const { error } = await supabase.rpc('process_delivery', { p_order_id: orderId })
      if (error) throw error

      // 2. Generate & Open PDF
      await generateDeliveryNote(orderId)

      // 3. Refresh Data
      setTimeout(() => {
        alert('Pengiriman Berhasil Diproses!')
        fetchOrders()
      }, 500)

    } catch (err: any) {
      alert('Gagal proses: ' + err.message)
      setLoading(false)
    }
  }

  // --- LOGIC CETAK ULANG (HANYA PRINT) ---
  const handleReprint = async (orderId: number) => {
    await generateDeliveryNote(orderId)
  }

  // --- GENERATE SURAT JALAN (PDF) ---
  const generateDeliveryNote = async (orderId: number) => {
    try {
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

      // Tabel Barang
      const tableRows = order.items.map((item: any) => [
        item.product.barcode || '-', 
        item.product.name,
        `${item.qty} ${item.product.unit}`,
        '[   ] Cek Fisik' 
      ])

      autoTable(doc, {
        startY: 70,
        head: [['Barcode', 'Nama Barang', 'Jumlah', 'Validasi']],
        body: tableRows,
        theme: 'grid', 
        headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
        columnStyles: { 0: { cellWidth: 35 } } 
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20
      doc.text('Diterima Oleh,', 14, finalY); doc.text('Supir / Pengirim,', 100, finalY); doc.text('Hormat Kami,', 160, finalY) 
      doc.text('( ........................... )', 14, finalY + 25); doc.text('( ........................... )', 100, finalY + 25); doc.text('( Admin Gudang )', 160, finalY + 25)

      // Auto Print
      doc.autoPrint(); 
      window.open(URL.createObjectURL(doc.output('blob')), '_blank'); 

    } catch (err: any) {
      console.error('Print error:', err)
      alert('Gagal cetak PDF.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pengiriman Barang (DO)</h2>
          <p className="text-sm text-gray-600">Proses pesanan, potong stok & cetak surat jalan</p>
        </div>
        <button onClick={() => fetchOrders()} className="text-blue-600 hover:text-blue-800"><RefreshCw size={24}/></button>
      </div>

      {/* --- SEARCH BAR --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari No. Order / Nama Pelanggan..." 
          className="flex-1 outline-none text-sm text-gray-900 font-medium placeholder:font-normal"
          value={searchTerm}
          onChange={handleSearch}
        />
      </div>

      {/* --- LIST PESANAN --- */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
           <p className="text-center text-gray-500 py-10 font-medium">Memuat data...</p>
        ) : orders.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
             <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
             <h3 className="text-lg font-bold text-gray-900">Tidak ada data.</h3>
             <p className="text-gray-500">Belum ada pesanan yang masuk.</p>
           </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-6 items-start md:items-center hover:shadow-md transition group">
              
              {/* Icon */}
              <div className="flex-shrink-0 bg-blue-50 p-4 rounded-full text-blue-600 hidden md:block">
                <Package size={24} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-lg font-bold text-gray-900">{order.customer.name}</h4>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-bold">
                    {order.order_no}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{order.customer.address}</p>
                
                {/* STATUS BADGES */}
                <div className="flex gap-2">
                  {/* Status Logistik */}
                  <span className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1 ${
                    order.status === 'shipped' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    order.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                    'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  }`}>
                    <Truck size={12} />
                    {order.status === 'shipped' ? 'SUDAH DIKIRIM' : order.status === 'completed' ? 'SELESAI' : 'MENUNGGU PROSES'}
                  </span>

                  {/* Status Pembayaran */}
                  <span className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1 ${
                    order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    <CreditCard size={12} />
                    {order.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                  </span>
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

                {/* Tombol Aksi (Kondisional) */}
                {order.status === 'pending' ? (
                  <button 
                    onClick={() => handleProcessAndPrint(order.id)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 text-sm font-bold flex justify-center items-center gap-2 transition transform active:scale-95"
                  >
                    <div className="flex flex-col items-start leading-none gap-1">
                      <span className="text-[10px] opacity-80 font-normal">KLIK UNTUK PROSES</span>
                      <span className="flex items-center gap-2">KIRIM & CETAK <Printer size={16}/></span>
                    </div>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleReprint(order.id)}
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-bold flex justify-center items-center gap-2 transition"
                  >
                    <Printer size={16}/> CETAK ULANG
                  </button>
                )}
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}