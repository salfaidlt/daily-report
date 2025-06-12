class FormManagementSystem {
    constructor() {
        this.currentMonth = new Date();
        this.forms = this.loadFromStorage();
        this.init();
    }

    init() {
        this.updateCurrentDate();
        this.updateCurrentMonth();
        this.renderForms();
        this.updateStats();
        this.setupEventListeners();

        // Update date every minute
        setInterval(() => this.updateCurrentDate(), 60000);
    }

    setupEventListeners() {
        // Auto-save forms when typing
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('form-textarea')) {
                this.autoSave();
            }
        });

        // Handle Enter key in textareas
        document.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('form-textarea') && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const textarea = e.target;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '\n' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                this.autoSave();
            }
        });
    }

    // Date and Time Functions
    updateCurrentDate() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
    }

    updateCurrentMonth() {
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        const monthYear = `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
        document.getElementById('current-month').textContent = monthYear;
        document.getElementById('nav-month').textContent = monthYear;
    }

    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    formatDateTime(date) {
        const dateStr = this.formatDate(date);
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        return `${dateStr} ${timeStr}`;
    }

    // Storage Functions
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('payroll-forms');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading from storage:', error);
            return {};
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('payroll-forms', JSON.stringify(this.forms));
            this.updateLastUpdated();
        } catch (error) {
            console.error('Error saving to storage:', error);
            this.showToast('Error saving data', 'error');
        }
    }

    autoSave() {
        // Debounced auto-save
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveAllForms();
        }, 1000);
    }

    saveAllForms() {
        const textareas = document.querySelectorAll('.form-textarea');
        textareas.forEach(textarea => {
            const formId = textarea.dataset.formId;
            if (formId && this.forms[formId]) {
                this.forms[formId].content = textarea.value;
                this.forms[formId].lastModified = new Date().toISOString();
            }
        });
        this.saveToStorage();
    }

    updateLastUpdated() {
        const lastUpdated = new Date().toLocaleString();
        document.getElementById('last-updated').textContent = lastUpdated;
    }

    // Form Management Functions
    getMonthKey(date = this.currentMonth) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    getCurrentMonthForms() {
        const monthKey = this.getMonthKey();
        return Object.values(this.forms).filter(form =>
            form.monthKey === monthKey
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    addNewForm() {
        const now = new Date();
        const formId = `form_${now.getTime()}`;
        const monthKey = this.getMonthKey();

        const newForm = {
            id: formId,
            createdAt: now.toISOString(),
            lastModified: now.toISOString(),
            monthKey: monthKey,
            content: '',
            date: this.formatDate(now)
        };

        this.forms[formId] = newForm;
        this.saveToStorage();
        this.renderForms();
        this.updateStats();

        // Focus on the new form's textarea
        setTimeout(() => {
            const newTextarea = document.querySelector(`[data-form-id="${formId}"]`);
            if (newTextarea) {
                newTextarea.focus();
            }
        }, 100);

        this.showToast('New form added successfully!');
    }

    deleteForm(formId) {
        if (this.forms[formId]) {
            delete this.forms[formId];
            this.saveToStorage();
            this.renderForms();
            this.updateStats();
            this.showToast('Form deleted successfully!');
        }
    }

    duplicateForm(formId) {
        if (this.forms[formId]) {
            const originalForm = this.forms[formId];
            const now = new Date();
            const newFormId = `form_${now.getTime()}`;

            const duplicatedForm = {
                ...originalForm,
                id: newFormId,
                createdAt: now.toISOString(),
                lastModified: now.toISOString(),
                date: this.formatDate(now)
            };

            this.forms[newFormId] = duplicatedForm;
            this.saveToStorage();
            this.renderForms();
            this.updateStats();
            this.showToast('Form duplicated successfully!');
        }
    }

    // Navigation Functions
    changeMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.updateCurrentMonth();
        this.renderForms();
    }

    goToToday() {
        this.currentMonth = new Date();
        this.updateCurrentMonth();
        this.renderForms();
    }

    // Rendering Functions
    renderForms() {
        const formsContainer = document.getElementById('forms-container');
        const emptyState = document.getElementById('empty-state');
        const currentMonthForms = this.getCurrentMonthForms();

        formsContainer.innerHTML = '';

        if (currentMonthForms.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            currentMonthForms.forEach(form => {
                const formElement = document.createElement('div');
                formElement.className = 'form-entry';
                formElement.innerHTML = `
                    <div class="form-header">
                        <div class="form-date">Added on: ${form.date}</div>
                        <div class="form-actions">
                            <button onclick="formSystem.duplicateForm('${form.id}')">Duplicate</button>
                            <button onclick="formSystem.deleteForm('${form.id}')">Delete</button>
                        </div>
                    </div>
                    <div class="form-content">
                        <textarea class="form-textarea" data-form-id="${form.id}" placeholder="Enter your comment here...">${form.content}</textarea>
                    </div>
                `;
                formsContainer.appendChild(formElement);
            });
        }
    }

    // Statistics Functions
    updateStats() {
        const totalForms = Object.keys(this.forms).length;
        const monthForms = this.getCurrentMonthForms().length;

        document.getElementById('total-forms').textContent = totalForms;
        document.getElementById('month-forms').textContent = monthForms;
    }

    // Toast Notification
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Export Functions
    exportData() {
        const exportModal = document.getElementById('export-modal');
        exportModal.classList.add('show');
    }

    closeExportModal() {
        const exportModal = document.getElementById('export-modal');
        exportModal.classList.remove('show');
    }

    exportToJSON() {
        const dataStr = JSON.stringify(this.forms, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = 'payroll-forms.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        this.closeExportModal();
    }

    exportToCSV() {
        let csv = 'id,createdAt,lastModified,monthKey,content,date\n';
        Object.values(this.forms).forEach(form => {
            csv += `"${form.id}","${form.createdAt}","${form.lastModified}","${form.monthKey}","${form.content.replace(/"/g, '""')}","${form.date}"\n`;
        });

        const dataUri = 'data:text/csv;charset=utf-8,'+ encodeURIComponent(csv);
        const exportFileDefaultName = 'payroll-forms.csv';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        this.closeExportModal();
    }

    exportToText() {
        let text = '';
        Object.values(this.forms).forEach(form => {
            text += `ID: ${form.id}\nCreated At: ${form.createdAt}\nLast Modified: ${form.lastModified}\nMonth: ${form.monthKey}\nDate: ${form.date}\nContent: ${form.content}\n\n`;
        });

        const dataUri = 'data:text/plain;charset=utf-8,'+ encodeURIComponent(text);
        const exportFileDefaultName = 'payroll-forms.txt';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        this.closeExportModal();
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data?')) {
            this.forms = {};
            this.saveToStorage();
            this.renderForms();
            this.updateStats();
            this.showToast('All data cleared successfully!');
        }
    }
}

// Initialize the form management system
const formSystem = new FormManagementSystem();