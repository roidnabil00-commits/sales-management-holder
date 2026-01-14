// app/dashboard/reports/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  FileText, Filter, Trash2, Calendar, Search, 
  Download, Eye, X, User, Clock, CheckCircle, Package 
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ReportsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filter States
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0].slice(0, 7) + '-01') // Awal bulan
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]) // Hari ini
  const [statusFilter, setStatusFilter] = useState('all') // all, pending, shipped, paid
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('')

  // Modal Detail State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)

  useEffect(() => {
    fetchReports()
  }, []) 

  const fetchReports = async () => {
    setLoading(true)
    
    // UPDATE QUERY: Tambahkan relation ke items & product untuk detail barang
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customers(name),
        items:order_items(
          qty, 
          price, 
          product:products(name, unit)
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
      .order('created_at', { ascending: false })
    
    const { data, error } = await query

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    let filteredData = data || []

    // 1. Logic Filter Status
    if (statusFilter !== 'all') {
      filteredData = filteredData.filter((o: any) => {
        if (statusFilter === 'pending') return o.status === 'pending'
        if (statusFilter === 'shipped') return o.status === 'shipped'
        if (statusFilter === 'paid') return o.payment_status === 'paid'
        if (statusFilter === 'unpaid') return o.payment_status === 'unpaid' && o.status === 'shipped'
        return true
      })
    }

    // 2. Logic Filter Search (No Order / Customer)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filteredData = filteredData.filter((o: any) => 
        o.order_no.toLowerCase().includes(term) || 
        (o.customer?.name || '').toLowerCase().includes(term)
      )
    }

    setOrders(filteredData)
    setLoading(false)
  }

  // --- DELETE TRANSACTION ---
  const handleDelete = async (id: number) => {
    if(!confirm("HAPUS DATA PERMANEN?\nIni akan menghapus Pesanan, Surat Jalan, dan Invoice sekaligus.")) return;

    try {
      await supabase.from('order_items').delete().eq('order_id', id)
      await supabase.from('orders').delete().eq('id', id)
      alert('Transaksi berhasil dihapus.')
      fetchReports()
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  // --- EXPORT PDF (REKAP LAPORAN) ---
  const handleExportPDF = () => {
    const doc = new jsPDF()
    
    doc.text(`Laporan Penjualan Xander Systems`, 14, 20)
    doc.setFontSize(10)
    doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 26)

    const tableRows = orders.map(o => [
      new Date(o.created_at).toLocaleDateString('id-ID'),
      o.order_no,
      o.customer?.name,
      o.status.toUpperCase(),
      o.payment_status === 'paid' ? 'LUNAS' : 'BELUM',
      `Rp ${o.total_amount.toLocaleString()}`
    ])

    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'No. Order', 'Pelanggan', 'Logistik', 'Keuangan', 'Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [50, 50, 50] }
    })

    // Total Omzet
    const totalOmzet = orders.reduce((acc, curr) => acc + curr.total_amount, 0)
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Omzet Periode Ini: Rp ${totalOmzet.toLocaleString()}`, 14, finalY)

    doc.save(`Laporan_${startDate}_${endDate}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Laporan & Riwayat</h2>
          <p className="text-sm text-gray-500">Rekapitulasi seluruh transaksi & audit trail</p>
        </div>
        <button 
          onClick={handleExportPDF}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 font-bold shadow-sm"
        >
          <Download size={18} /> Export PDF
        </button>
      </div>

      {/* --- FILTER & SEARCH BAR --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        
        {/* Tanggal */}
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-gray-500 block mb-1">Dari Tanggal</label>
          <input type="date" className="w-full border rounded-lg p-2 text-sm text-gray-900 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" 
            value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-gray-500 block mb-1">Sampai Tanggal</label>
           <input type="date" className="w-full border rounded-lg p-2 text-sm text-gray-900 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" 
             value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {/* Status */}
        <div className="md:col-span-3">
          <label className="text-xs font-bold text-gray-500 block mb-1">Status Transaksi</label>
           <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
             <Filter size={16} className="text-gray-400"/>
             <select className="bg-transparent outline-none text-sm text-gray-900 w-full"
               value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
               <option value="all">Semua Status</option>
               <option value="pending">Pending (Baru SO)</option>
               <option value="shipped">Dikirim (DO)</option>
               <option value="unpaid">Belum Lunas</option>
               <option value="paid">Lunas (Selesai)</option>
             </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="md:col-span-3">
           <label className="text-xs font-bold text-gray-500 block mb-1">Cari No. Order / Pelanggan</label>
           <div className="flex items-center gap-2 border rounded-lg p-2 bg-white ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-blue-500 transition">
              <Search size={16} className="text-blue-500"/>
              <input 
                type="text" 
                placeholder="Contoh: SO-2026..." 
                className="w-full outline-none text-sm text-gray-900 font-medium placeholder:font-normal"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReports()}
              />
           </div>
        </div>

        <div className="md:col-span-2">
          <button 
            onClick={fetchReports}
            className="w-full bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 h-[40px] flex justify-center items-center gap-2 shadow-md transition"
          >
            <Search size={18} /> Cari
          </button>
        </div>
      </div>

      {/* --- TABLE LAPORAN --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Tgl & No. Order</th>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Status Logistik</th>
                <th className="px-6 py-4">Status Keuangan</th>
                <th className="px-6 py-4 text-right">Nilai Transaksi</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                 <tr><td colSpan={6} className="p-8 text-center text-gray-500">Sedang memuat laporan...</td></tr>
              ) : orders.length === 0 ? (
                 <tr><td colSpan={6} className="p-8 text-center text-gray-500">Tidak ada data ditemukan.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-blue-50 transition group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-blue-700">{o.order_no}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar size={10}/> {new Date(o.created_at).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {o.customer?.name}
                    </td>
                    <td className="px-6 py-4">
                      {o.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">Pending</span>}
                      {o.status === 'shipped' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">Dikirim</span>}
                      {o.status === 'completed' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Selesai</span>}
                      {o.status === 'cancelled' && <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold">Batal</span>}
                    </td>
                    <td className="px-6 py-4">
                      {o.payment_status === 'paid' ? (
                        <span className="text-green-600 font-bold flex items-center gap-1"><FileText size={14}/> LUNAS</span>
                      ) : (
                        <span className="text-red-500 font-bold flex items-center gap-1"><FileText size={14}/> BELUM BAYAR</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      Rp {o.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center flex justify-center gap-2">
                       {/* Tombol Detail */}
                       <button 
                        onClick={() => setSelectedOrder(o)}
                        className="p-2 text-blue-500 hover:text-white hover:bg-blue-500 border border-blue-100 rounded-lg transition shadow-sm"
                        title="Lihat Detail & Item"
                      >
                        <Eye size={18} />
                      </button>
                      
                      {/* Tombol Hapus */}
                      <button 
                        onClick={() => handleDelete(o.id)}
                        className="p-2 text-red-400 hover:text-white hover:bg-red-500 border border-red-100 rounded-lg transition shadow-sm"
                        title="Hapus Permanen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* FOOTER TOTAL */}
            {!loading && orders.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold text-gray-600 uppercase">Total Omzet Periode Ini</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-700 text-lg">
                    Rp {orders.reduce((acc, curr) => acc + curr.total_amount, 0).toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* --- MODAL DETAIL RIWAYAT & ITEMS --- */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
              
              {/* HEADER MODAL */}
              <div className="bg-gray-900 p-4 flex justify-between items-center text-white shrink-0">
                 <h3 className="font-bold flex items-center gap-2"><Clock size={18}/> Detail Transaksi</h3>
                 <button onClick={() => setSelectedOrder(null)} className="hover:text-red-400 transition"><X size={20}/></button>
              </div>
              
              {/* BODY MODAL (Scrollable) */}
              <div className="p-6 space-y-4 overflow-y-auto">
                 <div className="text-center mb-4">
                    <p className="text-sm text-gray-500">Nomor Referensi</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedOrder.order_no}</p>
                 </div>

                 {/* INFO UTAMA */}
                 <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                       <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1"><Calendar size={12}/> Waktu</p>
                       <p className="font-bold text-gray-800 text-sm">
                         {new Date(selectedOrder.created_at).toLocaleDateString('id-ID')}
                       </p>
                       <p className="text-xs text-gray-500">
                         {new Date(selectedOrder.created_at).toLocaleTimeString('id-ID')} WIB
                       </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1"><User size={12}/> Admin</p>
                        <p className="font-bold text-gray-800 text-sm truncate">
                           {selectedOrder.maker_name || 'System Admin'}
                        </p>
                    </div>
                 </div>

                 {/* TABEL ITEM BARANG (NEW FEATURE) */}
                 <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Package size={14}/> Rincian Barang</p>
                    <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                       <table className="w-full text-sm text-left">
                          <thead className="bg-gray-100 text-xs text-gray-600 uppercase">
                             <tr>
                                <th className="px-3 py-2">Produk</th>
                                <th className="px-3 py-2 text-center">Qty</th>
                                <th className="px-3 py-2 text-right">Total</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                             {selectedOrder.items?.map((item: any, idx: number) => (
                                <tr key={idx}>
                                   <td className="px-3 py-2">
                                      <p className="font-bold text-gray-800 text-xs">{item.product?.name}</p>
                                      <p className="text-[10px] text-gray-500">@ Rp {item.price.toLocaleString()}</p>
                                   </td>
                                   <td className="px-3 py-2 text-center text-xs text-gray-700">
                                      {item.qty} {item.product?.unit}
                                   </td>
                                   <td className="px-3 py-2 text-right font-bold text-xs text-gray-900">
                                      Rp {(item.qty * item.price).toLocaleString()}
                                   </td>
                                </tr>
                             ))}
                             {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                                <tr><td colSpan={3} className="text-center p-3 text-xs text-gray-400">Tidak ada detail barang.</td></tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* INFO PENERIMA & STATUS */}
                 <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                       <div className="flex items-center gap-2">
                          <div className="bg-blue-200 p-1.5 rounded-full text-blue-700"><CheckCircle size={14}/></div>
                          <span className="text-sm font-bold text-blue-900">Penerima</span>
                       </div>
                       <span className="font-bold text-gray-900 text-sm text-right">{selectedOrder.receiver_name || selectedOrder.customer?.name}</span>
                    </div>
                 </div>

                 {/* FOOTER TOTAL */}
                 <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Total Transaksi</span>
                    <span className="font-bold text-2xl text-blue-700">Rp {selectedOrder.total_amount.toLocaleString()}</span>
                 </div>
              </div>

              {/* FOOTER MODAL (CLOSE BUTTON) */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 text-center shrink-0">
                 <button onClick={() => setSelectedOrder(null)} className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-100 transition text-sm">
                    Tutup
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  )
}