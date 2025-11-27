// UI Helper Functions

const UI = {
    // Format date as Japanese string
    formatDate(date) {
        const d = new Date(date);
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const dayOfWeek = days[d.getDay()];
        return `${year}年${month}月${day}日(${dayOfWeek})`;
    },

    // Format time as HH:MM
    formatTime(date) {
        const d = new Date(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    },

    // Format datetime
    formatDateTime(date) {
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    // Get today's date key (YYYY-MM-DD)
    getTodayKey() {
        const now = new Date();
        return this.getDateKey(now);
    },

    // Get date key from Date object
    getDateKey(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Show screen
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    },

    // Show/hide modal
    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    },

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    },

    // Compress image
    async compressImage(file, maxWidth = 1024, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    // Render transaction item
    renderTransactionItem(tx) {
        const isIncome = tx.type === 'income';
        const icon = isIncome ? '＋' : '－';
        const typeClass = isIncome ? 'income' : 'expense';
        const sign = isIncome ? '+' : '-';
        const comment = tx.comment || (isIncome ? '入金' : '出金');
        const hasImage = tx.imageData ? '<span class="has-image">📷</span>' : '';

        return `
            <div class="transaction-item" data-id="${tx.id}">
                <div class="icon ${typeClass}">${icon}</div>
                <div class="info">
                    <div class="comment">${this.escapeHtml(comment)}</div>
                    <div class="time">${this.formatTime(tx.createdAt)}</div>
                </div>
                <div class="amount ${typeClass}">${sign}¥${tx.amount.toLocaleString()}</div>
                ${hasImage}
            </div>
        `;
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Calculate daily summary
    calculateSummary(transactions) {
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(tx => {
            if (tx.type === 'income') {
                totalIncome += tx.amount;
            } else {
                totalExpense += tx.amount;
            }
        });

        return { totalIncome, totalExpense };
    }
};
