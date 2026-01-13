// app/dashboard/invoices/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Receipt, CheckCircle, Clock, AlertCircle, Printer, DollarSign } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Load Pesanan yang SUDAH DIKIRIM (Shipped)
  const fetchInvoices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_no, created_at, total_amount, status,
        payment_status, payment_due_date,
        customer:customers(name, address)
      `)
      .eq('status', 'shipped') // Hanya yang sudah dikirim yang bisa ditagih
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setInvoices(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  // ACTION: Update Status Pembayaran
  const handleUpdatePayment = async (id: number, status: string) => {
    if (!confirm(`Ubah status pembayaran menjadi ${status}?`)) return

    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_status: status,
        payment_due_date: status === 'unpaid' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null // Default tempo 7 hari
      })
      .eq('id', id)

    if (error) alert('Gagal update: ' + error.message)
    else fetchInvoices()
  }

  // ACTION: Cetak Invoice Resmi (Tagihan)
  const printInvoice = async (invoice: any) => {
    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(20)
    doc.setTextColor(40, 40, 40)
    doc.text('INVOICE / TAGIHAN', 14, 20)
    
    doc.setFontSize(10)
    doc.text(`No. Inv: ${invoice.order_no}`, 140, 20)
    doc.text(`Tanggal: ${new Date(invoice.created_at).toLocaleDateString('id-ID')}`, 140, 25)
    doc.text(`Status: ${invoice.payment_status.toUpperCase()}`, 140, 30)

    doc.setDrawColor(200, 200, 200)
    doc.line(14, 35, 196, 35)

    // Info Customer
    doc.text('Ditagihkan Kepada:', 14, 45)
    doc.setFont('helvetica', 'bold')
    doc.text(invoice.customer.name, 14, 50)
    doc.setFont('helvetica', 'normal')
    doc.text(invoice.customer.address || '', 14, 55)

    // Total Tagihan Besar
    doc.setFillColor(240, 240, 240)
    doc.rect(140, 40, 56, 20, 'F')
    doc.setFontSize(14)
    doc.text(`Rp ${invoice.total_amount.toLocaleString()}`, 168, 52, { align: 'center' })
    doc.setFontSize(8)
    doc.text('Total Tagihan', 168, 45, { align: 'center' })

    // Footer Info Rekening (Contoh)
    doc.setFontSize(10)
    doc.text('Harap transfer pembayaran ke:', 14, 80)
    doc.setFont('helvetica', 'bold')
    doc.text('BCA 123-456-7890 a.n Xander Systems', 14, 85)
    
    doc.save(`Invoice-${invoice.order_no}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Faktur Penjualan</h2>
          <p className="text-sm text-gray-500">Monitor pembayaran & tagihan jatuh tempo</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
            <tr>
              <th className="px-6 py-4">No. Invoice</th>
              <th className="px-6 py-4">Pelanggan</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Status Bayar</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
               <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading data...</td></tr>
            ) : invoices.length === 0 ? (
               <tr><td colSpan={5} className="p-6 text-center text-gray-400">Semua tagihan lunas / belum ada pengiriman.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{inv.order_no}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{inv.customer.name}</div>
                    <div className="text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 font-bold">Rp {inv.total_amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {inv.payment_status === 'paid' ? (
                      <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                        <CheckCircle size={12} /> LUNAS
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                        <Clock size={12} /> BELUM BAYAR
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 flex justify-center gap-2">
                    <button 
                      onClick={() => printInvoice(inv)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg tooltip"
                      title="Cetak Invoice"
                    >
                      <Printer size={18} />
                    </button>
                    {inv.payment_status !== 'paid' && (
                      <button 
                        onClick={() => handleUpdatePayment(inv.id, 'paid')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Tandai Lunas"
                      >
                        <DollarSign size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}