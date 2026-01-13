// app/dashboard/invoices/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Printer, 
  Trash2, 
  Edit, 
  X, 
  CheckCircle, 
  Clock, 
  Percent,
  RefreshCw
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// --- TIPE DATA ---
type Product = {
  name: string
  unit: string
  barcode: string | null
}

type OrderItem = {
  qty: number
  price: number
  product: Product
}

type Order = {
  id: number
  order_no: string
  created_at: string
  customer: { name: string; address: string; phone: string }
  total_amount: number
  tax_amount: number
  discount_amount: number
  payment_status: string // 'paid' or 'unpaid'
  maker_name: string
  approved_name: string
  receiver_name: string
  items?: OrderItem[]
}

// --- HELPER: TERBILANG (Rupiah) ---
const terbilang = (nilai: number): string => {
  const angka = Math.abs(nilai)
  const baca = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  let hasil = ''

  if (angka < 12) {
    hasil = ' ' + baca[Math.floor(angka)]
  } else if (angka < 20) {
    hasil = terbilang(angka - 10) + ' Belas'
  } else if (angka < 100) {
    hasil = terbilang(Math.floor(angka / 10)) + ' Puluh' + terbilang(angka % 10)
  } else if (angka < 200) {
    hasil = ' Seratus' + terbilang(angka - 100)
  } else if (angka < 1000) {
    hasil = terbilang(Math.floor(angka / 100)) + ' Ratus' + terbilang(angka % 100)
  } else if (angka < 2000) {
    hasil = ' Seribu' + terbilang(angka - 1000)
  } else if (angka < 1000000) {
    hasil = terbilang(Math.floor(angka / 1000)) + ' Ribu' + terbilang(angka % 1000)
  } else if (angka < 1000000000) {
    hasil = terbilang(Math.floor(angka / 1000000)) + ' Juta' + terbilang(angka % 1000000)
  }

  return hasil
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  
  // State Form
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  
  // Input Form States
  const [invNo, setInvNo] = useState('')
  const [invDate, setInvDate] = useState('')
  const [discountRate, setDiscountRate] = useState(0) // %
  const [paymentStatus, setPaymentStatus] = useState('unpaid') // Status Bayar
  const [makerName, setMakerName] = useState('')
  const [approvedName, setApprovedName] = useState('Manager Keuangan')
  const [receiverName, setReceiverName] = useState('')

  useEffect(() => {
    fetchInvoices()
  }, [])

  // --- AMBIL DATA (Status Shipped) ---
  const fetchInvoices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(name, address, phone),
        items:order_items(qty, price, product:products(name, unit, barcode))
      `)
      .eq('status', 'shipped') 
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setInvoices((data as any) || [])
    setLoading(false)
  }

  // --- HAPUS INVOICE ---
  const handleDelete = async (id: number) => {
    if (!confirm('PERHATIAN: Hapus Invoice ini? Data penjualan akan hilang permanen dari database.')) return

    try {
      await supabase.from('order_items').delete().eq('order_id', id)
      const { error } = await supabase.from('orders').delete().eq('id', id)
      if (error) throw error
      alert('Invoice berhasil dihapus.')
      fetchInvoices()
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  // --- BUKA FORM EDIT ---
  const handleEditClick = (order: Order) => {
    setSelectedOrder(order)
    
    // Hitung % Diskon dari Rupiah yang tersimpan
    const subTotal = order.items?.reduce((acc, item) => acc + (item.price * item.qty), 0) || 0
    const currentRate = subTotal > 0 ? ((order.discount_amount || 0) / subTotal) * 100 : 0

    setInvNo(order.order_no)
    setInvDate(new Date(order.created_at).toISOString().split('T')[0])
    setDiscountRate(Math.round(currentRate))
    setPaymentStatus(order.payment_status || 'unpaid') // Load status bayar
    setMakerName(order.maker_name || 'Admin Sales')
    setApprovedName(order.approved_name || 'Manager Keuangan')
    setReceiverName(order.receiver_name || order.customer.name)
    
    setIsFormOpen(true)
  }

  // --- SIMPAN & CETAK ---
  const handleSaveAndPrint = async () => {
    if (!selectedOrder) return

    // Hitung Ulang Angka
    const subTotal = selectedOrder.items?.reduce((acc, item) => acc + (item.price * item.qty), 0) || 0
    const discountValue = (subTotal * discountRate) / 100
    const tax = selectedOrder.tax_amount || 0
    const grandTotal = subTotal - discountValue + tax

    try {
      // Update Database
      const { error } = await supabase
        .from('orders')
        .update({
          order_no: invNo,
          created_at: new Date(invDate).toISOString(),
          discount_amount: discountValue,
          total_amount: grandTotal,
          payment_status: paymentStatus, // Simpan Status Bayar Baru
          maker_name: makerName,
          approved_name: approvedName,
          receiver_name: receiverName
        })
        .eq('id', selectedOrder.id)

      if (error) throw error

      // Object baru untuk PDF
      const updatedOrder = {
        ...selectedOrder,
        order_no: invNo,
        created_at: new Date(invDate).toISOString(),
        discount_amount: discountValue,
        total_amount: grandTotal,
        payment_status: paymentStatus,
        maker_name: makerName,
        approved_name: approvedName,
        receiver_name: receiverName
      }
      
      // Generate PDF
      await generateInvoicePDF(updatedOrder)

      setIsFormOpen(false)
      fetchInvoices() // Refresh tabel agar status berubah

    } catch (err: any) {
      alert('Gagal proses: ' + err.message)
    }
  }

  // --- GENERATE PDF (LAYOUT RAPIH) ---
  const generateInvoicePDF = async (order: Order) => {
    const doc = new jsPDF()
    
    // KOP SURAT
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('XANDER SYSTEMS & BAKERY', 14, 20)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Jl. Teknologi Masa Depan No. 1, Jakarta Selatan', 14, 26)
    doc.text('Telp: 021-555-888 | Email: invoice@xander.com', 14, 31)
    doc.setLineWidth(0.5); doc.line(14, 35, 196, 35);

    // JUDUL & INFO
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('INVOICE / FAKTUR', 196, 20, { align: 'right' })
    
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`No. Invoice : ${order.order_no}`, 140, 45)
    doc.text(`Tanggal     : ${new Date(order.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}`, 140, 50)
    
    // STATUS LUNAS (Stamp di PDF jika Lunas)
    if(order.payment_status === 'paid') {
      doc.setTextColor(0, 150, 0); // Hijau
      doc.setFont('helvetica', 'bold');
      doc.text('[ LUNAS ]', 196, 50, { align: 'right' });
      doc.setTextColor(0, 0, 0); // Balikin Hitam
      doc.setFont('helvetica', 'normal');
    }

    // CUSTOMER
    doc.text('Ditujukan Kepada:', 14, 45)
    doc.setFont('helvetica', 'bold')
    doc.text(order.customer.name, 14, 50)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customer.address || 'Alamat tidak tersedia', 14, 55)
    doc.text(order.customer.phone || '-', 14, 60)

    // TABEL BARANG
    const tableRows = order.items?.map((item) => [
      item.product.barcode || '-',
      item.product.name,
      `${item.qty} ${item.product.unit}`,
      `Rp ${item.price.toLocaleString()}`,
      `Rp ${(item.qty * item.price).toLocaleString()}`
    ]) || []

    autoTable(doc, {
      startY: 65,
      head: [['Barcode', 'Nama Barang', 'Qty', 'Harga Satuan', 'Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 30 }, 4: { halign: 'right' } }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 5

    // KALKULASI (LAYOUT BARU BIAR GAK TERTINDIH)
    const subTotal = order.items?.reduce((acc, item) => acc + (item.price * item.qty), 0) || 0
    const discount = order.discount_amount || 0
    const tax = order.tax_amount || 0
    const grandTotal = subTotal - discount + tax

    doc.setFont('helvetica', 'normal')
    
    // Label & Value (Right Aligned Value)
    const labelX = 130;
    const valueX = 196;
    const step = 6; // Jarak antar baris

    doc.text('Sub Total:', labelX, finalY + step)
    doc.text(`Rp ${subTotal.toLocaleString()}`, valueX, finalY + step, { align: 'right' })
    
    doc.text('Diskon (-):', labelX, finalY + (step*2))
    doc.text(`Rp ${discount.toLocaleString()}`, valueX, finalY + (step*2), { align: 'right' })
    
    doc.text('PPN (+):', labelX, finalY + (step*3))
    doc.text(`Rp ${tax.toLocaleString()}`, valueX, finalY + (step*3), { align: 'right' })
    
    // Garis Total
    doc.setLineWidth(0.2);
    doc.line(labelX, finalY + (step*3) + 2, valueX, finalY + (step*3) + 2);

    // Grand Total (Lebih Besar)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('TOTAL TAGIHAN:', labelX, finalY + (step*5))
    doc.text(`Rp ${grandTotal.toLocaleString()}`, valueX, finalY + (step*5), { align: 'right' })

    // Terbilang (Di Kiri Bawah)
    doc.setFontSize(10); doc.setFont('helvetica', 'italic');
    doc.text(`Terbilang: ${terbilang(grandTotal)} Rupiah`, 14, finalY + (step*5))

    // Footer Info
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const tahun = new Date().getFullYear();
    const keterangan = `Keterangan: ${order.customer.name} / ${order.order_no} / ${tahun}`;
    doc.text(keterangan, 14, finalY + (step*8))

    // TANDA TANGAN (Posisi Aman)
    const signY = finalY + (step*11)
    
    // Kolom 1
    doc.text('Disiapkan Oleh,', 20, signY)
    doc.text(`( ${order.maker_name || 'Admin'} )`, 20, signY + 25)
    doc.line(20, signY + 26, 60, signY + 26) 

    // Kolom 2
    doc.text('Disetujui Oleh,', 85, signY)
    doc.text(`( ${order.approved_name || 'Manager'} )`, 85, signY + 25)
    doc.line(85, signY + 26, 125, signY + 26)

    // Kolom 3
    doc.text('Diterima Oleh,', 150, signY)
    doc.text(`( ${order.receiver_name || 'Pelanggan'} )`, 150, signY + 25)
    doc.line(150, signY + 26, 190, signY + 26)
    
    // Print Popup
    doc.autoPrint();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  // Helper untuk Kalkulasi UI Modal
  const modalSubTotal = selectedOrder?.items?.reduce((acc, item) => acc + (item.price * item.qty), 0) || 0
  const modalDiscountVal = (modalSubTotal * discountRate) / 100
  const modalTax = selectedOrder?.tax_amount || 0
  const modalGrandTotal = modalSubTotal - modalDiscountVal + modalTax

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Faktur Penjualan</h2>
          <p className="text-sm text-gray-500">Kelola tagihan, diskon, dan cetak invoice resmi</p>
        </div>
        <button onClick={fetchInvoices} className="text-blue-600 hover:text-blue-800"><RefreshCw size={20}/></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 uppercase">
            <tr>
              <th className="px-6 py-4">No. Invoice</th>
              <th className="px-6 py-4">Pelanggan</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Status Bayar</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
               <tr><td colSpan={5} className="p-6 text-center text-gray-500">Memuat data...</td></tr>
            ) : invoices.length === 0 ? (
               <tr><td colSpan={5} className="p-6 text-center text-gray-500">Belum ada pesanan terkirim.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-blue-50 transition">
                  <td className="px-6 py-4 font-bold text-gray-900">{inv.order_no}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{inv.customer.name}</div>
                    <div className="text-xs text-gray-500">{new Date(inv.created_at).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">Rp {inv.total_amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {inv.payment_status === 'paid' ? (
                      <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-bold w-fit border border-green-200">
                        <CheckCircle size={12} /> LUNAS
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs font-bold w-fit border border-red-200">
                        <Clock size={12} /> BELUM BAYAR
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 flex justify-center gap-2">
                    <button 
                      onClick={() => handleEditClick(inv)}
                      className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 font-medium transition"
                      title="Proses Invoice"
                    >
                      <Edit size={16} /> Proses
                    </button>
                    <button 
                      onClick={() => handleDelete(inv.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FORM MODAL */}
      {isFormOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">Proses Invoice & Pembayaran</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1">No. Invoice</label>
                   <input type="text" className="w-full border rounded p-2 text-gray-900 font-bold bg-gray-50" 
                     value={invNo} onChange={(e) => setInvNo(e.target.value)} />
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1">Tanggal</label>
                   <input type="date" className="w-full border rounded p-2 text-gray-900 font-medium" 
                     value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                </div>
              </div>

              {/* STATUS PEMBAYARAN (FIX: Agar Status Berubah) */}
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                <label className="block text-sm font-bold text-gray-900 mb-2">Status Pembayaran</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="payment" value="unpaid" 
                      checked={paymentStatus === 'unpaid'} 
                      onChange={() => setPaymentStatus('unpaid')}
                      className="w-5 h-5 text-red-600" />
                    <span className="text-red-700 font-bold">Belum Bayar (Tempo)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="payment" value="paid" 
                      checked={paymentStatus === 'paid'} 
                      onChange={() => setPaymentStatus('paid')}
                      className="w-5 h-5 text-green-600" />
                    <span className="text-green-700 font-bold">LUNAS</span>
                  </label>
                </div>
              </div>

              {/* Kalkulasi */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sub Total</span>
                  <span className="font-bold">Rp {modalSubTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 flex items-center gap-1"><Percent size={14}/> Diskon (%)</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" min="0" max="100"
                      className="w-16 border border-blue-300 rounded p-1 text-center font-bold text-red-600" 
                      value={discountRate} onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)} 
                    />
                    <span className="text-gray-500 text-xs font-medium bg-white px-2 py-1 rounded border">
                      - Rp {modalDiscountVal.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">PPN</span>
                  <span className="font-bold">Rp {modalTax.toLocaleString()}</span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between text-lg font-bold text-blue-900">
                  <span>TOTAL TAGIHAN</span>
                  <span>Rp {modalGrandTotal.toLocaleString()}</span>
                </div>
                <p className="text-xs text-center italic text-blue-600">
                  "{terbilang(modalGrandTotal)} Rupiah"
                </p>
              </div>

              {/* Tanda Tangan */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2 border-b pb-1">Penanda Tangan</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Disiapkan</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" 
                      value={makerName} onChange={(e) => setMakerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Disetujui</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" 
                      value={approvedName} onChange={(e) => setApprovedName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Diterima</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" 
                      value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t bg-gray-50">
              <button 
                onClick={handleSaveAndPrint}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg flex justify-center items-center gap-2"
              >
                <Printer size={20} /> SIMPAN & CETAK
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}