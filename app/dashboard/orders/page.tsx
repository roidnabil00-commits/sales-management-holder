// app/dashboard/orders/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ShoppingCart, Plus, Trash2, Save, Printer, RefreshCw, Calendar, Hash, User, FileSignature, Barcode, Pencil, Search as SearchIcon, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Tipe Data
type Product = { id: number; name: string; price: number; unit: string; barcode: string | null }
type Customer = { id: number; name: string; address: string }
type OrderItem = { product_id: number; product_name: string; barcode: string | null; price: number; unit: string; qty: number }
type OrderHistory = { 
  id: number; 
  order_no: string; 
  customer: { name: string }; 
  total_amount: number; 
  created_at: string;
  tax_amount?: number;
  maker_name?: string;
  receiver_name?: string;
  items?: any[];
}

export default function OrdersPage() {
  // State Data Master
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<OrderHistory[]>([]) 
  const [loading, setLoading] = useState(true)
  
  // State Form Transaksi
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false) // Mode Edit
  const [editingId, setEditingId] = useState<number | null>(null) // ID yang diedit

  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [cart, setCart] = useState<OrderItem[]>([]) 
  
  // State Input Detail Order
  const [customOrderNo, setCustomOrderNo] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [taxRate, setTaxRate] = useState(0) // PPN dalam Persen (%)
  const [makerName, setMakerName] = useState('') 
  const [receiverName, setReceiverName] = useState('') 

  // State Search
  const [searchTerm, setSearchTerm] = useState('')

  // State Helper Tambah Barang
  const [selectedProduct, setSelectedProduct] = useState('')
  const [inputQty, setInputQty] = useState(1)
  const [inputPrice, setInputPrice] = useState(0)
  const [inputPriceDisplay, setInputPriceDisplay] = useState('') 

  useEffect(() => {
    fetchInitialData()
  }, [])

  // Generate No Order Otomatis
  const generateAutoNo = () => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 99) + 1
    return `${yyyy}${mm}-${dd}${String(random).padStart(2, '0')}`
  }

  // Reset Form
  const resetForm = () => {
    setCustomOrderNo(generateAutoNo())
    setCustomDate(new Date().toISOString().split('T')[0])
    setTaxRate(0)
    setMakerName('Admin Sales') 
    setReceiverName('')
    setCart([])
    setSelectedCustomerId('')
    setIsEditing(false)
    setEditingId(null)
  }

  // Buka Form Baru
  const handleOpenNew = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const fetchInitialData = async () => {
    setLoading(true)
    const { data: custData } = await supabase.from('customers').select('id, name, address')
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)
    
    // Ambil History
    await fetchOrders()

    if (custData) setCustomers(custData)
    if (prodData) setProducts(prodData)
    setLoading(false)
  }

  // Fungsi Fetch Orders (Bisa untuk search)
  const fetchOrders = async (query = '') => {
    setLoading(true)
    let supabaseQuery = supabase
      .from('orders')
      .select('id, order_no, total_amount, created_at, tax_amount, maker_name, receiver_name, customer:customers(name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (query) {
      // Search by Order No
      supabaseQuery = supabaseQuery.ilike('order_no', `%${query}%`)
    }

    const { data } = await supabaseQuery
    if (data) setOrders(data as any)
    setLoading(false)
  }

  // Handle Search Input
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    // Debounce simple: Panggil fetch kalau user berhenti ngetik atau tekan enter (disini kita fetch langsung tiap change biar responsif untuk data dikit, atau pakai button)
    // Untuk performa lebih baik di data banyak, gunakan button "Cari" atau useEffect debounce.
    // Di sini kita filter Client-Side dulu untuk UX cepat pada 50 data terakhir, 
    // TAPI kalau mau cari data lama harus request DB.
    // Kita buat logic: Fetch DB on change
    fetchOrders(e.target.value)
  }

  // --- LOGIC EDIT ORDER (LOAD DATA) ---
  const handleEditOrder = async (orderId: number) => {
    try {
      setLoading(true)
      // 1. Ambil Data Lengkap (Header + Items)
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(product_id, qty, price, product:products(name, unit, barcode))
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) throw new Error('Gagal ambil data pesanan')

      // 2. Isi State Form
      setCustomOrderNo(order.order_no)
      setCustomDate(new Date(order.created_at).toISOString().split('T')[0])
      setSelectedCustomerId(order.customer_id.toString())
      setMakerName(order.maker_name || '')
      setReceiverName(order.receiver_name || '')
      
      // Hitung Tax Rate (%) dari Tax Amount (Rp)
      // Rumus: (Tax / (Total - Tax)) * 100
      const subTotal = order.total_amount - (order.tax_amount || 0)
      const rate = subTotal > 0 ? Math.round(((order.tax_amount || 0) / subTotal) * 100) : 0
      setTaxRate(rate)

      // 3. Isi Cart
      const items = order.items.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product?.name || 'Produk Dihapus',
        barcode: item.product?.barcode,
        price: item.price,
        unit: item.product?.unit || 'pcs',
        qty: item.qty
      }))
      setCart(items)

      // 4. Set Mode Edit
      setIsEditing(true)
      setEditingId(orderId)
      setIsFormOpen(true)

    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- LOGIC GANTI PRODUK ---
  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId)
    const product = products.find(p => p.id === parseInt(productId))
    if (product) {
      setInputPrice(product.price)
      setInputPriceDisplay(new Intl.NumberFormat('id-ID').format(product.price))
    } else {
      setInputPrice(0)
      setInputPriceDisplay('')
    }
  }

  // --- LOGIC INPUT HARGA ---
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const numericValue = rawValue ? parseInt(rawValue) : 0
    const formattedDisplay = rawValue ? new Intl.NumberFormat('id-ID').format(numericValue) : ''
    
    setInputPrice(numericValue)
    setInputPriceDisplay(formattedDisplay)
  }

  // --- LOGIC KERANJANG ---
  const addToCart = () => {
    if (!selectedProduct) return
    const product = products.find(p => p.id === parseInt(selectedProduct))
    if (!product) return

    const existingItemIndex = cart.findIndex(item => item.product_id === product.id)
    if (existingItemIndex >= 0) {
      const newCart = [...cart]
      newCart[existingItemIndex].qty += parseInt(inputQty.toString())
      newCart[existingItemIndex].price = inputPrice 
      setCart(newCart)
    } else {
      setCart([...cart, { 
        product_id: product.id, 
        product_name: product.name, 
        barcode: product.barcode, 
        price: inputPrice,        
        unit: product.unit,
        qty: parseInt(inputQty.toString()) 
      }])
    }
    setSelectedProduct('')
    setInputQty(1)
    setInputPrice(0)
    setInputPriceDisplay('')
  }

  const removeFromCart = (index: number) => {
    const newCart = [...cart]
    newCart.splice(index, 1)
    setCart(newCart)
  }

  const subTotal = cart.reduce((total, item) => total + (item.price * item.qty), 0)
  const taxAmount = (subTotal * taxRate) / 100 
  const grandTotal = subTotal + taxAmount

  // --- LOGIC SIMPAN ORDER (INSERT / UPDATE) ---
  const handleSaveOrder = async () => {
    if (!selectedCustomerId || cart.length === 0 || !customOrderNo) {
      alert('Mohon lengkapi Data Pelanggan, Nomor Pesanan, dan Barang!')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi habis, login ulang.')

      const orderPayload = {
        customer_id: parseInt(selectedCustomerId),
        sales_id: user.id,
        doc_type: 'sales_order',
        status: 'pending',
        total_amount: grandTotal, 
        tax_amount: taxAmount,    
        order_no: customOrderNo,  
        created_at: new Date(customDate).toISOString(), 
        maker_name: makerName,
        receiver_name: receiverName
      }

      let savedOrderId = editingId

      if (isEditing && editingId) {
        // --- MODE UPDATE ---
        // 1. Update Header
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', editingId)
        
        if (updateError) throw updateError

        // 2. Hapus Item Lama
        const { error: deleteItemError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', editingId)
        
        if (deleteItemError) throw deleteItemError

      } else {
        // --- MODE INSERT ---
        const { data: newOrder, error: insertError } = await supabase
          .from('orders')
          .insert([orderPayload])
          .select()
          .single()
        
        if (insertError) throw insertError
        savedOrderId = newOrder.id
      }

      // 3. Insert Item Baru (Untuk Edit maupun Insert)
      const orderItemsData = cart.map(item => ({
        order_id: savedOrderId,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData)
      if (itemsError) throw itemsError

      alert(`Pesanan Berhasil ${isEditing ? 'Diperbarui' : 'Disimpan'}!`)
      setIsFormOpen(false)
      fetchOrders() 

      if(confirm('Cetak Surat Pesanan sekarang?')) {
        if(savedOrderId) generatePDF(savedOrderId)
      }

    } catch (error: any) {
      alert('Gagal simpan: ' + error.message)
    }
  }

  // --- LOGIC HAPUS ORDER ---
  const handleDeleteOrder = async (id: number) => {
    if(!confirm("HAPUS PESANAN INI? \nData yang dihapus tidak bisa dikembalikan.")) return;

    try {
      await supabase.from('order_items').delete().eq('order_id', id)
      const { error } = await supabase.from('orders').delete().eq('id', id)
      
      if(error) throw error
      alert('Data berhasil dihapus dari database.')
      fetchOrders()
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  // --- LOGIC GENERATE PDF ---
  const generatePDF = async (orderId: number) => {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(name, address, phone),
          items:order_items(qty, price, product:products(name, unit, barcode))
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) throw new Error('Data tidak ditemukan')

      const doc = new jsPDF()
      
      // HEADER BERSIH
      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('XANDER SYSTEMS', 14, 20)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('Distribusi Roti & Kue Pilihan', 14, 26)
      doc.text('Jl. Raya Puncak No. 1, Bogor', 14, 31)

      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('SALES ORDER', 140, 20)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`No: ${order.order_no}`, 140, 26)
      doc.text(`Tgl: ${new Date(order.created_at).toLocaleDateString('id-ID')}`, 140, 31)

      doc.line(14, 38, 196, 38)

      doc.text('Kepada Yth:', 14, 48)
      doc.setFont('helvetica', 'bold')
      doc.text(order.customer.name, 14, 53)
      doc.setFont('helvetica', 'normal')
      doc.text(order.customer.address || '-', 14, 58)

      const tableRows = order.items.map((item: any) => [
        item.product.barcode || '-',
        item.product.name,
        `${item.qty} ${item.product.unit}`,
        `Rp ${item.price.toLocaleString()}`,
        `Rp ${(item.qty * item.price).toLocaleString()}`
      ])

      autoTable(doc, {
        startY: 68,
        head: [['Barcode', 'Nama Barang', 'Qty', 'Harga', 'Total']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 35 } } 
      })

      const finalY = (doc as any).lastAutoTable.finalY + 5
      const tax = order.tax_amount || 0
      const subTotal = order.total_amount - tax
      const grandTotal = order.total_amount

      doc.setFont('helvetica', 'normal')
      doc.text('Sub Total:', 140, finalY + 5);      doc.text(`Rp ${subTotal.toLocaleString()}`, 190, finalY + 5, { align: 'right' })
      doc.text(`PPN:`, 140, finalY + 10);           doc.text(`Rp ${tax.toLocaleString()}`, 190, finalY + 10, { align: 'right' })
      
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('TOTAL BAYAR:', 140, finalY + 18);    doc.text(`Rp ${grandTotal.toLocaleString()}`, 190, finalY + 18, { align: 'right' })

      const signY = finalY + 30
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('Dibuat Oleh,', 20, signY)
      doc.text('Diterima Oleh,', 100, signY)

      doc.setFont('helvetica', 'bold');
      doc.text(`( ${order.maker_name || 'Admin'} )`, 20, signY + 25)
      doc.text(`( ${order.receiver_name || 'Pelanggan'} )`, 100, signY + 25)

      doc.save(`SO-${order.order_no}.pdf`)

    } catch (err: any) {
      alert('Gagal cetak PDF: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pesanan Penjualan (SO)</h2>
          <p className="text-sm text-gray-700 font-medium">Buat pesanan & cetak faktur resmi</p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 font-bold transition"
        >
          <Plus size={20} /> Buat Pesanan
        </button>
      </div>

      {/* --- SEARCH & LIST --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            Riwayat Transaksi
            {loading && <RefreshCw size={14} className="animate-spin text-gray-500"/>}
          </h3>
          
          {/* SEARCH BAR */}
          <div className="relative w-full md:w-64">
            <SearchIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari No. Order..." 
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {orders.length === 0 ? (
             <div className="p-8 text-center text-gray-400">
               {searchTerm ? 'Pesanan tidak ditemukan' : 'Belum ada transaksi'}
             </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-blue-50 transition gap-4 group">
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-blue-700 text-lg">{order.order_no}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200 font-bold">
                      {new Date(order.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-900 font-bold">
                    <span>{order.customer?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <span className="font-bold text-gray-900 text-xl">
                    Rp {order.total_amount.toLocaleString()}
                  </span>
                  
                  <div className="flex gap-2">
                    {/* EDIT BUTTON */}
                    <button 
                      onClick={() => handleEditOrder(order.id)}
                      className="p-2 text-blue-500 border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm"
                      title="Edit Pesanan"
                    >
                      <Pencil size={18} />
                    </button>

                    <button 
                      onClick={() => generatePDF(order.id)}
                      className="p-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-white hover:text-blue-600 hover:border-blue-300 transition shadow-sm"
                      title="Cetak PDF"
                    >
                      <Printer size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteOrder(order.id)}
                      className="p-2 text-red-400 border border-transparent rounded-lg hover:bg-red-50 hover:text-red-600 transition"
                      title="Hapus Data"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* --- MODAL FORM --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">
                {isEditing ? 'Edit Pesanan' : 'Form Pesanan Baru'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-600 font-bold">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                   <label className="text-xs font-bold text-blue-800 uppercase mb-1 flex items-center gap-1"><Hash size={14}/> No. Pesanan</label>
                   <input type="text" className="w-full border border-blue-200 rounded-lg p-2.5 text-gray-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                     value={customOrderNo} onChange={(e) => setCustomOrderNo(e.target.value)} />
                </div>
                <div>
                   <label className="text-xs font-bold text-blue-800 uppercase mb-1 flex items-center gap-1"><Calendar size={14}/> Tanggal Pesanan</label>
                   <input type="date" className="w-full border border-blue-200 rounded-lg p-2.5 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none" 
                     value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">Pelanggan</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    const cust = customers.find(c => c.id === parseInt(e.target.value));
                    if(cust) setReceiverName(cust.name);
                  }}
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-900 mb-2">Tambah Barang</label>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Produk</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 font-medium bg-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedProduct}
                      onChange={(e) => handleProductChange(e.target.value)}
                    >
                      <option value="">-- Pilih Produk --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-40">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Harga (Rp)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      value={inputPriceDisplay}
                      onChange={handlePriceChange}
                      placeholder="0"
                    />
                  </div>

                  <div className="w-full md:w-24">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Qty</label>
                    <input 
                      type="number" min="1"
                      className="w-full border border-gray-300 rounded-lg p-3 text-center text-gray-900 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      value={inputQty}
                      onChange={(e) => setInputQty(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="flex items-end">
                    <button 
                      onClick={addToCart}
                      className="bg-blue-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md h-[46px]"
                    >
                      <Plus size={22}/>
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-800 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Barcode</th>
                      <th className="px-4 py-3">Barang</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">Harga</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {cart.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-mono text-gray-600 text-xs">{item.barcode || '-'}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">{item.product_name}</td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">{item.qty} {item.unit}</td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">Rp {item.price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          Rp {(item.price * item.qty).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {cart.length > 0 && (
                    <tfoot className="bg-gray-50 text-gray-900">
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-right font-bold text-gray-600">Sub Total</td>
                        <td className="px-4 py-2 text-right font-bold">Rp {subTotal.toLocaleString()}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-right font-bold text-gray-600 flex items-center justify-end gap-2">
                           PPN (%)
                           <input 
                            type="number" min="0" max="100"
                            className="w-16 border border-blue-300 rounded p-1 text-center text-sm font-bold text-blue-600" 
                            value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} 
                           />
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-red-600">+ Rp {taxAmount.toLocaleString()}</td>
                        <td></td>
                      </tr>
                      <tr className="bg-gray-900 text-white text-lg">
                        <td colSpan={4} className="px-4 py-3 text-right font-bold">GRAND TOTAL</td>
                        <td className="px-4 py-3 text-right font-bold">Rp {grandTotal.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Pembuat (Sales/Admin)</label>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2.5 bg-white">
                      <User size={16} className="text-gray-400"/>
                      <input type="text" className="bg-transparent outline-none w-full text-gray-900 font-bold" 
                        value={makerName} onChange={(e) => setMakerName(e.target.value)} placeholder="Nama Anda" />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Penerima (Pelanggan)</label>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2.5 bg-white">
                      <FileSignature size={16} className="text-gray-400"/>
                      <input type="text" className="bg-transparent outline-none w-full text-gray-900 font-bold" 
                        value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Nama Customer" />
                    </div>
                 </div>
              </div>

            </div>

            <div className="p-5 border-t border-gray-200 bg-white">
              <button 
                onClick={handleSaveOrder}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-xl shadow-green-100 flex justify-center items-center gap-2 transition transform active:scale-95"
              >
                <Save size={22} /> {isEditing ? 'UPDATE PESANAN' : 'SIMPAN PESANAN'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}