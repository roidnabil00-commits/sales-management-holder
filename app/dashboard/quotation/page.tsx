// app/dashboard/quotation/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FileText, Plus, Trash2, Printer, ArrowRightCircle, Send } from 'lucide-react'
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
  created_at: string;
  status: string;
}

export default function QuotationPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  // State Form
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [cart, setCart] = useState<any[]>([]) 
  const [selectedProduct, setSelectedProduct] = useState('')
  const [inputQty, setInputQty] = useState(1)
  
  // Tambahan Khusus Penawaran
  const [subject, setSubject] = useState('Penawaran Harga Produk Bakery') // Perihal
  const [notes, setNotes] = useState('1. Harga berlaku selama 14 hari.\n2. Pembayaran DP 50% diawal.\n3. Barang yang sudah dibeli tidak dapat ditukar.') // Klausul Kontrak

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    const { data: custData } = await supabase.from('customers').select('id, name, address, phone')
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)
    
    // Ambil data yang doc_type = 'quotation'
    const { data: quoteData } = await supabase
      .from('orders')
      .select('id, order_no, total_amount, created_at, status, customer:customers(name)')
      .eq('doc_type', 'quotation')
      .order('created_at', { ascending: false })

    if (custData) setCustomers(custData)
    if (prodData) setProducts(prodData)
    if (quoteData) setQuotations(quoteData as any)
    setLoading(false)
  }

  // --- LOGIC KERANJANG (Sama) ---
  const addToCart = () => {
    if (!selectedProduct) return
    const product = products.find(p => p.id === parseInt(selectedProduct))
    if (!product) return

    const existingItemIndex = cart.findIndex(item => item.product_id === product.id)
    if (existingItemIndex >= 0) {
      const newCart = [...cart]
      newCart[existingItemIndex].qty += parseInt(inputQty.toString())
      setCart(newCart)
    } else {
      setCart([...cart, { 
        product_id: product.id, product_name: product.name, price: product.price, qty: parseInt(inputQty.toString()) 
      }])
    }
    setSelectedProduct('')
    setInputQty(1)
  }

  const removeFromCart = (index: number) => {
    const newCart = [...cart]
    newCart.splice(index, 1)
    setCart(newCart)
  }

  const grandTotal = cart.reduce((total, item) => total + (item.price * item.qty), 0)

  // --- LOGIC SIMPAN PENAWARAN ---
  const handleSaveQuotation = async () => {
    if (!selectedCustomerId || cart.length === 0) {
      alert('Lengkapi data pelanggan dan barang!')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi habis.')

      // 1. Simpan Header (doc_type: quotation)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
            customer_id: parseInt(selectedCustomerId),
            sales_id: user.id,
            doc_type: 'quotation', // <--- PENTING
            status: 'draft', // Status awal Draft
            total_amount: grandTotal,
            order_no: `Q-${Date.now().toString().slice(-6)}` 
          }])
        .select().single()

      if (orderError) throw orderError

      // 2. Simpan Detail Barang
      const orderItemsData = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price
      }))

      await supabase.from('order_items').insert(orderItemsData)

      alert('Penawaran Berhasil Dibuat!')
      setIsFormOpen(false)
      setCart([])
      fetchInitialData()
      
      if(confirm('Cetak Surat Penawaran sekarang?')) {
        generateProposalPDF(orderData.id)
      }

    } catch (error: any) {
      alert('Gagal simpan: ' + error.message)
    }
  }

  // --- LOGIC CONVERT KE SALES ORDER ---
  const convertToOrder = async (quoteId: number) => {
    if(!confirm('Deal? Ubah Penawaran ini menjadi Pesanan Penjualan (SO)?')) return;

    try {
      // Ubah doc_type jadi 'sales_order' dan status jadi 'pending'
      const { error } = await supabase
        .from('orders')
        .update({ 
          doc_type: 'sales_order', 
          status: 'pending',
          order_no: `SO-${Date.now().toString().slice(-6)}` // Generate No Baru
        })
        .eq('id', quoteId)

      if (error) throw error

      alert('Berhasil! Penawaran sudah menjadi Pesanan. Cek menu Pesanan (SO).')
      fetchInitialData() // Refresh list (harusnya hilang dari list penawaran)
    } catch (err: any) {
      alert('Gagal convert: ' + err.message)
    }
  }

  // --- CETAK PDF PENAWARAN (FORMAT SURAT RESMI) ---
  const generateProposalPDF = async (orderId: number) => {
    const { data: order } = await supabase
      .from('orders')
      .select(`*, customer:customers(*), items:order_items(*, product:products(*))`)
      .eq('id', orderId)
      .single()

    const doc = new jsPDF()
    
    // KOP SURAT
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('XANDER SYSTEMS & BAKERY', 14, 20)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Jl. Teknologi Masa Depan No. 1, Jakarta Selatan', 14, 26)
    doc.text('Email: sales@xander.com | Telp: 021-555-888', 14, 31)
    doc.line(14, 35, 196, 35) // Garis pembatas

    // TANGGAL & TUJUAN
    doc.text(`Jakarta, ${new Date().toLocaleDateString('id-ID', {dateStyle: 'long'})}`, 140, 45)
    
    doc.text('Kepada Yth,', 14, 45)
    doc.setFont('helvetica', 'bold')
    doc.text(order.customer.name, 14, 50)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customer.address || '', 14, 55)

    // PERIHAL
    doc.setFont('helvetica', 'bold')
    doc.text(`Perihal: ${subject}`, 14, 70)
    
    // PEMBUKAAN
    doc.setFont('helvetica', 'normal')
    doc.text('Dengan hormat,', 14, 80)
    doc.text('Bersama ini kami mengajukan penawaran harga untuk produk bakery dengan rincian sebagai berikut:', 14, 86)

    // TABEL PRODUK
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

    // TOTAL
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Penawaran: Rp ${order.total_amount.toLocaleString()}`, 140, finalY)

    // SYARAT & KETENTUAN (KONTRAK)
    doc.setFontSize(10)
    doc.text('Syarat dan Ketentuan:', 14, finalY + 15)
    doc.setFont('helvetica', 'normal')
    
    // Split text biar rapi kalau panjang
    const splitNotes = doc.splitTextToSize(notes, 180)
    doc.text(splitNotes, 14, finalY + 22)

    // PENUTUP
    doc.text('Demikian penawaran ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.', 14, finalY + 45)

    // TANDA TANGAN
    doc.text('Hormat Kami,', 14, finalY + 60)
    doc.text('Xander Sales Team', 14, finalY + 85)

    doc.save(`Penawaran-${order.order_no}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Penawaran (Quotation)</h2>
          <p className="text-sm text-gray-500">Buat surat penawaran & kontrak resmi</p>
        </div>
        <button onClick={() => setIsFormOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 shadow-lg">
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
                <div className="flex items-center gap-2">
                   <h4 className="font-bold text-gray-800">{q.customer?.name}</h4>
                   <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">{q.order_no}</span>
                </div>
                <p className="text-sm text-gray-500">Total: Rp {q.total_amount.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</p>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => generateProposalPDF(q.id)} className="px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2 text-sm" title="Cetak Surat">
                  <Printer size={16} /> Surat
                </button>
                <button onClick={() => convertToOrder(q.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium shadow-sm" title="Jadikan Pesanan">
                  Deal <ArrowRightCircle size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold">Buat Penawaran Baru</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400">Tutup</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium mb-1">Kepada Pelanggan</label>
                <select className="w-full border rounded-lg p-2 text-black" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                  <option value="">-- Pilih --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Kontrak Detail */}
              <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2"><FileText size={16}/> Detail Surat</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Perihal / Judul Surat</label>
                  <input type="text" className="w-full border rounded p-2 text-sm text-black" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Syarat & Ketentuan (Klausul)</label>
                  <textarea rows={3} className="w-full border rounded p-2 text-sm text-black" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              {/* Produk */}
              <div>
                <label className="block text-sm font-medium mb-2">Pilih Produk</label>
                <div className="flex gap-2 mb-2">
                  <select className="flex-1 border rounded p-2 text-black" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                     <option value="">-- Produk --</option>
                     {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" className="w-16 border rounded p-2 text-center text-black" value={inputQty} onChange={(e) => setInputQty(parseInt(e.target.value))} />
                  <button onClick={addToCart} className="bg-purple-600 text-white px-3 rounded"><Plus size={18}/></button>
                </div>
                
                {/* List Cart */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Total</th><th className="p-2"></th></tr></thead>
                    <tbody>
                      {cart.map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{item.product_name} <span className="text-xs text-gray-400">x{item.qty}</span></td>
                          <td className="p-2 text-right">{(item.price * item.qty).toLocaleString()}</td>
                          <td className="p-2 text-center"><button onClick={() => removeFromCart(i)} className="text-red-500"><Trash2 size={14}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t">
              <button onClick={handleSaveQuotation} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition">
                SIMPAN PENAWARAN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}