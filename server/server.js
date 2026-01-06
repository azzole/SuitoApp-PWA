const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// CORS設定（LAN内からのアクセスを許可）
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// データベースファイル（JSON）
const dbPath = path.join(__dirname, 'suito-data.json');

// データ読み込み
function loadData() {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
    return { dailyRecords: [], transactions: [] };
}

// データ保存
function saveData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

// 管理画面
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ヘルスチェック（LAN検出用）
app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', server: 'suito-sync', timestamp: new Date().toISOString() });
});

// 管理用：データ直接保存
app.post('/api/admin/save', (req, res) => {
    try {
        const { dailyRecords, transactions } = req.body;

        // 日付でソート
        dailyRecords.sort((a, b) => b.date.localeCompare(a.date));
        transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        saveData({ dailyRecords, transactions });

        res.json({ success: true, message: 'データを保存しました' });
    } catch (error) {
        console.error('Admin save error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 全データ取得（同期用）
app.get('/api/sync', (req, res) => {
    try {
        const data = loadData();
        res.json({
            dailyRecords: data.dailyRecords,
            transactions: data.transactions,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Sync GET error:', error);
        res.status(500).json({ error: error.message });
    }
});

// データ同期（マージ）
app.post('/api/sync', (req, res) => {
    try {
        const { dailyRecords: clientRecords, transactions: clientTransactions } = req.body;
        const serverData = loadData();
        const now = new Date().toISOString();

        let recordsUpdated = 0;
        let transactionsUpdated = 0;

        // Daily Records のマージ
        if (clientRecords && clientRecords.length > 0) {
            for (const clientRecord of clientRecords) {
                const existingIndex = serverData.dailyRecords.findIndex(r => r.date === clientRecord.date);

                if (existingIndex === -1) {
                    // 新規追加
                    serverData.dailyRecords.push({
                        ...clientRecord,
                        updatedAt: now
                    });
                    recordsUpdated++;
                } else {
                    // 既存データと比較して新しい方を採用
                    const existing = serverData.dailyRecords[existingIndex];
                    if (new Date(clientRecord.createdAt) > new Date(existing.createdAt)) {
                        serverData.dailyRecords[existingIndex] = {
                            ...clientRecord,
                            updatedAt: now
                        };
                        recordsUpdated++;
                    }
                }
            }
        }

        // Transactions のマージ
        if (clientTransactions && clientTransactions.length > 0) {
            for (const clientTx of clientTransactions) {
                const existingIndex = serverData.transactions.findIndex(t => t.id === clientTx.id);

                if (existingIndex === -1) {
                    // 新規追加
                    serverData.transactions.push({
                        ...clientTx,
                        updatedAt: now
                    });
                    transactionsUpdated++;
                } else {
                    // 既存データと比較して新しい方を採用
                    const existing = serverData.transactions[existingIndex];
                    if (new Date(clientTx.createdAt) > new Date(existing.createdAt)) {
                        serverData.transactions[existingIndex] = {
                            ...clientTx,
                            updatedAt: now
                        };
                        transactionsUpdated++;
                    }
                }
            }
        }

        // 日付でソート
        serverData.dailyRecords.sort((a, b) => b.date.localeCompare(a.date));
        serverData.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // 保存
        saveData(serverData);

        res.json({
            success: true,
            recordsUpdated,
            transactionsUpdated,
            dailyRecords: serverData.dailyRecords,
            transactions: serverData.transactions,
            serverTime: now
        });

    } catch (error) {
        console.error('Sync POST error:', error);
        res.status(500).json({ error: error.message });
    }
});

// インポート（初回バックアップ取り込み用）
app.post('/api/import', (req, res) => {
    try {
        const { dailyRecords, transactions } = req.body;
        const now = new Date().toISOString();

        const data = {
            dailyRecords: (dailyRecords || []).map(r => ({ ...r, updatedAt: now })),
            transactions: (transactions || []).map(t => ({ ...t, updatedAt: now }))
        };

        // 日付でソート
        data.dailyRecords.sort((a, b) => b.date.localeCompare(a.date));
        data.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        saveData(data);

        res.json({
            success: true,
            recordsImported: data.dailyRecords.length,
            transactionsImported: data.transactions.length
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: error.message });
    }
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 出納帳 同期サーバー起動`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   LAN: http://<iMacのIP>:${PORT}`);
    console.log(`\n📁 データファイル: ${dbPath}`);
});
