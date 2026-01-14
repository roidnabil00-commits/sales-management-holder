// app/dashboard/quotation/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FileText, Plus, Trash2, Printer, ArrowRightCircle, Calendar, Hash, Search, Save, CheckSquare, Square } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Tipe Data
type Product = { id: number; name: string; price: number; unit: string }
type Customer = { id: number; name: string; address: string; phone: string }
type Quotation = { 
  id: number; 
  order_no: string; 
  customer: { name: string }; 
  total_amount: number; 
  created_at: string; // Tanggal Surat
  status: string;
}

// Tipe untuk Selection Product (Checklist)
type ProductSelection = Product & {
  isSelected: boolean;
  qty: number;
}

export default function QuotationPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<ProductSelection[]>([]) // State Produk untuk Checklist
  const [loading, setLoading] = useState(true)
  
  // State Form
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [searchProductTerm, setSearchProductTerm] = useState('') // Search di dalam Modal Checklist
  
  // State Detail Surat
  const [subject, setSubject] = useState('Penawaran Harga Produk Bakery')
  const [notes, setNotes] = useState('1. Harga berlaku selama 14 hari.\n2. Pembayaran DP 50% diawal.\n3. Barang yang sudah dibeli tidak dapat ditukar.')
  
  // State Custom Input
  const [customOrderNo, setCustomOrderNo] = useState('')
  const [customDate, setCustomDate] = useState('')

  useEffect(() => {
    fetchInitialData()
  }, [])

  // Set default saat form dibuka
  useEffect(() => {
    if (isFormOpen) {
      const today = new Date().toISOString().split('T')[0]
      setCustomDate(today)
      setCustomOrderNo(`Q-${Date.now().toString().slice(-6)}`) 
      // Reset checklist produk saat buka form baru
      const resetProducts = products.map(p => ({ ...p, isSelected: false, qty: 1 }))
      setProducts(resetProducts)
    }
  }, [isFormOpen])

  const fetchInitialData = async () => {
    setLoading(true)
    const { data: custData } = await supabase.from('customers').select('id, name, address, phone')
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)
    
    const { data: quoteData } = await supabase
      .from('orders')
      .select('id, order_no, total_amount, created_at, status, customer:customers(name)')
      .eq('doc_type', 'quotation')
      .order('created_at', { ascending: false })

    if (custData) setCustomers(custData)
    // Transform produk biar punya state 'isSelected' dan 'qty'
    if (prodData) {
      const prods = prodData.map((p: any) => ({ ...p, isSelected: false, qty: 1 }))
      setProducts(prods)
    }
    if (quoteData) setQuotations(quoteData as any)
    setLoading(false)
  }

  // --- LOGIC CHECKLIST PRODUCT ---
  const toggleProductSelection = (id: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) return { ...p, isSelected: !p.isSelected }
      return p
    }))
  }

  const updateProductQty = (id: number, val: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) return { ...p, qty: val > 0 ? val : 1 }
      return p
    }))
  }

  // Hitung Barang Terpilih
  const selectedItems = products.filter(p => p.isSelected)
  const grandTotal = selectedItems.reduce((total, item) => total + (item.price * item.qty), 0)

  // Filter Tampilan Produk di Modal
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProductTerm.toLowerCase())
  )

  // --- LOGIC SIMPAN PENAWARAN (DIRECT PRINT) ---
  const handleSaveQuotation = async () => {
    if (!selectedCustomerId || selectedItems.length === 0 || !customOrderNo || !customDate) {
      alert('Mohon lengkapi Data Pelanggan dan Pilih minimal 1 Produk!')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi habis.')

      // 1. Simpan Header
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
            customer_id: parseInt(selectedCustomerId),
            sales_id: user.id,
            doc_type: 'quotation',
            status: 'draft',
            total_amount: grandTotal,
            order_no: customOrderNo,
            created_at: new Date(customDate).toISOString()
          }])
        .select().single()

      if (orderError) throw orderError

      // 2. Simpan Detail Barang (Dari Checklist)
      const orderItemsData = selectedItems.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        qty: item.qty,
        price: item.price
      }))

      await supabase.from('order_items').insert(orderItemsData)

      // 3. Generate PDF Langsung (Tanpa Confirm, Tanpa Download)
      // Kita buat object dummy agar bisa langsung diprint tanpa fetch ulang
      const printData = {
        ...orderData,
        customer: customers.find(c => c.id === parseInt(selectedCustomerId)),
        items: selectedItems.map(item => ({
          product: { name: item.name, unit: item.unit },
          qty: item.qty,
          price: item.price
        }))
      }
      
      await generateProposalPDF(printData, true) // True = Mode Popup Print

      alert('Penawaran Berhasil Disimpan & Dicetak!')
      setIsFormOpen(false)
      fetchInitialData() // Refresh list

    } catch (error: any) {
      alert('Gagal simpan: ' + error.message)
    }
  }

  // --- LOGIC HAPUS ---
  const handleDeleteQuotation = async (id: number) => {
    if (!confirm('Yakin hapus penawaran ini? Data tidak bisa dikembalikan.')) return
    try {
      await supabase.from('order_items').delete().eq('order_id', id)
      const { error } = await supabase.from('orders').delete().eq('id', id)
      if (error) throw error
      alert('Penawaran berhasil dihapus.')
      fetchInitialData()
    } catch (error: any) {
      alert('Gagal hapus: ' + error.message)
    }
  }

  // --- LOGIC CONVERT KE SO ---
  const convertToOrder = async (quoteId: number) => {
    if(!confirm('Deal? Ubah Penawaran ini menjadi Pesanan Penjualan (SO)?')) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          doc_type: 'sales_order', 
          status: 'pending',
          order_no: `SO-${Date.now().toString().slice(-6)}`,
          created_at: new Date().toISOString()
        })
        .eq('id', quoteId)
      if (error) throw error
      alert('Berhasil! Penawaran sudah menjadi Pesanan. Cek menu Pesanan (SO).')
      fetchInitialData()
    } catch (err: any) {
      alert('Gagal convert: ' + err.message)
    }
  }

  // --- CETAK PDF (Flexible Mode: ID atau Object Data) ---
  const generateProposalPDF = async (input: number | any, isDirectObject = false) => {
    let order: any;

    if (isDirectObject) {
      order = input;
    } else {
      // Kalau input ID, fetch dulu
      const { data, error } = await supabase
        .from('orders')
        .select(`*, customer:customers(*), items:order_items(*, product:products(*))`)
        .eq('id', input)
        .single()
      if (error) return alert('Gagal ambil data PDF')
      order = data;
    }

    const doc = new jsPDF()
    
    // KOP SURAT
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('XANDER SYSTEMS & BAKERY', 14, 20)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Jl. Teknologi Masa Depan No. 1, Jakarta Selatan', 14, 26)
    doc.text('Email: sales@xander.com | Telp: 021-555-888', 14, 31)
    doc.line(14, 35, 196, 35)

    // INFO
    const suratDate = new Date(order.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})
    doc.text(`Jakarta, ${suratDate}`, 140, 45)
    
    doc.text('Kepada Yth,', 14, 45)
    doc.setFont('helvetica', 'bold')
    doc.text(order.customer.name, 14, 50)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customer.address || '', 14, 55)

    doc.setFont('helvetica', 'bold')
    doc.text(`Nomor   : ${order.order_no}`, 14, 65)
    doc.text(`Perihal : ${subject}`, 14, 70)
    
    doc.setFont('helvetica', 'normal')
    doc.text('Dengan hormat,', 14, 80)
    doc.text('Bersama ini kami mengajukan penawaran harga untuk produk bakery dengan rincian sebagai berikut:', 14, 86)

    // TABEL
    const tableRows = order.items.map((item: any) => [
      item.product.name,
      `${item.qty} ${item.product.unit}`,
      `Rp ${item.price.toLocaleString()}`,
      `Rp ${(item.qty * item.price).toLocaleString()}`
    ])

    autoTable(doc, {
      startY: 95,
      head: [['Nama Produk', 'Qty', 'Harga Satuan', 'Total']],
      body: tableRows,
      theme: 'plain',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontStyle: 'bold' }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10

    doc.setFont('helvetica', 'bold')
    doc.text(`Total Penawaran: Rp ${order.total_amount.toLocaleString()}`, 140, finalY)

    doc.setFontSize(10)
    doc.text('Syarat dan Ketentuan:', 14, finalY + 15)
    doc.setFont('helvetica', 'normal')
    const splitNotes = doc.splitTextToSize(notes, 180)
    doc.text(splitNotes, 14, finalY + 22)

    doc.text('Demikian penawaran ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.', 14, finalY + 45)

    doc.text('Hormat Kami,', 14, finalY + 60)
    doc.text('Xander Sales Team', 14, finalY + 85)

    // POPUP PRINT
    doc.autoPrint();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Penawaran (Quotation)</h2>
          <p className="text-sm text-gray-600">Buat surat penawaran & kontrak resmi</p>
        </div>
        <button onClick={() => setIsFormOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 shadow-lg font-medium transition">
          <Plus size={18} /> Buat Penawaran
        </button>
      </div>

      {/* LIST QUOTATION */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? <p className="text-center text-gray-400">Loading...</p> : quotations.length === 0 ? (
          <div className="text-center p-8 border border-dashed rounded-xl text-gray-400">Belum ada penawaran dibuat.</div>
        ) : (
          quotations.map((q) => (
            <div key={q.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 hover:shadow-md transition">
              <div>
                <div className="flex items-center gap-2 mb-1">
                   <h4 className="font-bold text-gray-900 text-lg">{q.customer?.name}</h4>
                   <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 font-medium">
                     {q.order_no}
                   </span>
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-4">
                  <span>Total: <span className="font-bold">Rp {q.total_amount.toLocaleString()}</span></span>
                  <span className="text-gray-300">|</span>
                  <span>Tgl: {new Date(q.created_at).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => handleDeleteQuotation(q.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
                  <Trash2 size={18} />
                </button>
                <button onClick={() => generateProposalPDF(q.id)} className="px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2 text-sm font-medium" title="Cetak Surat">
                  <Printer size={16} /> Surat
                </button>
                <button onClick={() => convertToOrder(q.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold shadow-sm" title="Deal">
                  Deal <ArrowRightCircle size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FORM MODAL - FULLSCREEN AGAR LEGA */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-900 text-lg">Buat Penawaran Baru</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">Tutup</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50/50">
              
              {/* Header Info */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No. Surat</label>
                  <input type="text" className="w-full border rounded p-2 text-gray-900 font-bold" value={customOrderNo} onChange={(e) => setCustomOrderNo(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tanggal</label>
                  <input type="date" className="w-full border rounded p-2 text-gray-900" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-900 mb-1">Kepada Pelanggan <span className="text-red-500">*</span></label>
                  <select className="w-full border rounded-lg p-2.5 text-gray-900 bg-white" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                    <option value="">-- Pilih Pelanggan --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* LIST PRODUK (CHECKLIST) - BAGIAN BARU */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2"><CheckSquare size={18}/> Pilih Produk</h4>
                  <div className="relative">
                    <Search className="absolute left-2 top-2 text-gray-400" size={16} />
                    <input 
                      type="text" placeholder="Cari barang..." 
                      className="pl-8 pr-3 py-1.5 border rounded-lg text-sm text-gray-900 w-48"
                      value={searchProductTerm} onChange={e => setSearchProductTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[300px] border rounded-lg divide-y divide-gray-100">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className={`p-3 flex items-center gap-3 hover:bg-gray-50 transition ${product.isSelected ? 'bg-purple-50' : ''}`}>
                      {/* Checkbox Area */}
                      <div onClick={() => toggleProductSelection(product.id)} className="cursor-pointer">
                        {product.isSelected ? (
                          <CheckSquare className="text-purple-600" size={24} />
                        ) : (
                          <Square className="text-gray-300" size={24} />
                        )}
                      </div>

                      {/* Info Produk */}
                      <div className="flex-1 cursor-pointer" onClick={() => toggleProductSelection(product.id)}>
                        <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">Rp {product.price.toLocaleString()} / {product.unit}</p>
                      </div>

                      {/* Input Qty (Hanya Muncul Jika Dipilih) */}
                      {product.isSelected && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-bold">Qty:</span>
                          <input 
                            type="number" min="1"
                            className="w-16 border border-purple-300 rounded p-1 text-center font-bold text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                            value={product.qty}
                            onChange={(e) => updateProductQty(product.id, parseInt(e.target.value))}
                            onClick={(e) => e.stopPropagation()} // Biar gak trigger checklist
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredProducts.length === 0 && <p className="p-4 text-center text-gray-400 text-sm">Produk tidak ditemukan.</p>}
                </div>

                {/* Footer Total */}
                <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-600">{selectedItems.length} barang dipilih</span>
                  <span className="text-lg font-bold text-purple-700">Total: Rp {grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Detail Surat */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Perihal</label>
                  <input type="text" className="w-full border rounded p-2 text-sm text-gray-900" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Syarat & Ketentuan</label>
                  <textarea rows={3} className="w-full border rounded p-2 text-sm text-gray-900" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

            </div>

            {/* Tombol Aksi */}
            <div className="p-5 border-t bg-white">
              <button 
                onClick={handleSaveQuotation}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-200 flex justify-center items-center gap-2"
              >
                <Printer size={20} /> SIMPAN & GENERATE SURAT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}