// app/dashboard/delivery/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Truck, CheckCircle, FileText, Printer, Package } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

  // Load Pesanan yang statusnya 'pending'
  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_no, created_at, status, total_amount,
        customer:customers(name, address, phone)
      `)
      .eq('status', 'pending') // Hanya ambil yang belum dikirim
      .order('created_at', { ascending: true }) // Yang lama diprioritaskan
    
    if (error) console.error(error)
    else setOrders((data as any) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // LOGIC: PROSES PENGIRIMAN (Panggil RPC Supabase)
  const handleProcessDelivery = async (orderId: number) => {
    if (!confirm('Kirim pesanan ini? Stok akan otomatis berkurang.')) return

    try {
      // Panggil fungsi SQL 'process_delivery' yang kita buat tadi
      const { error } = await supabase.rpc('process_delivery', { p_order_id: orderId })

      if (error) throw error

      alert('Berhasil! Barang dalam pengiriman. Stok telah dipotong.')
      fetchOrders() // Refresh list

    } catch (err: any) {
      alert('Gagal proses: ' + err.message)
    }
  }

  // LOGIC: CETAK SURAT JALAN (Delivery Order)
  const generateDeliveryNote = async (orderId: number) => {
    try {
      // Ambil detail barang dulu
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(name, address, phone),
          items:order_items(qty, product:products(name, unit))
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) throw new Error('Data tidak ditemukan')

      const doc = new jsPDF()
      
      // Header Surat Jalan
      doc.setFontSize(22)
      doc.text('SURAT JALAN', 14, 20)
      
      doc.setFontSize(10)
      doc.text('XANDER BAKERY LOGISTICS', 14, 28)
      doc.text(`No. Dokumen: DO/${order.order_no}`, 140, 20)
      doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 140, 28)

      // Info Penerima
      doc.text('Tujuan Pengiriman:', 14, 40)
      doc.setFont('helvetica', 'bold')
      doc.text(order.customer.name, 14, 46)
      doc.setFont('helvetica', 'normal')
      doc.text(order.customer.address || 'Alamat tidak tersedia', 14, 52)
      doc.text(`Telp: ${order.customer.phone || '-'}`, 14, 58)

      // Tabel Barang (Tanpa Harga, Cuma Qty)
      const tableRows = order.items.map((item: any) => [
        item.product.name,
        `${item.qty} ${item.product.unit}`,
        '[   ] Cek Fisik' // Kolom ceklis manual supir
      ])

      autoTable(doc, {
        startY: 65,
        head: [['Nama Barang', 'Jumlah', 'Validasi']],
        body: tableRows,
        theme: 'grid', // Pakai grid biar jelas buat coret2
        headStyles: { fillColor: [100, 100, 100] } // Warna abu-abu (bukan biru sales)
      })

      // Footer Tanda Tangan
      const finalY = (doc as any).lastAutoTable.finalY + 20
      doc.text('Diterima Oleh,', 14, finalY)
      doc.text('Pengirim / Supir,', 140, finalY)
      
      doc.text('( ........................... )', 14, finalY + 25)
      doc.text('( ........................... )', 140, finalY + 25)

      doc.save(`SuratJalan-${order.order_no}.pdf`)

    } catch (err: any) {
      alert('Gagal cetak: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Pengiriman Barang</h2>
          <p className="text-sm text-gray-500">Proses pesanan & cetak surat jalan</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Truck size={18} />
          {orders.length} Pesanan Pending
        </div>
      </div>

      {/* --- LIST ANTRIAN PENGIRIMAN --- */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
           <p className="text-center text-gray-400 py-10">Memuat data...</p>
        ) : orders.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
             <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
             <h3 className="text-lg font-bold text-gray-800">Semua Beres!</h3>
             <p className="text-gray-500">Tidak ada pesanan yang perlu dikirim.</p>
           </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-start md:items-center">
              
              {/* Icon & Info Utama */}
              <div className="flex-shrink-0 bg-yellow-50 p-4 rounded-full text-yellow-600 hidden md:block">
                <Package size={24} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-lg font-bold text-gray-800">{order.customer.name}</h4>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                    {order.order_no}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{order.customer.address}</p>
                <p className="text-xs text-gray-400">
                  Dipesan: {new Date(order.created_at).toLocaleDateString('id-ID')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button 
                  onClick={() => generateDeliveryNote(order.id)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium flex justify-center items-center gap-2"
                >
                  <Printer size={16} /> Surat Jalan
                </button>
                
                <button 
                  onClick={() => handleProcessDelivery(order.id)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-100 text-sm font-bold flex justify-center items-center gap-2"
                >
                  <Truck size={16} /> KIRIM SEKARANG
                </button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}