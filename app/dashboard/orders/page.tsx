// app/dashboard/orders/page.tsx
'use client'

import { appConfig } from '@/lib/appConfig'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Plus, Trash2, Printer, RefreshCw, Calendar, Hash, User, 
  FileSignature, Search as SearchIcon, X, CheckSquare, Square, 
  Truck, CreditCard, Edit, ChevronLeft, ChevronRight 
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// --- TIPE DATA ---
type Product = { id: number; name: string; price: number; unit: string; barcode: string | null }
type Customer = { id: number; name: string; address: string }
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
  status: string;         // Status Logistik
  payment_status: string; // Status Bayar
}

// Tipe untuk Selection Product (Checklist)
type ProductSelection = Product & {
  isSelected: boolean;
  qty: number;
  customPrice: number; // Harga bisa diedit
}

export default function OrdersPage() {
  // State Data Master
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<ProductSelection[]>([]) 
  const [orders, setOrders] = useState<OrderHistory[]>([]) 
  const [loading, setLoading] = useState(true)
  
  // --- STATE PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) // Tampilkan 10 data per halaman
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // State Form Transaksi
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false) 
  const [editingId, setEditingId] = useState<number | null>(null)

  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [searchProductTerm, setSearchProductTerm] = useState('') // Search Produk
  
  // State Input Detail Order
  const [customOrderNo, setCustomOrderNo] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [taxRate, setTaxRate] = useState(0) 
  const [makerName, setMakerName] = useState('') 
  const [receiverName, setReceiverName] = useState('') 

  // State Search History
  const [searchTerm, setSearchTerm] = useState('')

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
    setSelectedCustomerId('')
    setIsEditing(false)
    setEditingId(null)
    
    // Reset Checklist
    const resetProducts = products.map(p => ({ ...p, isSelected: false, qty: 1, customPrice: p.price }))
    setProducts(resetProducts)
  }

  const handleOpenNew = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const fetchInitialData = async () => {
    setLoading(true)
    const { data: custData } = await supabase.from('customers').select('id, name, address')
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)
    
    await fetchOrders(1) // Load halaman 1

    if (custData) setCustomers(custData)
    
    // Transform produk untuk checklist
    if (prodData) {
      const prods = prodData.map((p: any) => ({ 
        ...p, 
        isSelected: false, 
        qty: 1, 
        customPrice: p.price 
      }))
      setProducts(prods)
    }
    
    setLoading(false)
  }

  // --- FETCH ORDERS (HYBRID PAGINATION) ---
  const fetchOrders = async (page = 1, query = '') => {
    setLoading(true)
    
    // Hitung range data (0-9, 10-19, dst)
    const from = (page - 1) * itemsPerPage
    const to = from + itemsPerPage - 1

    let supabaseQuery = supabase
      .from('orders')
      .select(`
        id, order_no, total_amount, created_at, 
        tax_amount, maker_name, receiver_name, 
        status, payment_status, 
        customer:customers(name)
      `, { count: 'exact' }) // Minta total count
      .order('created_at', { ascending: false }) 
      .order('id', { ascending: false })         

    if (!query) {
      supabaseQuery = supabaseQuery.range(from, to)
    } else {
      supabaseQuery = supabaseQuery.limit(100) 
    }

    const { data, count, error } = await supabaseQuery
    
    if (data) {
      let finalData = data as any[]
      
      if (query) {
        finalData = finalData.filter(o => 
          o.order_no.toLowerCase().includes(query.toLowerCase()) || 
          o.customer?.name.toLowerCase().includes(query.toLowerCase())
        )
        setTotalPages(1) 
        setTotalCount(finalData.length)
      } else {
        if (count) {
          setTotalCount(count)
          setTotalPages(Math.ceil(count / itemsPerPage))
        }
      }
      setOrders(finalData)
    }
    setLoading(false)
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    setCurrentPage(1) // Reset ke halaman 1 saat mengetik
    fetchOrders(1, val)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      fetchOrders(newPage, searchTerm)
    }
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

  const updateProductPrice = (id: number, val: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) return { ...p, customPrice: val >= 0 ? val : 0 }
      return p
    }))
  }

  // Hitung Barang Terpilih
  const selectedItems = products.filter(p => p.isSelected)
  
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProductTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchProductTerm))
  )

  const subTotal = selectedItems.reduce((total, item) => total + (item.customPrice * item.qty), 0)
  const taxAmount = (subTotal * taxRate) / 100 
  const grandTotal = subTotal + taxAmount

  // --- LOGIC EDIT ORDER ---
  const handleEditOrder = async (orderId: number) => {
    try {
      setLoading(true)
      const { data: order, error } = await supabase
        .from('orders')
        .select(`*, items:order_items(product_id, qty, price, product:products(name, unit, barcode))`)
        .eq('id', orderId)
        .single()

      if (error || !order) throw new Error('Gagal ambil data pesanan')

      setCustomOrderNo(order.order_no)
      setCustomDate(new Date(order.created_at).toISOString().split('T')[0])
      setSelectedCustomerId(order.customer_id.toString())
      setMakerName(order.maker_name || '')
      setReceiverName(order.receiver_name || '')
      
      const rate = (order.total_amount - (order.tax_amount || 0)) > 0 
        ? Math.round(((order.tax_amount || 0) / (order.total_amount - (order.tax_amount || 0))) * 100) 
        : 0
      setTaxRate(rate)

      const orderItemMap = new Map(order.items.map((i: any) => [i.product_id, i]))
      
      const newProductsState = products.map(p => {
        const existingItem: any = orderItemMap.get(p.id)
        if (existingItem) {
          return { 
            ...p, 
            isSelected: true, 
            qty: existingItem.qty, 
            customPrice: existingItem.price 
          }
        }
        return { ...p, isSelected: false, qty: 1, customPrice: p.price }
      })
      
      setProducts(newProductsState)

      setIsEditing(true)
      setEditingId(orderId)
      setIsFormOpen(true)

    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- LOGIC SIMPAN ORDER & DIRECT PRINT ---
  const handleSaveOrder = async () => {
    if (!selectedCustomerId || selectedItems.length === 0 || !customOrderNo) {
      alert('Mohon lengkapi Data Pelanggan, Nomor Pesanan, dan minimal 1 Barang!')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi habis, login ulang.')

      const orderPayload = {
        customer_id: parseInt(selectedCustomerId),
        sales_id: user.id,
        doc_type: 'sales_order',
        status: isEditing ? undefined : 'pending',
        payment_status: isEditing ? undefined : 'unpaid',
        total_amount: grandTotal, 
        tax_amount: taxAmount,    
        order_no: customOrderNo,  
        created_at: new Date(customDate).toISOString(), 
        maker_name: makerName,
        receiver_name: receiverName
      }

      let savedOrderId = editingId

      if (isEditing && editingId) {
        const updatePayload = JSON.parse(JSON.stringify(orderPayload));
        const { error: updateError } = await supabase.from('orders').update(updatePayload).eq('id', editingId)
        if (updateError) throw updateError

        const { error: deleteItemError } = await supabase.from('order_items').delete().eq('order_id', editingId)
        if (deleteItemError) throw deleteItemError

      } else {
        const { data: newOrder, error: insertError } = await supabase.from('orders').insert([orderPayload]).select().single()
        if (insertError) throw insertError
        savedOrderId = newOrder.id
      }

      const orderItemsData = selectedItems.map(item => ({
        order_id: savedOrderId,
        product_id: item.id,
        qty: item.qty,
        price: item.customPrice
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData)
      if (itemsError) throw itemsError

      setIsFormOpen(false)
      fetchOrders(currentPage) 
      if(savedOrderId) await generatePDF(savedOrderId)

    } catch (error: any) {
      alert('Gagal simpan: ' + error.message)
    }
  }

  const handleDeleteOrder = async (id: number) => {
    if(!confirm("HAPUS PESANAN INI? \nData yang dihapus tidak bisa dikembalikan.")) return;
    try {
      await supabase.from('order_items').delete().eq('order_id', id)
      const { error } = await supabase.from('orders').delete().eq('id', id)
      if(error) throw error
      alert('Data berhasil dihapus.')
      fetchOrders(currentPage) 
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message)
    }
  }

  // --- GENERATE PDF (A4 & LOGO & SIGNATURE) ---
  const generatePDF = async (orderId: number) => {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select(`*, customer:customers(name, address, phone), items:order_items(qty, price, product:products(name, unit, barcode))`)
        .eq('id', orderId)
        .single()

      if (error || !order) throw new Error('Data tidak ditemukan')

      const doc = new jsPDF({ format: 'a4', unit: 'mm' })
      
      // --- LOGO FIX (Menggunakan Config) ---
      if (appConfig.brandLogo) {
        try {
          // Posisi Logo: Pojok Kanan Atas
          doc.addImage(appConfig.brandLogo, 'PNG', 170, 10, 25, 25);
        } catch (err) {
          console.warn('Logo error', err);
        }
      }

      // KOP SURAT
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(appConfig.companyName, 14, 20) 
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(appConfig.companyAddress, 14, 26)
      doc.text(appConfig.companyContact, 14, 31)

      // JUDUL
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('SALES ORDER', 105, 48, { align: 'center' })
      
      // INFO
      const leftX = 15;
      const rightX = 120; 
      const infoY = 58;

      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('Kepada Yth:', leftX, infoY)
      doc.setFont('helvetica', 'normal');
      doc.text(order.customer.name, leftX, infoY + 5)
      doc.text(order.customer.address || '-', leftX, infoY + 10)
      doc.text(`Telp: ${order.customer.phone || '-'}`, leftX, infoY + 15)

      doc.setFont('helvetica', 'bold');
      doc.text('Nomor Order:', rightX, infoY)
      doc.setFont('helvetica', 'normal');
      doc.text(order.order_no, rightX + 30, infoY)
      
      doc.setFont('helvetica', 'bold');
      doc.text('Tanggal:', rightX, infoY + 6) 
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(order.created_at).toLocaleDateString('id-ID', { dateStyle: 'long' }), rightX + 30, infoY + 6)

      // TABEL
      const tableRows = order.items.map((item: any) => [
        item.product.barcode || '-',
        item.product.name,
        `${item.qty} ${item.product.unit}`,
        `Rp ${item.price.toLocaleString()}`,
        `Rp ${(item.qty * item.price).toLocaleString()}`
      ])

      autoTable(doc, {
        startY: 85,
        head: [['Barcode', 'Nama Barang', 'Qty', 'Harga Satuan', 'Total']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
        columnStyles: { 
          0: { cellWidth: 35 }, 
          1: { cellWidth: 'auto' }, 
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 35, halign: 'right' }
        },
        margin: { left: 15, right: 15 }
      })

      const finalY = (doc as any).lastAutoTable.finalY + 5
      const tax = order.tax_amount || 0
      const subTotal = order.total_amount - tax
      const grandTotal = order.total_amount

      // TOTAL
      const summaryXLabel = 140;
      const summaryXValue = 195;
      
      doc.setFont('helvetica', 'normal')
      doc.text('Sub Total:', summaryXLabel, finalY + 6);      
      doc.text(`Rp ${subTotal.toLocaleString()}`, summaryXValue, finalY + 6, { align: 'right' })
      
      doc.text('PPN:', summaryXLabel, finalY + 12);           
      doc.text(`Rp ${tax.toLocaleString()}`, summaryXValue, finalY + 12, { align: 'right' })
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('TOTAL:', summaryXLabel, finalY + 20);    
      doc.text(`Rp ${grandTotal.toLocaleString()}`, summaryXValue, finalY + 20, { align: 'right' })

      // TANDA TANGAN
      const signY = finalY + 45 
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      
      doc.text('Dibuat Oleh,', 35, signY, { align: 'center' })
      doc.text(`( ${order.maker_name || 'Admin'} )`, 35, signY + 25, { align: 'center' })
      doc.setLineWidth(0.2);
      doc.line(15, signY + 26, 55, signY + 26) 

      doc.text('Diterima Oleh,', 175, signY, { align: 'center' })
      doc.text(`( ${order.receiver_name || 'Pelanggan'} )`, 175, signY + 25, { align: 'center' })
      doc.line(155, signY + 26, 195, signY + 26) 

      doc.autoPrint();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

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

      {/* --- LIST PESANAN --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            Riwayat Transaksi
            {!loading && <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{totalCount} Data</span>}
            {loading && <RefreshCw size={14} className="animate-spin text-gray-500"/>}
          </h3>
          <div className="relative w-full md:w-64">
            <SearchIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" placeholder="Cari No. Order..." 
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm} onChange={handleSearch}
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

                  <div className="flex gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1 ${
                      order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      <Truck size={12} />
                      {order.status === 'shipped' ? 'DIKIRIM' : order.status === 'completed' ? 'SELESAI' : 'MENUNGGU'}
                    </span>

                    <span className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1 ${
                      order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      <CreditCard size={12} />
                      {order.payment_status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <span className="font-bold text-gray-900 text-xl">Rp {order.total_amount.toLocaleString()}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditOrder(order.id)} className="p-2 text-blue-500 border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm" title="Edit">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => generatePDF(order.id)} className="p-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-white hover:text-blue-600 hover:border-blue-300 transition shadow-sm" title="Cetak">
                      <Printer size={18} />
                    </button>
                    <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-red-400 border border-transparent rounded-lg hover:bg-red-50 hover:text-red-600 transition" title="Hapus">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* --- PAGINATION CONTROLS (WARNA FIX) --- */}
        {!searchTerm && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center items-center gap-4">
             <button 
               onClick={() => handlePageChange(currentPage - 1)}
               disabled={currentPage === 1}
               className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 transition"
             >
               <ChevronLeft size={20} className="text-slate-900" />
             </button>
             
             {/* Text Warna Slate-900 (Hitam Pekat) */}
             <span className="text-sm font-bold text-slate-900">
                Hal {currentPage} / {totalPages || 1}
             </span>

             <div className="flex gap-2">
                {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map((page) => {
                   if(page === 1 || page === (totalPages || 1) || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center transition ${
                             currentPage === page 
                             ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                             : 'bg-white border border-gray-300 text-slate-900 hover:bg-gray-100' // FIXED: text-slate-900
                          }`}
                        >
                          {page}
                        </button>
                      )
                   } else if(page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="self-end px-1 text-gray-400">...</span>
                   }
                   return null
                })}
             </div>

             <button 
               onClick={() => handlePageChange(currentPage + 1)}
               disabled={currentPage === (totalPages || 1)}
               className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 transition"
             >
               <ChevronRight size={20} className="text-slate-900" />
             </button>
          </div>
        )}

      </div>

      {/* --- FORM MODAL (CHECKLIST STYLE) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">
                {isEditing ? 'Edit Pesanan' : 'Form Pesanan Baru'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-600 font-bold"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                   <label className="text-xs font-bold text-blue-800 uppercase mb-1 flex items-center gap-1"><Hash size={14}/> No. Pesanan</label>
                   <input type="text" className="w-full border border-blue-200 rounded-lg p-2.5 text-gray-900 font-bold" 
                     value={customOrderNo} onChange={(e) => setCustomOrderNo(e.target.value)} />
                </div>
                <div>
                   <label className="text-xs font-bold text-blue-800 uppercase mb-1 flex items-center gap-1"><Calendar size={14}/> Tanggal</label>
                   <input type="date" className="w-full border border-blue-200 rounded-lg p-2.5 text-gray-900 font-medium" 
                     value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">Pelanggan</label>
                <select className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 font-medium"
                  value={selectedCustomerId} onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    const cust = customers.find(c => c.id === parseInt(e.target.value));
                    if(cust) setReceiverName(cust.name);
                  }}>
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.address}</option>)}
                </select>
              </div>

              {/* LIST PRODUK (CHECKLIST) */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2"><CheckSquare size={18}/> Pilih Produk</h4>
                  <div className="relative">
                    <SearchIcon className="absolute left-2 top-2 text-gray-400" size={16} />
                    <input type="text" placeholder="Cari barang..." 
                      className="pl-8 pr-3 py-1.5 border rounded-lg text-sm text-gray-900 w-48"
                      value={searchProductTerm} onChange={e => setSearchProductTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[300px] border rounded-lg divide-y divide-gray-100 bg-white">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className={`p-3 flex items-center gap-3 hover:bg-blue-50 transition ${product.isSelected ? 'bg-blue-50' : ''}`}>
                      <div onClick={() => toggleProductSelection(product.id)} className="cursor-pointer">
                        {product.isSelected ? <CheckSquare className="text-blue-600" size={24} /> : <Square className="text-gray-300" size={24} />}
                      </div>
                      <div className="flex-1 cursor-pointer" onClick={() => toggleProductSelection(product.id)}>
                        <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{product.barcode || '-'}</p>
                      </div>
                      
                      {/* Input Qty & Price (Hanya Muncul Jika Dipilih) */}
                      {product.isSelected && (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-end">
                            <label className="text-[10px] text-gray-400 font-bold uppercase">Harga</label>
                            <input type="number" className="w-24 border border-gray-300 rounded p-1 text-right font-bold text-gray-900 text-sm"
                              value={product.customPrice} onChange={(e) => updateProductPrice(product.id, parseInt(e.target.value))} onClick={(e) => e.stopPropagation()} />
                          </div>
                          <div className="flex flex-col items-center">
                            <label className="text-[10px] text-gray-400 font-bold uppercase">Qty</label>
                            <input type="number" min="1" className="w-16 border border-blue-300 rounded p-1 text-center font-bold text-gray-900 text-sm"
                              value={product.qty} onChange={(e) => updateProductQty(product.id, parseInt(e.target.value))} onClick={(e) => e.stopPropagation()} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredProducts.length === 0 && <p className="p-4 text-center text-gray-400 text-sm">Produk tidak ditemukan.</p>}
                </div>

                <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                     <span className="text-sm text-gray-600">{selectedItems.length} barang dipilih</span>
                     {selectedItems.length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 ml-4">
                          PPN (%): 
                          <input type="number" min="0" className="w-12 border rounded p-1 text-center" 
                            value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value)||0)} />
                        </div>
                     )}
                  </div>
                  <span className="text-lg font-bold text-blue-700">Total: Rp {grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Tanda Tangan */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Pembuat</label>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2.5 bg-white">
                      <User size={16} className="text-gray-400"/>
                      <input type="text" className="bg-transparent outline-none w-full text-gray-900 font-bold" 
                        value={makerName} onChange={(e) => setMakerName(e.target.value)} placeholder="Nama Anda" />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Penerima</label>
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
                <Printer size={22} /> {isEditing ? 'UPDATE & CETAK' : 'SIMPAN & CETAK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}