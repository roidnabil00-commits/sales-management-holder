// app/dashboard/customers/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, Plus, Trash2, Edit, Save, X, Phone, MapPin, User } from 'lucide-react'

// Tipe Data
type Customer = {
  id: number
  name: string
  address: string
  phone: string
  created_at: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // State Form
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setCustomers(data || [])
    setLoading(false)
  }

  // --- LOGIC HAPUS BERSIH (FIXED) ---
  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('PERINGATAN KERAS:\nMenghapus pelanggan ini akan MENGHAPUS SEMUA DATA terkait:\n- Riwayat Kunjungan\n- Riwayat Pesanan/Faktur\n- Penawaran\n\nData tidak bisa dikembalikan. Yakin lanjut?')) return

    try {
      setLoading(true)

      // 1. Hapus Kunjungan (Visits)
      const { error: errVisit } = await supabase
        .from('visits')
        .delete()
        .eq('customer_id', id)
      if (errVisit) throw new Error('Gagal hapus kunjungan: ' + errVisit.message)

      // 2. Hapus Item Pesanan (Order Items) - Butuh 2 langkah karena relasi tidak langsung
      // Ambil dulu ID order milik customer ini
      const { data: orders } = await supabase.from('orders').select('id').eq('customer_id', id)
      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id)
        
        // Hapus item di order_items
        const { error: errItems } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds)
        if (errItems) throw new Error('Gagal hapus item pesanan: ' + errItems.message)
        
        // 3. Hapus Pesanan (Orders)
        const { error: errOrders } = await supabase
          .from('orders')
          .delete()
          .eq('customer_id', id)
        if (errOrders) throw new Error('Gagal hapus pesanan: ' + errOrders.message)
      }

      // 4. Akhirnya, Hapus Pelanggan (Customers)
      const { error: errCust } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      if (errCust) throw new Error('Gagal hapus pelanggan: ' + errCust.message)

      alert('Pelanggan dan seluruh riwayatnya berhasil dihapus.')
      fetchCustomers()

    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- LOGIC SAVE (TAMBAH / EDIT) ---
  const handleSave = async () => {
    if (!formData.name) return alert('Nama wajib diisi!')

    try {
      if (isEditing && editId) {
        // Update
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', editId)
        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('customers')
          .insert([formData])
        if (error) throw error
      }

      alert('Berhasil disimpan!')
      setIsFormOpen(false)
      resetForm()
      fetchCustomers()
    } catch (err: any) {
      alert('Gagal: ' + err.message)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', address: '', phone: '' })
    setIsEditing(false)
    setEditId(null)
  }

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      address: customer.address,
      phone: customer.phone
    })
    setEditId(customer.id)
    setIsEditing(true)
    setIsFormOpen(true)
  }

  // Filter Search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Pelanggan</h2>
          <p className="text-sm text-gray-500">Kelola database mitra & toko</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsFormOpen(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg font-bold"
        >
          <Plus size={18} /> Pelanggan Baru
        </button>
      </div>

      {/* SEARCH */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari Nama Toko / Alamat..." 
          className="flex-1 outline-none text-sm text-gray-900"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* LIST CUSTOMERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-500 col-span-3 text-center py-10">Memuat data...</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-gray-400 col-span-3 text-center py-10">Data tidak ditemukan.</p>
        ) : (
          filteredCustomers.map((c) => (
            <div key={c.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group relative">
              
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                    <User size={20} />
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg">{c.name}</h4>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mt-3 pl-1">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                  <span>{c.address || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-gray-400" />
                  <span>{c.phone || '-'}</span>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(c)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                  title="Edit"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={() => handleDeleteCustomer(c.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  title="Hapus"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="font-bold text-gray-900 text-lg">
                {isEditing ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Toko / Pelanggan <span className="text-red-500">*</span></label>
                <input type="text" className="w-full border rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Contoh: Toko Berkah Jaya" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap</label>
                <textarea rows={3} className="w-full border rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Jalan, Nomor, Kota..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No. Telepon / WA</label>
                <input type="text" className="w-full border rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="08..." />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition mt-4 flex justify-center gap-2"
              >
                <Save size={18} /> SIMPAN DATA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}