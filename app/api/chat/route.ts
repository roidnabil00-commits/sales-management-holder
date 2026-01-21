import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  // 1. API KEY GEMINI (Bisa diset satu untuk semua di Vercel Env)
  const apiKey = process.env.GEMINI_API_KEY;
  
  // 2. KONEKSI SUPABASE (Otomatis beda-beda sesuai Env Client)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!apiKey || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Config Error: Cek Env" }, { status: 500 });
  }

  try {
    const { message } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- BAGIAN 1: AMBIL ILMU SALES (Knowledge Base) ---
    // Ini ambil dari tabel database klien. Jadi Toko Roti punya ilmu roti, Toko Besi punya ilmu besi.
    const { data: knowledgeData } = await supabase
      .from('ai_knowledge_base')
      .select('topic, content')
      .eq('is_active', true);

    const dynamicKnowledge = knowledgeData?.map(k => 
      `- ${k.topic}: ${k.content}`
    ).join("\n") || "Gunakan prinsip umum sales yang ramah dan solutif.";

    // --- BAGIAN 2: AMBIL INFO PRODUK (DINAMIS - PENTING!) ---
    // Kita hapus hardcode Roti, ganti dengan fetch database
    const { data: products } = await supabase
      .from('products')
      .select('name, price, unit')
      .eq('is_active', true)
      .limit(10); // Ambil 10 produk teratas saja biar prompt gak kepenuhan

    // Format jadi string biar AI ngerti
    const productListText = products?.map(p => 
      `- ${p.name}: Rp ${p.price.toLocaleString()} / ${p.unit}`
    ).join("\n") || "Belum ada data produk.";

    // --- BAGIAN 3: SYSTEM PROMPT ---
    const systemPrompt = `
      # PERAN
      Kamu adalah Senior Sales Coach & Asisten Penjualan.
      Gaya: Profesional ("Pak"), Tegas, tapi Detail.

      # KONTEKS PENGETAHUAN KHUSUS (Knowledge Base):
      ${dynamicKnowledge}

      # KATALOG PRODUK SAAT INI (Gunakan untuk referensi harga/stok):
      ${productListText}

      # INSTRUKSI FORMAT (PENTING!):
      User mengeluh jawaban sebelumnya terlalu pendek dan berantakan.
      1. **WAJIB VERTIKAL:** Gunakan ENTER (Baris Baru) untuk memisahkan setiap bagian. JANGAN menulis menyamping.
      2. **LEBIH BERISI:** Jelaskan setiap poin dengan 2-3 kalimat yang "daging" (berbobot).
      3. **STRUKTUR:** Ikuti template di bawah ini persis.

      # TEMPLATE JAWABAN (Ikuti Enter-nya):
      
      Questions : "${message}"
      
      Answer : [Sapa Pak, validasi pertanyaan, dan berikan pengantar singkat]
      
      1. [Strategi/Jawaban Poin 1]
      [Penjelasan detail. Jika relevan, sebutkan produk dari katalog di atas.]
      
      2. [Strategi/Jawaban Poin 2]
      [Penjelasan detail. Hubungkan dengan teknik closing atau soft skill.]
      
      3. [Strategi/Jawaban Poin 3]
      [Penjelasan detail langkah konkret.]
      
      [Kalimat Motivasi Penutup yang Kuat]

      # ATURAN:
      - DILARANG MARKDOWN (No Bold/Italic).
      - Gunakan format list angka (1. 2. 3.).
      - Pastikan ada Jarak Baris (Spasi Kosong) antar poin agar rapi.

      # INPUT USER:
      "${message}"
      
      # JAWABAN COACH:
    `;

    const modelName = "models/gemini-2.5-flash"; // Pakai Flash biar cepat & murah
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.7, 
        maxOutputTokens: 2000, 
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        // Cek error dari Google (misal kuota habis)
        console.error("Gemini Error:", data);
        return NextResponse.json({ error: "AI sedang istirahat. Coba lagi nanti." }, { status: 500 });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, saya kehabisan kata-kata.";
    
    // Pembersihan Markdown (Biar rapi di chat bubble)
    reply = reply.replace(/[\*#`]/g, "").trim();

    return NextResponse.json({ reply: reply });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}