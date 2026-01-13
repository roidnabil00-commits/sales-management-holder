// app/dashboard/customers/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Trash2, Search, Users, MapPin, Phone } from 'lucide-react'

// Tipe data sesuai tabel database
type Customer = {
  id: number
  name: string
  owner_name: string
  phone: string
  address: string
  credit_limit: number
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  // State Form
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone: '',
    address: '',
    credit_limit: ''
  })

  // 1. Ambil Data Pelanggan
  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('id', { ascending: false })
    
    if (error) console.error('Error fetching customers:', error)
    else setCustomers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  // 2. Tambah Pelanggan Baru
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name) {
      alert('Nama Warung wajib diisi!')
      return
    }

    const { error } = await supabase
      .from('customers')
      .insert([
        {
          name: formData.name,
          owner_name: formData.owner_name,
          phone: formData.phone,
          address: formData.address,
          credit_limit: formData.credit_limit ? parseInt(formData.credit_limit) : 0
        }
      ])

    if (error) {
      alert('Gagal tambah pelanggan: ' + error.message)
    } else {
      alert('Pelanggan berhasil ditambahkan!')
      setIsFormOpen(false)
      setFormData({ name: '', owner_name: '', phone: '', address: '', credit_limit: '' })
      fetchCustomers()
    }
  }

  // 3. Hapus Pelanggan
  const handleDelete = async (id: number) => {
    if (confirm('Yakin mau hapus pelanggan ini? Data penjualan terkait mungkin akan error.')) {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      
      if (error) alert('Gagal hapus: ' + error.message)
      else fetchCustomers()
    }
  }

  // Filter pencarian
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Data Pelanggan</h2>
          <p className="text-sm text-gray-500">Daftar warung & mitra outlet</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={18} /> Tambah Pelanggan
        </button>
      </div>

      {/* --- FORM MODAL --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold mb-4">Tambah Mitra Baru</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Warung / Toko</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg p-2 text-black" 
                  placeholder="Contoh: Warung Bu Ijah"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama Pemilik</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-black" 
                    placeholder="Ijah Surijah"
                    value={formData.owner_name}
                    onChange={e => setFormData({...formData, owner_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">No. HP / WA</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-black" 
                    placeholder="0812xxxx"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alamat Lengkap</label>
                <textarea 
                  className="w-full border rounded-lg p-2 text-black" 
                  placeholder="Jl. Mawar No. 10..."
                  rows={3}
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Limit Utang (Credit Limit)</label>
                <input 
                  type="number" 
                  className="w-full border rounded-lg p-2 text-black" 
                  placeholder="Contoh: 5000000"
                  value={formData.credit_limit}
                  onChange={e => setFormData({...formData, credit_limit: e.target.value})}
                />
                <p className="text-xs text-gray-400 mt-1">*Maksimal total bon yang belum lunas</p>
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
          placeholder="Cari nama warung atau pemilik..." 
          className="flex-1 outline-none text-sm text-black"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- LIST CARD PELANGGAN (Mobile Friendly) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
            <p className="text-center text-gray-400 col-span-full py-10">Loading data...</p>
        ) : filteredCustomers.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-10 text-gray-400">
                <Users size={48} className="opacity-20 mb-2" />
                <p>Belum ada data pelanggan</p>
            </div>
        ) : (
            filteredCustomers.map((c) => (
                <div key={c.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition group">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">{c.name}</h3>
                            <p className="text-sm text-gray-500">{c.owner_name}</p>
                        </div>
                        <button 
                            onClick={() => handleDelete(c.id)}
                            className="text-gray-300 hover:text-red-500 transition"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-blue-500" />
                            <span className="truncate">{c.address || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Phone size={16} className="text-green-500" />
                            <span>{c.phone || '-'}</span>
                        </div>
                        <div className="pt-3 border-t border-gray-50 mt-3 flex justify-between items-center">
                            <span className="text-xs text-gray-400">Limit Kredit</span>
                            <span className="font-semibold text-gray-700">Rp {c.credit_limit?.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  )
}