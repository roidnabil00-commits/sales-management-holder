// app/dashboard/reports/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FileText, Filter, Trash2, Calendar, Search, RefreshCw, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ReportsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filter States
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0].slice(0, 7) + '-01') // Awal bulan
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]) // Hari ini
  const [statusFilter, setStatusFilter] = useState('all') // all, pending, shipped, paid

  useEffect(() => {
    fetchReports()
  }, []) // First load

  const fetchReports = async () => {
    setLoading(true)
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customers(name)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
      .order('created_at', { ascending: false })

    // Apply Logic Filter Client-side/Query
    // Supabase filter limitations make simple combined logic harder, so we filter array below for status
    
    const { data, error } = await query

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    // Client Side Filtering untuk Status Gabungan (Logistik & Finance)
    let filteredData = data || []
    if (statusFilter !== 'all') {
      filteredData = filteredData.filter((o: any) => {
        if (statusFilter === 'pending') return o.status === 'pending'
        if (statusFilter === 'shipped') return o.status === 'shipped'
        if (statusFilter === 'paid') return o.payment_status === 'paid'
        if (statusFilter === 'unpaid') return o.payment_status === 'unpaid' && o.status === 'shipped'
        return true
      })
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
          <p className="text-sm text-gray-500">Rekapitulasi seluruh transaksi (SO, DO, Invoice)</p>
        </div>
        <button 
          onClick={handleExportPDF}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 font-bold shadow-sm"
        >
          <Download size={18} /> Export PDF
        </button>
      </div>

      {/* --- FILTER BAR --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-end md:items-center">
        <div className="w-full md:w-auto">
          <label className="text-xs font-bold text-gray-500 block mb-1">Dari Tanggal</label>
          <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
            <Calendar size={16} className="text-gray-400"/>
            <input type="date" className="bg-transparent outline-none text-sm text-gray-900" 
              value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <div className="w-full md:w-auto">
          <label className="text-xs font-bold text-gray-500 block mb-1">Sampai Tanggal</label>
          <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
             <Calendar size={16} className="text-gray-400"/>
             <input type="date" className="bg-transparent outline-none text-sm text-gray-900" 
               value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="w-full md:w-48">
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
        <button 
          onClick={fetchReports}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 h-[42px] flex items-center gap-2"
        >
          <Search size={18} /> Tampilkan
        </button>
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
                 <tr><td colSpan={6} className="p-8 text-center text-gray-500">Tidak ada data pada periode ini.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{o.order_no}</div>
                      <div className="text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString('id-ID')}</div>
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
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDelete(o.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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
    </div>
  )
}