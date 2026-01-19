// app/dashboard/visits/check-in-button.tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CheckInButton({ visitId }: { visitId: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleCheckIn = () => {
    setLoading(true);
    
    // Cek GPS Browser
    if (!navigator.geolocation) {
      alert("Browser tidak support GPS");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      
      // Update Database
      const { error } = await supabase
        .from('visit_schedules')
        .update({
          status: 'visited',
          check_in_time: new Date().toISOString(),
          location_lat: latitude,
          location_long: longitude
        })
        .eq('id', visitId);

      if (error) {
        alert("Gagal Check-in database error");
      } else {
        // Refresh halaman manual supaya cepat
        window.location.reload();
      }
      setLoading(false);
    }, (err) => {
      alert("Mohon nyalakan GPS/Lokasi di HP Anda untuk melakukan Check-In!");
      setLoading(false);
    });
  };

  return (
    <button 
      onClick={handleCheckIn}
      disabled={loading}
      className={`w-full font-bold py-3 px-4 rounded-lg shadow transition-all flex justify-center items-center gap-2 ${
        loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
      }`}
    >
      {loading ? 'Mendeteksi Lokasi...' : '📍 CHECK IN SEKARANG'}
    </button>
  );
}