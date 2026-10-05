import { redirect } from 'next/navigation';

// Dasbor admin dibangun pada Fase 8 — arahkan ke modul pertama Fase 3
export default function AdminIndex() {
  redirect('/admin/cabang');
}
