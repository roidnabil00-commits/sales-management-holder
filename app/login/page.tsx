// app/login/page.tsx
'use client' // <--- Pastikan baris ini ada di paling atas!

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { appConfig } from '@/lib/appConfig'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      if (error) throw error

      alert('Login Berhasil!')
      router.push('/dashboard') 
    } catch (error: any) {
      alert('Login Gagal: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg border border-gray-100">
        <div className="flex justify-center mb-4">
  {appConfig.brandLogo ? (
    <img src={appConfig.brandLogo} alt="Logo" className="h-16 w-auto" />
  ) : (
    <h1 className="text-2xl font-bold text-blue-600">{appConfig.brandName}</h1>
  )}
</div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            {/* Perhatikan bagian value dan onChange di bawah ini */}
            <input
              type="email"
              required
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:ring-blue-500 outline-none transition text-black"
              placeholder="sales@demo.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            {/* Perhatikan bagian value dan onChange di bawah ini */}
            <input
              type="password"
              required
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:ring-blue-500 outline-none transition text-black"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 transition"
          >
            {loading ? 'Memproses...' : 'Masuk Sistem'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          Powered by Xander Systems
        </div>
      </div>
    </div>
  )
}