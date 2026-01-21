// app/actions/generateSchedule.ts
'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type RouteTemplate = {
  customer_id: number;
}

export async function generateDailySchedule(salesId: string, targetDate: Date) {
  const supabase = await createClient();
  
  // --- FIX TIMEZONE ASIA/JAKARTA START ---
  
  // 1. Buat object Date baru yang sudah digeser ke zona waktu Jakarta
  // Ini penting agar .getDay() dan tanggalnya sesuai dengan WIB, bukan UTC London
  const jakartaDate = new Date(targetDate.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
  
  // 2. Ambil Hari (0-6) dari waktu Jakarta
  let dayOfWeek = jakartaDate.getDay(); 
  dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // 1=Senin ... 7=Minggu

  // 3. Ambil Format Tanggal YYYY-MM-DD dari waktu Jakarta
  // Gunakan 'en-CA' karena format defaultnya YYYY-MM-DD
  const formattedDate = jakartaDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  // Debugging di Terminal Server (Cek Logs Vercel/Local)
  console.log(`[GENERATE] ID: ${salesId} | Jakarta Date: ${formattedDate} | Day: ${dayOfWeek}`);

  // --- FIX TIMEZONE END ---

  // 4. Ambil Template PCP untuk hari tersebut
  const { data: templates, error: templateError } = await supabase
    .from('route_templates')
    .select('customer_id')
    .eq('sales_id', salesId)
    .eq('day_of_week', dayOfWeek);

  if (templateError || !templates) {
    console.error("Error fetching templates:", templateError);
    throw new Error('Gagal mengambil template rute');
  }

  if (templates.length === 0) {
    console.log("[GENERATE] Tidak ada template rute untuk hari ini.");
    return { success: true, count: 0, message: "Tidak ada rute PCP untuk hari ini." };
  }

  // 5. Siapkan data insert
  const schedules = templates.map((t: any) => ({
    sales_id: salesId,
    customer_id: t.customer_id,
    scheduled_date: formattedDate, // Tanggal sudah benar versi Jakarta
    status: 'pending'
  }));

  // 6. Masukkan ke database (Upsert)
  const { error: insertError } = await supabase
    .from('visit_schedules')
    .upsert(schedules, { onConflict: 'sales_id, customer_id, scheduled_date' });

  if (insertError) {
    console.error("Error inserting schedules:", insertError);
    throw new Error('Gagal membuat jadwal');
  }

  // Refresh Path
  revalidatePath('/dashboard/visits');
  revalidatePath('/dashboard/reports');
  
  return { success: true, count: schedules.length };
}