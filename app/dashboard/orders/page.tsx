// app/dashboard/orders/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ShoppingCart, Plus, Trash2, Save, Printer, FileText, Search, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Tipe Data
type Product = { id: number; name: string; price: number; unit: string }
type Customer = { id: number; name: string; address: string }
type OrderItem = { product_id: number; product_name: string; price: number; qty: number }
type OrderHistory = { 
  id: number; 
  order_no: string; 
  customer: { name: string }; 
  total_amount: number; 
  created_at: string;
  items?: any[] // Untuk keperluan cetak
}

export default function OrdersPage() {
  // State Data Master
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<OrderHistory[]>([]) // State untuk History
  const [loading, setLoading] = useState(true)
  
  // State Form Transaksi
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [cart, setCart] = useState<OrderItem[]>([]) 
  
  // State Helper
  const [selectedProduct, setSelectedProduct] = useState('')
  const [inputQty, setInputQty] = useState(1)

  // 1. Load Data Master & History Pesanan
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    // Ambil Customer & Produk
    const { data: custData } = await supabase.from('customers').select('id, name, address')
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)
    
    // Ambil History Order (Terbaru diatas)
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, order_no, total_amount, created_at, customer:customers(name)')
      .order('created_at', { ascending: false })
      .limit(20) // Ambil 20 terakhir aja biar ringan

    if (custData) setCustomers(custData)
    if (prodData) setProducts(prodData)
    if (orderData) setOrders(orderData as any)
    setLoading(false)
  }

  // --- LOGIC KERANJANG (Sama seperti sebelumnya) ---
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

  // --- LOGIC SIMPAN ORDER ---
  const handleSaveOrder = async () => {
    if (!selectedCustomerId || cart.length === 0) {
      alert('Pilih pelanggan dan minimal 1 barang!')
      return
    }

    if (!confirm(`Buat pesanan senilai Rp ${grandTotal.toLocaleString()}?`)) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi habis, login ulang.')

      // 1. Simpan Header
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
            customer_id: parseInt(selectedCustomerId),
            sales_id: user.id,
            doc_type: 'sales_order',
            status: 'pending',
            total_amount: grandTotal,
            order_no: `INV-${Date.now().toString().slice(-6)}` // Generate No Pendek
          }])
        .select().single()

      if (orderError) throw orderError

      // 2. Simpan Detail
      const orderItemsData = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData)
      if (itemsError) throw itemsError

      alert('Pesanan Berhasil Disimpan!')
      setIsFormOpen(false)
      setCart([])
      setSelectedCustomerId('')
      fetchInitialData() // Refresh list history

      // Tawarkan langsung cetak?
      if(confirm('Mau cetak notanya sekarang?')) {
        generatePDF(orderData.id)
      }

    } catch (error: any) {
      alert('Gagal simpan: ' + error.message)
    }
  }

  // --- LOGIC GENERATE PDF (INVOICE) ---
  const generatePDF = async (orderId: number) => {
    try {
      // 1. Ambil data lengkap (Header + Customer + Items)
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(name, address, phone),
          items:order_items(qty, price, product:products(name, unit))
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) throw new Error('Data tidak ditemukan')

      // 2. Setup PDF (Ukuran A4 atau Struk?) Kita pakai A4 standar dulu
      const doc = new jsPDF()
      
      // Header
      doc.setFontSize(18)
      doc.text('XANDER BAKERY', 14, 20)
      doc.setFontSize(10)
      doc.text('Distribusi Roti & Kue', 14, 25)
      doc.text('Jl. Teknologi No. 1, Jakarta', 14, 30)
      
      doc.setFontSize(16)
      doc.text('Sales Order', 140, 20)
      
      // Info Customer & Order
      doc.setFontSize(10)
      doc.text(`No. Faktur : ${order.order_no}`, 140, 30)
      doc.text(`Tanggal    : ${new Date(order.created_at).toLocaleDateString('id-ID')}`, 140, 35)
      
      doc.text('Kepada Yth:', 14, 45)
      doc.setFont('helvetica', 'bold')
      doc.text(order.customer.name, 14, 50)
      doc.setFont('helvetica', 'normal')
      doc.text(order.customer.address || '-', 14, 55)

      // Tabel Barang
      const tableRows = order.items.map((item: any) => [
        item.product.name,
        `${item.qty} ${item.product.unit}`,
        `Rp ${item.price.toLocaleString()}`,
        `Rp ${(item.qty * item.price).toLocaleString()}`
      ])

      autoTable(doc, {
        startY: 65,
        head: [['Nama Barang', 'Qty', 'Harga', 'Total']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
      })

      // Grand Total
      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.text(`GRAND TOTAL: Rp ${order.total_amount.toLocaleString()}`, 140, finalY)
      
      // Footer
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text('Terima kasih telah berbelanja.', 14, finalY + 20)
      doc.text('Barang yang sudah dibeli tidak dapat ditukar kecuali basi.', 14, finalY + 25)

      // Save/Download
      doc.save(`Faktur-${order.order_no}.pdf`)

    } catch (err: any) {
      alert('Gagal cetak PDF: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Pesanan Penjualan</h2>
          <p className="text-sm text-gray-500">Buat pesanan dan cetak faktur</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"
        >
          <Plus size={18} /> Pesanan Baru
        </button>
      </div>

      {/* --- LIST HISTORY PESANAN (Sekarang sudah dinamis!) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700">Riwayat Transaksi</h3>
          <span className="text-xs text-gray-500">20 Transaksi Terakhir</span>
        </div>
        
        <div className="divide-y divide-gray-100">
          {loading ? (
             <p className="p-8 text-center text-gray-400">Loading data...</p>
          ) : orders.length === 0 ? (
             <div className="p-8 text-center text-gray-400">Belum ada transaksi</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-gray-50 transition gap-4">
                
                {/* Info Order */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-blue-600 text-lg">{order.order_no}</span>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full capitalize">
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">{order.customer?.name}</span>
                    <span className="text-gray-300">•</span>
                    <span>{new Date(order.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>

                {/* Total & Action */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <span className="font-bold text-gray-800 text-lg">
                    Rp {order.total_amount.toLocaleString()}
                  </span>
                  
                  <button 
                    onClick={() => generatePDF(order.id)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-blue-600 transition"
                    title="Download Invoice PDF"
                  >
                    <Printer size={16} />
                    <span className="hidden md:inline">Cetak</span>
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* --- MODAL FORM TRANSAKSI (Sama seperti sebelumnya) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Form Pesanan Baru</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500">Tutup</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Select Pelanggan */}
              <div>
                <label className="block text-sm font-medium mb-1">Pelanggan</label>
                <select className="w-full border rounded-lg p-2.5 bg-white text-black" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Add Cart Section */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex gap-2">
                  <select className="flex-1 border rounded-lg p-2 text-black" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                    <option value="">-- Pilih Produk --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" min="1" className="w-16 border rounded-lg p-2 text-center text-black" value={inputQty} onChange={(e) => setInputQty(parseInt(e.target.value))} />
                  <button onClick={addToCart} className="bg-blue-600 text-white px-3 py-2 rounded-lg"><Plus size={18}/></button>
                </div>
              </div>
              {/* Cart Table */}
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100"><tr><th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2 text-right">Total</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {cart.map((item, i) => (
                    <tr key={i}><td className="p-2">{item.product_name}</td><td className="p-2">x{item.qty}</td><td className="p-2 text-right">{(item.price * item.qty).toLocaleString()}</td>
                    <td className="p-2"><button onClick={() => removeFromCart(i)} className="text-red-500"><Trash2 size={14}/></button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-white">
              <button onClick={handleSaveOrder} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">SIMPAN & CETAK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}