// IndexedDB schema untuk offline sync
const DB_NAME = 'kandangku-offline';
const DB_VERSION = 1;
const STORE_TRANSAKSI = 'pending_transaksi';
const STORE_PENGELUARAN = 'pending_pengeluaran';

export type PendingTransaksi = {
  id?: number;
  uuid: string;
  nama_pelanggan: string;
  nomor_wa?: string;
  tipe_transaksi: string;
  status_bayar: string;
  total_bayar: number;
  diskon: number;
  items: Array<{
    id_kategori: number;
    jumlah_ekor: number;
    harga_satuan: number;
  }>;
  created_at: number;
  synced: boolean;
};

export type PendingPengeluaran = {
  id?: number;
  uuid: string;
  jumlah: number;
  id_kategori?: number;
  keterangan?: string;
  created_at: number;
  synced: boolean;
};

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE_TRANSAKSI)) {
        database.createObjectStore(STORE_TRANSAKSI, { keyPath: 'uuid' });
      }

      if (!database.objectStoreNames.contains(STORE_PENGELUARAN)) {
        database.createObjectStore(STORE_PENGELUARAN, { keyPath: 'uuid' });
      }
    };
  });
}

export async function savePendingTransaksi(transaksi: PendingTransaksi): Promise<void> {
  const database = db || (await initDB());
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_TRANSAKSI], 'readwrite');
    const store = tx.objectStore(STORE_TRANSAKSI);
    const request = store.add(transaksi);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPendingTransaksi(): Promise<PendingTransaksi[]> {
  const database = db || (await initDB());
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_TRANSAKSI], 'readonly');
    const store = tx.objectStore(STORE_TRANSAKSI);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deletePendingTransaksi(uuid: string): Promise<void> {
  const database = db || (await initDB());
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_TRANSAKSI], 'readwrite');
    const store = tx.objectStore(STORE_TRANSAKSI);
    const request = store.delete(uuid);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function savePendingPengeluaran(pengeluaran: PendingPengeluaran): Promise<void> {
  const database = db || (await initDB());
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_PENGELUARAN], 'readwrite');
    const store = tx.objectStore(STORE_PENGELUARAN);
    const request = store.add(pengeluaran);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPendingPengeluaran(): Promise<PendingPengeluaran[]> {
  const database = db || (await initDB());
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_PENGELUARAN], 'readonly');
    const store = tx.objectStore(STORE_PENGELUARAN);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deletePendingPengeluaran(uuid: string): Promise<void> {
  const database = db || (await initDB());
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_PENGELUARAN], 'readwrite');
    const store = tx.objectStore(STORE_PENGELUARAN);
    const request = store.delete(uuid);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Check online status
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// Listen to online/offline events
export function onOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}
