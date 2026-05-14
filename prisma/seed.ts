import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import bcrypt from 'bcryptjs';

async function main() {
  await prisma.pengeluaran.deleteMany();
  await prisma.kategoriPengeluaran.deleteMany();
  await prisma.mutasiStok.deleteMany();
  await prisma.detailTransaksi.deleteMany();
  await prisma.transaksi.deleteMany();
  await prisma.pelanggan.deleteMany();
  await prisma.kategoriAyam.deleteMany();
  await prisma.user.deleteMany();

  await Promise.all([
    prisma.user.create({ data: { nama: 'Test Admin', username: 'testadmin', password: await bcrypt.hash('testadmin', 10), role: 'ADMIN' } }),
    prisma.user.create({ data: { nama: 'Test Kasir', username: 'testkasir', password: await bcrypt.hash('testkasir', 10), role: 'KASIR' } }),
  ]);

  await Promise.all([
    prisma.kategoriAyam.create({ data: { nama_kategori: 'Kecil', harga_hari_ini: 50000, stok_bebas: 20, stok_booking: 0 } }),
    prisma.kategoriAyam.create({ data: { nama_kategori: 'Sedang', harga_hari_ini: 75000, stok_bebas: 15, stok_booking: 0 } }),
    prisma.kategoriAyam.create({ data: { nama_kategori: 'Besar', harga_hari_ini: 100000, stok_bebas: 10, stok_booking: 0 } }),
  ]);

  // Kategori pengeluaran default — admin bisa tambah/nonaktifkan via panel admin
  await Promise.all([
    prisma.kategoriPengeluaran.create({ data: { nama: 'Pakan' } }),
    prisma.kategoriPengeluaran.create({ data: { nama: 'Operasional' } }),
    prisma.kategoriPengeluaran.create({ data: { nama: 'Sopir' } }),
    prisma.kategoriPengeluaran.create({ data: { nama: 'Listrik' } }),
    prisma.kategoriPengeluaran.create({ data: { nama: 'Lain-lain' } }),
  ]);

  console.log('✅ Seed selesai!');
  console.log('Login: testadmin / testadmin (ADMIN)');
  console.log('Login: testkasir / testkasir (KASIR)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
