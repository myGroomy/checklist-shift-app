/**
 * Seed script — jalankan dengan:
 * npx tsx drizzle/seed.ts
 *
 * Membuat data awal:
 * - Cabang contoh (BDG01)
 * - Admin user (username: admin, PIN: 123456)
 * - Shift definitions (Opening, Middle, Closing)
 * - SOP Categories + Checklist Points
 * - Handover Fields
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ulid } from 'ulid';
import * as argon2 from 'argon2';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak ada di .env');
}

const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('🌱 Mulai seed...');

  // Hash PIN (default: 123456)
  const pinHash = await argon2.hash('123456' + (process.env.PIN_PEPPER || ''));

  // 1. Cabang
  const branchId = ulid();
  await db.insert(schema.branches).values({
    id: branchId,
    name: 'Bandung Pusat',
    code: 'BDG01',
    address: 'Jl. Merdeka No. 1, Bandung',
    timezone: 'Asia/Jakarta',
  }).onConflictDoNothing();
  console.log(`✅ Cabang: BDG01 (${branchId})`);

  // 2. Admin user
  const adminId = ulid();
  await db.insert(schema.users).values({
    id: adminId,
    name: 'Admin',
    username: 'admin',
    pinHash,
    role: 'admin',
    mustChangePin: true,
  }).onConflictDoNothing();
  console.log(`✅ Admin: admin (${adminId})`);

  // 3. Shift Definitions
  const shiftOpeningId = ulid();
  const shiftMiddleId = ulid();
  const shiftClosingId = ulid();

  await db.insert(schema.shiftDefinitions).values([
    { id: shiftOpeningId, branchId, name: 'Opening', startTime: '07:00', endTime: '15:00', sortOrder: 1 },
    { id: shiftMiddleId, branchId, name: 'Middle', startTime: '11:00', endTime: '19:00', sortOrder: 2 },
    { id: shiftClosingId, branchId, name: 'Closing', startTime: '15:00', endTime: '22:00', sortOrder: 3 },
  ]).onConflictDoNothing();
  console.log('✅ Shift: Opening, Middle, Closing');

  // 4. SOP Categories + Checklist Points
  const catKebersihanId = ulid();
  const catFoodSafetyId = ulid();
  const catKasId = ulid();

  await db.insert(schema.sopCategories).values([
    { id: catKebersihanId, shiftDefinitionId: shiftOpeningId, name: 'Kebersihan', sortOrder: 1 },
    { id: catFoodSafetyId, shiftDefinitionId: shiftOpeningId, name: 'Food Safety', sortOrder: 2 },
    { id: catKasId, shiftDefinitionId: shiftOpeningId, name: 'Kas', sortOrder: 3 },
  ]).onConflictDoNothing();

  await db.insert(schema.checklistPoints).values([
    { id: ulid(), sopCategoryId: catKebersihanId, title: 'Sapu lantai area kasir', inputType: 'centang', isRequired: true, targetTime: '07:30', sortOrder: 1 },
    { id: ulid(), sopCategoryId: catKebersihanId, title: 'Pel meja makan', inputType: 'centang', isRequired: true, targetTime: '07:30', sortOrder: 2 },
    { id: ulid(), sopCategoryId: catKebersihanId, title: 'Cek suhu freezer', inputType: 'angka', isRequired: true, targetTime: '09:00', numberMin: -20, numberMax: -15, sortOrder: 3 },
    { id: ulid(), sopCategoryId: catKebersihanId, title: 'Bersihkan toilet', inputType: 'centang', isRequired: true, targetTime: '11:00', sortOrder: 4 },
    { id: ulid(), sopCategoryId: catFoodSafetyId, title: 'Cek suhu chiller', inputType: 'angka', isRequired: true, targetTime: '08:00', numberMin: 0, numberMax: 5, sortOrder: 1 },
    { id: ulid(), sopCategoryId: catFoodSafetyId, title: 'Cek tanggal expired bahan', inputType: 'centang', isRequired: true, targetTime: '09:30', sortOrder: 2 },
    { id: ulid(), sopCategoryId: catKasId, title: 'Hitung kas awal', inputType: 'angka', isRequired: true, targetTime: '07:15', numberMin: 0, numberMax: 10000000, sortOrder: 1 },
  ]).onConflictDoNothing();
  console.log('✅ SOP Categories + Checklist Points');

  // 5. Handover Fields
  await db.insert(schema.handoverFields).values([
    { id: ulid(), shiftDefinitionId: shiftOpeningId, label: 'Kas Awal', fieldType: 'angka', isRequired: true, sortOrder: 1 },
    { id: ulid(), shiftDefinitionId: shiftOpeningId, label: 'Total Transaksi', fieldType: 'angka', isRequired: true, sortOrder: 2 },
    { id: ulid(), shiftDefinitionId: shiftOpeningId, label: 'Menu Terlaris', fieldType: 'teks', isRequired: false, sortOrder: 3 },
    { id: ulid(), shiftDefinitionId: shiftOpeningId, label: 'Status Peralatan', fieldType: 'pilihan', isRequired: true, options: JSON.stringify(['Semua normal', 'Ada kerusakan']), sortOrder: 4 },
  ]).onConflictDoNothing();
  console.log('✅ Handover Fields');

  console.log('\n🎉 Seed selesai!');
  console.log('\nLogin default:');
  console.log('  Username: admin');
  console.log('  PIN: 123456');
  console.log('  (Ganti PIN setelah login pertama)');

  await sql.end();
}

seed().catch((err) => {
  console.error('❌ Seed gagal:', err);
  process.exit(1);
});
