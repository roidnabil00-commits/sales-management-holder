'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Trash2, Search, Package, Barcode, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner' // 1. Import Toast

// Tipe Data
type Product = {
  id: number
  name: string
  sku: string
  barcode: string | null
  price: number
  unit: string
  inventory?: { 
    qty_on_hand: number
    qty_damage: number 
  }[] 
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isReturOpen, setIsReturOpen] = useState(false)
  
  // State Form Produk
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: 0,
    priceDisplay: '',
    unit: 'pcs',
    initialStock: ''
  })

  // State Form Retur
  const [returData, setReturData] = useState({
    productId: 0,
    productName: '',
    currentQty: 0,
    damageQty: ''
  })

  // --- HELPER FORMAT RUPIAH ---
  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(angka)
  }

  // --- LOGIC INPUT HARGA (Auto Format 10.000) ---
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    const numericValue = rawValue ? parseInt(rawValue) : 0
    const formattedDisplay = rawValue ? new Intl.NumberFormat('id-ID').format(numericValue) : ''

    setFormData({
      ...formData,
      price: numericValue, 
      priceDisplay: formattedDisplay
    })
  }

  // 1. Ambil Data
  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        inventory(qty_on_hand, qty_damage)
      `)
      .order('id', { ascending: false })
    
    if (error) {
      console.error('Error fetching products:', error)
      toast.error('Gagal memuat data produk.')
    } else {
      setProducts((data as any) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // 2. Tambah Barang Baru
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validasi
    if (!formData.name || !formData.price) {
      toast.error('Nama dan Harga wajib diisi!')
      return
    }

    try {
      // A. Insert Produk
      const { data: newProduct, error: prodError } = await supabase
        .from('products')
        .insert([{
          name: formData.name,
          sku: formData.sku || `SKU-${Date.now()}`,
          barcode: formData.barcode || null,
          price: formData.price,
          unit: formData.unit
        }])
        .select()
        .single()

      if (prodError) throw prodError

      // B. Insert Stok Awal
      const { error: invError } = await supabase
        .from('inventory')
        .insert([{
          product_id: newProduct.id,
          warehouse_id: 1, // Gudang Pusat
          qty_on_hand: formData.initialStock ? parseInt(formData.initialStock) : 0,
          qty_damage: 0
        }])
      
      if (invError) throw invError

      toast.success('Barang berhasil disimpan!')
      setIsFormOpen(false)
      
      // Reset Form
      setFormData({ 
        name: '', sku: '', barcode: '', 
        price: 0, priceDisplay: '', 
        unit: 'pcs', initialStock: '' 
      })
      fetchProducts()

    } catch (err: any) {
      toast.error('Gagal: ' + err.message)
    }
  }

  // 3. Proses Retur
  const handleProcessRetur = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseInt(returData.damageQty)
    
    if (!qty || qty <= 0) {
      toast.warning('Jumlah retur tidak valid (minimal 1)')
      return
    }
    if (qty > returData.currentQty) {
      toast.error('Stok gudang tidak cukup!')
      return
    }

    try {
       const { data: currInv } = await supabase
        .from('inventory')
        .select('qty_on_hand, qty_damage')
        .eq('product_id', returData.productId)
        .eq('warehouse_id', 1)
        .single()
       
       if(currInv) {
         const { error } = await supabase
           .from('inventory')
           .update({
             qty_on_hand: currInv.qty_on_hand - qty,
             qty_damage: (currInv.qty_damage || 0) + qty
           })
           .eq('product_id', returData.productId)
           .eq('warehouse_id', 1)
           
         if(error) throw error
         
         toast.success('Laporan Retur berhasil dicatat!')
         setIsReturOpen(false)
         fetchProducts()
       }
    } catch (err: any) {
      toast.error('Gagal update retur: ' + err.message)
    }
  }

   // 4. Hapus Barang
  const handleDelete = async (id: number) => {
    // Confirm bawaan browser (aman dan cepat)
    if (!confirm('PERHATIAN: Menghapus produk ini akan menghapus DATA STOK dan RIWAYAT PENJUALAN terkait. Anda yakin?')) {
      return
    }

    try {
      setLoading(true) 

      // Tahap 1: Hapus Jejak di Transaksi (Order Items)
      const { error: errOrders } = await supabase
        .from('order_items')
        .delete()
        .eq('product_id', id)
      
      if (errOrders) throw new Error('Gagal hapus riwayat transaksi: ' + errOrders.message)

      // Tahap 2: Hapus Stok di Gudang (Inventory)
      const { error: errInv } = await supabase
        .from('inventory')
        .delete()
        .eq('product_id', id)

      if (errInv) throw new Error('Gagal hapus stok: ' + errInv.message)

      // Tahap 3: Hapus Produk Utama (Master Data)
      const { error: errProd } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (errProd) throw new Error('Gagal hapus produk: ' + errProd.message)

      toast.success('Produk berhasil dihapus total (termasuk riwayatnya).')
      fetchProducts()

    } catch (error: any) {
      console.error(error)
      toast.error('Terjadi kesalahan: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm)
  )

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock & Produk</h2>
          <p className="text-sm text-gray-600">Kelola master data, barcode, dan barang retur</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition font-medium shadow-sm"
        >
          <Plus size={18} /> Tambah Barang
        </button>
      </div>

      {/* SEARCH */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Scan Barcode / Cari Nama / SKU..." 
          className="flex-1 outline-none text-sm text-gray-900 font-medium placeholder:font-normal"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* TABEL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-800 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Produk</th>
                <th className="px-6 py-4 text-center">Stok Gudang</th>
                <th className="px-6 py-4 text-center">Stok Rusak</th>
                <th className="px-6 py-4 text-right">Harga</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                   <td colSpan={5} className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
                     <Package size={32} className="opacity-30" />
                     <p>Belum ada data barang.</p>
                   </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stock = p.inventory && p.inventory[0] ? p.inventory[0] : { qty_on_hand: 0, qty_damage: 0 }
                  return (
                    <tr key={p.id} className="hover:bg-blue-50 transition group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-base">{p.name}</div>
                        <div className="flex gap-2 text-xs mt-1">
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-medium">
                            {p.sku}
                          </span>
                          {p.barcode && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1 font-mono">
                              <Barcode size={12}/> {p.barcode}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex flex-col items-center justify-center px-3 py-1 rounded-lg border min-w-[60px] ${
                          stock.qty_on_hand > 10 
                            ? 'bg-green-50 border-green-200 text-green-700' 
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                          <span className="font-bold text-lg">{stock.qty_on_hand}</span>
                          <span className="text-[10px] uppercase font-bold opacity-80">{p.unit}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                         {stock.qty_damage > 0 ? (
                           <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-bold">
                             <AlertTriangle size={14} /> {stock.qty_damage}
                           </div>
                         ) : <span className="text-gray-300">-</span>}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-gray-900 text-base">
                          {formatRupiah(p.price)}
                        </span>
                      </td>

                      <td className="px-6 py-4 flex justify-center gap-2">
                        <button 
                          onClick={() => {
                            setReturData({
                              productId: p.id,
                              productName: p.name,
                              currentQty: stock.qty_on_hand,
                              damageQty: ''
                            })
                            setIsReturOpen(true)
                          }}
                          className="p-2 text-orange-500 hover:bg-orange-100 rounded-lg transition border border-transparent hover:border-orange-200"
                          title="Lapor Barang Rusak/Retur"
                        >
                          <AlertTriangle size={18} />
                        </button>

                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus Barang"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TAMBAH PRODUK */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl border border-gray-100">
            <h3 className="font-bold text-xl text-gray-900 mb-6 border-b pb-4">Tambah Produk Baru</h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Produk <span className="text-red-500">*</span></label>
                <input type="text" required 
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                  placeholder="Contoh: Roti Tawar Kupas"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">SKU</label>
                  <input type="text" 
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="Auto Generate"
                    value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Barcode</label>
                  <input type="text" 
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="Scan..."
                    value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Harga Jual <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500 font-bold">Rp</span>
                    <input 
                      type="text" 
                      required 
                      className="w-full border border-gray-300 rounded-lg p-3 pl-10 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg" 
                      placeholder="0"
                      value={formData.priceDisplay} 
                      onChange={handlePriceChange}  
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Satuan</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                    value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                    <option value="pcs">Pcs (Satuan)</option>
                    <option value="bal">Bal</option>
                    <option value="pak">Pak</option>
                    <option value="dus">Dus/Karton</option>
                  </select>
                </div>
              </div>

              {/* INPUT STOCK AWAL */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Stok Awal di Gudang</label>
                <div className="flex items-center gap-2">
                  <Package className="text-blue-600" size={20} />
                  <input 
                    type="number" 
                    min="0" // VALIDASI BARU: Tidak bisa minus
                    className="w-full border border-blue-200 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                    placeholder="0"
                    value={formData.initialStock} onChange={e => setFormData({...formData, initialStock: e.target.value})} />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">Batal</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">Simpan Barang</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RETUR */}
      {isReturOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4 text-orange-600">
               <div className="p-2 bg-orange-100 rounded-full"><AlertTriangle /></div>
               <h3 className="font-bold text-lg text-gray-900">Lapor Retur / Rusak</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Pindahkan stok <b>{returData.productName}</b> dari Gudang Utama ke Stok Rusak?
            </p>
            <form onSubmit={handleProcessRetur} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Jumlah Rusak (Qty)</label>
                <div className="flex items-center gap-2">
                  <input type="number" required min="1" max={returData.currentQty} 
                    className="w-full border-2 border-orange-100 rounded-lg p-2 text-gray-900 text-2xl font-bold text-center focus:border-orange-500 outline-none" 
                    placeholder="0"
                    value={returData.damageQty} onChange={e => setReturData({...returData, damageQty: e.target.value})} />
                </div>
                <p className="text-right text-xs text-gray-400 mt-1">Stok Bagus Tersedia: {returData.currentQty}</p>
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsReturOpen(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 shadow-lg shadow-orange-200 transition">Konfirmasi</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}