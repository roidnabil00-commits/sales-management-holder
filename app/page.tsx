// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  // Begitu aplikasi dibuka, langsung lempar ke /login
  redirect('/login')
}