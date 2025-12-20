// IndexedDB Database Manager
const DB_NAME = 'SuitoAppDB';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // DailyRecords store
                if (!db.objectStoreNames.contains('dailyRecords')) {
                    const dailyStore = db.createObjectStore('dailyRecords', { keyPath: 'date' });
                    dailyStore.createIndex('date', 'date', { unique: true });
                }

                // Transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    txStore.createIndex('date', 'date', { unique: false });
                    txStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    // Daily Record methods
    async getDailyRecord(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dailyRecords'], 'readonly');
            const store = transaction.objectStore('dailyRecords');
            const request = store.get(date);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveDailyRecord(record) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dailyRecords'], 'readwrite');
            const store = transaction.objectStore('dailyRecords');
            const request = store.put(record);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllDailyRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dailyRecords'], 'readonly');
            const store = transaction.objectStore('dailyRecords');
            const request = store.getAll();

            request.onsuccess = () => {
                const records = request.result.sort((a, b) =>
                    new Date(b.date) - new Date(a.date)
                );
                resolve(records);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Transaction methods
    async addTransaction(tx) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const request = store.add(tx);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTransactionsByDate(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => {
                const txs = request.result.sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                resolve(txs);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getTransaction(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllTransactions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Export all data as JSON
    async exportData() {
        const dailyRecords = await this.getAllDailyRecords();
        const transactions = await this.getAllTransactions();

        return {
            exportDate: new Date().toISOString(),
            dailyRecords,
            transactions
        };
    }

    // Clear all data (for sync replacement)
    async clearAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dailyRecords', 'transactions'], 'readwrite');

            const dailyStore = transaction.objectStore('dailyRecords');
            const txStore = transaction.objectStore('transactions');

            dailyStore.clear();
            txStore.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Save transaction (put = add or update)
    async saveTransaction(tx) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const request = store.put(tx);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

const db = new Database();
