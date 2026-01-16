'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Target, TrendingUp, Award, BookOpen, PlayCircle, MessageSquare, 
  Send, Bot, Sparkles, User, ChevronRight, Search, Plus, Upload, X, Lock,
  Edit3, Save, Trash2, Settings, Users, DollarSign, Briefcase
} from 'lucide-react'

// --- TIPE DATA ---
type AcademyModule = {
  id: number
  title: string
  category: string
  type: 'video' | 'article'
  content: string 
  description: string
  created_at?: string
}

type Discussion = {
  id: number
  user_name: string
  message: string
  created_at: string
}

type ChatMessage = {
  id: number
  sender: 'user' | 'ai'
  text: string
  timestamp: string
}

type SalesData = {
  target: number
  current: number
  team: { id: number; name: string; omzet: number }[]
}

export default function PerformanceHubPage() {
  const [activeTab, setActiveTab] = useState<'targets' | 'academy' | 'ai'>('targets')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // --- STATE DATA UTAMA (KPI) ---
  const [salesData, setSalesData] = useState<SalesData>({
    target: 150000000,
    current: 0, // Akan dihitung otomatis dari total omzet tim
    team: [
      { id: 1, name: 'Andi Sales', omzet: 45000000 },
      { id: 2, name: 'Budi Marketing', omzet: 32000000 },
      { id: 3, name: 'Siti SPG', omzet: 21000000 },
    ]
  })

  // --- STATE MODAL ADMIN (Target) ---
  const [showTargetModal, setShowTargetModal] = useState(false)
  const [editForm, setEditForm] = useState<SalesData>({ target: 0, current: 0, team: [] })

  // --- STATE ACADEMY ---
  const [modules, setModules] = useState<AcademyModule[]>([])
  const [selectedModule, setSelectedModule] = useState<AcademyModule | null>(null)
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [newComment, setNewComment] = useState('')
  
  // --- STATE MODAL ADMIN (Academy) ---
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '', category: 'Sales Technique', type: 'video', content: '', description: ''
  })

  // --- STATE AI ---
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: 1, sender: 'ai', text: 'Halo! Saya X-Bot. Ada yang bisa saya bantu untuk strategi pencapaian target hari ini?', timestamp: new Date().toLocaleTimeString() }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isAiTyping, setIsAiTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // --- INITIAL LOAD ---
  useEffect(() => {
    checkUserRole()
    fetchModules()
    calculateTotalOmzet(salesData.team)
  }, [])

  useEffect(() => {
    if (selectedModule) fetchDiscussions(selectedModule.id)
  }, [selectedModule])

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const adminEmails = ['roidnabil00@gmail.com', 'admin@xandersystems.com', 'bilxander@gmail.com'] 
      if (adminEmails.includes(user.email || '')) setIsAdmin(true)
    }
  }

  // --- LOGIC PERHITUNGAN & DATA ---
  const calculateTotalOmzet = (team: {omzet: number}[]) => {
    const total = team.reduce((acc, curr) => acc + curr.omzet, 0)
    setSalesData(prev => ({ ...prev, current: total }))
  }

  // --- LOGIC MODAL TARGET (ADMIN) ---
  const openTargetModal = () => {
    // Copy data saat ini ke form edit agar tidak merubah tampilan utama sebelum disimpan
    setEditForm(JSON.parse(JSON.stringify(salesData)))
    setShowTargetModal(true)
  }

  const handleSalesChange = (id: number, field: 'name' | 'omzet', value: string | number) => {
    setEditForm(prev => ({
      ...prev,
      team: prev.team.map(p => p.id === id ? { ...p, [field]: value } : p)
    }))
  }

  const handleAddSalesPerson = () => {
    const newId = Math.max(...editForm.team.map(t => t.id), 0) + 1
    setEditForm(prev => ({
      ...prev,
      team: [...prev.team, { id: newId, name: 'Sales Baru', omzet: 0 }]
    }))
  }

  const handleDeleteSalesPerson = (id: number) => {
    if(!confirm("Hapus data sales ini?")) return
    setEditForm(prev => ({
      ...prev,
      team: prev.team.filter(p => p.id !== id)
    }))
  }

  const saveTargetChanges = () => {
    // Hitung ulang total sebelum simpan
    const newTotal = editForm.team.reduce((acc, curr) => acc + curr.omzet, 0)
    const finalData = { ...editForm, current: newTotal }
    
    setSalesData(finalData)
    setShowTargetModal(false)
    alert("Data Target & Tim Sales berhasil diperbarui!")
    // Note: Di sini nanti bisa tambahkan API call untuk simpan ke Supabase permanen
  }

  // --- LOGIC ACADEMY ---
  const fetchModules = async () => {
    const { data } = await supabase.from('academy_modules').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (data) setModules(data as any[])
  }

  const getYoutubeEmbedUrl = (url: string) => {
    try {
      let videoId = ''
      if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0]
      else if (url.includes('youtube.com/watch')) videoId = new URLSearchParams(new URL(url).search).get('v') || ''
      else return null
      return `https://www.youtube.com/embed/${videoId}`
    } catch (e) { return null }
  }

  const handleUploadSubmit = async () => {
    if (!uploadForm.title || !uploadForm.content) return alert("Judul & Konten wajib!")
    const { error } = await supabase.from('academy_modules').insert([uploadForm])
    if (!error) { alert("Sukses!"); setShowUploadModal(false); fetchModules(); setUploadForm({ title: '', category: 'Sales Technique', type: 'video', content: '', description: '' }) }
  }

  // --- LOGIC AI ---
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return
    const userMsg: ChatMessage = { id: Date.now(), sender: 'user', text: inputMessage, timestamp: new Date().toLocaleTimeString() }
    setChatHistory(prev => [...prev, userMsg])
    setInputMessage('')
    setIsAiTyping(true)
    setTimeout(() => {
      let reply = "Saya perlu detail lebih lanjut."
      const lower = userMsg.text.toLowerCase()
      if (lower.includes('halo')) reply = "Halo Partner! Fokus kita hari ini adalah closing. Ada prospek 'panas' yang perlu difollow-up?"
      else if (lower.includes('script')) reply = "Coba pendekatan konsultatif: 'Halo Pak, banyak bisnis ritel kesulitan kontrol stok. Xander Systems bisa otomatisasi itu. Boleh diskusi sebentar?'"
      else if (lower.includes('motivasi')) reply = "Ingat: Penolakan adalah bagian dari proses. Setiap 'Tidak' membawamu lebih dekat ke 'Ya'."
      setChatHistory(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: reply, timestamp: new Date().toLocaleTimeString() }])
      setIsAiTyping(false)
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 1500)
  }

  // --- RENDER HELPERS ---
  const fetchDiscussions = async (moduleId: number) => {
    const { data } = await supabase.from('academy_discussions').select('*').eq('module_id', moduleId).order('created_at', { ascending: true })
    if (data) setDiscussions(data as any[])
  }
  const handlePostComment = async () => {
     if (!newComment.trim() || !selectedModule) return
     const { data: { user } } = await supabase.auth.getUser()
     if (!user) return alert("Login dulu")
     const { error } = await supabase.from('academy_discussions').insert([{module_id: selectedModule.id, user_id: user.id, user_name: user.email?.split('@')[0], message: newComment}])
     if(!error) { setNewComment(''); fetchDiscussions(selectedModule.id) }
  }

  const percentage = Math.round((salesData.current / salesData.target) * 100) || 0

  return (
    <div className="space-y-6 h-[85vh] flex flex-col relative">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Performance Hub</h2>
          <p className="text-sm text-gray-500 font-medium">Pusat Komando Sales & Pengembangan Tim</p>
        </div>
        
        <div className="flex items-center gap-3">
           {/* Tombol Admin Khusus Tab Academy */}
           {activeTab === 'academy' && isAdmin && (
             <button onClick={() => setShowUploadModal(true)} className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition shadow-lg shadow-gray-200">
               <Upload size={18}/> Upload Materi
             </button>
           )}

           {/* Tombol Admin Khusus Tab Targets */}
           {activeTab === 'targets' && isAdmin && (
             <button onClick={openTargetModal} className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition shadow-lg shadow-gray-200">
               <Settings size={18}/> Kelola Target & Tim
             </button>
           )}

           <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1">
            <button onClick={() => setActiveTab('targets')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'targets' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Target size={16}/> KPI
            </button>
            <button onClick={() => setActiveTab('academy')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'academy' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <BookOpen size={16}/> Academy
            </button>
            <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === 'ai' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Bot size={16}/> AI Agent
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-200 relative">
        
        {/* TAB 1: TARGETS (KPI) */}
        {activeTab === 'targets' && (
          <div className="p-8 h-full overflow-y-auto bg-gray-50/50">
             {/* KARTU UTAMA */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* 1. Progress Omzet */}
                <div className="bg-gradient-to-br from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <DollarSign className="text-white" size={20}/>
                      </div>
                      <span className="text-xs font-bold bg-blue-500/30 px-2 py-1 rounded text-blue-100 border border-blue-400/30">Bulanan</span>
                    </div>
                    <p className="text-blue-200 text-sm font-medium mb-1">Target Omset</p>
                    <h3 className="text-3xl font-black tracking-tight mb-4">Rp {salesData.target.toLocaleString()}</h3>
                    
                    <div className="w-full bg-black/20 h-3 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                      <div className="bg-gradient-to-r from-green-400 to-emerald-400 h-3 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: `${percentage}%` }}></div>
                    </div>
                    
                    <div className="flex justify-between mt-3 text-xs font-medium text-blue-100">
                      <span className="flex items-center gap-1">Tercapai: <span className="font-bold text-white">Rp {salesData.current.toLocaleString()}</span></span>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-white">{percentage}%</span>
                    </div>
                  </div>
                  {/* Dekorasi Background */}
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-400/30 transition duration-700"></div>
                </div>

                {/* 2. Kinerja Tim */}
                <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
                   <div className="flex justify-between items-start">
                     <div>
                       <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">Tim Sales</p>
                       <h3 className="text-3xl font-black text-gray-900 mt-2">{salesData.team.length} <span className="text-lg text-gray-400 font-medium">Personil</span></h3>
                     </div>
                     <div className="bg-orange-100 p-3 rounded-xl text-orange-600"><Users size={24}/></div>
                   </div>
                   <div className="mt-4 pt-4 border-t border-gray-100">
                     <p className="text-sm text-gray-600 font-medium flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> {salesData.team.filter(t => t.omzet > 0).length} Aktif berjualan
                     </p>
                   </div>
                </div>

                {/* 3. Sisa Target (Motivation) */}
                <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
                   <div className="flex justify-between items-start">
                     <div>
                       <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">Gap Target</p>
                       <h3 className="text-3xl font-black text-red-600 mt-2">Rp {Math.max(0, salesData.target - salesData.current).toLocaleString()}</h3>
                     </div>
                     <div className="bg-red-100 p-3 rounded-xl text-red-600"><TrendingUp size={24}/></div>
                   </div>
                   <div className="mt-4 pt-4 border-t border-gray-100">
                     <p className="text-xs text-gray-500 font-medium italic">"Kejar selisih ini sebelum akhir bulan!"</p>
                   </div>
                </div>
             </div>

             {/* LEADERBOARD TABLE (Read Only - Professional Look) */}
             <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><Award className="text-yellow-500"/> Leaderboard Sales</h3>
                    <p className="text-xs text-gray-500 font-medium">Peringkat berdasarkan kontribusi omzet real-time</p>
                  </div>
                  <button onClick={() => alert("Fitur Export PDF akan segera hadir!")} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition">
                    Export Laporan
                  </button>
                </div>
                
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
                    <tr>
                      <th className="p-4 w-20 text-center">Rank</th>
                      <th className="p-4">Nama Sales</th>
                      <th className="p-4">Level</th>
                      <th className="p-4 text-right">Kontribusi Omzet</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesData.team.sort((a,b) => b.omzet - a.omzet).map((person, idx) => {
                      const contribution = (person.omzet / salesData.target) * 100;
                      return (
                        <tr key={person.id} className="hover:bg-blue-50/50 transition group">
                          <td className="p-4 text-center font-black text-gray-900 text-lg">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="text-gray-400 text-sm">#{idx+1}</span>}
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-gray-900 text-base">{person.name}</p>
                            <p className="text-xs text-gray-400">ID: SALES-{100 + person.id}</p>
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              contribution > 20 ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {contribution > 20 ? 'TOP PERFORMER' : 'JUNIOR'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <p className="font-bold text-gray-900 text-base">Rp {person.omzet.toLocaleString()}</p>
                            <div className="w-24 h-1.5 bg-gray-100 rounded-full ml-auto mt-1 overflow-hidden">
                              <div className="bg-blue-600 h-full rounded-full" style={{width: `${contribution}%`}}></div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {person.omzet >= (salesData.target / salesData.team.length) ? 
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200"><TrendingUp size={12}/> On Track</span> : 
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-xs font-bold border border-amber-200"><Briefcase size={12}/> Push!</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                    {salesData.team.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Belum ada data tim sales.</td></tr>
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {/* TAB 2: ACADEMY (FULL FEATURES) */}
        {activeTab === 'academy' && (
          <div className="flex h-full">
            {/* LIST */}
            <div className={`w-full md:w-80 border-r border-gray-200 overflow-y-auto bg-gray-50 ${selectedModule ? 'hidden md:block' : 'block'}`}>
              <div className="p-4 sticky top-0 bg-gray-50 border-b z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                  <input type="text" placeholder="Cari materi..." className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {modules.map((mod) => (
                  <div key={mod.id} onClick={() => setSelectedModule(mod)} className={`p-4 cursor-pointer hover:bg-white transition group ${selectedModule?.id === mod.id ? 'bg-white border-l-4 border-indigo-600 shadow-sm' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${mod.category==='Marketing'?'bg-pink-100 text-pink-700':mod.category==='Sales Technique'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}`}>{mod.category}</span>
                      {mod.type === 'video' ? <PlayCircle size={16} className="text-gray-400"/> : <BookOpen size={16} className="text-gray-400"/>}
                    </div>
                    <h4 className={`font-bold text-sm mb-1 ${selectedModule?.id === mod.id ? 'text-indigo-700' : 'text-gray-900'}`}>{mod.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-2">{mod.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* DETAIL */}
            <div className={`flex-1 bg-white flex flex-col ${!selectedModule ? 'hidden md:flex' : 'flex'}`}>
              {selectedModule ? (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b flex items-center justify-between shadow-sm z-10 bg-white">
                     <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedModule(null)} className="md:hidden p-2 hover:bg-gray-100 rounded-full"><ChevronRight className="rotate-180" size={20}/></button>
                        <h3 className="font-bold text-lg text-gray-900 truncate max-w-md">{selectedModule.title}</h3>
                     </div>
                     {isAdmin && (
                        <button onClick={async () => {
                           if(confirm("Hapus materi ini?")) {
                             await supabase.from('academy_modules').delete().eq('id', selectedModule.id)
                             setSelectedModule(null); fetchModules()
                           }
                        }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition" title="Hapus"><Trash2 size={18}/></button>
                     )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                      {selectedModule.type === 'video' ? (
                        <div className="aspect-video bg-black flex items-center justify-center">
                          <iframe width="100%" height="100%" src={getYoutubeEmbedUrl(selectedModule.content) || ''} title="Video" frameBorder="0" allowFullScreen></iframe>
                        </div>
                      ) : (
                        <div className="p-8 prose max-w-none"><p className="whitespace-pre-wrap font-serif text-gray-800 text-lg leading-relaxed">{selectedModule.content}</p></div>
                      )}
                      <div className="p-6 border-t bg-gray-50/50"><h4 className="font-bold text-gray-900 mb-2">Deskripsi</h4><p className="text-gray-600 text-sm">{selectedModule.description}</p></div>
                    </div>
                    {/* DISKUSI */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><MessageSquare size={18}/> Diskusi Kelas</h4>
                      <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                         {discussions.length === 0 && <p className="text-gray-400 italic text-center py-4">Belum ada diskusi.</p>}
                         {discussions.map(d => (
                           <div key={d.id} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">{d.user_name.charAt(0).toUpperCase()}</div>
                              <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-none text-sm text-gray-800 flex-1">
                                <div className="flex justify-between mb-1"><span className="font-bold text-xs">{d.user_name}</span><span className="text-[10px] text-gray-400">{new Date(d.created_at).toLocaleDateString()}</span></div>
                                {d.message}
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Tulis komentar..." className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition" onKeyDown={e => e.key === 'Enter' && handlePostComment()}/>
                        <button onClick={handlePostComment} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition shadow-md"><Send size={18}/></button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-gray-50/30">
                   <div className="bg-white p-6 rounded-full shadow-sm mb-4"><BookOpen size={48} className="text-indigo-200"/></div>
                   <h3 className="font-bold text-gray-700 text-lg">Xander Academy</h3>
                   <p className="text-sm text-gray-500 mt-2 max-w-xs">Pilih materi di sebelah kiri untuk meningkatkan skill sales Anda.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AI AGENT */}
        {activeTab === 'ai' && (
          <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-white relative">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {chatHistory.map((chat) => (
                <div key={chat.id} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`p-4 rounded-2xl shadow-sm text-sm max-w-[80%] leading-relaxed ${chat.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'}`}>
                      {chat.text}
                   </div>
                </div>
              ))}
              {isAiTyping && <div className="text-xs text-gray-400 ml-4 flex gap-1"><span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-100">
               <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500 transition">
                  <input type="text" className="flex-1 bg-transparent px-4 py-2 text-sm outline-none text-gray-800" placeholder="Tanya X-Bot..." value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
                  <button onClick={handleSendMessage} className="bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700 transition shadow-md"><Send size={18}/></button>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL PROFESSIONAL: EDIT TARGET & TIM SALES --- */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-xl text-gray-900 flex items-center gap-2">
                  <Settings className="text-gray-900" size={24}/> Pengaturan Sales
                </h3>
                <p className="text-sm text-gray-500">Kelola target bulanan dan performa tim.</p>
              </div>
              <button onClick={() => setShowTargetModal(false)} className="bg-white p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition shadow-sm border border-gray-200"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* SECTION 1: TARGET SETTING */}
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                <label className="text-xs font-bold text-blue-800 uppercase mb-2 block flex items-center gap-2">
                  <Target size={14}/> Target Omset (Bulan Ini)
                </label>
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
                  <span className="text-gray-400 font-bold pl-2">Rp</span>
                  <input 
                    type="number" 
                    className="flex-1 outline-none font-black text-2xl text-gray-900 placeholder-gray-300"
                    value={editForm.target}
                    onChange={(e) => setEditForm({...editForm, target: parseInt(e.target.value) || 0})}
                  />
                </div>
                <p className="text-xs text-blue-600 mt-2">Set target yang realistis namun menantang untuk tim.</p>
              </div>

              {/* SECTION 2: TEAM MANAGEMENT */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2"><Users size={18}/> Manajemen Tim Sales</h4>
                  <button 
                    onClick={handleAddSalesPerson}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-black transition flex items-center gap-1"
                  >
                    <Plus size={12}/> Tambah Sales
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600 font-bold border-b">
                      <tr>
                        <th className="p-3 text-left">Nama Personil</th>
                        <th className="p-3 text-right">Omset (Rp)</th>
                        <th className="p-3 text-center w-10">Act</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {editForm.team.map((person) => (
                        <tr key={person.id} className="group hover:bg-gray-50">
                          <td className="p-3">
                            <input 
                              type="text" 
                              className="w-full border border-gray-300 rounded px-2 py-1.5 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              value={person.name}
                              onChange={(e) => handleSalesChange(person.id, 'name', e.target.value)}
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="number" 
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-right font-mono text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              value={person.omzet}
                              onChange={(e) => handleSalesChange(person.id, 'omzet', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => handleDeleteSalesPerson(person.id)}
                              className="text-gray-400 hover:text-red-500 transition p-1"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {editForm.team.length === 0 && (
                        <tr><td colSpan={3} className="p-4 text-center text-gray-400 text-xs">Tidak ada data sales. Tambahkan baru.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowTargetModal(false)}
                className="px-5 py-2.5 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-200 transition"
              >
                Batal
              </button>
              <button 
                onClick={saveTargetChanges}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transition transform active:scale-95"
              >
                <Save size={16}/> Simpan Perubahan
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL UPLOAD (ACADEMY) --- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b bg-gray-900 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Lock size={16}/> Upload Materi</h3>
              <button onClick={() => setShowUploadModal(false)} className="hover:text-red-400"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Judul Materi</label>
                 <input type="text" className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none focus:border-indigo-500 transition" value={uploadForm.title} onChange={e => setUploadForm({...uploadForm, title: e.target.value})} />
               </div>
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Kategori</label>
                   <select className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none bg-white" value={uploadForm.category} onChange={e => setUploadForm({...uploadForm, category: e.target.value})}>
                     <option>Sales Technique</option><option>Marketing</option><option>Psychology</option>
                   </select>
                 </div>
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tipe</label>
                   <select className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none bg-white" value={uploadForm.type} onChange={e => setUploadForm({...uploadForm, type: e.target.value as any})}>
                     <option value="video">Video</option><option value="article">Artikel</option>
                   </select>
                 </div>
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Konten / URL</label>
                 <input type="text" placeholder={uploadForm.type==='video'?"Link Youtube...":"Isi artikel..."} className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition" value={uploadForm.content} onChange={e => setUploadForm({...uploadForm, content: e.target.value})} />
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Deskripsi</label>
                 <textarea rows={3} className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition" value={uploadForm.description} onChange={e => setUploadForm({...uploadForm, description: e.target.value})}></textarea>
               </div>
               <button onClick={handleUploadSubmit} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-black transition shadow-lg">Upload Materi</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}