import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Setup Response Awal
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Setup Supabase Client untuk Middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Cek User Session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl
  const path = url.pathname

  // --- LOGIKA PROTEKSI LOGIN ---
  
  // A. Jika User BELUM Login, tapi coba masuk Dashboard -> Tendang ke Login
  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // B. Jika User SUDAH Login, tapi coba buka halaman Login -> Tendang ke Dashboard
  if (user && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // --- LOGIKA ROLE-BASED ACCESS (Security Hardening) ---
  
  if (user && path.startsWith('/dashboard')) {
    // Ambil Role User dari database
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'sales' // Default sales

    // JIKA USER ADALAH SALES (Bukan Admin)
    if (userRole === 'sales') {
      // Daftar Menu yang BOLEH diakses Sales
      const allowedPaths = [
        '/dashboard',           // Overview
        '/dashboard/visits',    // Visits
        '/dashboard/orders',    // Orders
        '/dashboard/customers', // Customers
        '/dashboard/routes',    // Laporan Visit (Opsional)
      ]

      // Cek apakah path saat ini ada di daftar yang boleh
      const isAllowed = allowedPaths.some(allowed => 
        path === allowed || path.startsWith(`${allowed}/`)
      )

      // Jika Sales nyasar ke halaman Admin (misal /stock), kembalikan ke Dashboard
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

// Konfigurasi Matcher (Agar middleware tidak jalan di file statis/gambar)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}