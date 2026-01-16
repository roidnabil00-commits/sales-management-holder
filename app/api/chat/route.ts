import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!apiKey || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Config Error: Cek API Key & Supabase Env" }, { status: 500 });
  }

  try {
    const { message } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. AMBIL MATERI
    const { data: knowledgeData } = await supabase
      .from('ai_knowledge_base')
      .select('topic, content')
      .eq('is_active', true);

    const dynamicKnowledge = knowledgeData?.map(k => 
      `- ${k.topic}: ${k.content}`
    ).join("\n") || "Gunakan prinsip umum sales.";

    // 2. INFO PRODUK
    const productData = `
    DAFTAR HARGA:
    - Roti Buaya: Rp 25.000
    - Roti Lonjong: Rp 20.000
    - Pia: Rp 2.000
    - Dorayaki: Rp 30.000 - 35.000
    - Roti Tawar: Rp 30.000 - 40.000
    `;

    // 3. SYSTEM PROMPT (VERTIKAL MODE)
    const systemPrompt = `
      # PERAN
      Kamu adalah Senior Sales Coach.
      Gaya: Profesional ("Pak"), Tegas, tapi Detail.

      # MATERI:
      ${dynamicKnowledge}
      ${productData}

      # INSTRUKSI FORMAT (PENTING!):
      User mengeluh jawaban sebelumnya terlalu pendek dan berantakan.
      1. **WAJIB VERTIKAL:** Gunakan ENTER (Baris Baru) untuk memisahkan setiap bagian. JANGAN menulis menyamping.
      2. **LEBIH BERISI:** Jelaskan setiap poin dengan 2-3 kalimat yang "daging" (berbobot), jangan cuma 1 kalimat pendek.
      3. **STRUKTUR:** Ikuti template di bawah ini persis.

      # TEMPLATE JAWABAN (Ikuti Enter-nya):
      
      Questions : "${message}"
      
      Answer : [Sapa Pak, validasi pertanyaan dengan ramah, dan berikan pengantar singkat]
      
      1. [Strategi Pertama]
      [Penjelasan detail strategi pertama. Berikan contoh cara melakukannya.]
      
      2. [Strategi Kedua]
      [Penjelasan detail strategi kedua. Hubungkan dengan soft skill jika relevan.]
      
      3. [Strategi Ketiga]
      [Penjelasan detail strategi ketiga. Berikan langkah konkret.]
      
      [Kalimat Motivasi Penutup yang Kuat]

      # ATURAN:
      - DILARANG MARKDOWN (No Bold/Italic).
      - Gunakan format list angka (1. 2. 3.).
      - Pastikan ada Jarak Baris (Spasi Kosong) antar poin agar rapi.

      # INPUT USER:
      "${message}"
      
      # JAWABAN COACH:
    `;

    const modelName = "models/gemini-2.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.6, // Naikkan sedikit agar penjelasan lebih luwes/panjang
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
        return NextResponse.json({ error: "Server sibuk." }, { status: 500 });
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, data kosong.";
    
    // Pembersihan Markdown
    reply = reply.replace(/[\*#`]/g, "").trim();

    return NextResponse.json({ reply: reply });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}