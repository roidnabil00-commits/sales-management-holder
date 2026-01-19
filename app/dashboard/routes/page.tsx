// app/dashboard/routes/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  User, MapPin, Trash2, Plus, Filter, 
  Calendar, FileText, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function RouteManagerPage() {
  const supabase = createClient();
  
  // --- STATE DATA ---
  const [customers, setCustomers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]); 
  
  // --- STATE FILTER & UI ---
  const [selectedDay, setSelectedDay] = useState(1); // 1 = Senin
  const [selectedSalesId, setSelectedSalesId] = useState<string>(''); 
  const [loading, setLoading] = useState(true);

  // --- STATE INPUT TAMBAHAN ---
  const [priority, setPriority] = useState('Medium');
  const [instructions, setInstructions] = useState('');

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  // 1. Initial Load (Updated: Fetch Profiles dengan Role)
  useEffect(() => {
    const initData = async () => {
      // Ambil User Login
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setSelectedSalesId(user.id);

      // Fetch Customers
      const { data: custData } = await supabase
        .from('customers')
        .select('id, name, district, address')
        .order('name', { ascending: true });
      if (custData) setCustomers(custData);

      // Fetch Sales Team (Profiles) - UPDATED
      // Mengambil id, nama, email, dan role untuk keperluan filter/display
      const { data: profData, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role'); 
      
      if (profData && profData.length > 0) {
        setProfiles(profData);
      } else {
        // Fallback jika profile kosong (misal belum setup SQL profiles)
        console.warn("Profiles kosong atau error:", error);
        if (user) {
          setProfiles([{ id: user.id, full_name: 'Current User', email: user.email }]);
        }
      }
    };
    initData();
  }, []);

  // 2. Fetch Routes saat filter berubah
  useEffect(() => {
    if (selectedSalesId) {
      fetchRoutes(selectedDay, selectedSalesId);
    }
  }, [selectedDay, selectedSalesId]);

  const fetchRoutes = async (day: number, salesId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('route_templates')
      .select('*, customers(name, district, address)')
      .eq('day_of_week', day)
      .eq('sales_id', salesId)
      .order('created_at', { ascending: true });
      
    if (data) setRoutes(data);
    setLoading(false);
  };

  // 3. Logic Tambah Rute
  const addToRoute = async (customerId: number) => {
    // Validasi Sales ID
    if (!selectedSalesId) {
      toast.error("Pilih Sales Person di dropdown atas terlebih dahulu.");
      return;
    }

    // Tampilkan loading/proses
    const toastId = toast.loading("Menyimpan rute...");

    try {
      const { error } = await supabase.from('route_templates').insert({
        sales_id: selectedSalesId,   // ID Sales yang dipilih dari dropdown
        customer_id: customerId,
        day_of_week: selectedDay,
        priority: priority,          // Menyimpan Prioritas
        instructions: instructions   // Menyimpan Instruksi
      });

      if (error) throw error;

      toast.success("Berhasil ditambahkan!", { id: toastId });
      setInstructions(''); // Reset input instruksi
      fetchRoutes(selectedDay, selectedSalesId); // Refresh list

    } catch (err: any) {
      console.error("Error Detail:", err);
      toast.error(`Gagal: ${err.message || 'Terjadi kesalahan sistem'}`, { id: toastId });
    }
  };

  // 4. Logic Hapus Rute (FIXED: Ini yang sebelumnya hilang)
  const removeFromRoute = async (id: string) => {
    const toastId = toast.loading("Menghapus...");
    
    try {
      const { error } = await supabase
        .from('route_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Rute dihapus", { id: toastId });
      fetchRoutes(selectedDay, selectedSalesId); // Refresh list
    } catch (err: any) {
      toast.error("Gagal menghapus rute", { id: toastId });
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-slate-900">
      
      {/* --- HEADER SECTION --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Route Management</h1>
          <p className="text-slate-600 mt-1">Pengaturan jadwal kunjungan rutin (Permanent Call Plan).</p>
        </div>

        {/* Sales Person Selector */}
        <div className="w-full md:w-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
            Assign Route To (Pilih Sales)
          </label>
          <div className="flex items-center gap-3">
            <User className="text-slate-400" size={20} />
            <select 
              value={selectedSalesId} 
              onChange={(e) => setSelectedSalesId(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* --- DAY TABS --- */}
      <div className="mb-8">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg overflow-x-auto border border-slate-200">
          {days.map((day, idx) => {
            const isActive = selectedDay === idx + 1;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(idx + 1)}
                className={`
                  flex-1 px-4 py-2.5 text-sm font-semibold rounded-md transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }
                `}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* --- LEFT COLUMN: INPUT & CUSTOMER LIST --- */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Configuration Panel */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Filter size={18} /> Konfigurasi Input
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioritas Kunjungan</label>
                <select 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border border-slate-300 rounded-md p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="High">High (Prioritas Tinggi)</option>
                  <option value="Medium">Medium (Standar)</option>
                  <option value="Low">Low (Prioritas Rendah)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Instruksi / Catatan Khusus</label>
                <input 
                  type="text" 
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Contoh: Tagih invoice, Cek stok display..."
                  className="w-full border border-slate-300 rounded-md p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Customer List */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Customer Database</h3>
              <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-1 rounded">
                Total: {customers.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {customers.map((cust) => (
                <div key={cust.id} className="flex justify-between items-center p-3 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-md transition-all group">
                  <div className="overflow-hidden">
                    <div className="font-semibold text-slate-900 text-sm truncate">{cust.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin size={12} className="text-slate-400" /> 
                      {cust.district || 'No District'} 
                    </div>
                  </div>
                  <button 
                    onClick={() => addToRoute(cust.id)}
                    className="flex-shrink-0 bg-white border border-slate-300 text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: ACTIVE ROUTE LIST --- */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm min-h-[600px] flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Jadwal Hari {days[selectedDay-1]}</h2>
                <p className="text-sm text-slate-500">Daftar kunjungan yang telah dijadwalkan.</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded border border-blue-100">
                <Calendar size={16} />
                <span className="font-semibold">Total Stops: {routes.length}</span>
              </div>
            </div>

            <div className="flex-1 p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3 border-b border-slate-200 w-16 text-center">No</th>
                    <th className="px-6 py-3 border-b border-slate-200">Customer Info</th>
                    <th className="px-6 py-3 border-b border-slate-200 w-48">Instruksi & Prioritas</th>
                    <th className="px-6 py-3 border-b border-slate-200 w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        Memuat data jadwal...
                      </td>
                    </tr>
                  ) : routes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <FileText size={48} className="mb-3 opacity-20" />
                          <p className="font-medium text-slate-600">Belum ada jadwal.</p>
                          <p className="text-sm">Pilih customer di panel kiri untuk menambahkan.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    routes.map((route, idx) => (
                      <tr key={route.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="px-6 py-4 text-center text-slate-500 font-medium">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{route.customers?.name}</div>
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">
                            {route.customers?.address || route.customers?.district}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            {/* Priority Badge */}
                            <span className={`
                              inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                              ${route.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 
                                route.priority === 'Low' ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                                'bg-blue-50 text-blue-700 border-blue-200'}
                            `}>
                              {route.priority || 'Medium'}
                            </span>
                            
                            {/* Instructions Text */}
                            {route.instructions ? (
                              <div className="flex items-start gap-1.5 text-xs text-slate-600">
                                <AlertCircle size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                                <span className="italic">{route.instructions}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 italic">- Tidak ada instruksi -</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => removeFromRoute(route.id)}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                            title="Hapus Rute"
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

      </div>
    </div>
  );
}