// 同期機能

class SyncManager {
    constructor() {
        // iMacサーバーのアドレス（ユーザーが設定可能）
        this.serverUrl = localStorage.getItem('syncServerUrl') || '';
        this.isChecking = false;
        this.lastSyncTime = localStorage.getItem('lastSyncTime') || null;
    }

    // サーバーURLを設定
    setServerUrl(url) {
        this.serverUrl = url;
        localStorage.setItem('syncServerUrl', url);
    }

    // サーバーURLを取得
    getServerUrl() {
        return this.serverUrl;
    }

    // LAN内のサーバーを検出（ping）
    async checkServer(url = this.serverUrl) {
        if (!url) return false;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${url}/api/ping`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.ok) {
                const data = await response.json();
                return data.status === 'ok';
            }
            return false;
        } catch (error) {
            console.log('Server not reachable:', error.message);
            return false;
        }
    }

    // 自動検出（よくあるローカルIPを試す）
    async autoDetectServer() {
        const port = 3001;
        const baseIPs = ['192.168.1', '192.168.0', '192.168.10', '192.168.11'];

        for (const base of baseIPs) {
            // よくあるIP範囲を試す
            for (let i = 1; i <= 20; i++) {
                const url = `http://${base}.${i}:${port}`;
                const found = await this.checkServer(url);
                if (found) {
                    return url;
                }
            }
        }
        return null;
    }

    // 同期実行
    async sync() {
        if (!this.serverUrl) {
            throw new Error('サーバーURLが設定されていません');
        }

        // ローカルデータを取得
        const localData = await db.exportData();

        // サーバーに送信してマージ
        const response = await fetch(`${this.serverUrl}/api/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dailyRecords: localData.dailyRecords,
                transactions: localData.transactions
            })
        });

        if (!response.ok) {
            throw new Error('同期に失敗しました');
        }

        const serverData = await response.json();

        // サーバーからのデータでローカルを更新
        await this.updateLocalData(serverData);

        // 同期時刻を保存
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem('lastSyncTime', this.lastSyncTime);

        return serverData;
    }

    // ローカルデータを更新
    async updateLocalData(serverData) {
        const { dailyRecords, transactions } = serverData;

        // Daily Records を更新
        for (const record of dailyRecords) {
            const existing = await db.getDailyRecord(record.date);
            if (!existing || new Date(record.createdAt) > new Date(existing.createdAt)) {
                await db.saveDailyRecord({
                    date: record.date,
                    startingBalance: record.startingBalance,
                    didSetStartingBalance: record.didSetStartingBalance,
                    createdAt: record.createdAt
                });
            }
        }

        // Transactions を更新
        for (const tx of transactions) {
            const existing = await db.getTransaction(tx.id);
            if (!existing) {
                // 新規追加
                await db.addTransaction({
                    id: tx.id,
                    type: tx.type,
                    amount: tx.amount,
                    comment: tx.comment,
                    imageData: tx.imageData,
                    date: tx.date,
                    createdAt: tx.createdAt
                });
            }
        }
    }

    // 最後の同期時刻を取得
    getLastSyncTime() {
        if (!this.lastSyncTime) return null;
        const date = new Date(this.lastSyncTime);
        return date.toLocaleString('ja-JP');
    }
}

const syncManager = new SyncManager();
