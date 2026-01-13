// app/dashboard/stock/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Trash2, Search, Package } from 'lucide-react'

// Kita definisikan tipe datanya biar TypeScript senang
type Product = {
  id: number
  name: string
  sku: string
  price: number
  unit: string
  qty_on_hand?: number // Opsional karena nanti nyambung ke tabel inventory
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  // State untuk Form Tambah Barang
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    unit: 'pcs'
  })

  // 1. Ambil Data dari Supabase saat halaman dibuka
  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: false }) // Barang baru paling atas
    
    if (error) console.error('Error fetching products:', error)
    else setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // 2. Fungsi Tambah Barang
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validasi simpel
    if (!formData.name || !formData.price) {
      alert('Nama dan Harga wajib diisi!')
      return
    }

    const { error } = await supabase
      .from('products')
      .insert([
        {
          name: formData.name,
          sku: formData.sku || `SKU-${Date.now()}`, // Generate SKU otomatis kalau kosong
          price: parseInt(formData.price),
          unit: formData.unit
        }
      ])

    if (error) {
      alert('Gagal tambah barang: ' + error.message)
    } else {
      alert('Barang berhasil ditambahkan!')
      setIsFormOpen(false) // Tutup form
      setFormData({ name: '', sku: '', price: '', unit: 'pcs' }) // Reset form
      fetchProducts() // Refresh tabel
    }
  }

  // 3. Fungsi Hapus Barang
  const handleDelete = async (id: number) => {
    if (confirm('Yakin mau hapus barang ini?')) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      
      if (error) alert('Gagal hapus: ' + error.message)
      else fetchProducts()
    }
  }

  // Filter pencarian
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Stock Barang</h2>
          <p className="text-sm text-gray-500">Master data produk roti & kue</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={18} /> Tambah Barang
        </button>
      </div>

      {/* --- FORM MODAL (Sederhana) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Tambah Produk Baru</h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Barang</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg p-2 text-black" 
                  placeholder="Contoh: Roti Tawar Kupas"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SKU (Kode)</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-black" 
                    placeholder="RT-001"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Satuan</label>
                  <select 
                    className="w-full border rounded-lg p-2 text-black"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  >
                    <option value="pcs">Pcs</option>
                    <option value="bal">Bal</option>
                    <option value="pak">Pak</option>
                    <option value="dus">Dus</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Harga Jual (Rp)</label>
                <input 
                  type="number" 
                  className="w-full border rounded-lg p-2 text-black" 
                  placeholder="12000"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SEARCH BAR --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari nama barang atau SKU..." 
          className="flex-1 outline-none text-sm text-black"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- TABEL PRODUK --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nama Produk</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Harga</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">Loading data...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400 flex flex-col items-center gap-2">
                    <Package size={32} className="opacity-20" />
                    Belum ada barang
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 text-gray-500">{product.sku || '-'}</td>
                    <td className="px-6 py-4 font-semibold text-green-600">
                      Rp {product.price.toLocaleString('id-ID')} 
                      <span className="text-gray-400 text-xs font-normal ml-1">/{product.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}