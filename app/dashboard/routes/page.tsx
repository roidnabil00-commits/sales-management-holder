// app/dashboard/routes/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function RouteManagerPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState(1); // 1 = Senin
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load Data saat halaman dibuka atau ganti hari
  useEffect(() => {
    fetchCustomers();
    fetchRoutes(selectedDay);
  }, [selectedDay]);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name, district');
    if (data) setCustomers(data);
  };

  const fetchRoutes = async (day: number) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data } = await supabase
        .from('route_templates')
        .select('*, customers(name, district)')
        .eq('day_of_week', day)
        .eq('sales_id', user.id); // Filter punya user yang login saja
      if (data) setRoutes(data);
    }
    setLoading(false);
  };

  const addToRoute = async (customerId: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('route_templates').insert({
      sales_id: user.id,
      customer_id: customerId,
      day_of_week: selectedDay
    });

    if (!error) fetchRoutes(selectedDay);
  };

  const removeFromRoute = async (id: string) => {
    await supabase.from('route_templates').delete().eq('id', id);
    fetchRoutes(selectedDay);
  };

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Permanent Call Plan (PCP)</h1>
      <p className="text-gray-500 mb-6">Atur rute kunjungan mingguan di sini. Jadwal ini akan berulang selamanya.</p>

      {/* Pilihan Hari */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {days.map((day, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedDay(idx + 1)}
            className={`px-5 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
              selectedDay === idx + 1 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* KIRI: Database Customer */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h2 className="font-bold text-gray-700 mb-4 flex justify-between">
            <span>Database Customer</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">{customers.length} Data</span>
          </h2>
          <div className="space-y-2 h-[500px] overflow-y-auto pr-2">
            {customers.map((cust) => (
              <div key={cust.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors">
                <div>
                  <div className="font-bold text-gray-800">{cust.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    📍 {cust.district || 'Tanpa Area'}
                  </div>
                </div>
                <button 
                  onClick={() => addToRoute(cust.id)}
                  className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-100"
                >
                  + Tambah
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* KANAN: Rute Terpilih */}
        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
          <h2 className="font-bold text-blue-800 mb-4">Rute Hari {days[selectedDay-1]}</h2>
          
          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading data...</div>
          ) : (
            <div className="space-y-3">
              {routes.length === 0 && (
                <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  Belum ada toko di jadwal hari ini.
                </div>
              )}
              {routes.map((route, idx) => (
                <div key={route.id} className="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">{route.customers?.name}</div>
                      <div className="text-xs text-gray-500">{route.customers?.district}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFromRoute(route.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors"
                    title="Hapus dari rute"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}