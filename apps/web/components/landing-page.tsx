import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardCheck,
  FileCheck2,
  Layers3,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

const FEATURES = [
  {
    number: '01',
    icon: ClipboardCheck,
    title: 'Checklist yang dikerjakan bersama',
    description:
      'Setiap tugas tercatat dengan status, waktu, dan nama petugas. Tim melihat progress yang sama, saat itu juga.',
  },
  {
    number: '02',
    icon: UsersRound,
    title: 'Serah terima yang tidak terlewat',
    description:
      'Catatan penting berpindah antar shift dalam format yang jelas, bukan tercecer di percakapan.',
  },
  {
    number: '03',
    icon: FileCheck2,
    title: 'Laporan yang siap ditinjau',
    description:
      'Checklist, incident, dan handover dirangkum menjadi laporan shift yang terkunci dan mudah dibagikan.',
  },
];

const STEPS = [
  { number: '01', title: 'Buka shift', text: 'Penanggung jawab memulai shift dan tim bergabung.' },
  { number: '02', title: 'Kerjakan SOP', text: 'Selesaikan checklist bersama dengan bukti yang tercatat.' },
  { number: '03', title: 'Tutup dengan rapi', text: 'Isi handover, tutup shift, lalu tinjau laporan.' },
];

export function LandingPage() {
  return (
    <main className="overflow-hidden bg-[#f7f6f2] text-[#292524]">
      <div className="pointer-events-none fixed inset-0 -z-0" aria-hidden="true">
        <div className="absolute -right-32 -top-48 h-[34rem] w-[34rem] rounded-full bg-[#dfebe2] opacity-70 blur-3xl" />
        <div className="absolute -left-48 top-[38rem] h-[28rem] w-[28rem] rounded-full bg-[#f2e8d9] opacity-70 blur-3xl" />
      </div>

      <nav className="relative z-10 mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5" aria-label="checklist-shift beranda">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#292524] text-white">
            <Check className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-bold tracking-tight">checklist<span className="text-[#8a847d]">-shift</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[#77716b] sm:inline">Untuk operasional F&amp;B</span>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#292524] px-5 text-sm font-semibold text-white transition hover:bg-[#44403c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] focus-visible:ring-offset-2"
          >
            Masuk <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 md:pb-28 md:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-12 lg:py-24">
        <div className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dcd9d2] bg-white/70 px-3.5 py-2 text-xs font-semibold tracking-wide text-[#625c55] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#64836c]" />
            OPERASIONAL SHIFT, LEBIH TERATUR
          </div>
          <h1 className="text-[clamp(3.3rem,8vw,6.7rem)] font-semibold leading-[0.96] tracking-[-0.075em]">
            Shift rapi.
            <br />
            <span className="font-normal text-[#837d75]">Tim lebih tenang.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#706a63] sm:text-lg sm:leading-8">
            Pastikan SOP benar-benar dikerjakan, serah terima tidak tertinggal, dan setiap shift punya catatan yang bisa dipercaya.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#292524] px-6 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(41,37,36,0.16)] transition hover:-translate-y-0.5 hover:bg-[#44403c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] focus-visible:ring-offset-2"
            >
              Masuk ke aplikasi <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#cara-kerja"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d7d3cc] bg-white/50 px-6 text-sm font-semibold text-[#443f3a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] focus-visible:ring-offset-2"
            >
              Lihat cara kerja <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-[#77716b]">
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#64836c]" /> Checklist bersama</span>
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#64836c]" /> Catatan tercatat</span>
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#64836c]" /> Laporan per shift</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[570px] lg:ml-auto">
          <div className="absolute -right-4 -top-5 h-28 w-28 rounded-full border border-[#d7d3cc]/80" aria-hidden="true" />
          <div className="absolute -bottom-7 -left-6 h-36 w-36 rounded-full bg-[#e5eadf]/80 blur-2xl" aria-hidden="true" />
          <div className="relative rounded-[28px] border border-white/90 bg-white/80 p-3 shadow-[0_32px_90px_rgba(41,37,36,0.13)] backdrop-blur sm:p-4">
            <div className="overflow-hidden rounded-[20px] border border-[#e8e5df] bg-[#fbfaf8]">
              <div className="flex items-center justify-between border-b border-[#e8e5df] bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#292524] text-white">
                    <Check className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-tight">checklist-shift</p>
                    <p className="text-[11px] text-[#8a847d]">Operasional harian</p>
                  </div>
                </div>
                <span className="rounded-full border border-[#d9e4d9] bg-[#edf4ed] px-3 py-1 text-[10px] font-semibold text-[#52705a]">SHIFT BERJALAN</span>
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#89837b]">Cabang Kemang · Hari ini</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">Shift Pagi</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-tight">12<span className="text-sm font-normal text-[#89837b]">/18</span></p>
                    <p className="text-[10px] uppercase tracking-wider text-[#89837b]">item selesai</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e9e6df]">
                  <div className="h-full w-2/3 rounded-full bg-[#718b72]" />
                </div>
                <div className="rounded-2xl border border-[#e8e5df] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">Persiapan area</p>
                      <p className="mt-0.5 text-[10px] text-[#89837b]">4 dari 5 tugas selesai</p>
                    </div>
                    <span className="rounded-full bg-[#edf4ed] px-2.5 py-1 text-[10px] font-semibold text-[#52705a]">4/5</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      ['Cek kebersihan meja dan area service', true],
                      ['Pastikan perlengkapan sudah lengkap', true],
                      ['Periksa suhu chiller', true],
                      ['Siapkan area kasir', false],
                    ].map(([label, done]) => (
                      <div key={String(label)} className="flex items-center gap-2.5 text-[11px] text-[#625c55]">
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${done ? 'border-[#718b72] bg-[#718b72] text-white' : 'border-[#d7d3cc]'}`}>
                          {done ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                        <span className={done ? 'text-[#89837b]' : ''}>{label}</span>
                        {label === 'Periksa suhu chiller' && <span className="ml-auto text-[9px] text-[#89837b]">08.12 · Rina</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-3.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#89837b]">Tim di shift</p>
                    <div className="mt-2 flex items-center">
                      {['R', 'D', 'A'].map((initial, index) => (
                        <span key={initial} className={`-ml-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-white first:ml-0 ${index === 0 ? 'bg-[#8a6a56]' : index === 1 ? 'bg-[#617b6a]' : 'bg-[#a18259]'}`}>
                          {initial}
                        </span>
                      ))}
                      <span className="ml-2 text-[10px] text-[#706a63]">3 petugas</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e8e5df] bg-white p-3.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#89837b]">Handover terakhir</p>
                    <p className="mt-2 text-[11px] font-medium">Sudah dibaca <span className="ml-1 text-[#718b72]">✓</span></p>
                    <p className="mt-0.5 text-[9px] text-[#89837b]">oleh Rina · 07.03</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[#e8e5df] bg-white px-5 py-3.5">
                <span className="text-[10px] text-[#89837b]">Progress tersimpan otomatis</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#52705a]"><span className="h-1.5 w-1.5 rounded-full bg-[#718b72]" /> Semua tersinkron</span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -right-2 rounded-2xl border border-white bg-white px-4 py-3 shadow-[0_12px_36px_rgba(41,37,36,0.14)] sm:-right-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5efe4] text-[#866e4f]"><ShieldCheck className="h-5 w-5" /></span>
              <div>
                <p className="text-[11px] font-semibold">Setiap aksi tercatat</p>
                <p className="text-[10px] text-[#89837b]">Nama · waktu · status</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-[#e3e0d9] bg-white/50">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 text-center sm:grid-cols-3 sm:px-8 lg:px-12">
          {[
            ['Satu alur', 'dari buka hingga tutup shift'],
            ['Tercatat rapi', 'tanpa bergantung pada ingatan'],
            ['Terlihat bersama', 'untuk seluruh tim di shift'],
          ].map(([headline, supporting]) => (
            <p key={headline} className="text-sm text-[#77716b]">
              <span className="font-semibold text-[#292524]">{headline}</span>
              <span className="mx-2 hidden text-[#c3beb5] sm:inline">/</span>
              <span className="block text-xs sm:inline">{supporting}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-32 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#718b72]">Dibuat untuk ritme outlet</p>
            <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.055em] sm:text-5xl">
              Bukan sekadar daftar tugas.
              <span className="block font-normal text-[#837d75]">Alur kerja satu shift.</span>
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-[#706a63] lg:justify-self-end">
            Saat outlet sibuk, tim tidak perlu menebak apa yang sudah dikerjakan atau apa yang perlu diteruskan. Semua ada dalam alur yang sama dan mudah ditinjau.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.number} className="group rounded-[24px] border border-[#e3e0d9] bg-white/70 p-6 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_45px_rgba(41,37,36,0.08)] sm:p-7">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eeeee8] text-[#526952] transition group-hover:bg-[#e3ebe2]">
                  <feature.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="font-mono text-xs text-[#aaa49b]">{feature.number}</span>
              </div>
              <h3 className="mt-9 text-xl font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#77716b]">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="cara-kerja" className="relative z-10 bg-[#292524] text-[#f7f6f2]">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-28 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b8c7b6]">Alur yang sederhana</p>
              <h2 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-[-0.055em] sm:text-5xl">
                Satu shift.
                <span className="block font-normal text-[#b7b1aa]">Tiga langkah jelas.</span>
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-6 text-[#c5c0ba]">
                Tim fokus bekerja. Catatan operasional terbentuk sepanjang proses.
              </p>
              <Link href="/login" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f7f6f2] px-5 text-sm font-semibold text-[#292524] transition hover:bg-white">
                Masuk ke aplikasi <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-0">
              {STEPS.map((step, index) => (
                <div key={step.number} className={`grid grid-cols-[52px_1fr] gap-4 py-6 sm:grid-cols-[72px_1fr] sm:gap-6 ${index < STEPS.length - 1 ? 'border-b border-white/15' : ''}`}>
                  <span className="pt-1 font-mono text-sm text-[#b8c7b6]">{step.number}</span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#b7b1aa]">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-32 lg:px-12">
        <div className="relative overflow-hidden rounded-[30px] bg-[#e7ebe3] px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
          <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full border border-[#cbd4c8]" aria-hidden="true" />
          <div className="absolute -right-2 top-2 h-52 w-52 rounded-full border border-[#cbd4c8]" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-[#526952]"><Layers3 className="h-5 w-5" /></span>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-4xl">
              Mulai shift berikutnya dengan informasi yang lebih jelas.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#66645d]">
              Masuk ke checklist-shift untuk membuka dashboard cabang dan alur shift Anda.
            </p>
            <Link href="/login" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#292524] px-6 text-sm font-semibold text-white transition hover:bg-[#44403c]">
              Masuk ke aplikasi <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#e3e0d9]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-xs text-[#77716b] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <Link href="/" className="font-semibold tracking-tight text-[#292524]">checklist-shift</Link>
          <p>Operasional shift yang jelas, dari buka sampai tutup.</p>
          <Link href="/login" className="inline-flex min-h-10 items-center gap-1 font-semibold text-[#292524] hover:underline">
            Masuk <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </main>
  );
}
