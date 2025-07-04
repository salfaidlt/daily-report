class FormManagementSystem {
    constructor() {
        this.targetWorkbookName = "test.xlsx"; // Set your target workbook name here
        this.targetSheetName = "Sheet1"; // Optionally set a target sheet name
        this.isAddInConfigured = true;
        this.initializeExcelEvents();
        
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
        setInterval(() => this.updateCurrentDate(), 60000);
    }

    async initializeExcelEvents() {
        try {
            // Check if we're in Excel
            if (Office.context.host === Office.HostType.Excel) {
                // Check if we should monitor sheet activation
                const configured = await this.getSetting("test");
                if (configured) {
                    this.isAddInConfigured = true;
                    this.monitorSheetActivation();
                }
                
                // Set up worksheet activated handler
                await Excel.run(async (context) => {
                    const sheets = context.workbook.worksheets;
                    sheets.onActivated.add(this.handleSheetActivation.bind(this));
                    await context.sync();
                });
            }
        } catch (error) {
            console.error("Error initializing Excel events:", error);
        }
    }

    async monitorSheetActivation() {
        try {
            await Excel.run(async (context) => {
                const sheet = context.workbook.worksheets.getActiveWorksheet();
                sheet.load("test");
                await context.sync();
                
                if (sheet.name === this.targetSheetName) {
                    Office.addin.showAsTaskpane();
                }
            });
        } catch (error) {
            console.error("Error monitoring sheet activation:", error);
        }
    }

    async handleSheetActivation(event) {
        try {
            const worksheet = event.worksheet;
            worksheet.load("name");
            await event.context.sync();
            
            if (worksheet.name === this.targetSheetName && this.isAddInConfigured) {
                Office.addin.showAsTaskpane();
            }
        } catch (error) {
            console.error("Error handling sheet activation:", error);
        }
    }

    async configureForTargetSheet() {
        try {
            await this.setSetting("targetSheetConfigured", true);
            this.isAddInConfigured = true;
            this.monitorSheetActivation();
            this.showToast("Add-in will now open automatically for this sheet");
        } catch (error) {
            console.error("Error configuring for target sheet:", error);
            this.showToast("Error configuring automatic opening", "error");
        }
    }

    // Helper methods for settings
    async getSetting(key) {
        return new Promise((resolve) => {
            Office.context.document.settings.get(key, (result) => {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    resolve(result.value);
                } else {
                    resolve(null);
                }
            });
        });
    }

    async setSetting(key, value) {
        return new Promise((resolve) => {
            Office.context.document.settings.set(key, value);
            Office.context.document.settings.saveAsync((result) => {
                resolve(result.status === Office.AsyncResultStatus.Succeeded);
            });
        });
    }

    async loadFromExcel() {
        this.forms = await loadFromExcel();
    }

    async saveToExcel() {
        await saveToExcel(this.forms);
    }

    setupEventListeners() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('form-textarea') && this.isCurrentMonth()) {
                this.autoSave();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('form-textarea') && e.key === 'Enter' && !e.shiftKey && this.isCurrentMonth()) {
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

    isCurrentMonth() {
        const currentDate = new Date();
        return this.currentMonth.getMonth() === currentDate.getMonth() &&
            this.currentMonth.getFullYear() === currentDate.getFullYear();
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

    async addNewForm() {
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
        // await this.saveToExcel();
        this.renderForms();
        this.updateStats();

        setTimeout(() => {
            const newTextarea = document.querySelector(`[data-form-id="${formId}"]`);
            if (newTextarea) {
                newTextarea.focus();
            }
        }, 100);

        this.showToast('New form added successfully!');
    }

    async deleteForm(formId) {
        if (this.forms[formId]) {
            delete this.forms[formId];
            await this.saveToExcel();
            this.renderForms();
            this.updateStats();
            this.showToast('Form deleted successfully!');
        }
    }

    async duplicateForm(formId) {
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
            await this.saveToExcel();
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
        const isCurrentMonth = this.isCurrentMonth();

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
                            <button ${!isCurrentMonth ? 'disabled' : `onclick="formSystem.duplicateForm('${form.id}')"`}>Duplicate</button>
                            <button ${!isCurrentMonth ? 'disabled' : `onclick="formSystem.deleteForm('${form.id}')"`}>Delete</button>
                        </div>
                    </div>
                    <div class="form-content">
                        <textarea class="form-textarea" data-form-id="${form.id}" ${!isCurrentMonth ? 'readonly' : ''} placeholder="Enter your comment here...">${form.content}</textarea>
                    </div>
                `;
                formsContainer.appendChild(formElement);
            });
        }

        // Désactiver le bouton "Add New Message" si ce n'est pas le mois courant
        document.querySelector('.btn-primary').disabled = !isCurrentMonth;
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
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = 'payroll-forms.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        this.closeExportModal();
    }

    exportToCSV() {
        const currentMonthForms = this.getCurrentMonthForms();
        let csv = 'id,createdAt,lastModified,monthKey,content,date\n';
        currentMonthForms.forEach(form => {
            csv += `"${form.id}","${form.createdAt}","${form.lastModified}","${form.monthKey}","${form.content.replace(/"/g, '""')}","${form.date}"\n`;
        });

        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        const monthYear = this.getMonthKey(this.currentMonth);
        const exportFileDefaultName = `payroll-forms-${monthYear}.csv`;

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

        const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
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

async function loadFromExcel() {
    try {
        await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getActiveWorksheet();
            const range = sheet.getUsedRange();
            range.load("values");
            await context.sync();

            // Convertir les données de la feuille en un format utilisable
            const data = range.values;
            const headers = data[0];
            const forms = {};

            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                const form = {};
                for (let j = 0; j < headers.length; j++) {
                    form[headers[j]] = row[j];
                }
                forms[form.id] = form;
            }

            return forms;
        });
    } catch (error) {
        console.error("Error loading data from Excel:", error);
        OfficeHelpers.Utilities.log(error);
    }
}

async function saveToExcel(forms) {
    try {
        await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getActiveWorksheet();
            sheet.getUsedRange().clear();

            // Préparer les données pour la feuille Excel
            const data = [["id", "content", "date"]]; // En-têtes
            Object.values(forms).forEach(form => {
                data.push([form.id, form.content, form.date]);
            });

            // Écrire les données dans la feuille
            const range = sheet.getRangeByIndexes(0, 0, data.length, data[0].length);
            range.values = data;
            await context.sync();
        });
    } catch (error) {
        console.error("Error saving data to Excel:", error);
        OfficeHelpers.Utilities.log(error);
    }
}


// Initialize the form management system
const formSystem = new FormManagementSystem();

// Add this to your HTML to configure the automatic opening
function configureAutoOpen() {
    formSystem.configureForTargetSheet();
}