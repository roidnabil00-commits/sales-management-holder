// app/dashboard/visits/page.tsx
import { createClient } from '@/lib/supabase/server';
import CheckInButton from './check-in-button';
import { generateDailySchedule } from '@/app/actions/generateSchedule';

export default async function VisitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = new Date().toISOString().split('T')[0];

  // 1. Logic AUTO GENERATE (Kalau hari ini kosong, coba generate dari PCP)
  // Cek dulu apakah sudah ada jadwal hari ini?
  const { count } = await supabase
    .from('visit_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('sales_id', user?.id)
    .eq('scheduled_date', today);

  if (count === 0 && user) {
    // Kalau kosong, panggil Server Action untuk generate otomatis
    // Kita panggil langsung fungsinya di sini (Server Side Call)
    await generateDailySchedule(user.id, new Date());
  }

  // 2. Fetch Data dengan SMART SORTING
  const { data: visits } = await supabase
    .from('visit_schedules')
    .select(`
      *,
      customers ( id, name, address, district )
    `)
    .eq('sales_id', user?.id)
    .eq('scheduled_date', today)
    // ORDER BY district ASC (Hemat Bensin) lalu status (Pending duluan)
    .order('district', { foreignTable: 'customers', ascending: true }) 
    .order('status', { ascending: true });

  const total = visits?.length || 0;
  const visited = visits?.filter(v => v.status === 'visited').length || 0;
  const progress = total === 0 ? 0 : (visited / total) * 100;

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      {/* Header Mobile UI */}
      <div className="bg-blue-700 text-white p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        <h1 className="text-xl font-bold">Rute Hari Ini</h1>
        <p className="opacity-80 text-sm mb-4">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        
        <div className="bg-blue-800/50 rounded-xl p-3 backdrop-blur-sm">
          <div className="flex justify-between text-xs mb-2 font-semibold">
            <span>Progress: {visited}/{total} Toko</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-blue-900/50 rounded-full h-2">
            <div 
              className="bg-green-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* List Toko */}
      <div className="p-4 space-y-4">
        {visits?.length === 0 && (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl shadow-sm p-8">
            <p className="mb-2 text-4xl"></p>
            <p>Tidak ada jadwal kunjungan.</p>
            <p className="text-xs mt-2">Pastikan Admin sudah setting PCP.</p>
          </div>
        )}

        {visits?.map((visit) => (
          <div key={visit.id} className={`bg-white rounded-xl shadow-sm border p-5 relative overflow-hidden transition-all ${
            visit.status === 'visited' ? 'border-green-500 bg-green-50/30' : 'border-gray-200'
          }`}>
            
            {/* Tag Wilayah (Fitur Smart Sorting Visual) */}
            <div className="absolute top-0 right-0 bg-gray-100 text-gray-500 text-[10px] px-3 py-1 rounded-bl-xl font-bold tracking-wider uppercase">
               {visit.customers?.district || 'NA'}
            </div>

            <h3 className="font-bold text-lg text-gray-800 mb-1">{visit.customers?.name}</h3>
            <p className="text-gray-500 text-sm mb-4 line-clamp-2">{visit.customers?.address}</p>

            {visit.status === 'visited' ? (
              <div className="flex items-center gap-2 text-green-700 font-bold bg-green-100 p-3 rounded-lg justify-center border border-green-200">
                KUNJUNGAN SELESAI
                <span className="text-xs font-normal opacity-70 block">
                  ({new Date(visit.check_in_time).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})})
                </span>
              </div>
            ) : (
              <CheckInButton visitId={visit.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}