# UI/UX.md — checklist‑shift PWA

## 1. Design Direction
- **Mobile‑first, editorial‑inspired** UI.  Off‑white canvas (`#f5f5f5`) with warm near‑black ink (`#292524`).
- **Typography** from the shared design system: Waldenburg Light for display, Inter for body, button, navigation.  See the full token list in **@[elevenlabs-DESIGN.md]**.
- **Primary action colour** – the black‑ink “pill” button (`component.button-primary`).  All CTAs use the pill geometry (`rounded.pill`).
- **Atmospheric gradient orbs** (`component.gradient-orb‑card`) are decorative only – never used for actionable UI.
- **Spacing rhythm** – 96 px vertical sections, 4 px base unit.  Consistent with the design system.

## 2. Design System
> The complete token, component, colour, and typography definitions live in **@[elevenlabs-DESIGN.md]**.  All UI elements in this doc should use those tokens rather than hard‑coded values.

## 3. Global Layout
- **App Shell** (Serwist service worker) caches the HTML head, base CSS, navigation and footer.
- **Top Navigation** (`component.top‑nav`): fixed 64 px height, ink text on canvas background, hamburger menu below 768 px.
- **Footer** (`component.footer`): 5‑column link list, canvas background, body‑sm typography.
- **Main container**: max‑width ≈ 1200 px, centred, horizontal padding 16 px on mobile, 32 px on tablet+, vertical padding 96 px between sections.

## 4. Pages
| Page | Route | Purpose | Key UI Elements |
|------|-------|---------|-----------------|
| **Login** | `/login` | Authenticate petugas/admin. | `text-input` (username), `pin` keypad component (6‑digit), `button-primary` (Sign In) |
| **Change PIN** | `/ganti‑pin` | Force‑change PIN on first login or reset. | `text-input` (old PIN), `text-input` (new PIN), `button-primary` (Simpan) |
| **Home / Dashboard** | `/` | List active shift cards, quick actions. | Shift‑card (status badge, progress bar), `button-primary` (Buka Shift), `button-outline` (Bergabung) |
| **Shift Builder (Admin)** | `/admin/shift‑builder` | Create / edit shift definitions, SOP categories, checklist points, handover fields. | Tree view of categories, drag‑&‑drop `card` reordering, modal dialogs for point edit. |
| **Shift Detail** | `/shifts/[id]` | Petugas view of an opened shift – checklist, incident, handover. | Accordion per SOP category, checklist item row (`checkbox`, `text‑input`, `number‑input`, `photo‑upload`), incident chip, handover form, `button-primary` (Tutup Shift) |
| **Incident List** | `/incidents` | List of open incidents for the branch. | Table with status chips, `button-outline` (Lihat Detail) |
| **Report / Laporan** | `/reports/[id]` | Read‑only view of locked report, share token link. | PDF‑preview embed, `button-outline` (Bagikan WhatsApp), `button-primary` (Addendum) |
| **Admin Console** | `/admin/*` | Admin utilities – users, branches, settings, audit log. | Data tables, `button-primary` (Reset PIN), `button-outline` (Non‑aktifkan) |
| **Not‑Found / 404** | `*` | Graceful fallback. | Large illustration, `button-primary` (Kembali ke Home) |

## 5. Components
- **Shift‑card** – shows branch name, shift name, PJ avatar, progress bar, status badge (`badge‑pill`).
- **Checklist‑item** – row with label, optional required icon, input type component, skip button, conflict toast.
- **Photo‑upload** – thumbnail preview, compress to WebP (client), `button-primary` (Upload), `badge-pill` (Pending / Uploaded / Purged).
- **Incident‑chip** – colour‑coded by category, clickable to open incident modal.
- **Handover‑field** – read‑only display after shift close, editable in modal before close.
- **Modal / Dialog** – Desktop: `Dialog` from shadcn/ui; Mobile: `Drawer` from shadcn/ui. All modals have a required **Alasan** textarea for sensitive actions.
- **Pagination / Infinite scroll** – used on admin tables, 20 rows per page.
- **Toast notifications** – auto‑dismiss after 5 s, colour based on `semantic-success` / `semantic-error`.

## 6. Modals
| Modal | Trigger | Content |
|-------|---------|---------|
| **Open Shift Confirmation** | `Buka Shift` button (admin) | Summary of shift definition, date picker, `button-primary` (Konfirmasi) |
| **Join Shift** | `Bergabung` button (petugas) | Confirmation of branch access, `button-primary` (Ikuti) |
| **Edit Checklist Item** | Edit icon on item (admin) | Form with fields: title, input‑type selector, required toggle, tolerance, active‑days, number‑range. `button-primary` (Simpan) |
| **Add Incident** | `+ Incident` button (petugas) | Category selector, description textarea, optional **Photo‑upload** (max 5), `button-primary` (Laporkan) |
| **Close Shift Stepper** | `Tutup Shift` (PJ) | 3‑step wizard:
1️⃣ Validasi item wajib / skip reason
2️⃣ Handover form (fields + optional notes)
3️⃣ PIN confirmation (sensitive) |
| **Sensitive Action Confirmation** | Any admin action (reset PIN, non‑aktifkan user, force‑close shift) | Reason textarea (required), PIN input, `button-primary` (Eksekusi) |
| **Share Report Token** | `Bagikan` on report page | Token preview, copy button, `button-outline` (Salin) |
| **Audit Log Viewer** | Admin console → Audit Log | Table with filters, expandable row showing before/after JSON, `button-outline` (Unduh) |

## 7. User Flow & Interactions
1. **First login** → `/login` → successful → **forced redirect** to `/ganti‑pin` (must change PIN).
2. After PIN change → redirected to **Home** (`/`).
3. Admin creates a **Shift Definition** via `/admin/shift‑builder` → saved → appears as a card on Home.
4. PJ **opens** a shift → advisory lock taken, shift instance created, participants list updated.
5. Petugas **joins** shift → added to participants, sees checklist accordion.
6. For each checklist item:
   - Petugas taps to interact → optimistic UI update (show completed instantly).
   - Backend validates via `SELECT FOR UPDATE`; loser receives toast “Sudah diselesaikan oleh X”.
   - If offline, UI shows disabled state with tooltip “Perlu koneksi internet”.
7. **Photo upload** → client compresses to WebP, shows preview thumbnail, uploads via `/api/photos/upload` → progress bar → status badge changes to *Uploaded*.
8. **Incident** → open modal, fill, submit → entry created, toast success.
9. **Close shift** → stepper wizard validates all required items, handover filled, PIN confirmed → shift status → report generated, PDF archived via cron.
10. **Report view** → read‑only page, share token generated → copy to clipboard.
11. **Admin actions** (reset PIN, revoke sessions) → open sensitive‑action modal → reason + PIN required → audit log entry.

## 8. Responsive Behavior
| Breakpoint | Layout Adjustments |
|------------|-------------------|
| **Mobile (<640 px)** | - Top‑nav collapses to hamburger. <br> - Shift‑cards stack single column. <br> - Accordion expands full width; each item height ≥48 px tap target. <br> - Gradient orbs shrink to 40 % size. |
| **Tablet (640‑1024 px)** | - Shift‑cards 2‑up grid. <br> - Feature‑cards 2‑up. <br> - Photo‑upload thumbnail grid 2‑col. |
| **Desktop (≥1024 px)** | - Shift‑cards 3‑up. <br> - Feature‑cards 3‑up. <br> - Modal dialogs use `Dialog` component, larger width (600 px). |
| **Wide (>1280 px)** | - Content max‑width 1200 px, side margins increase. |

All interactive elements respect the **48 px minimum touch target** rule.  Typography scales per design system (display sizes shrink on smaller breakpoints).

## 9. UI States
- **Default** – component colours from design system.
- **Hover / Focus** – subtle elevation (box‑shadow `0 2px 8px rgba(0,0,0,0.06)`) and ink colour darkening for buttons.
- **Active / Pressed** – `component.button-primary-active` background.
- **Disabled** – opacity 0.4, cursor `not-allowed`, tooltip explaining required online connection.
- **Error** – border `semantic-error` (`#dc2626`), inline error message (typography `caption-uppercase`).
- **Success** – border `semantic-success` (`#16a34a`), toast with green background.
- **Loading** – spinner inside button (`button-primary` shows spinner replacing label), skeleton rows for list loading.
- **Conflict (BR‑12)** – toast “Sudah diselesaikan oleh X” with icon, item reverts to read‑only state.
- **Read‑only (after shift closed)** – inputs become plain text, copy‑icon appears for values, edit icons hidden.

---

*This UI/UX specification is aligned with the PRD, TRD, and the shared design system in **@[elevenlabs-DESIGN.md]**.  All page routes, component names, and interaction patterns use the existing shadcn/ui primitives to keep the codebase consistent.*
