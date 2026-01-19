// app/actions/generateSchedule.ts
'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Kita definisikan tipe data manual di sini supaya TypeScript tidak rewel
type RouteTemplate = {
  customer_id: number; // Menggunakan number karena BIGINT di JS diperlakukan sebagai number/string
}

export async function generateDailySchedule(salesId: string, targetDate: Date) {
  const supabase = await createClient();
  
  // Konversi tanggal JS (0=Minggu) ke SQL (1=Senin, 7=Minggu)
  let dayOfWeek = targetDate.getDay(); 
  dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; 

  const formattedDate = targetDate.toISOString().split('T')[0];

  // 1. Ambil Template PCP untuk hari tersebut
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
    return { success: true, count: 0, message: "Tidak ada rute PCP untuk hari ini." };
  }

  // 2. Siapkan data untuk dimasukkan ke jadwal harian
  const schedules = templates.map((t: any) => ({
    sales_id: salesId,
    customer_id: t.customer_id,
    scheduled_date: formattedDate,
    status: 'pending'
  }));

  // 3. Masukkan ke database (Upsert: kalau sudah ada, jangan error)
  const { error: insertError } = await supabase
    .from('visit_schedules')
    .upsert(schedules, { onConflict: 'sales_id, customer_id, scheduled_date' });

  if (insertError) {
    console.error("Error inserting schedules:", insertError);
    throw new Error('Gagal membuat jadwal');
  }

  // Refresh halaman biar data muncul
  revalidatePath('/dashboard/visits');
  revalidatePath('/dashboard/reports');
  
  return { success: true, count: schedules.length };
}