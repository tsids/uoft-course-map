const DB_NAME = "uoft-course-map";
const STORE_NAME = "layout-cache";
const CACHE_VERSION = 1;
const MAX_ENTRIES = 50;

type StoredLayout = {
  key: string;
  savedAt: number;
  result: unknown;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("savedAt", "savedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function cacheKey(signature: string) {
  return `v${CACHE_VERSION}:${signature}`;
}

export async function loadLayout<T>(signature: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, "readwrite");
    } catch {
      resolve(null);
      return;
    }
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(cacheKey(signature));
    request.onsuccess = () => {
      const entry = request.result as StoredLayout | undefined;
      if (!entry) {
        resolve(null);
        return;
      }
      try {
        store.put({ ...entry, savedAt: Date.now() });
      } catch {
        void 0;
      }
      resolve(entry.result as T);
    };
    request.onerror = () => resolve(null);
    tx.onabort = () => resolve(null);
  });
}

export async function saveLayout(signature: string, result: unknown): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, "readwrite");
    } catch {
      resolve();
      return;
    }
    const store = tx.objectStore(STORE_NAME);
    try {
      store.put({ key: cacheKey(signature), savedAt: Date.now(), result } satisfies StoredLayout);
    } catch {
      resolve();
      return;
    }
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      let excess = countRequest.result - MAX_ENTRIES;
      if (excess <= 0) {
        resolve();
        return;
      }
      const cursorRequest = store.index("savedAt").openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || excess <= 0) {
          resolve();
          return;
        }
        cursor.delete();
        excess -= 1;
        cursor.continue();
      };
      cursorRequest.onerror = () => resolve();
    };
    countRequest.onerror = () => resolve();
    tx.onabort = () => resolve();
    tx.onerror = () => resolve();
  });
}
