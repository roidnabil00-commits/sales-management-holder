import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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

  // 1. Cek User Session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // --- LOGIKA PROTEKSI LOGIN ---
  
  // Jika User BELUM Login, tapi maksa masuk Dashboard
  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Jika User SUDAH Login, tapi buka Login atau Home
  if (user && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // --- LOGIKA RBAC (Role-Based Access Control) ---
  
  if (user && path.startsWith('/dashboard')) {
    // Ambil Role User dari tabel profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'sales' // Default ke sales jika null

    // DEFINISI AKSES
    // Admin: Bebas kemana saja
    // Sales: Terbatas
    if (userRole === 'sales') {
      // Daftar path yang DIIZINKAN untuk Sales
      const allowedPaths = [
        '/dashboard',           // Halaman utama dashboard (biasanya overview)
        '/dashboard/visits',    // Visits
        '/dashboard/quotation', // Quotation
        '/dashboard/targets',   // Targets
      ]

      // Cek apakah path saat ini berawalan dengan path yang diizinkan
      // Kita pakai .some() dan .startsWith() agar sub-route (misal /visits/add) juga kena
      const isAllowed = allowedPaths.some(allowed => path.startsWith(allowed))

      // Jika Sales mencoba masuk ke halaman TERLARANG (misal /stock atau /reports)
      if (!isAllowed) {
        // Tendang balik ke halaman dashboard utama atau halaman error
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}