'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { appConfig } from '@/lib/appConfig'
import { toast } from 'sonner' // 1. Import Toast
import { Loader2, LogIn, Mail, Lock } from 'lucide-react' // 2. Import Icons

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validasi ekstra (opsional tapi bagus)
    if (!email || !password) {
      toast.warning('Mohon isi Email dan Password!')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      if (error) throw error

      // Sukses
      toast.success('Login Berhasil! Mengalihkan ke Dashboard...')
      
      // Sedikit delay agar user sempat baca notifikasi sebelum pindah halaman
      setTimeout(() => {
        router.push('/dashboard') 
      }, 800)

    } catch (error: any) {
      // Translate Error biar lebih ramah
      let pesanError = error.message
      if (pesanError.includes('Invalid login credentials')) {
        pesanError = 'Email atau Password salah.'
      }

      toast.error('Gagal Masuk: ' + pesanError)
      setLoading(false) // Stop loading hanya jika gagal (kalau sukses biarkan loading sampai pindah)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-300">
        
        {/* LOGO SECTION */}
        <div className="flex flex-col items-center justify-center mb-8">
          {appConfig.brandLogo ? (
            <img src={appConfig.brandLogo} alt="Logo" className="h-20 w-auto mb-4 object-contain" />
          ) : (
            <div className="h-16 w-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                <LogIn size={32} />
            </div>
          )}
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{appConfig.brandName || 'Sistem Login'}</h1>
          <p className="text-sm text-gray-500 font-medium">Masuk untuk mengelola bisnis Anda</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-600 uppercase">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                placeholder="nama@perusahaan.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-gray-600 uppercase">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-center text-sm font-bold text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-70 disabled:cursor-not-allowed transition shadow-lg shadow-blue-100 flex justify-center items-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Memproses...
              </>
            ) : (
              'Masuk Sistem'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 font-medium">
            Powered by <span className="text-blue-600 font-bold">Xander Systems</span>
          </p>
        </div>
      </div>
    </div>
  )
}