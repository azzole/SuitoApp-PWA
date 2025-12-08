// Main Application

class App {
    constructor() {
        this.currentType = 'expense';
        this.currentImageData = null;
        this.todayRecord = null;
        this.todayTransactions = [];
        this.syncCheckInterval = null;
    }

    async init() {
        // Initialize database
        await db.init();

        // Setup event listeners
        this.setupEventListeners();
        this.setupSyncEventListeners();

        // Check and prepare daily record
        await this.checkDaily();

        // Register service worker
        this.registerServiceWorker();

        // Start sync check
        this.startSyncCheck();
    }

    setupEventListeners() {
        // Main screen buttons
        document.getElementById('btn-expense').addEventListener('click', () => {
            this.openInputScreen('expense');
        });

        document.getElementById('btn-income').addEventListener('click', () => {
            this.openInputScreen('income');
        });

        document.getElementById('btn-history').addEventListener('click', () => {
            this.openHistoryScreen();
        });

        // Input screen buttons
        document.getElementById('btn-cancel').addEventListener('click', () => {
            this.closeInputScreen();
        });

        document.getElementById('btn-save').addEventListener('click', () => {
            this.saveTransaction();
        });

        // Image inputs
        document.getElementById('input-camera').addEventListener('change', (e) => {
            this.handleImageSelect(e);
        });

        document.getElementById('input-gallery').addEventListener('change', (e) => {
            this.handleImageSelect(e);
        });

        document.getElementById('btn-remove-image').addEventListener('click', () => {
            this.removeImage();
        });

        // History screen buttons
        document.getElementById('btn-back').addEventListener('click', () => {
            UI.showScreen('main-screen');
        });

        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportData();
        });

        // Balance modal buttons
        document.getElementById('btn-set-balance').addEventListener('click', () => {
            document.getElementById('btn-set-balance').classList.add('active');
            document.getElementById('btn-zero-start').classList.remove('active');
            document.getElementById('balance-input-section').classList.remove('hidden');
        });

        document.getElementById('btn-zero-start').addEventListener('click', () => {
            document.getElementById('btn-zero-start').classList.add('active');
            document.getElementById('btn-set-balance').classList.remove('active');
            document.getElementById('balance-input-section').classList.add('hidden');
        });

        document.getElementById('btn-start-day').addEventListener('click', () => {
            this.startNewDay();
        });

        // Detail modal close
        document.getElementById('btn-close-detail').addEventListener('click', () => {
            UI.hideModal('detail-modal');
        });

        // Transaction item click (event delegation)
        document.getElementById('transactions-list').addEventListener('click', (e) => {
            const item = e.target.closest('.transaction-item');
            if (item) {
                this.showTransactionDetail(item.dataset.id);
            }
        });

        // Amount input validation
        document.getElementById('input-amount').addEventListener('input', (e) => {
            const saveBtn = document.getElementById('btn-save');
            saveBtn.disabled = !e.target.value || parseInt(e.target.value) <= 0;
        });
    }

    async checkDaily() {
        const todayKey = UI.getTodayKey();
        this.todayRecord = await db.getDailyRecord(todayKey);

        if (!this.todayRecord) {
            // Show balance setup modal
            document.getElementById('modal-date').textContent = UI.formatDate(new Date());
            UI.showModal('balance-modal');
        } else {
            await this.loadTodayData();
        }
    }

    async startNewDay() {
        const todayKey = UI.getTodayKey();
        const setBalance = document.getElementById('btn-set-balance').classList.contains('active');
        const initialBalance = setBalance
            ? parseInt(document.getElementById('initial-balance').value) || 0
            : 0;

        this.todayRecord = {
            date: todayKey,
            startingBalance: initialBalance,
            didSetStartingBalance: setBalance,
            createdAt: new Date().toISOString()
        };

        await db.saveDailyRecord(this.todayRecord);
        UI.hideModal('balance-modal');
        await this.loadTodayData();
    }

    async loadTodayData() {
        const todayKey = UI.getTodayKey();

        // Load transactions
        this.todayTransactions = await db.getTransactionsByDate(todayKey);

        // Update UI
        this.updateMainScreen();
    }

    updateMainScreen() {
        // Update date
        document.getElementById('current-date').textContent = UI.formatDate(new Date());

        // Calculate summary
        const { totalIncome, totalExpense } = UI.calculateSummary(this.todayTransactions);
        const startingBalance = this.todayRecord ? this.todayRecord.startingBalance : 0;
        const currentBalance = startingBalance + totalIncome - totalExpense;

        // Update balance display
        document.getElementById('current-balance').textContent = `¥${currentBalance.toLocaleString()}`;
        document.getElementById('total-income').textContent = `+¥${totalIncome.toLocaleString()}`;
        document.getElementById('total-expense').textContent = `-¥${totalExpense.toLocaleString()}`;

        // Update transactions list
        const listEl = document.getElementById('transactions-list');
        if (this.todayTransactions.length === 0) {
            listEl.innerHTML = '<div class="empty-state">取引がありません</div>';
        } else {
            listEl.innerHTML = this.todayTransactions
                .map(tx => UI.renderTransactionItem(tx))
                .join('');
        }
    }

    openInputScreen(type) {
        this.currentType = type;
        this.currentImageData = null;

        // Update UI for type
        const indicator = document.getElementById('type-indicator');
        indicator.className = `type-indicator ${type}`;
        indicator.innerHTML = `<span class="icon">${type === 'income' ? '＋' : '－'}</span>`;

        document.getElementById('input-title').textContent = type === 'income' ? '入金' : '出金';

        // Reset form
        document.getElementById('input-amount').value = '';
        document.getElementById('input-comment').value = '';
        document.getElementById('image-preview').classList.add('hidden');
        document.getElementById('image-buttons').classList.remove('hidden');
        document.getElementById('btn-save').disabled = true;

        UI.showScreen('input-screen');

        // Focus amount input
        setTimeout(() => {
            document.getElementById('input-amount').focus();
        }, 100);
    }

    closeInputScreen() {
        UI.showScreen('main-screen');
    }

    async handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Compress image
        this.currentImageData = await UI.compressImage(file);

        // Show preview
        document.getElementById('preview-img').src = this.currentImageData;
        document.getElementById('image-preview').classList.remove('hidden');
        document.getElementById('image-buttons').classList.add('hidden');

        // Reset input
        e.target.value = '';
    }

    removeImage() {
        this.currentImageData = null;
        document.getElementById('image-preview').classList.add('hidden');
        document.getElementById('image-buttons').classList.remove('hidden');
    }

    async saveTransaction() {
        const amount = parseInt(document.getElementById('input-amount').value);
        if (!amount || amount <= 0) return;

        const comment = document.getElementById('input-comment').value.trim();
        const todayKey = UI.getTodayKey();

        const transaction = {
            id: UI.generateId(),
            type: this.currentType,
            amount: amount,
            comment: comment,
            imageData: this.currentImageData,
            date: todayKey,
            createdAt: new Date().toISOString()
        };

        await db.addTransaction(transaction);
        await this.loadTodayData();
        this.closeInputScreen();
    }

    async showTransactionDetail(id) {
        const tx = await db.getTransaction(id);
        if (!tx) return;

        const isIncome = tx.type === 'income';
        const typeClass = isIncome ? 'income' : 'expense';
        const icon = isIncome ? '＋' : '－';
        const sign = isIncome ? '+' : '-';

        let imageHtml = '';
        if (tx.imageData) {
            imageHtml = `
                <div class="detail-image">
                    <img src="${tx.imageData}" alt="画像">
                </div>
            `;
        }

        const content = `
            <div class="type-icon ${typeClass}" style="background-color: ${isIncome ? 'rgba(0, 210, 106, 0.15)' : 'rgba(255, 107, 107, 0.15)'}; color: ${isIncome ? 'var(--accent-green)' : 'var(--accent-red)'};">
                ${icon}
            </div>
            <div class="amount" style="color: ${isIncome ? 'var(--accent-green)' : 'var(--accent-red)'};">
                ${sign}¥${tx.amount.toLocaleString()}
            </div>
            ${tx.comment ? `<div class="detail-row"><span class="detail-label">コメント</span><span>${UI.escapeHtml(tx.comment)}</span></div>` : ''}
            <div class="detail-row">
                <span class="detail-label">日時</span>
                <span>${UI.formatDateTime(tx.createdAt)}</span>
            </div>
            ${imageHtml}
        `;

        document.getElementById('detail-content').innerHTML = content;
        UI.showModal('detail-modal');
    }

    async openHistoryScreen() {
        const records = await db.getAllDailyRecords();
        const allTransactions = await db.getAllTransactions();

        // Group transactions by date
        const txByDate = {};
        allTransactions.forEach(tx => {
            if (!txByDate[tx.date]) {
                txByDate[tx.date] = [];
            }
            txByDate[tx.date].push(tx);
        });

        const listEl = document.getElementById('history-list');

        if (records.length === 0) {
            listEl.innerHTML = '<div class="empty-state">履歴がありません</div>';
        } else {
            listEl.innerHTML = records.map(record => {
                const transactions = txByDate[record.date] || [];
                const { totalIncome, totalExpense } = UI.calculateSummary(transactions);
                const endBalance = record.startingBalance + totalIncome - totalExpense;

                const txHtml = transactions
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map(tx => UI.renderTransactionItem(tx))
                    .join('');

                return `
                    <div class="history-day">
                        <div class="history-day-header">
                            <span class="date">${UI.formatDate(record.date)}</span>
                            <span class="balance">残高 ¥${endBalance.toLocaleString()}</span>
                        </div>
                        <div class="history-summary">
                            <span style="color: var(--accent-green);">+¥${totalIncome.toLocaleString()}</span>
                            <span style="color: var(--accent-red);">-¥${totalExpense.toLocaleString()}</span>
                            <span>${transactions.length}件</span>
                        </div>
                        <div class="transactions-list">
                            ${txHtml || '<div class="empty-state">取引なし</div>'}
                        </div>
                    </div>
                `;
            }).join('');
        }

        UI.showScreen('history-screen');
    }

    async exportData() {
        try {
            const data = await db.exportData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `suito-export-${UI.getTodayKey()}.json`;
            a.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('エクスポートに失敗しました');
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    // ========== 同期機能 ==========

    setupSyncEventListeners() {
        // 設定ボタン
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.openSettingsModal();
        });

        // 設定モーダルを閉じる
        document.getElementById('btn-close-settings').addEventListener('click', () => {
            UI.hideModal('settings-modal');
        });

        // 自動検出ボタン
        document.getElementById('btn-auto-detect').addEventListener('click', () => {
            this.autoDetectServer();
        });

        // 接続テストボタン
        document.getElementById('btn-test-connection').addEventListener('click', () => {
            this.testConnection();
        });

        // 設定保存ボタン
        document.getElementById('btn-save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        // 同期バナー - 同期ボタン
        document.getElementById('btn-sync-now').addEventListener('click', () => {
            this.performSync();
        });

        // 同期バナー - 閉じるボタン
        document.getElementById('btn-sync-dismiss').addEventListener('click', () => {
            document.getElementById('sync-banner').classList.add('hidden');
        });
    }

    openSettingsModal() {
        // 現在のサーバーURLを表示
        document.getElementById('server-url').value = syncManager.getServerUrl();

        // 最終同期時刻を表示
        const lastSync = syncManager.getLastSyncTime();
        document.getElementById('last-sync-time').textContent = lastSync || '未同期';

        // 接続状態をクリア
        document.getElementById('connection-status').textContent = '';
        document.getElementById('connection-status').className = 'connection-status';

        UI.showModal('settings-modal');
    }

    async autoDetectServer() {
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = 'サーバーを検索中...';
        statusEl.className = 'connection-status loading';

        const url = await syncManager.autoDetectServer();

        if (url) {
            document.getElementById('server-url').value = url;
            statusEl.textContent = `✓ サーバーを検出: ${url}`;
            statusEl.className = 'connection-status success';
        } else {
            statusEl.textContent = '✕ サーバーが見つかりません';
            statusEl.className = 'connection-status error';
        }
    }

    async testConnection() {
        const url = document.getElementById('server-url').value.trim();
        const statusEl = document.getElementById('connection-status');

        if (!url) {
            statusEl.textContent = 'URLを入力してください';
            statusEl.className = 'connection-status error';
            return;
        }

        statusEl.textContent = '接続テスト中...';
        statusEl.className = 'connection-status loading';

        const success = await syncManager.checkServer(url);

        if (success) {
            statusEl.textContent = '✓ 接続成功';
            statusEl.className = 'connection-status success';
        } else {
            statusEl.textContent = '✕ 接続失敗';
            statusEl.className = 'connection-status error';
        }
    }

    saveSettings() {
        const url = document.getElementById('server-url').value.trim();
        syncManager.setServerUrl(url);
        UI.hideModal('settings-modal');

        // 設定保存後にサーバーチェック
        if (url) {
            this.checkSyncServer();
        }
    }

    async performSync() {
        // 同期バナーを隠す
        document.getElementById('sync-banner').classList.add('hidden');

        // 同期中モーダルを表示
        UI.showModal('syncing-modal');

        try {
            await syncManager.sync();

            // データをリロード
            await this.loadTodayData();

            UI.hideModal('syncing-modal');
            alert('同期が完了しました');
        } catch (error) {
            console.error('Sync failed:', error);
            UI.hideModal('syncing-modal');
            alert('同期に失敗しました: ' + error.message);
        }
    }

    startSyncCheck() {
        // 起動時にチェック
        setTimeout(() => this.checkSyncServer(), 3000);

        // 5分ごとにチェック
        this.syncCheckInterval = setInterval(() => {
            this.checkSyncServer();
        }, 5 * 60 * 1000);
    }

    async checkSyncServer() {
        const serverUrl = syncManager.getServerUrl();
        if (!serverUrl) return;

        const available = await syncManager.checkServer();

        if (available) {
            // 同期バナーを表示
            document.getElementById('sync-banner').classList.remove('hidden');
        }
    }
}

// Initialize app
const app = new App();
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
