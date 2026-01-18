'use client'

import { appConfig } from '@/lib/appConfig'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Printer, 
  Trash2, 
  Edit, 
  X, 
  CheckCircle, 
  Clock, 
  Search as SearchIcon, 
  CheckSquare, 
  Square,
  RefreshCw,
  Truck,
  CreditCard,
  ChevronLeft,
  ChevronRight 
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner' // 1. Import Toast

// --- TIPE DATA ---
type Product = { id: number; name: string; price: number; unit: string; barcode: string | null }
type Customer = { id: number; name: string; address: string; phone: string }
type Order = {
  id: number
  order_no: string
  created_at: string
  customer: { name: string; address: string; phone: string }
  total_amount: number
  tax_amount: number
  discount_amount: number
  status: string 
  payment_status: string 
  maker_name: string
  approved_name: string
  receiver_name: string
  items?: any[]
}

type ProductSelection = Product & {
  isSelected: boolean;
  qty: number;
  customPrice: number;
}

const terbilang = (nilai: number): string => {
  const angka = Math.abs(nilai)
  const baca = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  let hasil = ''
  if (angka < 12) { hasil = ' ' + baca[Math.floor(angka)] } 
  else if (angka < 20) { hasil = terbilang(angka - 10) + ' Belas' } 
  else if (angka < 100) { hasil = terbilang(Math.floor(angka / 10)) + ' Puluh' + terbilang(angka % 10) } 
  else if (angka < 200) { hasil = ' Seratus' + terbilang(angka - 100) } 
  else if (angka < 1000) { hasil = terbilang(Math.floor(angka / 100)) + ' Ratus' + terbilang(angka % 100) } 
  else if (angka < 2000) { hasil = ' Seribu' + terbilang(angka - 1000) } 
  else if (angka < 1000000) { hasil = terbilang(Math.floor(angka / 1000)) + ' Ribu' + terbilang(angka % 1000) } 
  else if (angka < 1000000000) { hasil = terbilang(Math.floor(angka / 1000000)) + ' Juta' + terbilang(angka % 1000000) }
  return hasil
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Order[]>([])
  const [products, setProducts] = useState<ProductSelection[]>([]) 
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10) 
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  
  const [invNo, setInvNo] = useState('')
  const [invDate, setInvDate] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  
  const [searchProductTerm, setSearchProductTerm] = useState('')
  const [discountRate, setDiscountRate] = useState(0) 
  const [taxRate, setTaxRate] = useState(0) 
  
  const [makerName, setMakerName] = useState('')
  const [approvedName, setApprovedName] = useState('Manager Keuangan')
  const [receiverName, setReceiverName] = useState('')

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    const { data: prodData } = await supabase.from('products').select('*').eq('is_active', true)
    
    if (prodData) {
      const prods = prodData.map((p: any) => ({ 
        ...p, isSelected: false, qty: 1, customPrice: p.price 
      }))
      setProducts(prods)
    }

    await fetchInvoices(1) 
    setLoading(false)
  }

  const fetchInvoices = async (page = 1, query = '') => {
    setLoading(true)
    
    const from = (page - 1) * itemsPerPage
    const to = from + itemsPerPage - 1

    let supabaseQuery = supabase
      .from('orders')
      .select(`*, customer:customers(name, address, phone), items:order_items(product_id, qty, price, product:products(name, unit, barcode))`, { count: 'exact' })
      .in('status', ['shipped', 'completed']) 
      .order('created_at', { ascending: false }) 
      .order('id', { ascending: false })         
    
    if (!query) {
      supabaseQuery = supabaseQuery.range(from, to)
    } else {
      supabaseQuery = supabaseQuery.limit(100) 
    }
    
    const { data, count, error } = await supabaseQuery

    if (error) {
      console.error(error)
      toast.error('Gagal memuat data invoice.')
    } else {
      let filtered = data as any[]
      
      if(query) {
        filtered = filtered.filter(inv => 
          inv.order_no.toLowerCase().includes(query.toLowerCase()) || 
          inv.customer?.name.toLowerCase().includes(query.toLowerCase())
        )
        setTotalPages(1)
        setTotalCount(filtered.length)
      } else {
        if(count) {
          setTotalCount(count)
          setTotalPages(Math.ceil(count / itemsPerPage))
        }
      }
      setInvoices(filtered)
    }
    setLoading(false)
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    setCurrentPage(1)
    fetchInvoices(1, val)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      fetchInvoices(newPage, searchTerm)
    }
  }

  const toggleProductSelection = (id: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, isSelected: !p.isSelected } : p))
  }

  const updateProductQty = (id: number, val: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, qty: val > 0 ? val : 1 } : p))
  }

  const updateProductPrice = (id: number, val: number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, customPrice: val >= 0 ? val : 0 } : p))
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProductTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchProductTerm))
  )
  
  const selectedItems = products.filter(p => p.isSelected)
  const subTotal = selectedItems.reduce((acc, item) => acc + (item.customPrice * item.qty), 0)
  const discountVal = (subTotal * discountRate) / 100
  const taxVal = ((subTotal - discountVal) * taxRate) / 100
  const grandTotal = subTotal - discountVal + taxVal

  const handleEditClick = (order: Order) => {
    setSelectedOrder(order)
    setInvNo(order.order_no)
    setInvDate(new Date(order.created_at).toISOString().split('T')[0])
    setPaymentStatus(order.payment_status || 'unpaid')
    setMakerName(order.maker_name || 'Admin Finance')
    setApprovedName(order.approved_name || 'Manager Keuangan')
    setReceiverName(order.receiver_name || order.customer.name)

    const currentSubTotal = order.items?.reduce((acc, i) => acc + (i.price * i.qty), 0) || 0
    let dRate = 0
    if (currentSubTotal > 0 && order.discount_amount) {
      dRate = Math.round((order.discount_amount / currentSubTotal) * 100)
    }
    setDiscountRate(dRate)

    let tRate = 0
    const afterDiscount = currentSubTotal - (order.discount_amount || 0)
    if (afterDiscount > 0 && order.tax_amount) {
      tRate = Math.round((order.tax_amount / afterDiscount) * 100)
    }
    setTaxRate(tRate)

    const orderItemMap = new Map(order.items?.map((i: any) => [i.product_id, i]))
    const newProductsState = products.map(p => {
      const existing: any = orderItemMap.get(p.id)
      return existing 
        ? { ...p, isSelected: true, qty: existing.qty, customPrice: existing.price }
        : { ...p, isSelected: false, qty: 1, customPrice: p.price }
    })
    setProducts(newProductsState)

    setIsFormOpen(true)
  }

  const handleSaveAndPrint = async () => {
    if (!selectedOrder) return

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          order_no: invNo,
          created_at: new Date(invDate).toISOString(),
          discount_amount: discountVal,
          tax_amount: taxVal,
          total_amount: grandTotal,
          payment_status: paymentStatus, 
          maker_name: makerName,
          approved_name: approvedName,
          receiver_name: receiverName
        })
        .eq('id', selectedOrder.id)

      if (error) throw error

      await supabase.from('order_items').delete().eq('order_id', selectedOrder.id)
      
      const newItems = selectedItems.map(item => ({
        order_id: selectedOrder.id,
        product_id: item.id,
        qty: item.qty,
        price: item.customPrice
      }))
      await supabase.from('order_items').insert(newItems)

      const updatedOrder = {
        ...selectedOrder,
        order_no: invNo,
        created_at: new Date(invDate).toISOString(),
        discount_amount: discountVal,
        tax_amount: taxVal,
        total_amount: grandTotal,
        payment_status: paymentStatus, 
        maker_name: makerName,
        approved_name: approvedName,
        receiver_name: receiverName,
        items: selectedItems.map(p => ({
          product: { name: p.name, unit: p.unit, barcode: p.barcode },
          qty: p.qty,
          price: p.customPrice
        }))
      }
      
      await generateInvoicePDF(updatedOrder)

      // Notifikasi Sukses
      toast.success('Invoice berhasil disimpan & dicetak!')

      setIsFormOpen(false)
      fetchInvoices(currentPage) 

    } catch (err: any) {
      toast.error('Gagal proses: ' + err.message)
    }
  }

  const generateInvoicePDF = async (order: any) => {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    
    // --- LOGO FIX ---
    if (appConfig.brandLogo) {
      try {
        doc.addImage(appConfig.brandLogo, 'PNG', 170, 10, 25, 25);
      } catch (err) {
        console.warn('Logo error', err);
      }
    }

    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text(appConfig.companyName.toUpperCase(), 105, 20, { align: 'center' })
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(appConfig.companyTagline, 105, 26, { align: 'center' })
    doc.text(appConfig.companyContact, 105, 31, { align: 'center' })
    
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('INVOICE / FAKTUR', 105, 48, { align: 'center' })
    
    if(order.payment_status === 'paid') {
      doc.setTextColor(0, 150, 0); doc.setFontSize(14);
      doc.text('[ LUNAS ]', 195, 48, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(200, 0, 0); doc.setFontSize(14);
      doc.text('[ TAGIHAN ]', 195, 48, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }

    const leftX = 15, rightX = 130, infoY = 60
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Ditagihkan Kepada:', leftX, infoY)
    doc.setFont('helvetica', 'normal')
    doc.text(order.customer.name, leftX, infoY + 5)
    doc.text(order.customer.address || '-', leftX, infoY + 10)
    
    doc.setFont('helvetica', 'bold');
    doc.text('No. Invoice:', rightX, infoY); doc.setFont('helvetica', 'normal'); doc.text(order.order_no, rightX + 25, infoY)
    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', rightX, infoY + 6); doc.setFont('helvetica', 'normal'); doc.text(new Date(order.created_at).toLocaleDateString('id-ID'), rightX + 25, infoY + 6)

    const tableRows = order.items.map((item: any) => [
      item.product.barcode || '-', item.product.name, `${item.qty} ${item.product.unit}`,
      `Rp ${item.price.toLocaleString()}`, `Rp ${(item.qty * item.price).toLocaleString()}`
    ])

    autoTable(doc, {
      startY: 85,
      head: [['Barcode', 'Nama Barang', 'Qty', 'Harga Satuan', 'Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 30 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 15, right: 15 }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 5

    const labelX = 135, valX = 195, step = 6
    doc.setFont('helvetica', 'normal')
    const sub = order.items.reduce((a:number, b:any) => a + (b.price * b.qty), 0)
    const disc = order.discount_amount || 0
    const tax = order.tax_amount || 0
    const grand = order.total_amount

    doc.text('Sub Total:', labelX, finalY + step); doc.text(`Rp ${sub.toLocaleString()}`, valX, finalY + step, { align: 'right' })
    doc.text('Diskon (-):', labelX, finalY + (step*2)); doc.text(`Rp ${disc.toLocaleString()}`, valX, finalY + (step*2), { align: 'right' })
    doc.text('PPN (+):', labelX, finalY + (step*3)); doc.text(`Rp ${tax.toLocaleString()}`, valX, finalY + (step*3), { align: 'right' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('TOTAL:', labelX, finalY + (step*5)); doc.text(`Rp ${grand.toLocaleString()}`, valX, finalY + (step*5), { align: 'right' })

    doc.setFontSize(10); doc.setFont('helvetica', 'italic');
    doc.text(`Terbilang: ${terbilang(grand)} Rupiah`, 15, finalY + (step*5))

    const signY = finalY + 50
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Disiapkan Oleh,', 30, signY, {align:'center'}); doc.text(`( ${order.maker_name || 'Admin'} )`, 30, signY + 25, {align:'center'}); doc.line(10, signY + 26, 50, signY + 26)
    doc.text('Disetujui Oleh,', 105, signY, {align:'center'}); doc.text(`( ${order.approved_name || 'Manager'} )`, 105, signY + 25, {align:'center'}); doc.line(85, signY + 26, 125, signY + 26)
    doc.text('Diterima Oleh,', 180, signY, {align:'center'}); doc.text(`( ${order.receiver_name || 'Pelanggan'} )`, 180, signY + 25, {align:'center'}); doc.line(160, signY + 26, 200, signY + 26)

    doc.autoPrint();
    const blob = doc.output('blob');
    window.open(URL.createObjectURL(blob), '_blank');
  }

  const handleDelete = async (id: number) => {
    if (!confirm('PERHATIAN: Hapus Invoice ini? Data penjualan akan hilang permanen.')) return
    await supabase.from('order_items').delete().eq('order_id', id)
    await supabase.from('orders').delete().eq('id', id)
    
    // Notifikasi Sukses
    toast.success('Invoice berhasil dihapus.')
    
    fetchInvoices(currentPage)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Faktur Penjualan</h2>
          <p className="text-sm text-gray-700 font-bold">Kelola tagihan, status pembayaran, dan cetak invoice</p>
        </div>
        <button onClick={() => fetchInvoices(currentPage)} className="text-blue-700 hover:text-blue-900"><RefreshCw size={24}/></button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
        <SearchIcon className="text-gray-900" size={20} />
        <input 
          type="text" 
          placeholder="Cari No. Invoice / Nama Pelanggan..." 
          className="flex-1 outline-none text-sm text-gray-900 font-bold placeholder:font-normal placeholder:text-gray-500"
          value={searchTerm} onChange={handleSearch}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
             <h3 className="font-bold text-gray-900 text-sm">Daftar Invoice</h3>
             {!loading && <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{totalCount} Data</span>}
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-900 font-bold border-b border-gray-300 uppercase">
            <tr>
              <th className="px-6 py-4">Invoice</th>
              <th className="px-6 py-4">Pelanggan</th>
              <th className="px-6 py-4">Status Logistik</th>
              <th className="px-6 py-4">Status Keuangan</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
               <tr><td colSpan={6} className="p-6 text-center text-gray-900 font-medium">Memuat data...</td></tr>
            ) : invoices.length === 0 ? (
               <tr><td colSpan={6} className="p-6 text-center text-gray-900 font-medium">Tidak ada data invoice.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-blue-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 text-base">{inv.order_no}</div>
                    <div className="text-xs text-gray-700 font-medium">{new Date(inv.created_at).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 text-base">{inv.customer?.name}</td>
                  
                  <td className="px-6 py-4">
                    {inv.status === 'completed' ? (
                      <span className="flex items-center gap-1 text-green-800 bg-green-200 px-2 py-1 rounded text-xs font-bold w-fit"><CheckCircle size={12}/> Selesai</span>
                    ) : inv.status === 'shipped' ? (
                      <span className="flex items-center gap-1 text-blue-800 bg-blue-200 px-2 py-1 rounded text-xs font-bold w-fit"><Truck size={12}/> Dikirim</span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-800 bg-yellow-200 px-2 py-1 rounded text-xs font-bold w-fit"><Clock size={12}/> Menunggu</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {inv.payment_status === 'paid' ? (
                      <span className="flex items-center gap-1 text-emerald-800 bg-emerald-200 px-2 py-1 rounded text-xs font-bold w-fit"><CreditCard size={12}/> LUNAS</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-800 bg-red-200 px-2 py-1 rounded text-xs font-bold w-fit"><Clock size={12}/> BELUM LUNAS</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right font-black text-gray-900 text-base">Rp {inv.total_amount.toLocaleString()}</td>
                  
                  <td className="px-6 py-4 flex justify-center gap-2">
                    <button onClick={() => handleEditClick(inv)} className="p-2 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-200" title="Proses">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(inv.id)} className="p-2 text-red-700 hover:bg-red-50 rounded-lg transition border border-red-200" title="Hapus">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!searchTerm && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center items-center gap-4">
             <button 
               onClick={() => handlePageChange(currentPage - 1)}
               disabled={currentPage === 1}
               className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 transition"
             >
               <ChevronLeft size={20} />
             </button>
             
             <span className="text-sm font-bold text-gray-600">
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
                             : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
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
               <ChevronRight size={20} />
             </button>
          </div>
        )}

      </div>

      {isFormOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-gray-300">
            
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-100">
              <h3 className="font-black text-gray-900 text-xl">Proses Invoice</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-red-600"><X size={28} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                   <label className="text-xs font-black text-blue-900 uppercase mb-1 block">No. Invoice</label>
                   <input type="text" className="w-full border border-blue-300 rounded-lg p-2 font-black text-gray-900 bg-white" 
                     value={invNo} onChange={(e) => setInvNo(e.target.value)} />
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                   <label className="text-xs font-black text-blue-900 uppercase mb-1 block">Tanggal</label>
                   <input type="date" className="w-full border border-blue-300 rounded-lg p-2 font-bold text-gray-900 bg-white" 
                     value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <label className="text-sm font-black text-yellow-900 uppercase mb-3 block">Status Pembayaran</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-white border border-red-200 rounded-lg shadow-sm hover:bg-red-50 transition">
                    <input type="radio" name="payment" value="unpaid" 
                      checked={paymentStatus === 'unpaid'} 
                      onChange={() => setPaymentStatus('unpaid')}
                      className="w-5 h-5 text-red-600 accent-red-600" />
                    <span className="text-red-700 font-bold">BELUM LUNAS</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-white border border-green-200 rounded-lg shadow-sm hover:bg-green-50 transition">
                    <input type="radio" name="payment" value="paid" 
                      checked={paymentStatus === 'paid'} 
                      onChange={() => setPaymentStatus('paid')}
                      className="w-5 h-5 text-green-600 accent-green-600" />
                    <span className="text-green-700 font-bold">LUNAS</span>
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl border border-gray-300 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-gray-900 flex items-center gap-2 text-lg"><CheckSquare size={20}/> Rincian Barang</h4>
                  <div className="relative">
                    <SearchIcon className="absolute left-2 top-2 text-gray-500" size={18} />
                    <input type="text" placeholder="Cari barang..." 
                      className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-bold w-56"
                      value={searchProductTerm} onChange={e => setSearchProductTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[300px] border border-gray-300 rounded-lg divide-y divide-gray-200 bg-white">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className={`p-3 flex items-center gap-3 hover:bg-blue-50 transition ${product.isSelected ? 'bg-blue-100' : ''}`}>
                      <div onClick={() => toggleProductSelection(product.id)} className="cursor-pointer">
                        {product.isSelected ? <CheckSquare className="text-blue-700" size={26} /> : <Square className="text-gray-400" size={26} />}
                      </div>
                      <div className="flex-1 cursor-pointer" onClick={() => toggleProductSelection(product.id)}>
                        <p className="font-black text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-700 font-bold font-mono">{product.barcode || '-'}</p>
                      </div>
                      {product.isSelected && (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-end">
                            <label className="text-[10px] text-gray-700 font-black uppercase">Harga</label>
                            <input type="number" className="w-28 border border-gray-400 rounded p-1 text-right font-black text-gray-900"
                              value={product.customPrice} onChange={(e) => updateProductPrice(product.id, parseInt(e.target.value))} onClick={(e) => e.stopPropagation()} />
                          </div>
                          <div className="flex flex-col items-center">
                            <label className="text-[10px] text-gray-700 font-black uppercase">Qty</label>
                            <input type="number" min="1" className="w-16 border border-gray-400 rounded p-1 text-center font-black text-gray-900"
                              value={product.qty} onChange={(e) => updateProductQty(product.id, parseInt(e.target.value))} onClick={(e) => e.stopPropagation()} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-300 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="flex gap-4">
                    <div>
                      <label className="text-xs font-black text-gray-800">Diskon (%)</label>
                      <input type="number" min="0" className="w-full border border-gray-400 rounded p-2 text-center font-black text-gray-900 text-lg" 
                        value={discountRate} onChange={(e) => setDiscountRate(parseFloat(e.target.value)||0)} />
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-800">PPN (%)</label>
                      <input type="number" min="0" className="w-full border border-gray-400 rounded p-2 text-center font-black text-gray-900 text-lg" 
                        value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value)||0)} />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-gray-800 font-bold">Subtotal: <span className="font-black">Rp {subTotal.toLocaleString()}</span></p>
                    <p className="text-xs text-red-600 font-bold">Disc: -Rp {discountVal.toLocaleString()}</p>
                    <p className="text-xs text-gray-800 font-bold">Tax: +Rp {taxVal.toLocaleString()}</p>
                    <p className="text-2xl font-black text-blue-900 mt-2 border-t border-gray-300 pt-1">Total: Rp {grandTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div><label className="text-xs text-gray-800 font-bold block mb-1">Disiapkan Oleh</label><input type="text" className="w-full border border-gray-300 rounded p-2 text-sm font-bold text-gray-900" value={makerName} onChange={(e) => setMakerName(e.target.value)} /></div>
                 <div><label className="text-xs text-gray-800 font-bold block mb-1">Disetujui Oleh</label><input type="text" className="w-full border border-gray-300 rounded p-2 text-sm font-bold text-gray-900" value={approvedName} onChange={(e) => setApprovedName(e.target.value)} /></div>
                 <div><label className="text-xs text-gray-800 font-bold block mb-1">Diterima Oleh</label><input type="text" className="w-full border border-gray-300 rounded p-2 text-sm font-bold text-gray-900" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} /></div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-300 bg-gray-50">
              <button 
                onClick={handleSaveAndPrint}
                className="w-full bg-blue-700 text-white py-4 rounded-xl font-black text-xl hover:bg-blue-800 shadow-xl flex justify-center items-center gap-3 transition transform active:scale-95"
              >
                <Printer size={24} /> SIMPAN & CETAK
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}