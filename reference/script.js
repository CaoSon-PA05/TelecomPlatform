// CDR Analyzer - Phân tích chi tiết cuộc gọi
class CDRAnalyzer {
    constructor() {
        this.data = null;
        this.subscriberInfo = null;
        this.subscriberInfoDisplay = {}; // Thông tin hiển thị riêng biệt
        this.currentFileName = null; // Tên file hiện tại để tạo key riêng
        this.callRecords = [];
        this.callHistory = new Map();
        this.imeiList = new Set();
        this.contacts = new Map();
        this.hourlyStats = new Array(24).fill(0);
        this.weeklyStats = new Array(7).fill(0);
        this.locationStats = new Map();
        this.imeiChanges = [];
        this.imsiChanges = [];
        this.currentEditingLocation = null; // Thêm thuộc tính để lưu vị trí đang edit
        
        // Pagination settings
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.filteredRecords = [];

        // Pagination variables for contacts
        this.contactsCurrentPage = 1;
        this.contactsPageSize = 50;
        this.contactsTotalPages = 1;
        this.filteredContacts = [];

        // Pagination variables for location
        this.locationCurrentPage = 1;
        this.locationPageSize = 50;
        this.locationTotalPages = 1;
        this.filteredLocations = [];
        
        // Pagination variables for IMEI
        this.filteredIMEI = [];
        
        // Location time filtering
        this.locationsWithTimeData = new Map();
        this.filteredLocationsByTime = new Map();
        
        // Location contact search
        this.locationContactSearchData = null; // Dữ liệu tìm kiếm theo số liên lạc cụ thể
        this.filteredLocationsBySpecificContact = []; // Kết quả lọc theo số liên lạc cụ thể

        // Contacts time filtering data
        this.contactsWithTimeData = new Map(); // Lưu dữ liệu chi tiết theo thời gian
        this.filteredContactsByTime = new Map(); // Kết quả lọc theo thời gian
        
        // Template detection
        this.currentTemplate = 'template1';
        this.currentFileName = null;
        this.currentColumnMap = null; // Column mapping for flexible detection
        this.currentHeaderRowIndex = null; // Header row index
        this.fileMissingColumns = new Map(); // Lưu missing columns theo file name
        this.templateMappings = {
            template1: {
                subscriberInfo: {
                    startDate: 'C5',
                    endDate: 'E5',
                    name: 'C7',
                    phoneNumber: 'C8',
                    birthDate: 'C9',
                    address: 'C10',
                    idNumber: 'C13',
                    idIssueDate: 'C14',
                    activationDate: 'C16'
                },
                callRecords: {
                    startRow: 22,
                    sourceNumber: 'B',
                    targetNumber: 'C',
                    timestamp: 'D',
                    duration: 'E',
                    imsi: 'F',
                    imei: 'G',
                    provinceCode: 'H',
                    callType: 'I',
                    serviceType: 'J',
                    location: 'K',
                    lac: 'L',
                    cell: 'M'
                }
            },
            template3: { // Đổi thành Mẫu 2 (STT format)
                subscriberInfo: {
                    startRow: 0,
                    startDate: '',
                    endDate: '',
                    name: '',
                    phoneNumber: '',
                    birthDate: '',
                    address: '',
                    idNumber: '',
                    idIssueDate: '',
                    activationDate: ''
                },
                callRecords: {
                    startRow: 0, // Will be detected dynamically
                    sourceNumber: 'D',
                    targetNumber: 'E',
                    timestamp: 'B',
                    duration: 'F',
                    imsi: '',
                    imei: 'I',
                    provinceCode: '',
                    callType: 'C',
                    serviceType: '',
                    location: 'H',
                    lac: 'G',
                    cell: 'G'
                }
            },
            template2: { // Template có a_subs, b_subs
                subscriberInfo: {
                    startDate: '',
                    endDate: '',
                    name: '',
                    phoneNumber: '',
                    birthDate: '',
                    address: '',
                    idNumber: '',
                    idIssueDate: '',
                    activationDate: ''
                },
                callRecords: {
                    startRow: 1,
                    sourceNumber: 'A', // a_subs (cột 0)
                    targetNumber: 'G', // b_subs (cột 6)
                    timestamp: 'D', // date (cột 3)
                    time: 'E', // time (cột 4)
                    duration: 'F', // duration (cột 5)
                    imsi: 'B', // imsi (cột 1)
                    imei: 'C', // imei (cột 2)
                    provinceCode: 'I', // province code (cột 8)
                    callType: 'H', // call type (cột 7)
                    serviceType: 'J', // service type (cột 9)
                    location: 'P', // location (cột 15)
                    lac: 'N', // lac (cột 13)
                    cell: 'O' // cell (cột 14)
                }
            }
        };
        
        // Modal management
        this.activeModal = null;
        this.modalElements = new Map();
        
        // Map data storage
        this.mapFiles = new Map(); // Lưu trữ các file đã import cho maps
        this.mapData = []; // Dữ liệu tổng hợp từ tất cả file cho maps
        
        // Compare data storage
        this.compareFiles = [];
        this.compareResults = null;
        this.currentCompareAnalysis = null;
        
        // Compare pagination settings
        this.compareCurrentPage = 1;
        this.comparePageSize = 15; // Increased from 6 to 15 for better display optimization
        this.compareTotalPages = 1;
        this.filteredCompareResults = [];
        this.compareSearchTerm = [];
        
        // Multi-file management
        this.filesData = new Map(); // Map<fileName, {file, template, data, analyzed, subscriberInfo, ...}>
        this.compareFileSelection = [];
        this.currentFileId = null; // ID của file đang được xem
        
        this.initializeEventListeners();
        this.initializeCharts();
        this.initializeModals();
        this.initializeToast();
    }

    // Initialize toast container
    initializeToast() {
        // Toast container is already in HTML, just ensure it exists
        if (!document.getElementById('toastContainer')) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    // Show toast notification
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) {
            // Fallback to alert if toast container doesn't exist
            alert(message);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Determine icon based on type
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        else if (type === 'warning') icon = '⚠️';
        else if (type === 'info') icon = 'ℹ️';

        // Remove icon from message if it already contains one
        let cleanMessage = message;
        const iconPatterns = ['✅', '❌', '⚠️', 'ℹ️', '📋', '📊', '📁', '🗺️', '📍', '🔑', '📄', '📑'];
        for (const iconPattern of iconPatterns) {
            if (cleanMessage.startsWith(iconPattern + ' ')) {
                cleanMessage = cleanMessage.substring(iconPattern.length + 1);
                break;
            } else if (cleanMessage.startsWith(iconPattern)) {
                cleanMessage = cleanMessage.substring(iconPattern.length);
                break;
            }
        }

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">${cleanMessage}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(toast);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('hiding');
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                }, 300);
            }, duration);
        }
    }

    initializeEventListeners() {
        // File upload events
        const fileInput = document.getElementById('fileInput');
        const fileDropZone = document.getElementById('fileDropZone');
        const removeFile = document.getElementById('removeFile');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                try {
                    console.log('File input changed, files selected:', e.target.files.length);
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        console.log('Processing', files.length, 'file(s)');
                        this.processMultipleFiles(files);
                    } else {
                        console.warn('No files selected');
                    }
                } catch (error) {
                    console.error('Error in file input change handler:', error);
                    this.showToast('Lỗi khi chọn file: ' + error.message, 'error');
                }
            });
        } else {
            console.error('fileInput element not found!');
        }
        
        // Drag and drop events
        if (fileDropZone) {
            fileDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileDropZone.classList.add('dragover');
            });
            
            fileDropZone.addEventListener('dragleave', () => {
                fileDropZone.classList.remove('dragover');
            });
            
            fileDropZone.addEventListener('drop', (e) => {
                try {
                    e.preventDefault();
                    fileDropZone.classList.remove('dragover');
                    console.log('Files dropped, count:', e.dataTransfer.files.length);
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0) {
                        console.log('Processing', files.length, 'dropped file(s)');
                        this.processMultipleFiles(files);
                    } else {
                        console.warn('No files in drop event');
                    }
                } catch (error) {
                    console.error('Error in drop handler:', error);
                    this.showToast('Lỗi khi thả file: ' + error.message, 'error');
                }
            });

            // Click to select files
            fileDropZone.addEventListener('click', (e) => {
                if (fileInput) {
                    fileInput.value = ''; // Reset trước khi mở dialog
                    fileInput.click();
                }
            });
        }
        
        if (removeFile) {
            removeFile.addEventListener('click', () => this.removeFile());
        }
        
        // Multi-file management buttons
        const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
        if (addMoreFilesBtn) {
            addMoreFilesBtn.addEventListener('click', () => {
                if (fileInput) {
                    fileInput.value = '';
                    fileInput.click();
                }
            });
        }
        
        const analyzeAllFilesBtn = document.getElementById('analyzeAllFilesBtn');
        if (analyzeAllFilesBtn) {
            analyzeAllFilesBtn.addEventListener('click', () => this.analyzeAllFiles());
        }
        
        const clearAllFilesBtn = document.getElementById('clearAllFilesBtn');
        if (clearAllFilesBtn) {
            clearAllFilesBtn.addEventListener('click', () => this.clearAllFiles());
        }
        
        // Clear errors button
        const clearErrorsBtn = document.getElementById('clearErrorsBtn');
        if (clearErrorsBtn) {
            clearErrorsBtn.addEventListener('click', () => {
                const errorsContainer = document.getElementById('importErrorsContainer');
                if (errorsContainer) {
                    errorsContainer.style.display = 'none';
                }
            });
        }
        
        // Clear analysis errors button
        const clearAnalysisErrorsBtn = document.getElementById('clearAnalysisErrorsBtn');
        if (clearAnalysisErrorsBtn) {
            clearAnalysisErrorsBtn.addEventListener('click', () => {
                const errorsContainer = document.getElementById('analysisErrorsContainer');
                if (errorsContainer) {
                    errorsContainer.style.display = 'none';
                }
            });
        }
        
        // File manager button - show upload section
        const openFileManagerBtn = document.getElementById('openFileManagerBtn');
        if (openFileManagerBtn) {
            openFileManagerBtn.addEventListener('click', () => {
                this.showFileManager();
            });
        }

        // Export all button
        const exportAllBtn = document.getElementById('exportAllBtn');
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', () => this.exportAllData());
        }

        // Export all files button (in import screen)
        const exportAllFilesBtn = document.getElementById('exportAllFilesBtn');
        if (exportAllFilesBtn) {
            exportAllFilesBtn.addEventListener('click', () => {
                this.exportAllFiles();
            });
        }

        // Template selector
        const templateSelect = document.getElementById('templateSelect');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                this.currentTemplate = e.target.value;
                console.log('Template changed to:', this.currentTemplate);
                
                // Nếu đã có file được load, cần reload để áp dụng template mới
                if (this.data) {
                    console.log('Reloading data with new template...');
                    
                    // Hiển thị thông báo
                    this.showTemplateChangeNotification();
                    
                    // Reload data
                    this.analyzeData();
                    this.updateSubscriberInfo();
                    this.updateCallHistoryTable();
                    this.updateIMEITable();
                    this.updateContactsTable();
                    this.updateLocationTable();
                    this.updateChangesLog();
                    this.updateCharts();
                }
            });
        }

        // Tab navigation
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Call history tab - no longer using modal
        // Event listeners for call history tab elements will be set up below

        // All contacts modal
        const closeAllContacts = document.getElementById('closeAllContacts');
        const allContactsModal = document.getElementById('allContactsModal');
        
        if (closeAllContacts) {
            closeAllContacts.addEventListener('click', () => this.hideAllContacts());
        }
        
        if (allContactsModal) {
            allContactsModal.addEventListener('click', (e) => {
                if (e.target === allContactsModal) this.hideAllContacts();
            });
        }

        // All locations modal
        const viewAllLocations = document.getElementById('viewAllLocations');
        const closeAllLocations = document.getElementById('closeAllLocations');
        const allLocationsModal = document.getElementById('allLocationsModal');
        const refreshCoordinates = document.getElementById('refreshCoordinates');

        if (viewAllLocations) {
            viewAllLocations.addEventListener('click', () => this.showAllLocations());
        }
        if (closeAllLocations) {
            closeAllLocations.addEventListener('click', () => this.hideAllLocations());
        }
        if (allLocationsModal) {
            allLocationsModal.addEventListener('click', (e) => {
                if (e.target === allLocationsModal) this.hideAllLocations();
            });
        }
        // Tạm thời tắt chức năng làm mới tọa độ
        // if (refreshCoordinates) {
        //     refreshCoordinates.addEventListener('click', () => this.refreshLocationCoordinates());
        // }

        // Export buttons
        const exportIMEIBtn = document.getElementById('exportIMEI');
        const exportContactsBtn = document.getElementById('exportContacts');
        const exportCallHistoryBtn = document.getElementById('exportCallHistory');
        const exportLocationBtn = document.getElementById('exportLocation');
        
        if (exportIMEIBtn) {
            exportIMEIBtn.addEventListener('click', () => this.exportIMEI());
        }
        if (exportContactsBtn) {
            exportContactsBtn.addEventListener('click', () => this.exportContacts());
        }
        if (exportCallHistoryBtn) {
            exportCallHistoryBtn.addEventListener('click', () => this.exportCallHistory());
        }
        if (exportLocationBtn) {
            exportLocationBtn.addEventListener('click', () => this.exportLocation());
        }
        
        // Sync location button
        const syncLocationBtn = document.getElementById('syncLocationBtn');
        if (syncLocationBtn) {
            syncLocationBtn.addEventListener('click', () => this.syncLocationToCallHistory());
        }

        // Scroll to top buttons
        const scrollToTopCallHistory = document.getElementById('scrollToTopCallHistory');
        const scrollToTopContacts = document.getElementById('scrollToTopContacts');
        const scrollToTopLocation = document.getElementById('scrollToTopLocation');

        if (scrollToTopCallHistory) {
            scrollToTopCallHistory.addEventListener('click', () => this.scrollToTopOfTab('call-history'));
        }
        if (scrollToTopContacts) {
            scrollToTopContacts.addEventListener('click', () => this.scrollToTopOfTab('contacts'));
        }
        if (scrollToTopLocation) {
            scrollToTopLocation.addEventListener('click', () => this.scrollToTopOfTab('location'));
        }

        // Show all contacts button
        const showAllContactsBtn = document.getElementById('showAllContactsBtn');
        if (showAllContactsBtn) {
            showAllContactsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Show all contacts button clicked');
                this.showAllContacts();
            });
        }

        // IMEI functionality
        const setCookiesBtn = document.getElementById('setCookies');
        const testIMEIBtn = document.getElementById('testIMEI');
        const lookupAllIMEIBtn = document.getElementById('lookupAllIMEI');
        const clearAllDataBtn = document.getElementById('clearAllData');
        const closeCookiesBtn = document.getElementById('closeCookies');
        const saveCookiesBtn = document.getElementById('saveCookies');
        const cancelCookiesBtn = document.getElementById('cancelCookies');
        const cookiesModal = document.getElementById('cookiesModal');

        if (setCookiesBtn) {
            setCookiesBtn.addEventListener('click', () => this.showCookiesModal());
        }
        if (testIMEIBtn) {
            testIMEIBtn.addEventListener('click', () => this.testIMEILookup());
        }
        if (lookupAllIMEIBtn) {
            lookupAllIMEIBtn.addEventListener('click', () => this.lookupAllIMEI());
        }
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', () => this.confirmClearAllData());
        }
        if (closeCookiesBtn) {
            closeCookiesBtn.addEventListener('click', () => this.hideCookiesModal());
        }
        if (saveCookiesBtn) {
            saveCookiesBtn.addEventListener('click', () => this.saveCookies());
        }
        if (cancelCookiesBtn) {
            cancelCookiesBtn.addEventListener('click', () => this.hideCookiesModal());
        }
        if (cookiesModal) {
            cookiesModal.addEventListener('click', (e) => {
                if (e.target === cookiesModal) this.hideCookiesModal();
            });
        }

        // Maps functionality
        const drawFoliumMapBtn = document.getElementById('drawFoliumMap');
        const downloadMapFileBtn = document.getElementById('downloadMapFile');
        const openMapBtn = document.getElementById('openMapBtn');
        const importMapFilesBtn = document.getElementById('importMapFiles');
        const mapFileInput = document.getElementById('mapFileInput');
        
        if (drawFoliumMapBtn) {
            drawFoliumMapBtn.addEventListener('click', () => this.drawFoliumMap());
        }
        if (downloadMapFileBtn) {
            downloadMapFileBtn.addEventListener('click', () => this.downloadMapFile());
        }
        if (openMapBtn) {
            openMapBtn.addEventListener('click', () => this.openMapFile());
        }
        if (importMapFilesBtn) {
            importMapFilesBtn.addEventListener('click', () => this.showMapFileImport());
        }
        if (mapFileInput) {
            mapFileInput.addEventListener('change', (e) => this.handleMapFileImport(e.target.files));
        }

        // Google Maps Edit Modal
        const closeGoogleMapsBtn = document.getElementById('closeGoogleMaps');
        const saveGoogleMapsBtn = document.getElementById('saveGoogleMaps');
        const cancelGoogleMapsBtn = document.getElementById('cancelGoogleMaps');
        const editGoogleMapsModal = document.getElementById('editGoogleMapsModal');
        const googleMapsInput = document.getElementById('googleMapsInput');

        // Search functionality
        const resetCallHistoryBtn = document.getElementById('resetCallHistory');
        const filterCallHistoryBtn = document.getElementById('filterCallHistory');
        const resetIMEIBtn = document.getElementById('resetIMEI');
        const callHistorySearchInput = document.getElementById('callHistorySearch');
        const imeiSearchInput = document.getElementById('imeiSearch');
        const imeiStatusFilter = document.getElementById('imeiStatusFilter');
        const callHistoryPageSizeSelect = document.getElementById('callHistoryPageSize');

        if (closeGoogleMapsBtn) {
            closeGoogleMapsBtn.addEventListener('click', () => this.hideGoogleMapsModal());
        }
        if (saveGoogleMapsBtn) {
            saveGoogleMapsBtn.addEventListener('click', () => this.saveGoogleMapsLink());
        }
        if (cancelGoogleMapsBtn) {
            cancelGoogleMapsBtn.addEventListener('click', () => this.hideGoogleMapsModal());
        }
        if (editGoogleMapsModal) {
            editGoogleMapsModal.addEventListener('click', (e) => {
                if (e.target === editGoogleMapsModal) {
                    // Lưu link khi click ra ngoài
                    this.saveGoogleMapsLink();
                }
            });
        }
        if (googleMapsInput) {
            // Lưu link khi nhấn Enter
            googleMapsInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveGoogleMapsLink();
                }
            });
            // Lưu link khi input mất focus
            googleMapsInput.addEventListener('blur', () => {
                this.saveGoogleMapsLink();
            });
        }

        // Search functionality event listeners
        if (resetCallHistoryBtn) {
            resetCallHistoryBtn.addEventListener('click', () => this.resetCallHistory());
        }
        if (filterCallHistoryBtn) {
            filterCallHistoryBtn.addEventListener('click', () => this.searchCallHistory());
        }
        if (resetIMEIBtn) {
            resetIMEIBtn.addEventListener('click', () => this.resetIMEI());
        }
        
        // Pagination event listeners
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        
        // Event listeners removed - using onclick in HTML instead
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', () => this.changePageSize());
        }
        if (callHistoryPageSizeSelect) {
            callHistoryPageSizeSelect.addEventListener('change', () => this.changeCallHistoryPageSize());
        }

        // Contacts tab event listeners
        const contactsPageSizeSelect = document.getElementById('contactsPageSize');
        const contactsPrevBtn = document.getElementById('contactsPrevBtn');
        const contactsNextBtn = document.getElementById('contactsNextBtn');
        const contactsSearchInput = document.getElementById('contactsSearchInput');
        const contactsResetBtn = document.getElementById('contactsResetBtn');

        if (contactsPageSizeSelect) {
            contactsPageSizeSelect.addEventListener('change', () => this.changeContactsPageSize());
        }
        // Event listeners removed - using onclick in HTML instead
        if (contactsSearchInput) {
            contactsSearchInput.addEventListener('input', () => this.searchContacts());
        }
        if (contactsResetBtn) {
            contactsResetBtn.addEventListener('click', () => this.resetContactsFilters());
        }

        // Contacts time filter event listeners
        const contactsDateFrom = document.getElementById('contactsDateFrom');
        const contactsDateTo = document.getElementById('contactsDateTo');
        const contactsTimeFrom = document.getElementById('contactsTimeFrom');
        const contactsTimeTo = document.getElementById('contactsTimeTo');
        const filterContactsBtn = document.getElementById('filterContacts');
        const resetContactsFiltersBtn = document.getElementById('resetContactsFilters');

        if (contactsDateFrom) {
            contactsDateFrom.addEventListener('change', () => this.filterContactsByTime());
        }
        if (contactsDateTo) {
            contactsDateTo.addEventListener('change', () => this.filterContactsByTime());
        }
        if (contactsTimeFrom) {
            this.initializeTimeSelect('contactsTimeFrom');
            contactsTimeFrom.addEventListener('change', () => this.filterContactsByTime());
        }
        if (contactsTimeTo) {
            this.initializeTimeSelect('contactsTimeTo');
            contactsTimeTo.addEventListener('change', () => this.filterContactsByTime());
        }
        if (filterContactsBtn) {
            filterContactsBtn.addEventListener('click', () => this.filterContactsByTime());
        }
        if (resetContactsFiltersBtn) {
            resetContactsFiltersBtn.addEventListener('click', () => this.resetContactsFilters());
        }

        // Location tab event listeners
        const locationPageSizeSelect = document.getElementById('locationPageSize');
        const locationPrevBtn = document.getElementById('locationPrevBtn');
        const locationNextBtn = document.getElementById('locationNextBtn');
        const locationSearchInput = document.getElementById('locationSearchInput');
        const locationResetBtn = document.getElementById('locationResetBtn');

        if (locationPageSizeSelect) {
            locationPageSizeSelect.addEventListener('change', () => this.changeLocationPageSize());
        }
        // Event listeners removed - using onclick in HTML instead
        if (locationSearchInput) {
            locationSearchInput.addEventListener('input', () => this.searchLocation());
        }
        if (locationResetBtn) {
            locationResetBtn.addEventListener('click', () => this.resetLocationFilters());
        }
        
        // Location contact search
        const searchLocationByContactBtn = document.getElementById('searchLocationByContact');
        if (searchLocationByContactBtn) {
            searchLocationByContactBtn.addEventListener('click', () => this.searchLocationByContact());
        }
        
        // Location editable inputs
        this.setupLocationEditableInputs();

        // Location time filtering
        const locationDateFrom = document.getElementById('locationDateFrom');
        const locationDateTo = document.getElementById('locationDateTo');
        const locationTimeFrom = document.getElementById('locationTimeFrom');
        const locationTimeTo = document.getElementById('locationTimeTo');
        const filterLocationBtn = document.getElementById('filterLocation');
        const resetLocationFiltersBtn = document.getElementById('resetLocationFilters');
        
        // Auto-filter when date/time fields change (like contacts and call history tabs)
        if (locationDateFrom) {
            locationDateFrom.addEventListener('change', () => this.filterLocationByTime());
        }
        if (locationDateTo) {
            locationDateTo.addEventListener('change', () => this.filterLocationByTime());
        }
        if (locationTimeFrom) {
            this.initializeTimeSelect('locationTimeFrom');
            locationTimeFrom.addEventListener('change', () => this.filterLocationByTime());
        }
        if (locationTimeTo) {
            this.initializeTimeSelect('locationTimeTo');
            locationTimeTo.addEventListener('change', () => this.filterLocationByTime());
        }
        
        // Keep button for manual trigger (optional, but kept for consistency)
        if (filterLocationBtn) {
            filterLocationBtn.addEventListener('click', () => this.filterLocationByTime());
        }

        if (resetLocationFiltersBtn) {
            resetLocationFiltersBtn.addEventListener('click', () => this.resetLocationFilters());
        }
        
        // Real-time search for call history
        if (callHistorySearchInput) {
            callHistorySearchInput.addEventListener('input', () => this.searchCallHistory());
        }
        if (document.getElementById('callHistoryDateFrom')) {
            document.getElementById('callHistoryDateFrom').addEventListener('change', () => this.searchCallHistory());
        }
        if (document.getElementById('callHistoryDateTo')) {
            document.getElementById('callHistoryDateTo').addEventListener('change', () => this.searchCallHistory());
        }
        if (document.getElementById('callHistoryTimeFrom')) {
            this.initializeTimeSelect('callHistoryTimeFrom');
            document.getElementById('callHistoryTimeFrom').addEventListener('change', () => this.searchCallHistory());
        }
        if (document.getElementById('callHistoryTimeTo')) {
            this.initializeTimeSelect('callHistoryTimeTo');
            document.getElementById('callHistoryTimeTo').addEventListener('change', () => this.searchCallHistory());
        }

        // Initialize scroll to top functionality
        this.initializeScrollToTop();
        if (document.getElementById('callHistoryTypeFilter')) {
            document.getElementById('callHistoryTypeFilter').addEventListener('change', () => this.searchCallHistory());
        }
        
        // Real-time search for IMEI
        if (imeiSearchInput) {
            imeiSearchInput.addEventListener('input', () => this.searchIMEI());
        }
        if (imeiStatusFilter) {
            imeiStatusFilter.addEventListener('change', () => this.searchIMEI());
        }

        // Subscriber edit functionality
        const editSubscriberBtn = document.getElementById('editSubscriberBtn');
        const saveSubscriberBtn = document.getElementById('saveSubscriberBtn');
        const cancelSubscriberBtn = document.getElementById('cancelSubscriberBtn');

        if (editSubscriberBtn) {
            editSubscriberBtn.addEventListener('click', () => this.editSubscriberInfo());
        }
        if (saveSubscriberBtn) {
            saveSubscriberBtn.addEventListener('click', () => this.saveSubscriberInfo());
        }
        if (cancelSubscriberBtn) {
            cancelSubscriberBtn.addEventListener('click', () => this.cancelEditSubscriberInfo());
        }
        
        // Reset subscriber button
        const resetSubscriberBtn = document.getElementById('resetSubscriberBtn');
        if (resetSubscriberBtn) {
            resetSubscriberBtn.addEventListener('click', () => this.resetSubscriberDisplayToOriginal());
        }
        
        // Clear file data button
        const clearFileDataBtn = document.getElementById('clearFileDataBtn');
        if (clearFileDataBtn) {
            clearFileDataBtn.addEventListener('click', () => this.confirmClearCurrentFileData());
        }

        // All contacts modal initialization completed

        // Initialize compare tab events
        this.initializeCompareEventListeners();
    }

    initializeModals() {
        try {
            // Cache tất cả modal elements để tránh query DOM nhiều lần
            const modalIds = [
                'fileManagerModal',
                'callHistoryModal',
                'allContactsModal', 
                'allLocationsModal',
                'cookiesModal',
                'editGoogleMapsModal',
                'compareFilesModal'
            ];
            
            modalIds.forEach(id => {
                const modal = document.getElementById(id);
                if (modal) {
                    this.modalElements.set(id, modal);
                    
                    // Thêm event listener để đóng modal khi click outside
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            this.hideModal(id);
                        }
                    });
                    
                    console.log(`Modal ${id} initialized successfully`);
                } else {
                    console.warn(`Modal ${id} not found in DOM`);
                }
            });
            
            console.log('Modals initialized successfully. Total modals:', this.modalElements.size);
        } catch (error) {
            console.error('Error initializing modals:', error);
        }
    }

    // Centralized modal management methods
    showModal(modalId) {
        try {
            // Đảm bảo modal đã được khởi tạo
            if (!this.ensureModalInitialized(modalId)) {
                console.error(`Cannot show modal ${modalId} - initialization failed`);
                return;
            }
            
            // Ẩn modal hiện tại nếu có
            if (this.activeModal && this.activeModal !== modalId) {
                this.hideModal(this.activeModal);
            }
            
            const modal = this.modalElements.get(modalId);
            if (modal) {
                // Prevent body scroll when modal is open
                document.body.style.overflow = 'hidden';
                
                modal.style.display = 'flex';
                // Set background opacity immediately (no delay)
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
                this.activeModal = modalId;
                
                // Thêm class để trigger animation cho modal-content
                setTimeout(() => {
                    modal.classList.add('show');
                }, 10);
                
                console.log(`Modal ${modalId} shown successfully`);
            } else {
                console.error(`Modal ${modalId} not found`);
            }
        } catch (error) {
            console.error(`Error showing modal ${modalId}:`, error);
        }
    }

    hideModal(modalId) {
        try {
            const modal = this.modalElements.get(modalId);
            if (modal) {
                // Remove show class first
                modal.classList.remove('show');
                
                // Hide after animation
                setTimeout(() => {
                    modal.style.display = 'none';
                    if (this.activeModal === modalId) {
                        this.activeModal = null;
                    }
                    
                    // Restore body scroll when no modal is active
                    if (!this.activeModal) {
                        document.body.style.overflow = '';
                    }
                }, 200);
                
                console.log(`Modal ${modalId} hidden successfully`);
            }
        } catch (error) {
            console.error(`Error hiding modal ${modalId}:`, error);
        }
    }

    hideAllModals() {
        try {
            this.modalElements.forEach((modal, id) => {
                this.hideModal(id);
            });
            // Ensure body scroll is restored after all modals are closed
            this.activeModal = null;
            setTimeout(() => {
                document.body.style.overflow = '';
            }, 250);
        } catch (error) {
            console.error('Error hiding all modals:', error);
        }
    }

    // Kiểm tra và khởi tạo lại modal nếu cần
    ensureModalInitialized(modalId) {
        try {
            if (!this.modalElements.has(modalId)) {
                console.log(`Modal ${modalId} not found, reinitializing...`);
                this.initializeModals();
                
                // Kiểm tra lại
                if (!this.modalElements.has(modalId)) {
                    console.error(`Modal ${modalId} still not found after reinitialization`);
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error(`Error ensuring modal ${modalId} initialized:`, error);
            return false;
        }
    }

    initializeCharts() {
        try {
        // Initialize Chart.js charts
            const contactsChartElement = document.getElementById('contactsChart');
            const hourlyChartElement = document.getElementById('hourlyChart');
            const weeklyChartElement = document.getElementById('weeklyChart');
            
            if (contactsChartElement) {
                this.contactsChart = new Chart(contactsChartElement, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Tần suất liên lạc',
                    data: [],
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
            }

            if (hourlyChartElement) {
                this.hourlyChart = new Chart(hourlyChartElement, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => {
                    const nextHour = (i + 1) % 24;
                    return `${i.toString().padStart(2, '0')} - ${nextHour.toString().padStart(2, '0')}`;
                }),
                datasets: [{
                    label: 'Số cuộc gọi & tin nhắn',
                    data: this.hourlyStats,
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const index = context[0].dataIndex;
                                return `${index.toString().padStart(2, '0')}:00 - ${index.toString().padStart(2, '0')}:59`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Số lượng tương tác'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Khung giờ (24h)'
                        }
                    }
                }
            }
        });
            }

            if (weeklyChartElement) {
                this.weeklyChart = new Chart(weeklyChartElement, {
            type: 'bar',
            data: {
                labels: ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
                datasets: [{
                    label: 'Số cuộc gọi & tin nhắn',
                    data: this.weeklyStats,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
            }
            
            console.log('Charts initialized successfully');
        } catch (error) {
            console.error('Error initializing charts:', error);
        }
    }

    analyzeLocations() {
        this.locationStats.clear();
        this.callRecords.forEach(record => {
            if (record.lac && record.cell) {
                const key = `${record.lac}-${record.cell}`;
                if (!this.locationStats.has(key)) {
                    this.locationStats.set(key, {
                        lac: record.lac,
                        cell: record.cell,
                        provinceCode: record.provinceCode,
                        location: record.location,
                        count: 0
                    });
                }
                this.locationStats.get(key).count++;
            }
        });
    }

    updateLocationTable() {
        try {
            const tbody = document.getElementById('locationBody');
            if (!tbody) return;

            const sortedLocations = Array.from(this.locationStats.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 10); // chỉ lấy 10 dòng

            tbody.innerHTML = '';
            sortedLocations.forEach((loc, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${loc.lac || ''}</td>
                    <td>${loc.cell || ''}</td>
                    <td>${loc.provinceCode || ''}</td>
                    <td>${loc.location || ''}</td>
                    <td>${loc.count || ''}</td>
                `;
                tbody.appendChild(row);
            });
        } catch (e) {
            console.error('Error updating location table:', e);
        }
    }

    showAllLocations(page = 1, pageSize = 200) {
        try {
            const modal = document.getElementById('allLocationsModal');
            const tbody = document.getElementById('allLocationsBody');
            if (!modal || !tbody) return;

            const sorted = Array.from(this.locationStats.values())
                .sort((a, b) => b.count - a.count);

            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            const pageData = sorted.slice(start, end);

            tbody.innerHTML = '';
            pageData.forEach((loc, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${start + idx + 1}</td>
                    <td>${loc.lac || ''}</td>
                    <td>${loc.cell || ''}</td>
                    <td>${loc.provinceCode || ''}</td>
                    <td>${loc.location || ''}</td>
                    <td>${loc.count || ''}</td>
                `;
                tbody.appendChild(row);
            });

            modal.style.display = 'block';
        } catch (e) {
            console.error('Error showing all locations:', e);
        }
    }

    hideAllLocations() {
        const modal = document.getElementById('allLocationsModal');
        if (modal) modal.style.display = 'none';
    }
  
    async processFile(file) {
        try {
            console.log('Processing file:', file.name);
            
            // Check if this is an export_all file
            if (this.isExportAllFile(file.name)) {
                console.log('Detected export_all file, using import mode');
                this.currentFileName = file.name;
                this.currentTemplate = 'chuan'; // Set template to "Chuẩn"
                await this.importExportAllFile(file);
                this.showFileInfo(file.name);
                this.showMainContent();
                console.log('Export_all file processing completed successfully');
                return;
            }
            
            // Regular file processing
            const data = await this.readExcelFile(file);
            console.log('File data loaded, rows:', data.length);
            
            // Lưu tên file hiện tại và xóa thông tin hiển thị cũ
            this.currentFileName = file.name;
            this.subscriberInfoDisplay = {}; // Reset thông tin hiển thị khi import file mới
            
            // Reset column map và header row index cho file mới
            this.currentColumnMap = null;
            this.currentHeaderRowIndex = null;
            
            this.data = data;
            
            // Detect template if auto mode is selected
            const templateSelect = document.getElementById('templateSelect');
            if (templateSelect && templateSelect.value === 'auto') {
                this.currentTemplate = this.detectTemplate(data);
                console.log('Auto-detected template:', this.currentTemplate);
                
                // Update the select element to show detected template
                templateSelect.value = this.currentTemplate;
            } else if (templateSelect) {
                this.currentTemplate = templateSelect.value;
                console.log('Manually selected template:', this.currentTemplate);
            }
            
            this.analyzeData();
            this.showFileInfo(file.name);
            this.showMainContent();
            
            console.log('File processing completed successfully');
        } catch (error) {
            console.error('Error processing file:', error);
            this.showToast('Lỗi khi xử lý file: ' + error.message, 'error');
        } finally {
            // 🔥 Reset input để lần sau chọn lại cùng 1 file vẫn nhận
            document.getElementById('fileInput').value = '';
        }
    }

    // Process multiple files
    async processMultipleFiles(files) {
        try {
            if (!files || files.length === 0) {
                console.log('No files to process');
                return;
            }
            
            console.log('Processing files:', files.length);
            
            // Track import errors
            const importErrors = [];
            
            // Add files to filesData map
            let fileIndex = 0;
            for (const file of files) {
                try {
                    fileIndex++;
                    console.log(`Processing file ${fileIndex}/${files.length}: ${file.name}`);
                    
                    // Validate file type
                    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                        console.warn(`File ${file.name} is not a valid Excel file`);
                        importErrors.push({
                            fileName: file.name,
                            error: 'Không phải file Excel hợp lệ (.xlsx hoặc .xls)'
                        });
                        continue;
                    }
                    
                    // Create unique fileId with timestamp, index, and random number to avoid collisions
                    const timestamp = Date.now();
                    const randomStr = Math.random().toString(36).substr(2, 9);
                    const fileId = `${file.name}_${timestamp}_${fileIndex}_${randomStr}`;
                    console.log('Adding file:', file.name, 'with ID:', fileId);
                    
                    // Check if this is an export_all file
                    let suggestedTemplate = 'template1'; // Default
                    if (this.isExportAllFile(file.name)) {
                        // For export_all files, detect network provider from phone number in file name
                        const detectedPhoneNumber = this.detectPhoneNumberFromFileName(file.name);
                        const detectedProvider = detectedPhoneNumber ? this.detectNetworkProvider(detectedPhoneNumber) : null;
                        
                        if (detectedProvider === 'viettel') {
                            suggestedTemplate = 'template1';
                        } else if (detectedProvider === 'vina') {
                            suggestedTemplate = 'template2';
                        } else if (detectedProvider === 'mobi') {
                            suggestedTemplate = 'template3';
                        }
                        // If cannot detect, use 'chuan' as fallback
                        if (!detectedProvider) {
                            suggestedTemplate = 'chuan';
                        }
                        
                        console.log(`Detected export_all file: ${file.name}, phone: ${detectedPhoneNumber}, provider: ${detectedProvider}, template: ${suggestedTemplate}`);
                    } else {
                        // Auto-detect template based on file name (phone number)
                        try {
                            suggestedTemplate = this.detectTemplateFromFileName(file.name);
                            console.log(`Detected template for ${file.name}: ${suggestedTemplate}`);
                        } catch (templateError) {
                            console.warn(`Error detecting template for ${file.name}:`, templateError);
                            // Use default template
                        }
                    }
                    
                    this.filesData.set(fileId, {
                        file: file,
                        fileName: file.name,
                        template: suggestedTemplate, // Auto-detected template
                        data: null,
                        analyzed: false,
                        analyzing: false,
                        subscriberInfo: null,
                        subscriberInfoDisplay: {},
                        callRecords: [],
                        callHistory: new Map(),
                        imeiList: new Set(),
                        contacts: new Map(),
                        hourlyStats: new Array(24).fill(0),
                        weeklyStats: new Array(7).fill(0),
                        locationStats: new Map(),
                        imeiChanges: [],
                        imsiChanges: []
                    });
                    
                    console.log(`✅ Successfully added file: ${file.name}`);
                } catch (error) {
                    console.error(`❌ Error processing file ${file.name}:`, error);
                    importErrors.push({
                        fileName: file.name,
                        error: error.message || 'Lỗi không xác định'
                    });
                }
            }
            
            console.log(`Total files processed: ${this.filesData.size} files in filesData`);
            
            // Display import errors if any
            if (importErrors.length > 0) {
                this.displayImportErrors(importErrors);
            } else {
                // Hide errors container if no errors
                const errorsContainer = document.getElementById('importErrorsContainer');
                if (errorsContainer) {
                    errorsContainer.style.display = 'none';
                }
            }
            
            // Render files list
            try {
                console.log('Rendering files list...');
                this.renderFilesList();
                console.log('Files list rendered successfully');
            } catch (renderError) {
                console.error('Error rendering files list:', renderError);
            }
            
            // Show files list container
            const filesListContainer = document.getElementById('filesListContainer');
            if (filesListContainer) {
                filesListContainer.style.display = 'block';
                console.log('Files list container displayed');
            } else {
                console.error('filesListContainer element not found!');
            }
            
            // Update compare tab dropdowns and counts when new files are imported
            try {
                this.updateCompareFileDropdowns();
                this.updateCompareFileCounts();
            } catch (compareError) {
                console.warn('Error updating compare dropdowns:', compareError);
            }
            
            // Reset file input
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.value = '';
        } catch (error) {
            console.error('Error processing multiple files:', error);
            this.displayImportErrors([{
                fileName: 'Lỗi hệ thống',
                error: error.message || 'Lỗi không xác định'
            }]);
        }
    }
    
    // Display import errors in table
    displayImportErrors(errors) {
        const errorsContainer = document.getElementById('importErrorsContainer');
        const errorsBody = document.getElementById('importErrorsBody');
        
        if (!errorsContainer || !errorsBody) return;
        
        // Clear previous errors
        errorsBody.innerHTML = '';
        
        // Add error rows
        errors.forEach((error, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="text-align: center;">${index + 1}</td>
                <td>${error.fileName}</td>
                <td style="color: #dc2626;">${error.error}</td>
            `;
            errorsBody.appendChild(row);
        });
        
        // Show errors container
        errorsContainer.style.display = 'block';
    }
    
    // Display missing columns errors
    displayMissingColumnsErrors() {
        const errorsContainer = document.getElementById('analysisErrorsContainer');
        const errorsBody = document.getElementById('analysisErrorsBody');
        
        if (!errorsContainer || !errorsBody) return;
        
        if (this.fileMissingColumns.size === 0) {
            // Chỉ ẩn nếu không có lỗi nào (cả analysis errors và missing columns)
            const existingRows = errorsBody.querySelectorAll('tr');
            if (existingRows.length === 0) {
                errorsContainer.style.display = 'none';
            }
            return;
        }
        
        // Lấy số dòng hiện tại để tiếp tục đánh số
        const existingRows = errorsBody.querySelectorAll('tr');
        let errorIndex = existingRows.length + 1;
        
        this.fileMissingColumns.forEach((missingInfo, fileName) => {
            let errorMessage = '';
            
            // Hiển thị cột bắt buộc thiếu
            if (missingInfo.missing && missingInfo.missing.length > 0) {
                errorMessage += `⚠️ Thiếu cột bắt buộc: ${missingInfo.missing.join(', ')}. `;
            }
            
            // Hiển thị cột tùy chọn thiếu (cảnh báo)
            if (missingInfo.warnings && missingInfo.warnings.length > 0) {
                errorMessage += `ℹ️ Cột tùy chọn không tìm thấy (sẽ bỏ qua): ${missingInfo.warnings.join(', ')}. `;
            }
            
            // Hiển thị các cột đã tìm thấy
            if (missingInfo.columnMap && Object.keys(missingInfo.columnMap).length > 0) {
                const foundColumns = Object.values(missingInfo.columnMap)
                    .map(col => col.header)
                    .filter(h => h)
                    .join(', ');
                if (foundColumns) {
                    errorMessage += `✓ Đã tìm thấy: ${foundColumns}`;
                }
            }
            
            if (errorMessage) {
                // Kiểm tra xem đã có row cho file này chưa
                const existingRow = Array.from(existingRows).find(row => {
                    const cells = row.querySelectorAll('td');
                    return cells.length >= 2 && cells[1].textContent === fileName;
                });
                
                if (existingRow) {
                    // Cập nhật row hiện có
                    const errorCell = existingRow.querySelectorAll('td')[2];
                    if (errorCell) {
                        errorCell.innerHTML = `<div>${errorCell.textContent}</div><div style="margin-top: 0.5rem;">${errorMessage}</div>`;
                    }
                } else {
                    // Thêm row mới
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="text-align: center;">${errorIndex}</td>
                        <td>${fileName}</td>
                        <td style="color: #dc2626;">${errorMessage}</td>
                    `;
                    errorsBody.appendChild(row);
                    errorIndex++;
                }
            }
        });
        
        // Show errors container if there are errors
        errorsContainer.style.display = 'block';
    }
    
    // Show delete confirmation modal
    showDeleteConfirmModal(message, onConfirm) {
        const modal = document.getElementById('deleteConfirmModal');
        const messageEl = document.getElementById('deleteConfirmMessage');
        const yesBtn = document.getElementById('deleteConfirmYes');
        const noBtn = document.getElementById('deleteConfirmNo');
        
        if (!modal || !messageEl || !yesBtn || !noBtn) {
            // Fallback to confirm if modal elements not found
            if (confirm(message)) {
                onConfirm();
            }
            return;
        }
        
        // Set message
        messageEl.textContent = message;
        
        // Reset modal state first - hide content
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transform = 'translateY(20px) scale(0.95)';
            modalContent.style.opacity = '0';
        }
        
        // Show modal overlay
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        
        // Force reflow to ensure initial state is applied
        void modal.offsetHeight;
        
        // Trigger animation with double requestAnimationFrame for smooth transition
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
                modal.classList.add('showing');
                
                // Animate content
                if (modalContent) {
                    modalContent.style.transform = 'translateY(0) scale(1)';
                    modalContent.style.opacity = '1';
                }
            });
        });
        
        // Remove previous event listeners by cloning
        const newYesBtn = yesBtn.cloneNode(true);
        const newNoBtn = noBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
        noBtn.parentNode.replaceChild(newNoBtn, noBtn);
        
        // Add event listeners
        newYesBtn.addEventListener('click', () => {
            this.hideDeleteConfirmModal(modal);
            onConfirm();
        });
        
        newNoBtn.addEventListener('click', () => {
            this.hideDeleteConfirmModal(modal);
        });
        
        // Close on overlay click
        const overlayClickHandler = (e) => {
            if (e.target === modal) {
                this.hideDeleteConfirmModal(modal);
                modal.removeEventListener('click', overlayClickHandler);
            }
        };
        modal.addEventListener('click', overlayClickHandler);
    }
    
    // Hide delete confirmation modal with smooth animation
    hideDeleteConfirmModal(modal) {
        if (!modal) return;
        
        const modalContent = modal.querySelector('.modal-content');
        
        // Animate content out first
        if (modalContent) {
            modalContent.style.transform = 'translateY(20px) scale(0.95)';
            modalContent.style.opacity = '0';
        }
        
        // Fade out overlay
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        modal.classList.remove('showing');
        
        // Hide after animation completes
        setTimeout(() => {
            modal.style.display = 'none';
            // Reset content transform for next show
            if (modalContent) {
                modalContent.style.transform = '';
                modalContent.style.opacity = '';
            }
        }, 300);
    }

    // Detect phone number from file name
    detectPhoneNumberFromFileName(fileName) {
        // Extract all numbers from file name
        const numbers = fileName.match(/\d+/g);
        if (!numbers || numbers.length === 0) return null;
        
        // Try to find a phone number (usually 10-11 digits, starting with 0)
        for (const num of numbers) {
            // Check if it looks like a phone number (starts with 0 and has 10-11 digits)
            if (num.startsWith('0') && (num.length === 10 || num.length === 11)) {
                return num;
            }
            // Also check if it's a 9-10 digit number that could be phone number without leading 0
            if (num.length === 9 || num.length === 10) {
                // Check if adding 0 makes it a valid phone number
                const withZero = '0' + num;
                if (this.isValidPhoneNumberPrefix(withZero)) {
                    return withZero;
                }
            }
        }
        
        // If no exact match, try the longest number sequence
        const longestNumber = numbers.reduce((a, b) => a.length > b.length ? a : b);
        if (longestNumber.length >= 9) {
            const withZero = longestNumber.startsWith('0') ? longestNumber : '0' + longestNumber;
            if (this.isValidPhoneNumberPrefix(withZero)) {
                return withZero;
            }
        }
        
        return null;
    }
    
    // Check if phone number has valid network prefix
    isValidPhoneNumberPrefix(phoneNumber) {
        const prefix = phoneNumber.substring(0, 3);
        const viettelPrefixes = ['086', '096', '097', '098', '039', '038', '037', '036', '035', '034', '033', '032'];
        const vinaPrefixes = ['091', '094', '088', '083', '084', '085', '081', '082'];
        const mobiPrefixes = ['070', '079', '077', '076', '078', '089', '090', '093'];
        
        return viettelPrefixes.includes(prefix) || 
               vinaPrefixes.includes(prefix) || 
               mobiPrefixes.includes(prefix);
    }
    
    // Detect network provider from phone number prefix
    detectNetworkProvider(phoneNumber) {
        if (!phoneNumber) return null;
        
        const prefix = phoneNumber.substring(0, 3);
        const viettelPrefixes = ['086', '096', '097', '098', '039', '038', '037', '036', '035', '034', '033', '032'];
        const vinaPrefixes = ['091', '094', '088', '083', '084', '085', '081', '082'];
        const mobiPrefixes = ['070', '079', '077', '076', '078', '089', '090', '093'];
        
        if (viettelPrefixes.includes(prefix)) {
            return 'viettel';
        } else if (vinaPrefixes.includes(prefix)) {
            return 'vina';
        } else if (mobiPrefixes.includes(prefix)) {
            return 'mobi';
        }
        
        return null;
    }
    
    // Get network provider name from phone number
    getNetworkProviderName(phoneNumber) {
        if (!phoneNumber) return null;
        const provider = this.detectNetworkProvider(phoneNumber);
        if (provider === 'viettel') return 'VIETTEL';
        if (provider === 'vina') return 'VINA';
        if (provider === 'mobi') return 'MOBI';
        return null;
    }
    
    // Get network provider from owners list (for comparison tables)
    getNetworkProviderFromOwners(owners) {
        if (!owners || owners.length === 0) return 'N/A';
        // Get first owner phone number
        const firstOwner = owners[0];
        const providerName = this.getNetworkProviderName(firstOwner);
        return providerName || 'N/A';
    }
    
    // Detect template from file name
    detectTemplateFromFileName(fileName) {
        // Extract phone number from file name
        const phoneNumber = this.detectPhoneNumberFromFileName(fileName);
        
        if (!phoneNumber) {
            // Default to template1 (Viettel) if cannot detect
            console.log('Cannot detect phone number from file name:', fileName, '- using default template1');
            return 'template1';
        }
        
        // Detect network provider
        const provider = this.detectNetworkProvider(phoneNumber);
        
        if (provider === 'viettel') {
            console.log('Detected Viettel from file name:', fileName, 'phone:', phoneNumber);
            return 'template1';
        } else if (provider === 'vina') {
            console.log('Detected Vina from file name:', fileName, 'phone:', phoneNumber);
            return 'template2';
        } else if (provider === 'mobi') {
            console.log('Detected Mobi from file name:', fileName, 'phone:', phoneNumber);
            return 'template3';
        }
        
        // Default to template1 if cannot detect provider
        console.log('Cannot detect provider from file name:', fileName, 'phone:', phoneNumber, '- using default template1');
        return 'template1';
    }

    // Render files list with template selectors
    renderFilesList() {
        const filesList = document.getElementById('filesList');
        const filesCount = document.getElementById('filesCount');
        
        if (!filesList) return;
        
        filesList.innerHTML = '';
        
        if (filesCount) {
            filesCount.textContent = this.filesData.size;
        }
        
        this.filesData.forEach((fileData, fileId) => {
            const fileItem = document.createElement('div');
            fileItem.className = `file-item ${fileData.analyzing ? 'analyzing' : ''} ${fileData.analyzed ? 'analyzed' : ''}`;
            fileItem.dataset.fileId = fileId;
            
            fileItem.innerHTML = `
                <div class="file-item-info">
                    <div class="file-item-name">${fileData.fileName}</div>
                    <div class="file-item-status ${fileData.analyzing ? 'analyzing' : fileData.analyzed ? 'analyzed' : ''}">
                        ${fileData.analyzing ? '⏳ Đang phân tích...' : fileData.analyzed ? '✅ Đã phân tích' : '⏳ Chưa phân tích'}
                    </div>
                </div>
                <div class="file-item-template">
                    <select class="template-select-file" data-file-id="${fileId}">
                        <option value="template1" ${fileData.template === 'template1' ? 'selected' : ''}>📄 VIETTEL</option>
                        <option value="template2" ${fileData.template === 'template2' ? 'selected' : ''}>📄 VINA</option>
                        <option value="template3" ${fileData.template === 'template3' ? 'selected' : ''}>📄 MOBI</option>
                    </select>
                </div>
                <div class="file-item-actions">
                    <button class="btn-remove-file" data-file-id="${fileId}">✕</button>
                </div>
            `;
            
            filesList.appendChild(fileItem);
            
            // Add event listeners
            const templateSelect = fileItem.querySelector('.template-select-file');
            if (templateSelect) {
                templateSelect.addEventListener('change', (e) => {
                    const selectedFileId = e.target.dataset.fileId;
                    const fileData = this.filesData.get(selectedFileId);
                    if (fileData) {
                        fileData.template = e.target.value;
                        // If already analyzed, mark as not analyzed to re-analyze
                        if (fileData.analyzed) {
                            fileData.analyzed = false;
                            this.renderFilesList();
                        }
                    }
                });
            }
            
            const removeBtn = fileItem.querySelector('.btn-remove-file');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    this.removeFileFromList(fileId);
                });
            }
        });
    }

    // Remove file from list
    removeFileFromList(fileId) {
        const fileName = this.filesData.get(fileId)?.fileName || 'file này';
        this.showDeleteConfirmModal(
            `Bạn có chắc muốn xóa file "${fileName}"?`,
            () => {
                this.filesData.delete(fileId);
                
                // If it was the current file, clear current view
                if (this.currentFileId === fileId) {
                    this.currentFileId = null;
                    this.loadFileData(null);
                }
                
                this.renderFilesList();
                this.renderFileSelection();
                
                // Hide containers if no files
                if (this.filesData.size === 0) {
                    const filesListContainer = document.getElementById('filesListContainer');
                    const fileSelectionContainer = document.getElementById('fileSelectionContainer');
                    if (filesListContainer) filesListContainer.style.display = 'none';
                    if (fileSelectionContainer) fileSelectionContainer.style.display = 'none';
                }
            }
        );
    }

    // Analyze all files
    async analyzeAllFiles() {
        try {
            const filesToAnalyze = Array.from(this.filesData.entries()).filter(([id, data]) => !data.analyzed && !data.analyzing);
            
            if (filesToAnalyze.length === 0) {
                this.showToast('Tất cả file đã được phân tích!', 'info');
                return;
            }
            
            // Show loading
            const analyzeBtn = document.getElementById('analyzeAllFilesBtn');
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
                analyzeBtn.textContent = '⏳ Đang phân tích...';
            }
            
            // Track analysis errors
            const analysisErrors = [];
            
            // Analyze each file
            for (const [fileId, fileData] of filesToAnalyze) {
                try {
                    // Mark as analyzing
                    fileData.analyzing = true;
                    this.renderFilesList();
                    
                    // Check if this is an export_all file
                    if (this.isExportAllFile(fileData.fileName)) {
                        console.log('Detected export_all file:', fileData.fileName);
                        fileData.template = 'chuan';
                        
                        // Import export_all file
                        const originalTemplate = this.currentTemplate;
                        this.currentTemplate = 'chuan';
                        await this.importExportAllFile(fileData.file);
                        
                        // Store analyzed data
                        fileData.subscriberInfo = this.subscriberInfo;
                        fileData.subscriberInfoDisplay = { ...this.subscriberInfoDisplay };
                        fileData.callRecords = [...this.callRecords];
                        fileData.callHistory = new Map(this.callHistory);
                        fileData.imeiList = new Set(this.imeiList);
                        fileData.contacts = new Map(this.contacts);
                        fileData.hourlyStats = [...this.hourlyStats];
                        fileData.weeklyStats = [...this.weeklyStats];
                        fileData.locationStats = new Map(this.locationStats);
                        fileData.imeiChanges = [...this.imeiChanges];
                        fileData.imsiChanges = [...this.imsiChanges];
                        fileData.analyzed = true;
                        fileData.analyzing = false;
                        
                        // Restore original template
                        this.currentTemplate = originalTemplate;
                        continue;
                    }
                    
                    // Regular file processing
                    // Read file
                    const data = await this.readExcelFile(fileData.file);
                    fileData.data = data;
                    
                    // Detect or use selected template
                    if (fileData.template === 'auto') {
                        fileData.template = this.detectTemplate(data);
                    }
                    
                    // Set current template and file name temporarily for analysis
                    const originalTemplate = this.currentTemplate;
                    const originalFileName = this.currentFileName;
                    this.currentTemplate = fileData.template;
                    this.currentFileName = fileData.fileName;
                    
                    // Reset column map for this file
                    this.currentColumnMap = null;
                    this.currentHeaderRowIndex = null;
                    
                    // Analyze data
                    this.data = data;
                    this.analyzeData();
                    
                    // Restore original file name
                    this.currentFileName = originalFileName;
                    
                    // Store analyzed data
                    fileData.subscriberInfo = this.subscriberInfo;
                    fileData.callRecords = [...this.callRecords];
                    fileData.callHistory = new Map(this.callHistory);
                    fileData.imeiList = new Set(this.imeiList);
                    fileData.contacts = new Map(this.contacts);
                    fileData.hourlyStats = [...this.hourlyStats];
                    fileData.weeklyStats = [...this.weeklyStats];
                    fileData.locationStats = new Map(this.locationStats);
                    fileData.imeiChanges = [...this.imeiChanges];
                    fileData.imsiChanges = [...this.imsiChanges];
                    fileData.analyzed = true;
                    fileData.analyzing = false;
                    
                    // Restore original template
                    this.currentTemplate = originalTemplate;
                    
                    console.log(`✅ Successfully analyzed file: ${fileData.fileName}`);
                    
                } catch (error) {
                    console.error(`❌ Error analyzing file ${fileData.fileName}:`, error);
                    fileData.analyzed = false;
                    fileData.analyzing = false;
                    // Store error instead of showing alert
                    analysisErrors.push({
                        fileName: fileData.fileName,
                        error: error.message || 'Lỗi không xác định'
                    });
                }
            }
            
            // Display analysis errors if any
            if (analysisErrors.length > 0) {
                this.displayAnalysisErrors(analysisErrors);
            }
            
            // Display missing columns errors (sẽ hiển thị cả khi không có lỗi phân tích)
            this.displayMissingColumnsErrors();
            
            // Update UI
            this.renderFilesList();
            this.renderFileSelection();
            
            // Update compare tab dropdowns and counts after analysis
            this.updateCompareFileDropdowns();
            this.updateCompareFileCounts();
            
            // Show file selection container
            const fileSelectionContainer = document.getElementById('fileSelectionContainer');
            if (fileSelectionContainer && this.filesData.size > 0) {
                const hasAnalyzed = Array.from(this.filesData.values()).some(f => f.analyzed === true);
                if (hasAnalyzed) {
                    fileSelectionContainer.style.display = 'block';
                }
            }
            
            // Reset button
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = '🚀 Phân tích tất cả';
            }
            
        } catch (error) {
            console.error('Error analyzing all files:', error);
            this.displayAnalysisErrors([{
                fileName: 'Lỗi hệ thống',
                error: error.message || 'Lỗi không xác định'
            }]);
            
            const analyzeBtn = document.getElementById('analyzeAllFilesBtn');
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = '🚀 Phân tích tất cả';
            }
        }
    }
    
    // Display analysis errors in table
    displayAnalysisErrors(errors) {
        const errorsContainer = document.getElementById('analysisErrorsContainer');
        const errorsBody = document.getElementById('analysisErrorsBody');
        
        if (!errorsContainer || !errorsBody) return;
        
        // Clear previous errors
        errorsBody.innerHTML = '';
        
        // Add error rows
        errors.forEach((error, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="text-align: center;">${index + 1}</td>
                <td>${error.fileName}</td>
                <td style="color: #dc2626;">${error.error}</td>
            `;
            errorsBody.appendChild(row);
        });
        
        // Show errors container
        errorsContainer.style.display = 'block';
    }

    // Render file selection list
    renderFileSelection() {
        const fileSelectionList = document.getElementById('fileSelectionList');
        if (!fileSelectionList) return;
        
        fileSelectionList.innerHTML = '';
        
        const analyzedFiles = Array.from(this.filesData.entries()).filter(([id, data]) => data.analyzed === true);
        
        if (analyzedFiles.length === 0) return;
        
        analyzedFiles.forEach(([fileId, fileData]) => {
            const selectionItem = document.createElement('div');
            selectionItem.className = `file-selection-item ${this.currentFileId === fileId ? 'active' : ''}`;
            selectionItem.dataset.fileId = fileId;
            
            const recordCount = fileData.callRecords.length;
            const contactCount = fileData.contacts.size;
            const imeiCount = fileData.imeiList.size;
            
            selectionItem.innerHTML = `
                <div class="file-selection-item-name" title="${fileData.fileName}">${fileData.fileName}</div>
                <div class="file-selection-item-info">
                    📞 ${recordCount} cuộc gọi | 👥 ${contactCount} liên lạc | 📱 ${imeiCount} IMEI
                </div>
            `;
            
            selectionItem.title = fileData.fileName; // Tooltip cho toàn bộ item
            
            selectionItem.addEventListener('click', () => {
                this.selectFileToView(fileId);
            });
            
            fileSelectionList.appendChild(selectionItem);
        });
    }

    // Select file to view
    selectFileToView(fileId) {
        this.currentFileId = fileId;
        this.loadFileData(fileId);
        this.renderFileSelection();
    }

    // Load file data into current view
    loadFileData(fileId) {
        if (!fileId) {
            // Clear current view
            this.data = null;
            this.subscriberInfo = null;
            this.currentFileName = null;
            this.subscriberInfoDisplay = {};
            this.callRecords = [];
            this.callHistory.clear();
            this.imeiList.clear();
            this.contacts.clear();
            this.hourlyStats.fill(0);
            this.weeklyStats.fill(0);
            this.locationStats.clear();
            this.imeiChanges = [];
            this.imsiChanges = [];
            
            // Clear time-based data structures
            this.contactsWithTimeData.clear();
            this.locationsWithTimeData.clear();
            this.filteredContactsByTime.clear();
            this.filteredLocationsByTime.clear();
            
            // Show file manager
            this.showFileManager();
            
            return;
        }
        
        const fileData = this.filesData.get(fileId);
        if (!fileData || !fileData.analyzed) {
            this.showToast('File chưa được phân tích!', 'warning');
            return;
        }
        
        // Load data
        this.data = fileData.data;
        this.currentFileName = fileData.fileName;
        this.currentTemplate = fileData.template;
        this.subscriberInfo = fileData.subscriberInfo;
        this.subscriberInfoDisplay = fileData.subscriberInfoDisplay || {};
        this.callRecords = [...fileData.callRecords];
        this.callHistory = new Map(fileData.callHistory);
        this.imeiList = new Set(fileData.imeiList);
        this.contacts = new Map(fileData.contacts);
        this.hourlyStats = [...fileData.hourlyStats];
        this.weeklyStats = [...fileData.weeklyStats];
        this.locationStats = new Map(fileData.locationStats);
        this.imeiChanges = [...fileData.imeiChanges];
        this.imsiChanges = [...fileData.imsiChanges];
        
        // Clear and rebuild time-based data structures for current file only
        this.contactsWithTimeData.clear();
        this.locationsWithTimeData.clear();
        this.filteredContactsByTime.clear();
        this.filteredLocationsByTime.clear();
        
        // Rebuild time-based data from current file's call records
        this.rebuildTimeBasedData();
        
        // Reset column map (sẽ được rebuild nếu cần phân tích lại)
        this.currentColumnMap = null;
        this.currentHeaderRowIndex = null;
        
        // Update UI
        this.updateSubscriberInfo();
        this.updateCallHistoryTable();
        this.updateIMEITable();
        this.updateContactsTable();
        this.updateLocationTable();
        this.updateChangesLog();
        this.updateCharts();
        this.showFileInfo(fileData.fileName);
        
        // Switch to analysis view
        this.showMainContent();
    }

    // Clear all files
    clearAllFiles() {
        this.showDeleteConfirmModal(
            'Bạn có chắc muốn xóa tất cả file? Hành động này không thể hoàn tác!',
            () => {
                this.filesData.clear();
                this.currentFileId = null;
                this.loadFileData(null);
                this.renderFilesList();
                this.renderFileSelection();
                
                const filesListContainer = document.getElementById('filesListContainer');
                const fileSelectionContainer = document.getElementById('fileSelectionContainer');
                if (filesListContainer) filesListContainer.style.display = 'none';
                if (fileSelectionContainer) fileSelectionContainer.style.display = 'none';
            }
        );
    }

    // Detect template automatically (improved with flexible detection)
    detectTemplate(data) {
        try {
            // Bước 1: Tìm header row
            const headerRowIndex = this.findHeaderRow(data);
            const headerRow = data[headerRowIndex] || [];
            
            // Bước 2: Build column map
            const columnMap = this.buildColumnMap(headerRow);
            
            // Bước 3: Validate columns
            const validation = this.validateColumns(columnMap);
            
            // Log column mapping for debugging
            console.log('Column mapping:', columnMap);
            if (validation.warnings.length > 0) {
                console.warn('Column warnings:', validation.warnings);
            }
            
            // Bước 4: Detect template by pattern
            const detectedTemplate = this.detectTemplateByPattern(data, columnMap);
            
            // Lưu column map và header row index để sử dụng sau
            this.currentColumnMap = columnMap;
            this.currentHeaderRowIndex = headerRowIndex;
            
            console.log('Detected template:', detectedTemplate);
            console.log('Header row index:', headerRowIndex);
            
            // Fallback: Nếu không detect được bằng pattern, dùng logic cũ
            if (!validation.valid && detectedTemplate === 'template1') {
                // Thử detect bằng logic cũ
                if (this.hasTemplate1Structure(data)) {
                    return 'template1';
                }
                if (this.hasTemplate3Structure(data)) {
                    return 'template3';
                }
                if (this.hasTemplate2Structure(data)) {
                    return 'template2';
                }
            }
            
            return detectedTemplate;
            
        } catch (error) {
            console.error('Error detecting template:', error);
            // Fallback to old method
            if (this.hasTemplate1Structure(data)) {
                return 'template1';
            }
            if (this.hasTemplate3Structure(data)) {
                return 'template3';
            }
            if (this.hasTemplate2Structure(data)) {
                return 'template2';
            }
            return 'template1';
        }
    }

    // Check if data has Template 1 structure
    hasTemplate1Structure(data) {
        try {
            // Check if C5, C7, C8 have values (subscriber info)
            const hasSubscriberInfo = data[4] && data[4][2] && // C5
                                    data[6] && data[6][2] && // C7
                                    data[7] && data[7][2];   // C8
            
            // Check if row 22 has data (call records start)
            const hasCallRecords = data[21] && data[21].length > 0;
            
            return hasSubscriberInfo && hasCallRecords;
        } catch (error) {
            return false;
        }
    }

    // Helper function to check if a value matches STT patterns (STT, Số thứ tự, Số Thứ Tự)
    isSTTPattern(value) {
        if (!value) return false;
        const str = String(value).trim();
        const strUpper = str.toUpperCase();
        const strLower = str.toLowerCase();
        // Check for "STT" (case insensitive)
        if (strUpper.includes('STT')) return true;
        // Check for "Số thứ tự" (various cases)
        if (strLower.includes('số thứ tự') || strLower.includes('so thu tu')) return true;
        return false;
    }

    // Check if data has Template 3 structure (STT format)
    hasTemplate3Structure(data) {
        try {
            // Look for "STT", "Số thứ tự", "Số Thứ Tự" in any row
            for (let i = 0; i < Math.min(10, data.length); i++) {
                const row = data[i] || [];
                for (let j = 0; j < row.length; j++) {
                    if (this.isSTTPattern(row[j])) {
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // Check if data has Template 2 structure (a_subs, b_subs)
    hasTemplate2Structure(data) {
        try {
            // Tìm header row (có thể ở dòng đầu hoặc các dòng sau)
            let headerRow = null;
            let headerRowIndex = -1;
            
            // Tìm trong 10 dòng đầu
            for (let i = 0; i < Math.min(10, data.length); i++) {
                const row = data[i] || [];
                if (row.length < 3) continue;
                
                // Kiểm tra xem dòng này có chứa các cột a_subs, b_subs không
                let foundASubs = false;
                let foundBSubs = false;
                let foundImsi = false;
                let foundImei = false;
                
                for (let j = 0; j < row.length; j++) {
                    const cellValue = String(row[j] || '').toLowerCase().trim();
                    
                    // Kiểm tra các pattern cho a_subs
                    if (cellValue.includes('a_subs') || cellValue.includes('a-subs') || 
                        cellValue.includes('a subs')) {
                        foundASubs = true;
                    }
                    
                    // Kiểm tra các pattern cho b_subs
                    if (cellValue.includes('b_subs') || cellValue.includes('b-subs') || 
                        cellValue.includes('b subs')) {
                        foundBSubs = true;
                    }
                    
                    // Kiểm tra imsi
                    if (cellValue.includes('imsi')) {
                        foundImsi = true;
                    }
                    
                    // Kiểm tra imei
                    if (cellValue.includes('imei')) {
                        foundImei = true;
                    }
                }
                
                // Nếu tìm thấy cả a_subs và b_subs, đây là header row
                if (foundASubs && foundBSubs) {
                    headerRow = row;
                    headerRowIndex = i;
                    // Không cần kiểm tra imsi và imei vì chúng là optional
                    break;
                }
            }
            
            return headerRow !== null;
        } catch (error) {
            console.error('Error checking Template 2 structure:', error);
            return false;
        }
    }

    // ========== FLEXIBLE COLUMN DETECTION SYSTEM ==========
    
    // Find header row by analyzing content
    findHeaderRow(data) {
        try {
            // Tìm trong 30 dòng đầu (để bao phủ cả trường hợp header ở dòng 22)
            let bestRow = -1;
            let bestScore = 0;
            
            // Keywords liên quan đến cột dữ liệu (quan trọng hơn)
            const dataColumnKeywords = [
                'số đi', 'số đến', 'số gọi', 'số nhận', 'số chủ', 'số liên hệ',
                'thời gian', 'ngày giờ', 'datetime', 'date', 'time',
                'imei', 'imsi',
                'lac', 'cell', 'cid', 'số cell',
                'mã tỉnh', 'province', 'tỉnh',
                'giây', 'thời lượng', 'duration',
                'type', 'direction', 'loại', 'loại cuộc gọi',
                'địa chỉ trạm', 'location', 'station', 'trạm', 'bts',
                'stt', '#'
            ];
            
            // Keywords của tiêu đề báo cáo (cần loại bỏ)
            const reportTitleKeywords = [
                'báo cáo', 'chi tiết', 'lịch sử', 'liên lạc', 'thuê bao',
                'report', 'detail', 'history', 'subscriber'
            ];
            
            for (let i = 0; i < Math.min(30, data.length); i++) {
                const row = data[i] || [];
                if (row.length === 0) continue;
                
                let dataKeywordCount = 0;
                let reportTitleCount = 0;
                let cellCount = 0;
                let hasMultipleDataColumns = false;
                
                row.forEach(cell => {
                    if (cell !== null && cell !== undefined && cell !== '') {
                        const cellStr = String(cell).toLowerCase().trim();
                        
                        // Bỏ qua cell rỗng hoặc chỉ có ký tự đặc biệt
                        if (cellStr.length < 2) return;
                        
                        cellCount++;
                        
                        // Kiểm tra keywords của cột dữ liệu
                        dataColumnKeywords.forEach(keyword => {
                            if (cellStr.includes(keyword)) {
                                dataKeywordCount++;
                            }
                        });
                        
                        // Kiểm tra keywords của tiêu đề báo cáo
                        reportTitleKeywords.forEach(keyword => {
                            if (cellStr.includes(keyword)) {
                                reportTitleCount++;
                            }
                        });
                    }
                });
                
                // Tính điểm: ưu tiên dòng có nhiều keywords dữ liệu và ít keywords tiêu đề
                // Và phải có ít nhất 5 cột để đảm bảo là header row thực sự
                if (cellCount >= 5) {
                    const score = dataKeywordCount * 10 - reportTitleCount * 5 + (cellCount > 8 ? 5 : 0);
                    
                    // Nếu có ít nhất 3 keywords dữ liệu, đây có thể là header row
                    if (dataKeywordCount >= 3 && score > bestScore) {
                        bestScore = score;
                        bestRow = i;
                        hasMultipleDataColumns = true;
                    }
                }
            }
            
            // Nếu tìm thấy header row tốt, trả về
            if (bestRow >= 0 && bestScore > 20) {
                console.log(`Found header row at index ${bestRow} with score ${bestScore}`);
                return bestRow;
            }
            
            // Fallback: Tìm lại với tiêu chí thấp hơn
            for (let i = 0; i < Math.min(30, data.length); i++) {
                const row = data[i] || [];
                if (row.length < 3) continue;
                
                let keywordCount = 0;
                const keywords = ['số', 'imei', 'imsi', 'lac', 'cell', 'thời gian', 'giây'];
                
                row.forEach(cell => {
                    if (cell !== null && cell !== undefined && cell !== '') {
                        const cellStr = String(cell).toLowerCase().trim();
                        keywords.forEach(keyword => {
                            if (cellStr.includes(keyword)) {
                                keywordCount++;
                            }
                        });
                    }
                });
                
                if (keywordCount >= 2 && row.length >= 5) {
                    console.log(`Found header row at index ${i} (fallback)`);
                    return i;
                }
            }
            
            // Fallback cuối cùng: dòng đầu tiên
            console.log('Using first row as header (final fallback)');
            return 0;
        } catch (error) {
            console.error('Error finding header row:', error);
            return 0;
        }
    }

    // Calculate string similarity using Levenshtein distance
    stringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Calculate Levenshtein distance between two strings
    levenshteinDistance(str1, str2) {
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;
        
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,     // deletion
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j - 1] + 1  // substitution
                    );
                }
            }
        }
        
        return matrix[len1][len2];
    }

    // Calculate match score between text and keywords
    calculateMatchScore(text, keywords) {
        let maxScore = 0;
        const textLower = text.toLowerCase().trim();
        
        keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            
            // Exact match
            if (textLower === keywordLower) {
                maxScore = Math.max(maxScore, 1.0);
            }
            // Contains match (one contains the other)
            else if (textLower.includes(keywordLower) || keywordLower.includes(textLower)) {
                const longer = textLower.length > keywordLower.length ? textLower : keywordLower;
                const shorter = textLower.length > keywordLower.length ? keywordLower : textLower;
                const ratio = shorter.length / longer.length;
                maxScore = Math.max(maxScore, 0.7 + ratio * 0.2); // 0.7-0.9
            }
            // Word match (contains as whole word)
            else {
                const words = textLower.split(/[\s_\-]+/);
                words.forEach(word => {
                    if (word === keywordLower) {
                        maxScore = Math.max(maxScore, 0.9);
                    } else if (word.includes(keywordLower) || keywordLower.includes(word)) {
                        maxScore = Math.max(maxScore, 0.8);
                    }
                });
            }
            
            // Similarity check (for typos)
            const similarity = this.stringSimilarity(textLower, keywordLower);
            if (similarity > 0.6 && similarity > maxScore) {
                maxScore = Math.max(maxScore, similarity * 0.9);
            }
        });
        
        return maxScore;
    }

    // Build column map based on header row with fuzzy matching
    buildColumnMap(headerRow) {
        const columnMap = {};
        
        // Định nghĩa patterns cho từng loại cột (bao gồm keywords cho VIETTEL)
        const columnPatterns = {
            sourceNumber: {
                keywords: ['a_subs', 'a-subs', 'a subs', 'source', 'số gọi', 'caller', 'from', 'người gọi', 'số điện thoại gọi', 'phone caller', 'caller number', 'số gọi đi', 'số chủ gọi', 'số thuê bao gọi', 'số đi'],
                required: true,
                aliases: ['sourceNumber', 'source_number', 'caller_number', 'a_subs']
            },
            targetNumber: {
                keywords: ['b_subs', 'b-subs', 'b subs', 'target', 'số nhận', 'called', 'to', 'người nhận', 'số điện thoại nhận', 'phone called', 'called number', 'số nhận cuộc gọi', 'số thuê bao nhận', 'số liên hệ', 'số đến'],
                required: true,
                aliases: ['targetNumber', 'target_number', 'called_number', 'b_subs']
            },
            timestamp: {
                keywords: ['date', 'time', 'timestamp', 'thời gian', 'ngày giờ', 'datetime', 'date_time', 'thời điểm', 'ngày tháng giờ', 'thời điểm cuộc gọi'],
                required: true,
                aliases: ['timestamp', 'datetime', 'date_time']
            },
            date: {
                keywords: ['date', 'ngày', 'ngày tháng', 'ngày_tháng', 'date_value', 'ngày tháng năm', 'ngay', 'ngay thang'],
                required: false,
                aliases: ['date']
            },
            time: {
                keywords: ['time', 'giờ', 'thời gian', 'hour', 'gio', 'thoi gian', 'thời_gian', 'time_value', 'giá trị thời gian'],
                required: false,
                aliases: ['time']
            },
            imei: {
                keywords: ['imei', 'imei số', 'số imei'],
                required: false,
                aliases: ['imei']
            },
            imsi: {
                keywords: ['imsi', 'imsi số', 'số imsi'],
                required: false,
                aliases: ['imsi']
            },
            duration: {
                keywords: ['duration', 'thời lượng', 'thời gian cuộc gọi', 'call duration', 'duration_sec', 'thời lượng (giây)', 'thời lượng cuộc gọi', 'giây'],
                required: false,
                aliases: ['duration', 'call_duration']
            },
            callType: {
                keywords: ['rec_type', 'call_type', 'calltype', 'loại cuộc gọi', 'type', 'call type', 'loại', 'loại cuộc gọi', 'hướng cuộc gọi', 'direction'],
                required: false,
                aliases: ['callType', 'call_type', 'rec_type']
            },
            location: {
                keywords: ['cell_name', 'location', 'địa điểm', 'vị trí', 'station', 'station_name', 'trạm', 'tên trạm', 'trạm bts', 'địa chỉ', 'vị trí trạm', 'địa chỉ trạm', 'địa chỉ trạm bts'],
                required: false,
                aliases: ['location', 'station_name', 'cell_name']
            },
            lac: {
                keywords: ['lac', 'lac code', 'mã lac'],
                required: false,
                aliases: ['lac']
            },
            cell: {
                keywords: ['cellid', 'cell_id', 'cell', 'cell code', 'mã cell', 'cid', 'số cell'],
                required: false,
                aliases: ['cell', 'cell_id', 'cellid']
            },
            provinceCode: {
                keywords: ['province', 'province_code', 'mã tỉnh', 'tỉnh', 'mã tỉnh thành', 'province code'],
                required: false,
                aliases: ['provinceCode', 'province_code']
            },
            serviceType: {
                keywords: ['service', 'service_type', 'loại dịch vụ', 'dịch vụ', 'service type', 'loại dịch vụ sử dụng'],
                required: false,
                aliases: ['serviceType', 'service_type']
            }
        };
        
        headerRow.forEach((header, index) => {
            if (header === null || header === undefined || header === '') return;
            
            const headerStr = String(header).trim();
            if (headerStr === '') return;
            
            const headerLower = headerStr.toLowerCase();
            
            // Tìm pattern phù hợp nhất
            for (const [fieldName, pattern] of Object.entries(columnPatterns)) {
                const matchScore = this.calculateMatchScore(headerLower, pattern.keywords);
                
                // Threshold: 0.5 để cho phép một số sai lệch
                if (matchScore > 0.5) {
                    // Nếu chưa có mapping hoặc score cao hơn
                    if (!columnMap[fieldName] || matchScore > columnMap[fieldName].score) {
                        columnMap[fieldName] = {
                            index: index,
                            header: headerStr,
                            score: matchScore,
                            required: pattern.required
                        };
                    }
                }
            }
        });
        
        return columnMap;
    }

    // Validate required columns
    validateColumns(columnMap) {
        const requiredFields = ['sourceNumber', 'targetNumber', 'timestamp'];
        const missing = [];
        const warnings = [];
        
        // Mapping tên field sang tên hiển thị
        const fieldDisplayNames = {
            'sourceNumber': 'Số gọi đi / Số chủ gọi',
            'targetNumber': 'Số nhận / Số liên hệ',
            'timestamp': 'Thời gian / Ngày giờ',
            'imei': 'IMEI',
            'imsi': 'IMSI',
            'duration': 'Thời lượng',
            'callType': 'Loại cuộc gọi',
            'location': 'Vị trí / Tên trạm',
            'lac': 'LAC',
            'cell': 'Cell / CID',
            'provinceCode': 'Mã tỉnh',
            'serviceType': 'Loại dịch vụ'
        };
        
        requiredFields.forEach(field => {
            if (!columnMap[field]) {
                missing.push(fieldDisplayNames[field] || field);
            }
        });
        
        // Optional fields
        const optionalFields = ['imei', 'imsi', 'duration', 'callType', 'location', 'lac', 'cell', 'provinceCode', 'serviceType'];
        optionalFields.forEach(field => {
            if (!columnMap[field]) {
                const displayName = fieldDisplayNames[field] || field;
                warnings.push(displayName);
            }
        });
        
        return {
            valid: missing.length === 0,
            missing: missing,
            warnings: warnings,
            columnMap: columnMap
        };
    }

    // Detect template by pattern (improved version)
    detectTemplateByPattern(data, columnMap) {
        try {
            // Template 2: Có a_subs, b_subs trong header
            if (columnMap.sourceNumber && columnMap.targetNumber) {
                const sourceHeader = columnMap.sourceNumber.header.toLowerCase();
                const targetHeader = columnMap.targetNumber.header.toLowerCase();
                
                if (sourceHeader.includes('a_subs') || sourceHeader.includes('a-subs') || 
                    sourceHeader.includes('a subs')) {
                    return 'template2';
                }
            }
            
            // Template 3: Có "STT", "Số thứ tự", "Số Thứ Tự" trong header hoặc trong data
            const hasSTT = Object.values(columnMap).some(col => 
                col.header && this.isSTTPattern(col.header)
            );
            
            if (!hasSTT) {
                // Tìm STT trong data
                for (let i = 0; i < Math.min(10, data.length); i++) {
                    const row = data[i] || [];
                    for (let j = 0; j < row.length; j++) {
                        if (this.isSTTPattern(row[j])) {
                            return 'template3';
                        }
                    }
                }
            } else {
                return 'template3';
            }
            
            // Template 1: Có subscriber info ở các ô cố định hoặc không có header rõ ràng
            // Kiểm tra nếu có subscriber info ở vị trí cố định
            if (data[4] && data[4][2] && data[6] && data[6][2] && data[7] && data[7][2]) {
                return 'template1';
            }
            
            // Default: Template 1
            return 'template1';
        } catch (error) {
            console.error('Error detecting template by pattern:', error);
            return 'template1';
        }
    }

    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Lỗi đọc file'));
            reader.readAsArrayBuffer(file);
        });
    }

    // Read Excel file with all sheets
    async readExcelFileWithSheets(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheets = {};
                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet);
                    });
                    resolve(sheets);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Lỗi đọc file'));
            reader.readAsArrayBuffer(file);
        });
    }

    // Check if file is export_all file
    isExportAllFile(fileName) {
        if (!fileName) return false;
        const lowerFileName = fileName.toLowerCase();
        return lowerFileName.includes('export_all') || lowerFileName.includes('export-all');
    }

    // Import export_all file and restore data
    async importExportAllFile(file) {
        try {
            console.log('Importing export_all file:', file.name);
            const sheets = await this.readExcelFileWithSheets(file);
            
            // Detect phone number and network provider from file name
            const detectedPhoneNumber = this.detectPhoneNumberFromFileName(file.name);
            const detectedProvider = detectedPhoneNumber ? this.detectNetworkProvider(detectedPhoneNumber) : null;
            let networkProviderName = '';
            let suggestedTemplate = 'template1'; // Default to Viettel
            
            if (detectedProvider === 'viettel') {
                networkProviderName = 'VIETTEL';
                suggestedTemplate = 'template1';
            } else if (detectedProvider === 'vina') {
                networkProviderName = 'VINA';
                suggestedTemplate = 'template2';
            } else if (detectedProvider === 'mobi') {
                networkProviderName = 'MOBI';
                suggestedTemplate = 'template3';
            }
            
            console.log('Detected from file name:', {
                phoneNumber: detectedPhoneNumber,
                provider: detectedProvider,
                networkProviderName: networkProviderName,
                suggestedTemplate: suggestedTemplate
            });
            
            // Reset all data
            this.subscriberInfo = null;
            this.subscriberInfoDisplay = {};
            this.callRecords = [];
            this.callHistory = new Map();
            this.imeiList = new Set();
            this.contacts = new Map();
            this.locationStats = new Map();
            this.hourlyStats = new Array(24).fill(0);
            this.weeklyStats = new Array(7).fill(0);
            this.imeiChanges = [];
            this.imsiChanges = [];
            
            // Set current template based on detected provider
            this.currentTemplate = suggestedTemplate;
            
            // Sheet 1: Thông tin thuê bao (TTTB)
            if (sheets['TTTB'] && sheets['TTTB'].length > 0) {
                const subscriberRow = sheets['TTTB'][0];
                this.subscriberInfo = {
                    phoneNumber: subscriberRow['Số điện thoại'] || detectedPhoneNumber || '',
                    name: subscriberRow['Họ tên chủ thuê bao'] || '',
                    birthDate: subscriberRow['Ngày sinh'] || '',
                    address: subscriberRow['Địa chỉ'] || '',
                    idNumber: subscriberRow['Số giấy tờ tùy thân'] || '',
                    idIssueDate: subscriberRow['Ngày cấp ID'] || '',
                    activationDate: subscriberRow['Ngày kích hoạt'] || '',
                    startDate: '',
                    endDate: '',
                    networkProvider: networkProviderName // Thêm thông tin nhà mạng
                };
                // Copy to display info
                this.subscriberInfoDisplay = { ...this.subscriberInfo };
                console.log('Restored subscriber info:', this.subscriberInfo);
            } else if (detectedPhoneNumber) {
                // If no TTTB sheet but detected phone number, create basic subscriber info
                this.subscriberInfo = {
                    phoneNumber: detectedPhoneNumber,
                    name: '',
                    birthDate: '',
                    address: '',
                    idNumber: '',
                    idIssueDate: '',
                    activationDate: '',
                    startDate: '',
                    endDate: '',
                    networkProvider: networkProviderName
                };
                this.subscriberInfoDisplay = { ...this.subscriberInfo };
            }
            
            // Sheet 2: Lịch sử cuộc gọi (LIST)
            if (sheets['LIST'] && sheets['LIST'].length > 0) {
                this.callRecords = sheets['LIST'].map((row, index) => {
                    const ownerPhone = row['Số chủ'] || '';
                    const contactNumber = row['Số liên hệ'] || '';
                    let timestamp = row['Thời gian'] || '';
                    const duration = row['Thời lượng'] || '';
                    const imei = row['IMEI'] || '';
                    const provinceCode = row['Mã tỉnh'] || '';
                    const callType = row['Loại'] || '';
                    const serviceType = row['Dịch vụ'] || '';
                    const location = row['Địa chỉ'] || '';
                    const lac = row['LAC'] || '';
                    const cell = row['Cell'] || '';
                    
                    // Parse timestamp from export_all file
                    // Excel may return Date object, string, or Excel serial number
                    if (timestamp) {
                        if (timestamp instanceof Date) {
                            // If it's already a Date object, format it to dd/mm/yyyy hh:mm:ss
                            const day = timestamp.getDate().toString().padStart(2, '0');
                            const month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
                            const year = timestamp.getFullYear();
                            const hours = timestamp.getHours().toString().padStart(2, '0');
                            const minutes = timestamp.getMinutes().toString().padStart(2, '0');
                            const seconds = timestamp.getSeconds().toString().padStart(2, '0');
                            timestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                        } else if (typeof timestamp === 'number') {
                            // Excel serial number - convert to date string
                            const parsed = this.parseExcelDateTime(timestamp);
                            timestamp = parsed || timestamp.toString();
                        } else if (typeof timestamp === 'string') {
                            // String format - try to parse and normalize
                            // First check if it's already in dd/mm/yyyy format
                            if (timestamp.includes('/') && /^\d{2}\/\d{2}\/\d{4}/.test(timestamp)) {
                                // Already in correct format, keep as is
                                // But ensure it has time component
                                if (!timestamp.includes(' ')) {
                                    timestamp = timestamp + ' 00:00:00';
                                }
                            } else {
                                // Try to parse using parseExcelDateTime
                                const parsed = this.parseExcelDateTime(timestamp);
                                if (parsed && parsed !== timestamp) {
                                    timestamp = parsed;
                                } else {
                                    // If parseExcelDateTime didn't change it, try parseDateFromTimestamp
                                    const date = this.parseDateFromTimestamp(timestamp);
                                    if (date && !isNaN(date.getTime())) {
                                        // Format to dd/mm/yyyy hh:mm:ss
                                        const day = date.getDate().toString().padStart(2, '0');
                                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                        const year = date.getFullYear();
                                        const hours = date.getHours().toString().padStart(2, '0');
                                        const minutes = date.getMinutes().toString().padStart(2, '0');
                                        const seconds = date.getSeconds().toString().padStart(2, '0');
                                        timestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Determine direction based on call type
                    let direction = 'outgoing';
                    if (callType.includes('đến') || callType.includes('incoming')) {
                        direction = 'incoming';
                    }
                    
                    // Determine source and target numbers
                    let sourceNumber = ownerPhone;
                    let targetNumber = contactNumber;
                    if (direction === 'incoming') {
                        sourceNumber = contactNumber;
                        targetNumber = ownerPhone;
                    }
                    
                    return {
                        tt: index + 1,
                        sourceNumber: sourceNumber,
                        targetNumber: targetNumber,
                        contactNumber: contactNumber,
                        timestamp: timestamp,
                        duration: duration,
                        imei: imei,
                        provinceCode: provinceCode,
                        callType: callType,
                        callTypeReadable: callType,
                        serviceType: serviceType,
                        service: serviceType,
                        location: location,
                        address: location,
                        lac: lac,
                        cell: cell,
                        direction: direction
                    };
                });
                
                // Rebuild callHistory map
                this.callHistory = new Map();
                this.callRecords.forEach(record => {
                    const contact = record.contactNumber || '';
                    if (contact) {
                        if (!this.callHistory.has(contact)) {
                            this.callHistory.set(contact, []);
                        }
                        this.callHistory.get(contact).push(record);
                    }
                });
                
                console.log('Restored call records:', this.callRecords.length);
            }
            
            // Sheet 3: Số liên lạc (Contact)
            if (sheets['Contact'] && sheets['Contact'].length > 0) {
                sheets['Contact'].forEach(row => {
                    const phoneNumber = row['Số điện thoại'] || '';
                    const frequency = parseInt(row['Tần suất']) || 0;
                    const zalo = row['Zalo'] || '';
                    const facebook = row['Facebook'] || '';
                    const telegram = row['Telegram'] || '';
                    const note = row['Ghi chú'] || '';
                    
                    if (phoneNumber) {
                        this.contacts.set(phoneNumber, {
                            number: phoneNumber,
                            phoneNumber: phoneNumber,
                            count: frequency
                        });
                        
                        // Save contact data to localStorage
                        const contactKey = `contact_${phoneNumber}`;
                        const contactData = {
                            zalo: zalo,
                            facebook: facebook,
                            telegram: telegram,
                            note: note
                        };
                        localStorage.setItem(contactKey, JSON.stringify(contactData));
                    }
                });
                console.log('Restored contacts:', this.contacts.size);
            }
            
            // Sheet 4: IMEI
            if (sheets['IMEI'] && sheets['IMEI'].length > 0) {
                sheets['IMEI'].forEach(row => {
                    const imei = row['IMEI'] || '';
                    const model = row['Model'] || '';
                    const note = row['Ghi chú'] || '';
                    const usagePeriods = row['Thời gian sử dụng'] || '';
                    
                    if (imei) {
                        this.imeiList.add(imei);
                        
                        // Save IMEI data to localStorage
                        if (model) {
                            localStorage.setItem(`imei_model_${imei}`, model);
                        }
                        if (note) {
                            localStorage.setItem(`imei_note_${imei}`, note);
                        }
                    }
                });
                console.log('Restored IMEI:', this.imeiList.size);
            }
            
            // Sheet 5: Vị trí (Location)
            if (sheets['Location'] && sheets['Location'].length > 0) {
                sheets['Location'].forEach(row => {
                    const lac = String(row['LAC'] || '').trim();
                    const cell = String(row['CID'] || '').trim();
                    const provinceCode = row['Mã tỉnh'] || '';
                    const stationName = row['Tên trạm BTS'] || '';
                    const frequency = parseInt(row['Tần suất']) || 0;
                    const googleMapsLink = row['Google Maps'] || '';
                    const mnc = row['MNC'] || '';
                    
                    if (lac && cell) {
                        const locationKey = `${lac}-${cell}`;
                        const location = {
                            lac: lac,
                            cell: cell,
                            provinceCode: provinceCode,
                            stationName: stationName,
                            location: stationName,
                            count: frequency,
                            googleMapsLink: googleMapsLink,
                            mnc: mnc // Lưu MNC từ file
                        };
                        
                        this.locationStats.set(locationKey, location);
                        
                        // Save location data to localStorage
                        const storageKey = `location_${locationKey}`;
                        const locationData = {
                            provinceCode: provinceCode,
                            stationName: stationName,
                            googleMapsLink: googleMapsLink,
                            mnc: mnc // Lưu MNC vào localStorage
                        };
                        localStorage.setItem(storageKey, JSON.stringify(locationData));
                    }
                });
                console.log('Restored locations:', this.locationStats.size);
            }
            
            // Rebuild time-based data structures
            this.rebuildTimeBasedData();
            
            // Update UI
            this.updateSubscriberInfo();
            this.updateCallHistoryTable();
            this.updateIMEITable();
            this.updateContactsTable();
            this.updateContactsStats();
            this.updateLocationTable();
            this.updateLocationStats();
            this.updateChangesLog();
            this.updateCharts();
            
            console.log('✅ Successfully imported export_all file');
            return true;
        } catch (error) {
            console.error('Error importing export_all file:', error);
            throw error;
        }
    }

    // Rebuild time-based data structures from call records
    rebuildTimeBasedData() {
        // Rebuild contactsWithTimeData
        this.contactsWithTimeData = new Map();
        this.callRecords.forEach(record => {
            const contactNumber = record.contactNumber || '';
            if (contactNumber) {
                if (!this.contactsWithTimeData.has(contactNumber)) {
                    this.contactsWithTimeData.set(contactNumber, {
                        phoneNumber: contactNumber,
                        interactions: []
                    });
                }
                this.contactsWithTimeData.get(contactNumber).interactions.push({
                    timestamp: record.timestamp,
                    record: record
                });
            }
        });
        
        // Rebuild locationsWithTimeData
        this.locationsWithTimeData = new Map();
        this.callRecords.forEach(record => {
            if (record.lac && record.cell) {
                const locationKey = `${record.lac}-${record.cell}`;
                if (!this.locationsWithTimeData.has(locationKey)) {
                    this.locationsWithTimeData.set(locationKey, []);
                }
                this.locationsWithTimeData.get(locationKey).push({
                    timestamp: record.timestamp,
                    record: record
                });
            }
        });
        
        // Rebuild hourly and weekly stats
        this.hourlyStats = new Array(24).fill(0);
        this.weeklyStats = new Array(7).fill(0);
        this.callRecords.forEach(record => {
            if (record.timestamp) {
                const date = this.parseDateFromTimestamp(record.timestamp);
                if (date && !isNaN(date.getTime())) {
                    const hour = date.getHours();
                    const dayOfWeek = date.getDay();
                    this.hourlyStats[hour]++;
                    this.weeklyStats[dayOfWeek]++;
                }
            }
        });
        
        console.log('Rebuilt time-based data structures');
    }

    analyzeData() {
        try {
            console.log('Starting data analysis...');
            
        if (!this.data || this.data.length < 23) {
                throw new Error('File không có đủ dữ liệu (cần ít nhất 23 dòng)');
        }

            console.log('Data validation passed, proceeding with analysis...');

        // Extract subscriber information
        this.extractSubscriberInfo();
            console.log('Subscriber info extracted');
        
            // Load saved subscriber info from localStorage
            this.loadSubscriberFromStorage();
            this.loadSubscriberDisplayFromStorage(); // Load display info separately
            this.loadLocationDataFromStorage();
            this.loadIMEIDataFromStorage();
        
        // Extract call records
        this.extractCallRecords();
            console.log('Call records extracted:', this.callRecords.length);
        
        // Analyze data
        this.analyzeIMEI();
            console.log('IMEI analysis completed');
        this.analyzeContacts();
            console.log('Contacts analysis completed');
        this.analyzeTimePatterns();
            console.log('Time patterns analysis completed');
        this.analyzeLocations();
            console.log('Locations analysis completed');
        this.analyzeChanges();
            console.log('Changes analysis completed');
        
        // Update UI
        this.updateSubscriberInfo();
        this.updateCallHistoryTable();
        this.updateIMEITable();
        this.updateContactsTable();
        this.updateContactsStats();
        this.updateLocationTable();
        this.updateLocationStats();
        this.updateChangesLog();
        this.updateCharts();
        
        // Hiển thị lỗi missing columns nếu có
        this.displayMissingColumnsErrors();
        
        // Thêm: Cập nhật lại subscriberInfo cho Template 3 nếu cần
        if (this.currentTemplate === 'template3' && this.callRecords.length > 0) {
            console.log('Template 3: Final UI update check');
            console.log('Final subscriberInfo.phoneNumber:', this.subscriberInfo.phoneNumber);
            
            // Nếu vẫn không có số điện thoại, thử lấy từ call records
            if (!this.subscriberInfo.phoneNumber || this.subscriberInfo.phoneNumber === '') {
                for (const record of this.callRecords) {
                    if (record.sourceNumber && /^\d{9,11}$/.test(record.sourceNumber.replace(/^84/, '0'))) {
                        this.subscriberInfo.phoneNumber = this.formatPhoneNumber(record.sourceNumber);
                        console.log('Template 3: Final update - found phone from sourceNumber:', this.subscriberInfo.phoneNumber);
                        break;
                    }
                    if (record.targetNumber && /^\d{9,11}$/.test(record.targetNumber.replace(/^84/, '0'))) {
                        this.subscriberInfo.phoneNumber = this.formatPhoneNumber(record.targetNumber);
                        console.log('Template 3: Final update - found phone from targetNumber:', this.subscriberInfo.phoneNumber);
                        break;
                    }
                }
                
                // Cập nhật UI một lần nữa
                if (this.subscriberInfo.phoneNumber) {
                    console.log('Template 3: Final UI update with phone number');
                    this.updateSubscriberInfo();
                }
            }
        }
            
        console.log('UI updates completed');
        } catch (error) {
            console.error('Error in analyzeData:', error);
            throw error;
        }
    }

    extractSubscriberInfo() {
        const data = this.data;
        const template = this.templateMappings[this.currentTemplate];
        
        if (this.currentTemplate === 'template1') {
            // Template 1: Standard CDR format
            this.subscriberInfo = {
                startDate: this.getCellValue(data, 'C5'),
                endDate: this.getCellValue(data, 'E5'),
                name: this.getCellValue(data, 'C7'),
                phoneNumber: this.formatPhoneNumber(this.getCellValue(data, 'C8')),
                birthDate: this.getCellValue(data, 'C9'),
                address: this.getCellValue(data, 'C10'),
                idNumber: this.getCellValue(data, 'C13'),
                idIssueDate: this.getCellValue(data, 'C14'),
                activationDate: this.getCellValue(data, 'C16')
            };
        } else if (this.currentTemplate === 'template2') {
            // Template 2: Extract phone number from a_subs column
            this.subscriberInfo = this.parseTemplate2SubscriberInfo(data);
        } else if (this.currentTemplate === 'template3') {
            // Template 3: Parse subscriber info from text
            this.subscriberInfo = this.parseTemplate3SubscriberInfo(data);
        }
        
        console.log('Subscriber info extracted for template:', this.currentTemplate, this.subscriberInfo);
    }

    // Parse subscriber info for Template 2 (Vina)
    parseTemplate2SubscriberInfo(data) {
        try {
            // Tìm header row và build column map nếu chưa có
            let headerRowIndex = -1;
            let columnMap = this.currentColumnMap;
            
            // Tìm header row có chứa a_subs, b_subs
            if (!columnMap || Object.keys(columnMap).length === 0) {
                for (let i = 0; i < Math.min(10, data.length); i++) {
                    const row = data[i] || [];
                    if (row.length < 3) continue;
                    
                    let foundASubs = false;
                    let foundBSubs = false;
                    
                    for (let j = 0; j < row.length; j++) {
                        const cellValue = String(row[j] || '').toLowerCase().trim();
                        
                        if (cellValue.includes('a_subs') || cellValue.includes('a-subs') || 
                            cellValue.includes('a subs')) {
                            foundASubs = true;
                        }
                        
                        if (cellValue.includes('b_subs') || cellValue.includes('b-subs') || 
                            cellValue.includes('b subs')) {
                            foundBSubs = true;
                        }
                    }
                    
                    if (foundASubs && foundBSubs) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                // Build column map từ header row
                if (headerRowIndex !== -1) {
                    const headerRow = data[headerRowIndex] || [];
                    columnMap = this.buildColumnMap(headerRow);
                    this.currentColumnMap = columnMap;
                    this.currentHeaderRowIndex = headerRowIndex;
                }
            } else {
                // Nếu đã có column map, tìm header row index
                headerRowIndex = this.currentHeaderRowIndex !== null 
                    ? this.currentHeaderRowIndex 
                    : 0;
            }
            
            const phoneCounts = new Map();
            let startDate = '';
            let endDate = '';
            
            // Lấy index của cột sourceNumber (a_subs) và date
            const sourceNumberIndex = columnMap && columnMap.sourceNumber 
                ? columnMap.sourceNumber.index 
                : 0; // Fallback về cột 0
            const dateIndex = columnMap && columnMap.date 
                ? columnMap.date.index 
                : (columnMap && columnMap.timestamp 
                    ? columnMap.timestamp.index 
                    : 3); // Fallback về cột 3
            
            // Xác định start row (sau header row)
            const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1;
            
            // Process data rows (skip header row)
            for (let i = startRow; i < data.length; i++) {
                const row = data[i];
                if (row && row.length > 0) {
                    // Lấy số điện thoại từ cột sourceNumber (a_subs)
                    const phoneNumber = String(row[sourceNumberIndex] || '').trim();
                    if (phoneNumber && phoneNumber !== '' && 
                        !phoneNumber.toLowerCase().includes('a_subs') &&
                        !phoneNumber.toLowerCase().includes('a-subs')) {
                        // Normalize phone number (remove 84 prefix, add 0 prefix)
                        let normalizedPhone = phoneNumber.replace(/^84/, '0');
                        if (!normalizedPhone.startsWith('0')) {
                            normalizedPhone = '0' + normalizedPhone;
                        }
                        
                        // Chỉ đếm nếu là số điện thoại hợp lệ
                        if (/^\d{9,11}$/.test(normalizedPhone)) {
                            phoneCounts.set(normalizedPhone, (phoneCounts.get(normalizedPhone) || 0) + 1);
                        }
                    }
                    
                    // Try to extract date range from date column
                    if (row[dateIndex]) {
                        const dateStr = String(row[dateIndex]);
                        // Kiểm tra nhiều định dạng ngày
                        const dateMatch = dateStr.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
                        if (dateMatch) {
                            const dateValue = dateMatch[1].replace(/\//g, '-');
                            if (!startDate || dateValue < startDate) {
                                startDate = dateValue;
                            }
                            if (!endDate || dateValue > endDate) {
                                endDate = dateValue;
                            }
                        }
                    }
                }
            }
            
            // Find the most frequent phone number (likely the owner)
            let ownerPhone = '';
            let maxCount = 0;
            phoneCounts.forEach((count, phone) => {
                if (count > maxCount) {
                    maxCount = count;
                    ownerPhone = phone;
                }
            });
            
            return {
                startDate: startDate,
                endDate: endDate,
                name: 'Thuê bao Vina',
                phoneNumber: this.formatPhoneNumber(ownerPhone),
                birthDate: '',
                address: '',
                idNumber: '',
                idIssueDate: '',
                activationDate: ''
            };
        } catch (error) {
            console.error('Error parsing Template 2 subscriber info:', error);
            return {
                startDate: '',
                endDate: '',
                name: 'Thuê bao Vina',
                phoneNumber: '',
                birthDate: '',
                address: '',
                idNumber: '',
                idIssueDate: '',
                activationDate: ''
            };
        }
    }

    // Parse subscriber info for Template 3
    parseTemplate3SubscriberInfo(data) {
        try {
            let subscriberInfo = {
                startDate: '',
                endDate: '',
                name: '',
                phoneNumber: '',
                birthDate: '',
                address: '',
                idNumber: '',
                idIssueDate: '',
                activationDate: ''
            };

            // Find the row containing "STT", "Số thứ tự", "Số Thứ Tự" to determine data start position
            let sttRow = -1;
            for (let i = 0; i < Math.min(20, data.length); i++) {
                const row = data[i] || [];
                for (let j = 0; j < row.length; j++) {
                    if (this.isSTTPattern(row[j])) {
                        sttRow = i;
                        break;
                    }
                }
                if (sttRow !== -1) break;
            }

            if (sttRow === -1) {
                console.warn('Could not find STT/Số thứ tự row in Template 3');
                return subscriberInfo;
            }

            // Sửa: Lấy dữ liệu từ dòng dưới dòng "STT" (dòng x+1)
            // Tìm dòng chứa dữ liệu thực tế (dòng dưới dòng "STT")
            const dataStartRow = sttRow + 1;
            console.log(`Template 3: STT row at ${sttRow}, data starts at ${dataStartRow}`);

            // Parse subscriber info from rows above STT row
            for (let i = 0; i < sttRow; i++) {
                const row = data[i] || [];
                const rowText = row.join(' '); // Không chuyển thành lowercase để giữ nguyên viết hoa
                const rowTextLower = rowText.toLowerCase(); // Dùng để tìm kiếm
                
                // Tìm kiếm số điện thoại với nhiều pattern
                if (!subscriberInfo.phoneNumber) {
                    // Pattern 1: "Số điện thoại: 0123456789"
                    let phoneMatch = rowText.match(/(?:số điện thoại|số dt|sdt)\s*:?\s*(\d+)/i);
                    if (phoneMatch) {
                        subscriberInfo.phoneNumber = this.formatPhoneNumber(phoneMatch[1]);
                        console.log(`Template 3: Found phone from pattern 1: ${subscriberInfo.phoneNumber}`);
                    }
                    
                    // Pattern 2: "0123456789" (số điện thoại đứng riêng)
                    if (!subscriberInfo.phoneNumber) {
                        const phoneNumbers = rowText.match(/\b(?:0|\+84|84)?[0-9]{9,10}\b/g);
                        if (phoneNumbers && phoneNumbers.length > 0) {
                            subscriberInfo.phoneNumber = this.formatPhoneNumber(phoneNumbers[0]);
                            console.log(`Template 3: Found phone from pattern 2: ${subscriberInfo.phoneNumber}`);
                        }
                    }
                    
                    // Pattern 3: Tìm số điện thoại trong bất kỳ cột nào
                    if (!subscriberInfo.phoneNumber) {
                        for (let j = 0; j < row.length; j++) {
                            const cellValue = String(row[j] || '');
                            if (/^\d{9,11}$/.test(cellValue.replace(/^84/, '0'))) {
                                subscriberInfo.phoneNumber = this.formatPhoneNumber(cellValue);
                                console.log(`Template 3: Found phone from cell ${j}: ${subscriberInfo.phoneNumber}`);
                                break;
                            }
                        }
                    }
                }
                
                if (rowTextLower.includes('tên thuê bao')) {
                    const nameMatch = rowText.match(/tên thuê bao\s*:\s*([^:]+)/i);
                    if (nameMatch) {
                        // Giữ nguyên viết hoa như trong file
                        subscriberInfo.name = nameMatch[1].trim();
                    }
                }
                
                if (rowTextLower.includes('ngày nhập mạng')) {
                    // Sửa: Lấy đầy đủ ngày giờ phút giây
                    const dateMatch = rowText.match(/ngày nhập mạng\s*:\s*([^:]+(?::[^:]+)*)/i);
                    if (dateMatch) {
                        const dateValue = dateMatch[1].trim();
                        console.log('Template 3: Raw activation date:', dateValue);
                        subscriberInfo.activationDate = this.convertToStandardDateFormat(dateValue);
                    }
                }
                
                // Thêm: Tìm kiếm thêm các pattern khác cho ngày kích hoạt
                if (rowTextLower.includes('ngày kích hoạt')) {
                    const dateMatch = rowText.match(/ngày kích hoạt\s*:\s*([^:]+(?::[^:]+)*)/i);
                    if (dateMatch) {
                        const dateValue = dateMatch[1].trim();
                        console.log('Template 3: Raw activation date (alternative):', dateValue);
                        subscriberInfo.activationDate = this.convertToStandardDateFormat(dateValue);
                    }
                }
                
                if (rowTextLower.includes('số cmnd')) {
                    const idMatch = rowText.match(/số cmnd\s*:\s*([^:]+)/i);
                    if (idMatch) {
                        subscriberInfo.idNumber = idMatch[1].trim();
                    }
                }
                
                if (rowTextLower.includes('ngày cấp cmnd')) {
                    const issueMatch = rowText.match(/ngày cấp cmnd\s*:\s*([^:]+)/i);
                    if (issueMatch) {
                        const dateValue = issueMatch[1].trim();
                        subscriberInfo.idIssueDate = this.convertToStandardDateFormat(dateValue);
                    }
                }
                
                if (rowTextLower.includes('năm sinh')) {
                    const birthMatch = rowText.match(/năm sinh\s*:\s*([^:]+)/i);
                    if (birthMatch) {
                        const dateValue = birthMatch[1].trim();
                        subscriberInfo.birthDate = this.convertToStandardDateFormat(dateValue);
                    }
                }
                
                if (rowTextLower.includes('địa chỉ') || rowTextLower.includes('hộ khẩu')) {
                    const addressMatch = rowText.match(/(?:địa chỉ|hộ khẩu)\s*:\s*([^:]+)/i);
                    if (addressMatch) {
                        subscriberInfo.address = addressMatch[1].trim();
                    }
                }
            }

            // Sửa: Lấy dữ liệu từ dòng dưới dòng "STT" (dòng x+1)
            // Nếu không tìm thấy thông tin từ rows trên, thử lấy từ dòng dưới dòng "STT"
            if (!subscriberInfo.phoneNumber && dataStartRow < data.length) {
                const dataRow = data[dataStartRow] || [];
                console.log(`Template 3: Trying to get data from row ${dataStartRow}:`, dataRow);
                
                // Lấy thông tin từ dòng dữ liệu thực tế
                if (dataRow.length > 0) {
                    // Có thể cần điều chỉnh index tùy theo cấu trúc file
                    subscriberInfo.phoneNumber = this.formatPhoneNumber(dataRow[0] || '');
                    subscriberInfo.name = dataRow[1] || '';
                    // Các thông tin khác có thể cần điều chỉnh index
                }
            }
            
            // Thêm: Nếu vẫn không tìm thấy số điện thoại, thử tìm từ các dòng dữ liệu
            if (!subscriberInfo.phoneNumber && dataStartRow < data.length) {
                console.log('Template 3: Searching for phone number in data rows...');
                for (let i = dataStartRow; i < Math.min(dataStartRow + 10, data.length); i++) {
                    const row = data[i] || [];
                    console.log(`Template 3: Checking row ${i}:`, row);
                    
                    if (row.length >= 4) {
                        // Kiểm tra cột 3 và 4 (sourceNumber và targetNumber)
                        const sourceNumber = String(row[3] || '');
                        const targetNumber = String(row[4] || '');
                        
                        console.log(`Template 3: Row ${i} - Source: ${sourceNumber}, Target: ${targetNumber}`);
                        
                        // Tìm số điện thoại hợp lệ
                        if (sourceNumber && /^\d{9,11}$/.test(sourceNumber.replace(/^84/, '0'))) {
                            subscriberInfo.phoneNumber = this.formatPhoneNumber(sourceNumber);
                            console.log(`Template 3: Found phone number from source column: ${subscriberInfo.phoneNumber}`);
                            break;
                        }
                        
                        if (targetNumber && /^\d{9,11}$/.test(targetNumber.replace(/^84/, '0'))) {
                            subscriberInfo.phoneNumber = this.formatPhoneNumber(targetNumber);
                            console.log(`Template 3: Found phone number from target column: ${subscriberInfo.phoneNumber}`);
                            break;
                        }
                    }
                }
            }
            
            // Thêm: Nếu vẫn không tìm thấy, thử tìm từ tất cả các dòng
            if (!subscriberInfo.phoneNumber) {
                console.log('Template 3: Final attempt - searching all rows for phone number...');
                for (let i = 0; i < Math.min(50, data.length); i++) {
                    const row = data[i] || [];
                    for (let j = 0; j < row.length; j++) {
                        const cellValue = String(row[j] || '');
                        if (/^\d{9,11}$/.test(cellValue.replace(/^84/, '0'))) {
                            subscriberInfo.phoneNumber = this.formatPhoneNumber(cellValue);
                            console.log(`Template 3: Found phone from row ${i}, cell ${j}: ${subscriberInfo.phoneNumber}`);
                            break;
                        }
                    }
                    if (subscriberInfo.phoneNumber) break;
                }
            }
            
            // Thêm: Nếu vẫn không tìm thấy, thử tìm từ các dòng đầu tiên (có thể chứa thông tin header)
            if (!subscriberInfo.phoneNumber) {
                console.log('Template 3: Searching in header rows for phone number...');
                for (let i = 0; i < Math.min(sttRow, 20); i++) {
                    const row = data[i] || [];
                    for (let j = 0; j < row.length; j++) {
                        const cellValue = String(row[j] || '');
                        // Tìm số điện thoại với pattern linh hoạt hơn
                        if (cellValue && /^[0-9+\s\-\(\)]{9,15}$/.test(cellValue.replace(/\s/g, ''))) {
                            const cleanPhone = cellValue.replace(/\s/g, '').replace(/^84/, '0');
                            if (/^\d{9,11}$/.test(cleanPhone)) {
                                subscriberInfo.phoneNumber = this.formatPhoneNumber(cleanPhone);
                                console.log(`Template 3: Found phone from header row ${i}, cell ${j}: ${subscriberInfo.phoneNumber}`);
                                break;
                            }
                        }
                    }
                    if (subscriberInfo.phoneNumber) break;
                }
            }

            // Debug: Log thông tin subscriber đã parse
            console.log('Template 3: Parsed subscriber info:', subscriberInfo);
            
            // Debug: Log chi tiết ngày kích hoạt
            if (subscriberInfo.activationDate) {
                console.log('Template 3: Activation date converted:', subscriberInfo.activationDate);
            }
            
            // Test các định dạng ngày khác nhau
            console.log('Template 3: Testing date conversion:');
            console.log('  "2010-11-10 21:21:30" ->', this.convertToStandardDateFormat('2010-11-10 21:21:30'));
            console.log('  "2010-11-10 21" ->', this.convertToStandardDateFormat('2010-11-10 21'));
            console.log('  "2010-11-10" ->', this.convertToStandardDateFormat('2010-11-10'));

            return subscriberInfo;
        } catch (error) {
            console.error('Error parsing Template 3 subscriber info:', error);
            return {
                startDate: '',
                endDate: '',
                name: 'Lỗi khi đọc thông tin',
                phoneNumber: '',
                birthDate: '',
                address: '',
                idNumber: '',
                idIssueDate: '',
                activationDate: ''
            };
        }
    }

    extractCallRecords() {
        this.callRecords = [];
        const data = this.data;
        let ownerPhone = this.subscriberInfo.phoneNumber;
        const template = this.templateMappings[this.currentTemplate];
        const callRecordsConfig = template.callRecords;
        
        // Debug log cho Template 3
        if (this.currentTemplate === 'template3') {
            console.log('Template 3: Starting extractCallRecords');
            console.log('Initial subscriberInfo.phoneNumber:', this.subscriberInfo.phoneNumber);
            console.log('Initial ownerPhone:', ownerPhone);
        }

        // Đối với template1, tìm header row và build column map nếu chưa có
        if (this.currentTemplate === 'template1' && (!this.currentColumnMap || Object.keys(this.currentColumnMap).length === 0)) {
            // Ưu tiên tìm header row trong khoảng 15-25 (thường header ở dòng 21-22 cho template1)
            let headerRowIndex = -1;
            let bestScore = 0;
            
            // Tìm trong khoảng ưu tiên trước
            for (let i = 15; i < Math.min(26, data.length); i++) {
                const row = data[i] || [];
                if (row.length < 5) continue;
                
                // Kiểm tra xem dòng này có phải header không
                let score = 0;
                const keywords = ['số đi', 'số đến', 'thời gian', 'imei', 'imsi', 'lac', 'cell', 'mã tỉnh', 'giây', 'direction', 'type', 'địa chỉ trạm'];
                const reportKeywords = ['báo cáo', 'chi tiết', 'lịch sử'];
                
                row.forEach(cell => {
                    if (cell !== null && cell !== undefined && cell !== '') {
                        const cellStr = String(cell).toLowerCase().trim();
                        keywords.forEach(keyword => {
                            if (cellStr.includes(keyword)) {
                                score += 10;
                            }
                        });
                        reportKeywords.forEach(keyword => {
                            if (cellStr.includes(keyword)) {
                                score -= 20; // Trừ điểm nếu có keywords của tiêu đề báo cáo
                            }
                        });
                    }
                });
                
                if (score > bestScore && score > 20) {
                    bestScore = score;
                    headerRowIndex = i;
                }
            }
            
            // Nếu không tìm thấy trong khoảng ưu tiên, dùng hàm findHeaderRow() chung
            if (headerRowIndex === -1) {
                headerRowIndex = this.findHeaderRow(data);
            }
            
            const headerRow = data[headerRowIndex] || [];
            const columnMap = this.buildColumnMap(headerRow);
            const validation = this.validateColumns(columnMap);
            
            // Lưu column map và header row index
            this.currentColumnMap = columnMap;
            this.currentHeaderRowIndex = headerRowIndex;
            
            // Log để debug
            console.log('Template1: Found header row at index', headerRowIndex);
            console.log('Header row content:', headerRow);
            console.log('Column mapping:', columnMap);
            
            // Lưu missing columns để hiển thị lỗi
            if (validation.missing.length > 0 || validation.warnings.length > 0) {
                const missingInfo = {
                    missing: validation.missing,
                    warnings: validation.warnings,
                    columnMap: columnMap
                };
                this.fileMissingColumns.set(this.currentFileName || 'unknown', missingInfo);
                console.warn('Missing columns for template1:', missingInfo);
            }
        }
        
        // Đối với template2, tìm header row và build column map nếu chưa có
        if (this.currentTemplate === 'template2' && (!this.currentColumnMap || Object.keys(this.currentColumnMap).length === 0)) {
            let headerRowIndex = -1;
            
            // Tìm header row có chứa a_subs, b_subs
            for (let i = 0; i < Math.min(10, data.length); i++) {
                const row = data[i] || [];
                if (row.length < 3) continue;
                
                let foundASubs = false;
                let foundBSubs = false;
                
                for (let j = 0; j < row.length; j++) {
                    const cellValue = String(row[j] || '').toLowerCase().trim();
                    
                    if (cellValue.includes('a_subs') || cellValue.includes('a-subs') || 
                        cellValue.includes('a subs')) {
                        foundASubs = true;
                    }
                    
                    if (cellValue.includes('b_subs') || cellValue.includes('b-subs') || 
                        cellValue.includes('b subs')) {
                        foundBSubs = true;
                    }
                }
                
                if (foundASubs && foundBSubs) {
                    headerRowIndex = i;
                    break;
                }
            }
            
            // Nếu không tìm thấy, dùng hàm findHeaderRow() chung
            if (headerRowIndex === -1) {
                headerRowIndex = this.findHeaderRow(data);
            }
            
            const headerRow = data[headerRowIndex] || [];
            const columnMap = this.buildColumnMap(headerRow);
            const validation = this.validateColumns(columnMap);
            
            // Lưu column map và header row index
            this.currentColumnMap = columnMap;
            this.currentHeaderRowIndex = headerRowIndex;
            
            // Log để debug
            console.log('Template2: Found header row at index', headerRowIndex);
            console.log('Header row content:', headerRow);
            console.log('Column mapping:', columnMap);
            
            // Lưu missing columns để hiển thị lỗi
            if (validation.missing.length > 0 || validation.warnings.length > 0) {
                const missingInfo = {
                    missing: validation.missing,
                    warnings: validation.warnings,
                    columnMap: columnMap
                };
                this.fileMissingColumns.set(this.currentFileName || 'unknown', missingInfo);
                console.warn('Missing columns for template2:', missingInfo);
            }
        }

        let startRow = callRecordsConfig.startRow;
        
        // For Template 3, find the STT row dynamically
        if (this.currentTemplate === 'template3') {
            startRow = this.findSTTRow(data);
            if (startRow === -1) {
                console.error('Could not find STT row in Template 3');
                return;
            }
            // Sửa: Lấy dữ liệu từ dòng dưới dòng "STT" (dòng x+1)
            startRow = startRow + 1;
        }
        
        // Đối với template1, nếu có header row, bắt đầu từ dòng sau header
        if (this.currentTemplate === 'template1' && this.currentHeaderRowIndex !== null) {
            startRow = this.currentHeaderRowIndex + 1;
        }
        
        // Đối với template2, nếu có header row, bắt đầu từ dòng sau header
        if (this.currentTemplate === 'template2' && this.currentHeaderRowIndex !== null) {
            startRow = this.currentHeaderRowIndex + 1;
        }

        console.log(`Extracting call records from row ${startRow} for template ${this.currentTemplate}`);

        for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 3) continue;

            let callRecord;
            
            if (this.currentTemplate === 'template1') {
                callRecord = this.extractTemplate1Record(row, i, ownerPhone);
            } else if (this.currentTemplate === 'template2') {
                callRecord = this.extractTemplate2Record(row, i, ownerPhone);
            } else if (this.currentTemplate === 'template3') {
                callRecord = this.extractTemplate3Record(row, i, ownerPhone);
            }

            if (callRecord) {
                this.callRecords.push(callRecord);
            }
        }

        console.log(`Extracted ${this.callRecords.length} call records from template ${this.currentTemplate}`);
        
        // Cập nhật ownerPhone nếu tìm thấy số điện thoại trong Template 3
        if (this.currentTemplate === 'template3' && this.callRecords.length > 0) {
            console.log('Template 3: Updating phone number from call records...');
            console.log('Current subscriberInfo.phoneNumber:', this.subscriberInfo.phoneNumber);
            
            // Tìm số điện thoại từ tất cả các call records
            let foundPhone = null;
            for (const record of this.callRecords) {
                if (record.sourceNumber && /^\d{9,11}$/.test(record.sourceNumber.replace(/^84/, '0'))) {
                    foundPhone = this.formatPhoneNumber(record.sourceNumber);
                    console.log('Template 3: Found phone from sourceNumber:', foundPhone);
                    break;
                }
                if (record.targetNumber && /^\d{9,11}$/.test(record.targetNumber.replace(/^84/, '0'))) {
                    foundPhone = this.formatPhoneNumber(record.targetNumber);
                    console.log('Template 3: Found phone from targetNumber:', foundPhone);
                    break;
                }
            }
            
            // Cập nhật nếu tìm thấy số điện thoại
            if (foundPhone && (!this.subscriberInfo.phoneNumber || this.subscriberInfo.phoneNumber === '')) {
                this.subscriberInfo.phoneNumber = foundPhone;
                ownerPhone = foundPhone;
                console.log('Template 3: Updated subscriberInfo.phoneNumber to:', foundPhone);
                
                // Cập nhật UI ngay lập tức
                this.updateSubscriberInfo();
            }
        }
    }

    // Find STT row for Template 3 (supports STT, Số thứ tự, Số Thứ Tự)
    findSTTRow(data) {
        for (let i = 0; i < Math.min(20, data.length); i++) {
            const row = data[i] || [];
            for (let j = 0; j < row.length; j++) {
                if (this.isSTTPattern(row[j])) {
                    return i;
                }
            }
        }
        return -1;
    }

    // Extract record using flexible column map
    extractRecordByColumnMap(row, rowIndex, ownerPhone) {
        try {
            const columnMap = this.currentColumnMap;
            if (!columnMap || Object.keys(columnMap).length === 0) {
                return null;
            }
            
            const record = {
                tt: rowIndex - (this.currentHeaderRowIndex || 0)
            };
            
            // Extract từng field theo column map
            Object.entries(columnMap).forEach(([fieldName, columnInfo]) => {
                const value = row[columnInfo.index];
                
                if (value !== null && value !== undefined && value !== '') {
                    // Xử lý đặc biệt cho từng field
                    switch(fieldName) {
                        case 'sourceNumber':
                            record.sourceNumber = this.formatPhoneNumber(String(value));
                            break;
                        case 'targetNumber':
                            record.targetNumber = this.formatPhoneNumber(String(value));
                            break;
                        case 'timestamp':
                            // Chỉ dùng timestamp field nếu chưa có dateValue (ưu tiên Date + Time cho template VINA)
                            if (!record.dateValue) {
                                record.timestamp = this.parseExcelDateTime(value);
                            }
                            break;
                        case 'date':
                            // Nếu có date riêng, lưu lại để kết hợp với time
                            record.dateValue = String(value);
                            break;
                        case 'time':
                            // Nếu có time riêng, kết hợp với date
                            if (record.dateValue) {
                                record.timestamp = this.parseTemplate2DateTime(record.dateValue, String(value));
                            } else {
                                record.timeValue = String(value);
                            }
                            break;
                        case 'imei':
                            record.imei = String(value).trim();
                            break;
                        case 'imsi':
                            record.imsi = String(value).trim();
                            break;
                        case 'duration':
                            record.duration = String(value);
                            break;
                        case 'callType':
                            record.callType = this.mapCallType ? this.mapCallType(String(value)) : String(value);
                            break;
                        case 'location':
                            record.location = String(value);
                            record.stationName = String(value);
                            break;
                        case 'lac':
                            record.lac = String(value);
                            break;
                        case 'cell':
                            record.cell = String(value);
                            break;
                        case 'provinceCode':
                            record.provinceCode = String(value);
                            break;
                        case 'serviceType':
                            record.serviceType = String(value);
                            break;
                        default:
                            record[fieldName] = value;
                    }
                } else {
                    // Set giá trị mặc định cho optional fields
                    if (!columnInfo.required) {
                        switch(fieldName) {
                            case 'imei':
                                record.imei = '';
                                break;
                            case 'imsi':
                                record.imsi = '';
                                break;
                            case 'duration':
                                record.duration = '';
                                break;
                            case 'callType':
                                record.callType = '';
                                break;
                            case 'location':
                                record.location = '';
                                record.stationName = '';
                                break;
                            case 'lac':
                                record.lac = '';
                                break;
                            case 'cell':
                                record.cell = '';
                                break;
                            case 'provinceCode':
                                record.provinceCode = '';
                                break;
                            case 'serviceType':
                                record.serviceType = '';
                                break;
                        }
                    }
                }
            });
            
            // Nếu có dateValue và timeValue nhưng chưa được ghép thành timestamp, ghép chúng lại
            if (record.dateValue && record.timeValue && !record.timestamp) {
                record.timestamp = this.parseTemplate2DateTime(record.dateValue, record.timeValue);
            } else if (record.dateValue && !record.timestamp) {
                // Nếu chỉ có dateValue, vẫn tạo timestamp với time mặc định
                record.timestamp = this.parseTemplate2DateTime(record.dateValue, '000000');
            }
            
            // Validate required fields
            if (!record.sourceNumber || !record.targetNumber || !record.timestamp) {
                return null;
            }
            
            // Set call direction
            this.setCallRecordDirection(record, record.sourceNumber, record.targetNumber, ownerPhone);
            
            // Xử lý LAC-Cell nếu location có format đặc biệt (Template 3)
            if (record.location && (record.location.includes('Lac') || record.location.includes('Cell'))) {
                const lacCell = this.parseLacCell(record.location);
                if (lacCell.lac) record.lac = lacCell.lac;
                if (lacCell.cell) record.cell = lacCell.cell;
            }
            
            return record;
        } catch (error) {
            console.error('Error extracting record by column map:', error);
            return null;
        }
    }

    // Extract call record for Template 1 (sử dụng column map dựa trên header)
    extractTemplate1Record(row, rowIndex, ownerPhone) {
        const columnMap = this.currentColumnMap;
        
        // Nếu có column map, sử dụng nó (nhận diện theo header)
        if (columnMap && Object.keys(columnMap).length > 0) {
            return this.extractRecordByColumnMap(row, rowIndex, ownerPhone);
        }
        
        // Fallback: Sử dụng vị trí cố định (tương thích ngược)
        if (row.length < 13) return null;

        const rawSource = row[1] || '';
        const rawTarget = row[2] || '';

        const callRecord = {
            tt: rowIndex - 21,
            sourceNumber: rawSource,
            targetNumber: rawTarget,
            timestamp: this.parseExcelDateTime(row[3]),
            duration: row[4] || '',
            imsi: row[5] || '',
            imei: row[6] || '',
            provinceCode: row[7] || '',
            callType: row[8] || '',
            serviceType: row[9] || '',
            location: row[10] || '',
            stationName: row[10] || '', // Tên trạm BTS từ trường location
            lac: row[11] || '',
            cell: row[12] || ''
        };

        this.setCallRecordDirection(callRecord, rawSource, rawTarget, ownerPhone);
        return callRecord;
    }

    // Extract call record for Template 2
    extractTemplate2Record(row, rowIndex, ownerPhone) {
        // Sử dụng column mapping nếu có
        const columnMap = this.currentColumnMap;
        
        if (!columnMap || Object.keys(columnMap).length === 0) {
            // Fallback về logic cũ nếu không có column map
            if (row.length < 8) return null;

            let sourceNumber = String(row[0] || '').replace(/^84/, '0');
            let targetNumber = String(row[6] || '').replace(/^84/, '0');
            const dateValue = row[3] || '';
            const timeValue = row[4] || '';
            const timestamp = this.parseTemplate2DateTime(dateValue, timeValue);
            let callType = this.mapCallType(row[7] || '');

            const callRecord = {
                tt: rowIndex,
                sourceNumber: sourceNumber,
                targetNumber: targetNumber,
                timestamp: timestamp,
                duration: row[5] || '',
                imsi: row[1] || '',
                imei: row[2] || '',
                provinceCode: row[8] || '',
                callType: callType,
                serviceType: row[9] || '',
                location: row[15] || '',
                stationName: row[15] || '',
                lac: row[13] || '',
                cell: row[14] || ''
            };

            this.setCallRecordDirection(callRecord, sourceNumber, targetNumber, ownerPhone);
            return callRecord;
        }
        
        // Sử dụng column mapping để lấy giá trị từ các cột đúng
        // Hàm helper để lấy giá trị, chỉ trả về giá trị nếu có (không trả về chuỗi rỗng)
        const getValue = (fieldName) => {
            if (columnMap[fieldName] && columnMap[fieldName].index !== undefined) {
                const value = row[columnMap[fieldName].index];
                // Chỉ trả về giá trị nếu không rỗng
                if (value !== null && value !== undefined && value !== '') {
                    return String(value).trim();
                }
            }
            return null; // Trả về null thay vì chuỗi rỗng
        };
        
        // Lấy các giá trị từ column map
        const sourceNumberRaw = getValue('sourceNumber');
        const targetNumberRaw = getValue('targetNumber');
        
        if (!sourceNumberRaw || !targetNumberRaw) {
            return null; // Bỏ qua record nếu thiếu số gọi hoặc số nhận
        }
        
        let sourceNumber = sourceNumberRaw.replace(/^84/, '0');
        let targetNumber = targetNumberRaw.replace(/^84/, '0');
        
        // Đối với template VINA: Ưu tiên ghép Date + Time để tạo timestamp đầy đủ
        // Template VINA có 2 cột riêng biệt: Date và Time, cần ghép lại
        let timestamp = '';
        
        // Bước 1: Lấy date và time riêng biệt (ưu tiên cao nhất cho template VINA)
        const dateValue = getValue('date');
        let timeValue = getValue('time');
        
        // Nếu không tìm thấy time qua column map, thử tìm trong các cột khác
        if (!timeValue && columnMap) {
            // Tìm cột time bằng cách duyệt qua các cột chưa được map
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cellValue = String(row[colIndex] || '').trim();
                // Kiểm tra nếu giá trị có vẻ là time (format số từ 1-6 ký tự hoặc có dấu :)
                // Mặc định time đầy đủ có 6 ký tự (hhmmss), thiếu ký tự sẽ được pad left với số 0
                if (cellValue && (
                    /^\d{1,6}$/.test(cellValue) || // Số từ 1-6 ký tự (sẽ được pad left thành hhmmss)
                    /^\d{2}:\d{2}:\d{2}$/.test(cellValue) || // hh:mm:ss
                    /^\d{2}:\d{2}$/.test(cellValue) // hh:mm
                )) {
                    // Kiểm tra xem cột này đã được map chưa
                    let isMapped = false;
                    for (const [fieldName, columnInfo] of Object.entries(columnMap)) {
                        if (columnInfo.index === colIndex && fieldName !== 'time') {
                            isMapped = true;
                            break;
                        }
                    }
                    // Nếu chưa được map và có vẻ là time value, sử dụng nó
                    if (!isMapped) {
                        timeValue = cellValue;
                        console.log(`Template2: Found time value in unmapped column ${colIndex}:`, timeValue);
                        break;
                    }
                }
            }
        }
        
        // Bước 2: Ghép Date + Time nếu có cả hai
        if (dateValue && timeValue) {
            // Có cả Date và Time -> ghép lại (ưu tiên cao nhất)
            timestamp = this.parseTemplate2DateTime(dateValue, timeValue);
            console.log(`Template2: Combined Date (${dateValue}) + Time (${timeValue}) = ${timestamp}`);
        } else if (dateValue) {
            // Chỉ có Date -> thêm time mặc định 00:00:00
            timestamp = this.parseTemplate2DateTime(dateValue, '000000');
            console.log(`Template2: Using Date (${dateValue}) with default time 00:00:00`);
        } else {
            // Không có Date, thử dùng timestamp field như fallback
            const timestampValue = getValue('timestamp');
            if (timestampValue) {
                timestamp = this.parseExcelDateTime(timestampValue);
                console.log(`Template2: Using timestamp field as fallback: ${timestamp}`);
            } else if (timeValue) {
                // Chỉ có Time mà không có Date -> warning
                console.warn('Template2: Found time but no date at row', rowIndex, '- Cannot create timestamp');
            }
        }
        
        if (!timestamp) {
            return null; // Bỏ qua record nếu thiếu timestamp
        }
        
        // Map call type (rec_type)
        const callTypeRaw = getValue('callType');
        let callType = callTypeRaw ? this.mapCallType(callTypeRaw) : null;
        
        // Tính tt dựa trên header row index
        const tt = this.currentHeaderRowIndex !== null 
            ? rowIndex - this.currentHeaderRowIndex 
            : rowIndex;

        // Khởi tạo callRecord với các trường bắt buộc
        const callRecord = {
            tt: tt,
            sourceNumber: sourceNumber,
            targetNumber: targetNumber,
            timestamp: timestamp
        };
        
        // Chỉ thêm các trường optional nếu có giá trị
        const duration = getValue('duration');
        if (duration) callRecord.duration = duration;
        
        const imsi = getValue('imsi');
        if (imsi) callRecord.imsi = imsi;
        
        const imei = getValue('imei');
        if (imei) callRecord.imei = imei;
        
        if (callType) callRecord.callType = callType;
        
        const provinceCode = getValue('provinceCode');
        if (provinceCode) callRecord.provinceCode = provinceCode;
        
        const serviceType = getValue('serviceType');
        if (serviceType) callRecord.serviceType = serviceType;
        
        // Xử lý location (cell_name)
        const location = getValue('location');
        if (location) {
            callRecord.location = location;
            callRecord.stationName = location; // Tên trạm BTS từ trường location
        }
        
        // Xử lý lac
        const lac = getValue('lac');
        if (lac) callRecord.lac = lac;
        
        // Xử lý cell (cellid)
        const cell = getValue('cell');
        if (cell) callRecord.cell = cell;

        // Set call record direction and contact number
        this.setCallRecordDirection(callRecord, sourceNumber, targetNumber, ownerPhone);
        
        // Debug log cho Template 2
        if (this.currentTemplate === 'template2') {
            console.log('Template 2 Record (using column map):', {
                tt: callRecord.tt,
                sourceNumber: callRecord.sourceNumber,
                targetNumber: callRecord.targetNumber,
                direction: callRecord.direction,
                contactNumber: callRecord.contactNumber,
                ownerPhone: ownerPhone,
                callType: callRecord.callType,
                columnMap: columnMap
            });
        }
        
        return callRecord;
    }

    // Extract call record for Template 3
    extractTemplate3Record(row, rowIndex, ownerPhone) {
        if (row.length < 9) return null;

        // Format số điện thoại đúng cách
        let sourceNumber = String(row[3] || '').replace(/^84/, '0');
        let targetNumber = String(row[4] || '').replace(/^84/, '0');
        
        // Đảm bảo số điện thoại có định dạng đúng
        sourceNumber = this.formatPhoneNumber(sourceNumber);
        targetNumber = this.formatPhoneNumber(targetNumber);


        // Parse LAC-Cell từ cột G
        const lacCellValue = row[6] || '';
        const { lac, cell } = this.parseLacCell(lacCellValue);


        // ✅ tính tt dựa theo rowIndex - dataStartRow + 1
        const sttRow = this.findSTTRow(this.data);
        const dataStartRow = sttRow + 1;


        const callRecord = {
        tt: rowIndex - dataStartRow + 1,
        sourceNumber: sourceNumber,
        targetNumber: targetNumber,
        timestamp: this.parseExcelDateTime(row[1]),
        duration: row[5] || '',
        imsi: '',
        imei: row[8] || '',
        provinceCode: '',
        callType: row[2] || '',
        serviceType: '',
        location: row[7] || '',
        stationName: row[7] || '', // Tên trạm BTS từ trường location
        lac: lac,
        cell: cell
        };


        this.setCallRecordDirection(callRecord, sourceNumber, targetNumber, ownerPhone);
        
        // Debug log cho Template 3
        if (this.currentTemplate === 'template3') {
            console.log('Template 3 Record:', {
                tt: callRecord.tt,
                sourceNumber: callRecord.sourceNumber,
                targetNumber: callRecord.targetNumber,
                direction: callRecord.direction,
                contactNumber: callRecord.contactNumber,
                ownerPhone: ownerPhone
            });
            
                    // Thêm: Cập nhật subscriberInfo.phoneNumber nếu chưa có
        if (!this.subscriberInfo.phoneNumber && (sourceNumber || targetNumber)) {
            const potentialPhone = sourceNumber || targetNumber;
            if (potentialPhone && /^\d{9,11}$/.test(potentialPhone.replace(/^84/, '0'))) {
                this.subscriberInfo.phoneNumber = this.formatPhoneNumber(potentialPhone);
                console.log('Template 3: Updated subscriberInfo.phoneNumber to:', this.subscriberInfo.phoneNumber);
                
                // Cập nhật UI ngay lập tức nếu đây là record đầu tiên
                if (this.callRecords.length === 0) {
                    console.log('Template 3: First record, updating UI immediately');
                    this.updateSubscriberInfo();
                }
            }
        }
        }
        
        return callRecord;
        }

    // Parse LAC-Cell string for Template 3
    parseLacCell(lacCellString) {
        if (!lacCellString) return { lac: '', cell: '' };
        
        const lacCellStr = String(lacCellString);
        
        // Format 1: "452-01-Lac-Cell-xxx" -> lấy "Lac" và "Cell"
        if (lacCellStr.includes('452-01-')) {
            const parts = lacCellStr.split('-');
            if (parts.length >= 4) {
                return {
                    lac: parts[2] || '',
                    cell: parts[3] || ''
                };
            }
        }
        
        // Format 2: "Lac-Cell-xxx" -> lấy "Lac" và "Cell"
        if (lacCellStr.startsWith('Lac-') || lacCellStr.includes('-Cell-')) {
            const parts = lacCellStr.split('-');
            if (parts.length >= 2) {
                return {
                    lac: parts[0] || '',
                    cell: parts[1] || ''
                };
            }
        }
        
        // Fallback: split by dash and take first two parts
        const parts = lacCellStr.split('-');
        return {
            lac: parts[0] || '',
            cell: parts[1] || ''
        };
    }

    // Parse Template 2 date and time
    parseTemplate2DateTime(dateValue, timeValue) {
        try {
            if (!dateValue) return '';

            // Normalize date using the new function
            let normalizedDate = this.normalizeTemplate2Date(dateValue);
            
            // Nếu không có timeValue, chỉ trả về date
            if (!timeValue) {
                return normalizedDate;
            }
            
            // Parse time: mặc định time đầy đủ có 6 ký tự (hhmmss)
            // Nếu thiếu ký tự, thêm số 0 vào bên trái (pad left)
            const timeStr = String(timeValue).trim();
            
            // Format có dấu : (đã format sẵn)
            if (timeStr.includes(':')) {
                // Combine normalized date with time (time đã có format đúng)
                return `${normalizedDate} ${timeStr}`;
            }
            
            // Format số: pad left với số 0 để đủ 6 ký tự (hhmmss)
            if (/^\d+$/.test(timeStr)) {
                // Pad left với số 0 để đủ 6 ký tự
                // Ví dụ: 1 → 000001, 12 → 000012, 5420 → 005420, 75026 → 075026
                const paddedTime = timeStr.padStart(6, '0');
                
                // Parse như hhmmss
                const hour = paddedTime.substring(0, 2);
                const minute = paddedTime.substring(2, 4);
                const second = paddedTime.substring(4, 6);
                
                // Validate: hour <= 23, minute <= 59, second <= 59
                if (parseInt(hour) <= 23 && parseInt(minute) <= 59 && parseInt(second) <= 59) {
                    return `${normalizedDate} ${hour}:${minute}:${second}`;
                } else {
                    // Nếu không hợp lệ, vẫn trả về nhưng có warning
                    console.warn('Template2: Invalid time values after padding:', hour, minute, second, '- Original:', timeValue);
                    return `${normalizedDate} ${hour}:${minute}:${second}`;
                }
            }
            
            // Nếu không parse được time format, chỉ trả về date
            console.warn('Template2: Unknown time format:', timeValue, '- Using date only');
            return normalizedDate;
        } catch (error) {
            console.error('Error parsing Template 2 date/time:', error);
            return '';
        }
    }

    // Set call record direction and contact number
    setCallRecordDirection(callRecord, sourceNumber, targetNumber, ownerPhone) {
        const normOwner = this.formatPhoneNumber(ownerPhone);
        const normSource = this.formatPhoneNumber(sourceNumber);
        const normTarget = this.formatPhoneNumber(targetNumber);

        if (normSource === normOwner) {
            callRecord.direction = 'outgoing';
            callRecord.contactNumber = targetNumber;
        } else if (normTarget === normOwner) {
            callRecord.direction = 'incoming';
            callRecord.contactNumber = sourceNumber;
        } else {
            // Nếu không xác định được hướng, vẫn set contactNumber
            callRecord.direction = 'unknown';
            // Ưu tiên targetNumber làm contactNumber nếu có
            callRecord.contactNumber = targetNumber || sourceNumber || '';
        }

        // Convert call type to readable format
        callRecord.callTypeReadable = this.getCallTypeReadable(callRecord.callType, callRecord.direction);
    }

    getCellValue(data, cellRef) {
        const col = cellRef.charCodeAt(0) - 65; // Convert A=0, B=1, etc.
        const row = parseInt(cellRef.slice(1)) - 1;
        
        if (data[row] && data[row][col] !== undefined) {
            let value = data[row][col];
            
            // Handle Excel date serial numbers
            if (typeof value === 'number' && value > 1000) {
                // Excel dates are serial numbers starting from 1900-01-01
                const excelEpoch = new Date(1900, 0, 1);
                const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
                // Format as dd/mm/yyyy
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return day + '/' + month + '/' + year;
            }
            
            return value;
        }
        return '';
    }

    getCallTypeReadable(callType, direction) {
        if (callType === 'SMS') {
            return direction === 'outgoing' ? 'Tin nhắn đi' : 'Tin nhắn đến';
        } else if (callType === 'VOICE') {
            return direction === 'outgoing' ? 'Cuộc gọi đi' : 'Cuộc gọi đến';
        }
        return callType || 'Không xác định';
    }

    // Map call type for Template 2
    mapCallType(type) {
        if (!type) return '';
        const mapping = {
            'MOC': 'Cuộc gọi đi',
            'MTC': 'Cuộc gọi đến',
            'SMT': 'Tin nhắn đi',
            'SMO': 'Tin nhắn đến'
        };
        return mapping[type] || type;
    }

    normalizeTemplate2Date(raw) {
        if (!raw) return '';

        // Loại bỏ ký tự không phải số
        let str = String(raw).replace(/\D/g, '');

        // Trường hợp chuẩn: yyMMdd (6 ký tự, tháng <= 12)
        if (/^\d{6}$/.test(str)) {
            let yy = str.substring(0, 2);
            let mm = str.substring(2, 4);
            let dd = str.substring(4, 6);

            // Nếu mm <= 12 coi như định dạng đúng
            if (parseInt(mm) <= 12) {
                return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/20${yy}`;
            } 
            // Nếu mm > 12 thì đây là định dạng sai ddyyMM -> cần đảo lại
            else {
                let dd2 = str.substring(0, 2);   // ngày
                let yy2 = str.substring(2, 4);   // năm
                let mm2 = str.substring(4, 6);   // tháng
                return `${dd2.padStart(2, '0')}/${mm2.padStart(2, '0')}/20${yy2}`;
            }
        }

        // Nếu không khớp thì trả nguyên
        return raw;
    }

    analyzeIMEI() {
        this.imeiList.clear();
        this.callRecords.forEach(record => {
            if (record.imei) {
                this.imeiList.add(record.imei);
            }
        });
    }

    analyzeContacts() {
        this.contacts.clear();
        this.contactsWithTimeData.clear();
        console.log('Starting contacts analysis...');
        console.log('Total call records:', this.callRecords.length);
        console.log('Owner phone:', this.subscriberInfo.phoneNumber);
        
        this.callRecords.forEach(record => {
            if (record.contactNumber && record.contactNumber !== this.subscriberInfo.phoneNumber) {
                // Lưu dữ liệu chi tiết với timestamp
                if (!this.contactsWithTimeData.has(record.contactNumber)) {
                    this.contactsWithTimeData.set(record.contactNumber, {
                        number: record.contactNumber,
                        interactions: [], // Lưu tất cả tương tác với timestamp
                        totalCount: 0,
                        types: new Set()
                    });
                }
                
                const contactData = this.contactsWithTimeData.get(record.contactNumber);
                contactData.interactions.push({
                    timestamp: record.timestamp,
                    type: record.callTypeReadable,
                    duration: record.duration
                });
                contactData.totalCount++;
                contactData.types.add(record.callTypeReadable);
                
                // Cập nhật contacts tổng (giữ nguyên logic cũ)
                if (!this.contacts.has(record.contactNumber)) {
                    this.contacts.set(record.contactNumber, {
                        number: record.contactNumber,
                        count: 0,
                        types: new Set()
                    });
                }
                const contact = this.contacts.get(record.contactNumber);
                contact.count++;
                contact.types.add(record.callTypeReadable);
            }
        });
        
        console.log('Contacts analysis completed. Total unique contacts:', this.contacts.size);
        console.log('Sample contacts:', Array.from(this.contacts.values()).slice(0, 10));
    }
    


    analyzeTimePatterns() {
        // Reset stats
        this.hourlyStats.fill(0);
        this.weeklyStats.fill(0);

        this.callRecords.forEach(record => {
            if (record.timestamp && record.timestamp !== '') {
                try {
                    // Sử dụng parseDateFromTimestamp để parse chính xác
                    const date = this.parseDateFromTimestamp(record.timestamp);
                    if (date && !isNaN(date.getTime())) {
                        const hour = date.getHours();
                        const day = date.getDay();
                        
                        // Tính cả cuộc gọi và tin nhắn
                        this.hourlyStats[hour]++;
                        this.weeklyStats[day]++;
                    }
                } catch (error) {
                    console.warn('Invalid timestamp:', record.timestamp, error);
                }
            }
        });
        
        console.log('Time patterns analysis completed. Hourly stats:', this.hourlyStats);
        console.log('Weekly stats:', this.weeklyStats);
    }

    analyzeLocations() {
        this.locationStats.clear();
        this.locationsWithTimeData.clear();
        
        this.callRecords.forEach(record => {
            if (record.lac && record.cell) {
                const key = `${record.lac}-${record.cell}`;
                
                // Cập nhật locationStats (như cũ)
                if (!this.locationStats.has(key)) {
                    this.locationStats.set(key, {
                        lac: record.lac,
                        cell: record.cell,
                        provinceCode: record.provinceCode,
                        location: record.location,
                        stationName: record.stationName || '',
                        googleMapsLink: record.googleMapsLink || '',
                        count: 0
                    });
                }
                this.locationStats.get(key).count++;
                
                // Lưu dữ liệu thời gian chi tiết
                if (record.timestamp && record.timestamp !== '') {
                    if (!this.locationsWithTimeData.has(key)) {
                        this.locationsWithTimeData.set(key, []);
                    }
                    this.locationsWithTimeData.get(key).push({
                        timestamp: record.timestamp,
                        type: record.callType || 'Unknown',
                        duration: record.duration || 0,
                        sourceNumber: record.sourceNumber,
                        targetNumber: record.targetNumber,
                        record: record // Lưu toàn bộ record để có thể truy cập sau
                    });
                }
            }
        });
        
        // Tải dữ liệu đã lưu từ localStorage
        this.loadLocationDataFromStorage();
        
        console.log('Location analysis completed. Total locations:', this.locationStats.size);
        console.log('Locations with time data:', this.locationsWithTimeData.size);
    }

    analyzeChanges() {
        this.imeiChanges = [];
        this.imsiChanges = [];
        
        const imeiTimeline = new Map();
        const imsiTimeline = new Map();

        this.callRecords.forEach(record => {
            if (record.imei && record.timestamp) {
                if (!imeiTimeline.has(record.imei)) {
                    imeiTimeline.set(record.imei, record.timestamp);
                }
            }
            if (record.imsi && record.timestamp) {
                if (!imsiTimeline.has(record.imsi)) {
                    imsiTimeline.set(record.imsi, record.timestamp);
                }
            }
        });

        // Sort by timestamp
        const sortedIMEI = Array.from(imeiTimeline.entries()).sort((a, b) => new Date(a[1]) - new Date(b[1]));
        const sortedIMSI = Array.from(imsiTimeline.entries()).sort((a, b) => new Date(a[1]) - new Date(b[1]));

        sortedIMEI.forEach((entry, index) => {
            this.imeiChanges.push({
                changeNumber: index + 1,
                imei: entry[0],
                timestamp: entry[1]
            });
        });

        sortedIMSI.forEach((entry, index) => {
            this.imsiChanges.push({
                changeNumber: index + 1,
                imsi: entry[0],
                timestamp: entry[1]
            });
        });
    }

    // UI Update Methods
    updateSubscriberInfo(isEditMode = false) {
        try {
        const container = document.getElementById('subscriberInfo');
            if (!container) {
                console.error('subscriberInfo container not found');
                return;
            }
            
        // Sử dụng thông tin hiển thị riêng biệt, nếu không có thì dùng thông tin gốc
        let info = this.subscriberInfoDisplay;
        
        // Nếu subscriberInfoDisplay rỗng hoặc không có dữ liệu, sử dụng subscriberInfo gốc
        if (!info || Object.keys(info).length === 0 || !info.phoneNumber) {
            info = this.subscriberInfo;
        }
        
        if (!info) {
            console.error('subscriberInfo data not found');
            return;
        }
            
            // Debug log để kiểm tra thông tin subscriber
            console.log('Updating subscriber info with:', info);
            console.log('Phone number:', info.phoneNumber);
            console.log('Template:', this.currentTemplate);

            if (isEditMode) {
                // Chế độ chỉnh sửa - hiển thị form input
                container.innerHTML = '<div class="info-card">' +
                    '<div class="info-label">Số điện thoại</div>' +
                    '<input type="text" class="info-input" id="editPhoneNumber" value="' + (info.phoneNumber || '') + '">' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Họ tên chủ thuê bao</div>' +
                    '<input type="text" class="info-input" id="editName" value="' + (info.name || '') + '">' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Ngày sinh</div>' +
                    '<input type="text" class="info-input" id="editBirthDate" value="' + (info.birthDate || '') + '">' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Địa chỉ</div>' +
                    '<textarea class="info-textarea" id="editAddress" rows="3">' + (info.address || '') + '</textarea>' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Số giấy tờ tùy thân</div>' +
                    '<input type="text" class="info-input" id="editIdNumber" value="' + (info.idNumber || '') + '">' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Ngày cấp ID</div>' +
                    '<input type="text" class="info-input" id="editIdIssueDate" value="' + (info.idIssueDate || '') + '">' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Ngày kích hoạt</div>' +
                    '<input type="text" class="info-input" id="editActivationDate" value="' + (info.activationDate || '') + '">' +
                    '</div>';
            } else {
                // Chế độ xem - hiển thị thông tin thông thường
                container.innerHTML = '<div class="info-card">' +
                    '<div class="info-label">Số điện thoại</div>' +
                    '<div class="info-value">' + (info.phoneNumber || 'N/A') + '</div>' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Họ tên chủ thuê bao</div>' +
                    '<div class="info-value">' + (info.name || 'N/A') + '</div>' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Ngày sinh</div>' +
                    '<div class="info-value">' + (info.birthDate || 'N/A') + '</div>' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Địa chỉ</div>' +
                    '<div class="info-value">' + (info.address || 'N/A') + '</div>' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Số giấy tờ tùy thân</div>' +
                    '<div class="info-value">' + (info.idNumber || 'N/A') + '</div>' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Ngày cấp ID</div>' +
                    '<div class="info-value">' + (info.idIssueDate || 'N/A') + '</div>' +
                    '</div>' +
                    '<div class="info-card">' +
                    '<div class="info-label">Ngày kích hoạt</div>' +
                    '<div class="info-value">' + (info.activationDate || 'N/A') + '</div>' +
                    '</div>';
            }
            
            console.log('Subscriber info updated successfully');
        } catch (error) {
            console.error('Error updating subscriber info:', error);
        }
    }

    // Subscriber Edit Methods
    editSubscriberInfo() {
        try {
            // Hiển thị form chỉnh sửa
            this.updateSubscriberInfo(true);
            
            // Ẩn nút chỉnh sửa, hiện nút lưu và hủy
            document.getElementById('editSubscriberBtn').style.display = 'none';
            document.getElementById('saveSubscriberBtn').style.display = 'inline-block';
            document.getElementById('cancelSubscriberBtn').style.display = 'inline-block';
            
            console.log('Edit mode activated');
        } catch (error) {
            console.error('Error entering edit mode:', error);
        }
    }

    saveSubscriberInfo() {
        try {
            // Lấy dữ liệu từ form
            const updatedInfo = {
                phoneNumber: document.getElementById('editPhoneNumber').value.trim(),
                name: document.getElementById('editName').value.trim(),
                birthDate: document.getElementById('editBirthDate').value.trim(),
                address: document.getElementById('editAddress').value.trim(),
                idNumber: document.getElementById('editIdNumber').value.trim(),
                idIssueDate: document.getElementById('editIdIssueDate').value.trim(),
                activationDate: document.getElementById('editActivationDate').value.trim()
            };

            // Chỉ lưu thông tin hiển thị, không ảnh hưởng đến logic phân tích
            this.subscriberInfoDisplay = { ...this.subscriberInfoDisplay, ...updatedInfo };

            // Lưu vào localStorage với key riêng cho file hiện tại
            const storageKey = this.getDisplayStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(this.subscriberInfoDisplay));

            // Chuyển về chế độ xem
            this.cancelEditSubscriberInfo();

            // Hiển thị thông báo thành công
            this.showCopyMessage('Thông tin thuê bao hiển thị đã được lưu thành công!', 'success');

            console.log('Subscriber display info saved:', this.subscriberInfoDisplay);
        } catch (error) {
            console.error('Error saving subscriber display info:', error);
            this.showCopyMessage('Có lỗi xảy ra khi lưu thông tin hiển thị!', 'error');
        }
    }

    cancelEditSubscriberInfo() {
        try {
            // Chuyển về chế độ xem với thông tin hiển thị
            this.updateSubscriberInfo(false);
            
            // Ẩn nút lưu và hủy, hiện nút chỉnh sửa
            document.getElementById('editSubscriberBtn').style.display = 'inline-block';
            document.getElementById('saveSubscriberBtn').style.display = 'none';
            document.getElementById('cancelSubscriberBtn').style.display = 'none';
            
            console.log('Edit mode cancelled');
        } catch (error) {
            console.error('Error cancelling edit mode:', error);
        }
    }

    saveSubscriberToStorage() {
        try {
            if (this.subscriberInfo) {
                localStorage.setItem('cdr_subscriber_info', JSON.stringify(this.subscriberInfo));
                console.log('Subscriber info saved to localStorage');
            }
        } catch (error) {
            console.error('Error saving subscriber info to storage:', error);
        }
    }

    getDisplayStorageKey() {
        // Tạo key riêng cho từng file dựa trên tên file
        return this.currentFileName ? `subscriberInfoDisplay_${this.currentFileName}` : 'subscriberInfoDisplay_default';
    }

    loadSubscriberDisplayFromStorage() {
        try {
            const storageKey = this.getDisplayStorageKey();
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsedData = JSON.parse(stored);
                // Chỉ load nếu có dữ liệu hợp lệ
                if (parsedData && typeof parsedData === 'object' && Object.keys(parsedData).length > 0) {
                    this.subscriberInfoDisplay = parsedData;
                    console.log(`Subscriber display info loaded from storage for ${this.currentFileName}:`, this.subscriberInfoDisplay);
                } else {
                    this.subscriberInfoDisplay = {};
                }
            } else {
                this.subscriberInfoDisplay = {};
            }
        } catch (error) {
            console.error('Error loading subscriber display info from storage:', error);
            this.subscriberInfoDisplay = {};
        }
    }

    resetSubscriberDisplayToOriginal() {
        try {
            // Xóa thông tin hiển thị và sử dụng dữ liệu gốc
            this.subscriberInfoDisplay = {};
            const storageKey = this.getDisplayStorageKey();
            localStorage.removeItem(storageKey);
            
            // Cập nhật UI với dữ liệu gốc
            this.updateSubscriberInfo(false);
            
            this.showCopyMessage('Đã reset thông tin thuê bao về dữ liệu gốc từ file Excel', 'success');
            console.log('Subscriber display reset to original data');
        } catch (error) {
            console.error('Error resetting subscriber display:', error);
            this.showCopyMessage('Có lỗi xảy ra khi reset thông tin!', 'error');
        }
    }


    confirmClearCurrentFileData() {
        if (!this.currentFileName) {
            this.showCopyMessage('Không có file nào đang được mở!', 'warning');
            return;
        }

        const confirmMessage = `Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu đã lưu của file "${this.currentFileName}"?\n\n⚠️ Hành động này sẽ xóa:\n• Thông tin thuê bao đã chỉnh sửa\n• Dữ liệu IMEI đã tra cứu và models\n• TẤT CẢ thông tin liên lạc đã bổ sung (Zalo, Facebook, Telegram, Ghi chú)\n• Dữ liệu vị trí đã chỉnh sửa và Google Maps links\n• Cookies IMEI đã lưu\n• Dữ liệu bản đồ đã tạo\n• Tất cả dữ liệu khác liên quan\n\n❌ Không thể hoàn tác sau khi xóa!`;
        
        if (confirm(confirmMessage)) {
            this.clearCurrentFileData();
        }
    }

    clearCurrentFileData() {
        try {
            if (!this.currentFileName) {
                this.showCopyMessage('Không có file nào để xóa dữ liệu!', 'error');
                return;
            }

            // Danh sách các key cần xóa cho file hiện tại
            const keysToRemove = [
                `subscriberInfoDisplay_${this.currentFileName}`,
                `cdr_subscriber_info_${this.currentFileName}`,
                `cdr_location_data_${this.currentFileName}`,
                `cdr_imei_data_${this.currentFileName}`,
                `cdr_contact_data_${this.currentFileName}`,
                `cdr_call_history_${this.currentFileName}`,
                `cdr_imei_changes_${this.currentFileName}`,
                `cdr_imsi_changes_${this.currentFileName}`
            ];

            // Xóa các key localStorage
            let removedCount = 0;
            keysToRemove.forEach(key => {
                if (localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                    removedCount++;
                }
            });

            // Xóa tất cả IMEI models liên quan đến file hiện tại
            const imeiKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('imei_model_') || 
                key.startsWith('imei_note_') || 
                key.startsWith('imei_edited_')
            );
            
            imeiKeys.forEach(key => {
                localStorage.removeItem(key);
                removedCount++;
            });

            // Xóa Google Maps links liên quan đến file hiện tại
            const locationKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('location_') && key.includes(this.currentFileName.replace('.xlsx', ''))
            );
            
            locationKeys.forEach(key => {
                localStorage.removeItem(key);
                removedCount++;
            });

            // Xóa TẤT CẢ dữ liệu liên lạc (contact_data_*)
            const contactKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('contact_data_')
            );
            
            contactKeys.forEach(key => {
                localStorage.removeItem(key);
                removedCount++;
            });

            // Xóa dữ liệu cookies IMEI
            if (localStorage.getItem('imei_cookies')) {
                localStorage.removeItem('imei_cookies');
                removedCount++;
            }

            // Xóa dữ liệu map URL
            if (localStorage.getItem('folium_map_url')) {
                localStorage.removeItem('folium_map_url');
                removedCount++;
            }

            // Xóa tất cả location data keys (location_*)
            const allLocationKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('location_')
            );
            
            allLocationKeys.forEach(key => {
                localStorage.removeItem(key);
                removedCount++;
            });

            // Reset dữ liệu hiện tại trong memory
            this.subscriberInfoDisplay = {};
            
            // Cập nhật UI
            this.updateSubscriberInfo(false);
            this.updateIMEITable();
            this.updateContactsTable();
            this.updateLocationTable();

            // Hiển thị thông báo thành công
            this.showCopyMessage(`Đã xóa thành công ${removedCount} mục dữ liệu của file "${this.currentFileName}"`, 'success');
            
            console.log(`Cleared ${removedCount} data items for file: ${this.currentFileName}`);
            console.log('Removed keys:', [
                ...keysToRemove,
                ...imeiKeys,
                ...locationKeys,
                ...contactKeys,
                ...allLocationKeys,
                'imei_cookies',
                'folium_map_url'
            ].filter(key => localStorage.getItem(key) === null));

        } catch (error) {
            console.error('Error clearing current file data:', error);
            this.showCopyMessage('Có lỗi xảy ra khi xóa dữ liệu!', 'error');
        }
    }

    loadSubscriberFromStorage() {
        try {
            const saved = localStorage.getItem('cdr_subscriber_info');
            if (saved) {
                this.subscriberInfo = { ...this.subscriberInfo, ...JSON.parse(saved) };
                console.log('Subscriber info loaded from localStorage:', this.subscriberInfo);
                return true;
            }
        } catch (error) {
            console.error('Error loading subscriber info from storage:', error);
        }
        return false;
    }

    loadLocationDataFromStorage() {
        try {
            // Load Google Maps links from localStorage
            this.locationStats.forEach((location, key) => {
                const googleMapsKey = `location_${location.lac}_${location.cell}`;
                const savedLink = localStorage.getItem(googleMapsKey);
                if (savedLink) {
                    location.googleMapsLink = savedLink;
                }
            });
            console.log('Loaded location data from storage');
        } catch (error) {
            console.error('Error loading location data from storage:', error);
        }
    }

    loadIMEIDataFromStorage() {
        try {
            // Load IMEI data from localStorage
            this.imeiList.forEach(imei => {
                const model = localStorage.getItem(`imei_model_${imei}`);
                const note = localStorage.getItem(`imei_note_${imei}`);
                
                // Store in a way that can be accessed during export
                if (model || note) {
                    // We'll use the existing localStorage keys during export
                    console.log(`Loaded IMEI data for ${imei}: model=${model}, note=${note}`);
                }
            });
            console.log('Loaded IMEI data from storage');
        } catch (error) {
            console.error('Error loading IMEI data from storage:', error);
        }
    }

    updateIMEITable() {
        try {
        const tbody = document.getElementById('imeiBody');
        const countElement = document.getElementById('uniqueIMEICount');
            const validCountElement = document.getElementById('validIMEICount');
            const invalidCountElement = document.getElementById('invalidIMEICount');
        
            if (!tbody || !countElement || !validCountElement || !invalidCountElement) {
                console.error('IMEI table elements not found');
                return;
            }
            
            // Khởi tạo filteredIMEI nếu chưa có
            if (!this.filteredIMEI || this.filteredIMEI.length === 0) {
                this.filteredIMEI = [];
            }
        
        const imeiArray = Array.from(this.imeiList);
            let validCount = 0;
            let invalidCount = 0;
            
            countElement.textContent = this.imeiList.size;
        tbody.innerHTML = '';

        // Tạo tất cả rows cùng lúc để tránh reflow và làm chậm
        const fragment = document.createDocumentFragment();
        
        imeiArray.forEach((imei, index) => {
                const isValid = imei && imei.length === 15 && /^\d{15}$/.test(imei);
                if (isValid) validCount++;
                else invalidCount++;
                
                // Tính tần suất cho IMEI này
                const frequency = this.getIMEIFrequency(imei);
                
                // Tính các khoảng thời gian sử dụng
                const usagePeriods = this.getIMEIUsagePeriods(imei);
                
                            // Lấy dữ liệu đã lưu từ localStorage
                const savedModel = localStorage.getItem(`imei_model_${imei}`) || '';
                const savedNote = localStorage.getItem(`imei_note_${imei}`) || '';
                
                const row = document.createElement('tr');
                row.className = isValid ? '' : 'invalid-imei';
                row.innerHTML = '<td>' + (index + 1) + '</td>' +
                    '<td>' +
                            '<div class="ip-with-copy">' +
                            '<i class="fas fa-copy copy-icon" onclick="cdrAnalyzer.copyToClipboard(\'' + imei + '\')"></i>' +
                            '<input type="text" class="imei-input ip-text" value="' + imei + '" ' +
                                   'data-original-imei="' + imei + '" ' +
                                   'data-index="' + index + '" ' +
                                   'onchange="cdrAnalyzer.updateIMEI(this)" ' +
                                   'onblur="cdrAnalyzer.updateIMEI(this)" ' +
                                   'onkeypress="if(event.key===\'Enter\') this.blur()">' +
                        '</div>' +
                    '</td>' +
                    '<td>' + frequency + '</td>' +
                    '<td>' +
                        '<input type="text" class="model-input" placeholder="Nhập model" ' +
                               'data-imei="' + imei + '" ' +
                               'value="' + savedModel + '" ' +
                               'onchange="cdrAnalyzer.updateModel(this)" ' +
                               'onblur="cdrAnalyzer.updateModel(this)" ' +
                               'onkeypress="if(event.key===\'Enter\') this.blur()">' +
                    '</td>' +
                    '<td style="white-space: normal; word-break: break-word; max-width: 300px;">' + (usagePeriods || '-') + '</td>' +
                    '<td>' +
                        '<input type="text" class="note-input" placeholder="Nhập ghi chú" ' +
                               'data-imei="' + imei + '" ' +
                               'value="' + savedNote + '" ' +
                               'onchange="cdrAnalyzer.updateNote(this)" ' +
                               'onblur="cdrAnalyzer.updateNote(this)" ' +
                               'onkeypress="if(event.key===\'Enter\') this.blur()">' +
                    '</td>';
            fragment.appendChild(row);
        });
        
        // Thêm tất cả rows vào tbody cùng lúc
        tbody.appendChild(fragment);
            
            validCountElement.textContent = validCount;
            invalidCountElement.textContent = invalidCount;
            
            // Cập nhật số lượng kết quả
            const resultsSpan = document.getElementById('imeiResults');
            if (resultsSpan) {
                resultsSpan.textContent = `📊 Kết quả: ${this.imeiList.size}/${this.imeiList.size}`;
            }
            
            console.log('IMEI table updated successfully');
        } catch (error) {
            console.error('Error updating IMEI table:', error);
        }
    }

    getIMEIFrequency(imei) {
        try {
            if (!this.callRecords || !this.callRecords.length) return 0;
            
            let count = 0;
            this.callRecords.forEach(record => {
                if (record.imei === imei) {
                    count++;
                }
            });
            
            return count;
        } catch (error) {
            console.error('Error calculating IMEI frequency:', error);
            return 0;
        }
    }
    
    // Tính toán các khoảng thời gian sử dụng IMEI
    getIMEIUsagePeriods(imei) {
        try {
            if (!this.callRecords || !this.callRecords.length) {
                console.warn('No call records available for IMEI:', imei);
                return '';
            }
            
            // Lấy tất cả records của IMEI này
            const allIMEIRecords = this.callRecords.filter(record => {
                const recordIMEI = (record.imei || '').trim();
                return recordIMEI === imei;
            });
            
            if (allIMEIRecords.length === 0) {
                // IMEI không có trong callRecords, có thể do filter hoặc không có dữ liệu
                // Trả về empty string thay vì '-'
                return '';
            }
            
            // Lấy các records có timestamp hợp lệ
            const imeiRecords = allIMEIRecords
                .filter(record => record.timestamp !== null && record.timestamp !== undefined && record.timestamp !== '')
                .map(record => {
                    // Sử dụng parseDateFromTimestamp để parse đúng định dạng dd/mm/yyyy
                    let date = null;
                    const timestamp = record.timestamp;
                    
                    if (timestamp instanceof Date) {
                        date = timestamp;
                    } else {
                        // Sử dụng parseDateFromTimestamp để parse đúng dd/mm/yyyy
                        date = this.parseDateFromTimestamp(timestamp);
                        
                        // Nếu không parse được, thử parse như Excel date
                        if (!date && this.parseExcelDateTime) {
                            const parsedDateStr = this.parseExcelDateTime(timestamp);
                            if (parsedDateStr) {
                                // parseExcelDateTime trả về string dd/mm/yyyy, cần parse lại
                                date = this.parseDateFromTimestamp(parsedDateStr);
                            }
                        }
                        
                        // Nếu vẫn không parse được và là number, thử Excel serial date
                        if (!date && typeof timestamp === 'number' && timestamp > 0 && timestamp < 1000000) {
                            // Có thể là Excel serial date (số ngày từ 1900-01-01)
                            const excelEpoch = new Date(1899, 11, 30); // Excel epoch
                            date = new Date(excelEpoch.getTime() + timestamp * 24 * 60 * 60 * 1000);
                        }
                    }
                    
                    return {
                        timestamp: timestamp,
                        date: date,
                        isValid: date && !isNaN(date.getTime())
                    };
                })
                .filter(record => record.isValid)
                .sort((a, b) => a.date.getTime() - b.date.getTime());
            
            // Nếu không có record nào có timestamp hợp lệ, vẫn cố gắng tìm bất kỳ timestamp nào
            if (imeiRecords.length === 0) {
                // Thử tìm record có timestamp, kể cả không hợp lệ
                const recordWithTimestamp = allIMEIRecords.find(r => r.timestamp);
                if (recordWithTimestamp) {
                    // Sử dụng parseDateFromTimestamp để parse đúng định dạng dd/mm/yyyy
                    const timestampStr = String(recordWithTimestamp.timestamp);
                    let date = this.parseDateFromTimestamp(timestampStr);
                    
                    // Nếu không parse được, thử parse như Excel date
                    if (!date && this.parseExcelDateTime) {
                        const parsedDateStr = this.parseExcelDateTime(timestampStr);
                        if (parsedDateStr) {
                            date = this.parseDateFromTimestamp(parsedDateStr);
                        }
                    }
                    
                    if (date && !isNaN(date.getTime())) {
                        // Nếu parse được, sử dụng nó
                        imeiRecords.push({
                            timestamp: timestampStr,
                            date: date,
                            isValid: true
                        });
                    } else {
                        // Nếu vẫn không parse được, nhưng IMEI có trong danh sách
                        // Thử tìm bất kỳ record nào khác có timestamp
                        let foundValidDate = false;
                        for (const rec of allIMEIRecords) {
                            if (rec.timestamp) {
                                const tsStr = String(rec.timestamp);
                                // Sử dụng parseDateFromTimestamp
                                let testDate = this.parseDateFromTimestamp(tsStr);
                                if (!testDate && this.parseExcelDateTime) {
                                    const parsed = this.parseExcelDateTime(tsStr);
                                    if (parsed) testDate = this.parseDateFromTimestamp(parsed);
                                }
                                if (testDate && !isNaN(testDate.getTime())) {
                                    imeiRecords.push({
                                        timestamp: tsStr,
                                        date: testDate,
                                        isValid: true
                                    });
                                    foundValidDate = true;
                                    break;
                                }
                            }
                        }
                        
                        if (!foundValidDate) {
                            console.warn('IMEI has records but no valid timestamp:', imei, 'Total records:', allIMEIRecords.length);
                            // Vẫn trả về empty để người dùng biết có vấn đề với timestamp
                            return '';
                        }
                    }
                } else {
                    // Không có timestamp nào - IMEI có trong danh sách nhưng không có timestamp
                    console.warn('IMEI in list but no timestamp in any record:', imei, 'Total records:', allIMEIRecords.length);
                    return '';
                }
            }
            
            // Sắp xếp tất cả records theo thời gian để xác định khi nào IMEI bị thay đổi
            const allRecords = this.callRecords
                .filter(record => record.timestamp)
                .map(record => {
                    // Sử dụng parseDateFromTimestamp để parse đúng định dạng dd/mm/yyyy
                    let date = this.parseDateFromTimestamp(record.timestamp);
                    
                    // Nếu không parse được, thử parse như Excel date
                    if (!date && this.parseExcelDateTime) {
                        const parsedDateStr = this.parseExcelDateTime(record.timestamp);
                        if (parsedDateStr) {
                            date = this.parseDateFromTimestamp(parsedDateStr);
                        }
                    }
                    
                    // Nếu vẫn không parse được, thử new Date (fallback)
                    if (!date) {
                        date = new Date(record.timestamp);
                    }
                    
                    return {
                        timestamp: record.timestamp,
                        date: date,
                        imei: (record.imei || '').trim(), // Loại bỏ khoảng trắng và xử lý empty
                        isValid: date && !isNaN(date.getTime())
                    };
                })
                .filter(record => record.isValid)
                .sort((a, b) => a.date.getTime() - b.date.getTime());
            
            if (allRecords.length === 0) {
                console.warn('No valid timestamps in any call records');
                return '';
            }
            
            // Tìm các khoảng thời gian liên tiếp mà IMEI được sử dụng
            const periods = [];
            let periodStart = null;
            
            for (let i = 0; i < allRecords.length; i++) {
                const record = allRecords[i];
                const currentIMEI = record.imei;
                
                // Bỏ qua IMEI trống (empty string)
                if (!currentIMEI || currentIMEI === '') {
                    continue;
                }
                
                if (currentIMEI === imei) {
                    if (periodStart === null) {
                        // Bắt đầu khoảng thời gian mới - thời gian phát hiện đầu tiên
                        periodStart = record.date;
                    }
                } else {
                    // Gặp IMEI khác (không trống)
                    if (periodStart !== null) {
                        // Đếm số lần IMEI xuất hiện trong khoảng thời gian từ periodStart đến record hiện tại
                        const imeiCountInPeriod = allRecords
                            .filter(r => {
                                const rIMEI = (r.imei || '').trim();
                                return rIMEI === imei && 
                                       r.date.getTime() >= periodStart.getTime() && 
                                       r.date.getTime() < record.date.getTime();
                            })
                            .length;
                        
                        // Nếu IMEI chỉ xuất hiện 1 lần, start và end phải giống nhau
                        if (imeiCountInPeriod === 1) {
                            periods.push({ 
                                start: periodStart, 
                                end: periodStart // Cùng thời gian
                            });
                        } else {
                            // Kết thúc khoảng thời gian - thời gian xuất hiện đầu tiên của IMEI khác
                            periods.push({ 
                                start: periodStart, 
                                end: record.date // Thời gian xuất hiện đầu tiên của IMEI khác
                            });
                        }
                        periodStart = null;
                    }
                }
            }
            
            // Nếu IMEI vẫn đang được sử dụng đến cuối (không có IMEI khác sau đó)
            if (periodStart !== null) {
                // Lấy thời gian cuối cùng của IMEI này làm thời gian kết thúc
                const lastIMEIRecord = imeiRecords[imeiRecords.length - 1];
                if (lastIMEIRecord) {
                    // Nếu IMEI chỉ xuất hiện 1 lần, start và end phải giống nhau
                    if (imeiRecords.length === 1) {
                        periods.push({ 
                            start: periodStart, 
                            end: periodStart // Cùng thời gian
                        });
                    } else {
                        periods.push({ 
                            start: periodStart, 
                            end: lastIMEIRecord.date 
                        });
                    }
                }
            }
            
            if (periods.length === 0) return '';
            
            // Format các khoảng thời gian
            const formatDate = (date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            };
            
            return periods.map(period => {
                // Nếu thời gian đầu và cuối giống nhau (chỉ xuất hiện 1 lần), hiển thị dạng: dd/mm/yyyy - dd/mm/yyyy
                return `${formatDate(period.start)} - ${formatDate(period.end)}`;
            }).join('; ');
            
        } catch (error) {
            console.error('Error calculating IMEI usage periods:', error);
            return '';
        }
    }

    // Sửa: IMEI validation logic
    isValidIMEI(imei) {
        // IMEI 15 số là hợp lệ
        return imei && imei.length === 15 && /^\d{15}$/.test(imei);
    }

    updateIMEIStats() {
        try {
            const countElement = document.getElementById('uniqueIMEICount');
            const validCountElement = document.getElementById('validIMEICount');
            const invalidCountElement = document.getElementById('invalidIMEICount');
            
            if (!countElement || !validCountElement || !invalidCountElement) {
                return;
            }
            
            const imeiArray = Array.from(this.imeiList);
            let validCount = 0;
            let invalidCount = 0;
            
            imeiArray.forEach(imei => {
                const isValid = this.isValidIMEI(imei);
                if (isValid) validCount++;
                else invalidCount++;
            });
            
            countElement.textContent = imeiArray.length;
            validCountElement.textContent = validCount;
            invalidCountElement.textContent = invalidCount;
            
            console.log('IMEI stats updated successfully');
        } catch (error) {
            console.error('Error updating IMEI stats:', error);
        }
    }

    
    showAllContacts(page = 1, pageSize = 200) {
        try {
            console.log('showAllContacts called with page:', page, 'pageSize:', pageSize);
            console.log('Total contacts:', this.contacts.size);
            
            const tbody = document.getElementById('allContactsBody');
            if (!tbody) {
                console.error('allContactsBody not found');
                return;
            }

            const sortedContacts = Array.from(this.contacts.values())
                .sort((a, b) => b.count - a.count);

            console.log('Sorted contacts:', sortedContacts.length);

            const totalPages = Math.ceil(sortedContacts.length / pageSize);
            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            const pageData = sortedContacts.slice(start, end);

            tbody.innerHTML = '';
            const fragment = document.createDocumentFragment();
            pageData.forEach((contact, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${start + index + 1}</td>
                    <td>${contact.number || ''}</td>
                    <td>${contact.count || ''}</td>`;
                fragment.appendChild(row);
            });
            tbody.appendChild(fragment);

            // Thêm phân trang
            const modal = this.modalElements.get('allContactsModal');
            if (!modal) {
                console.error('allContactsModal not found in modalElements');
                console.log('Available modals:', Array.from(this.modalElements.keys()));
                return;
            }
            
            let footer = modal.querySelector('.pagination');
            if (!footer) {
                footer = document.createElement('div');
                footer.className = 'pagination';
                footer.style.textAlign = 'center';
                footer.style.marginTop = '10px';
                modal.querySelector('.modal-body').appendChild(footer);
            }
            footer.innerHTML = `
                <button ${page<=1?'disabled':''}
                    onclick="cdrAnalyzer.showAllContacts(${page-1},${pageSize})">◀ Trước</button>
                Trang ${page}/${totalPages}
                <button ${page>=totalPages?'disabled':''}
                    onclick="cdrAnalyzer.showAllContacts(${page+1},${pageSize})">Sau ▶</button>
            `;

            console.log('About to show allContactsModal');
            this.showModal('allContactsModal');
        } catch (error) {
            console.error('Error showing all contacts:', error);
        }
    }

    hideAllContacts() {
        this.hideModal('allContactsModal');
    }

    updateContactsTable() {
        try {
            // Sử dụng dữ liệu đã lọc theo thời gian nếu có, ngược lại dùng dữ liệu tổng
            let dataToShow;
            
            if (this.filteredContactsByTime.size > 0) {
                // Sử dụng dữ liệu đã lọc theo thời gian
                dataToShow = Array.from(this.filteredContactsByTime.values())
                    .sort((a, b) => b.count - a.count);
            } else {
                // Sử dụng dữ liệu tổng
                dataToShow = Array.from(this.contacts.values())
                    .sort((a, b) => b.count - a.count);
            }

            // Set filtered data
            this.filteredContacts = [...dataToShow];
            
            // Update pagination and render
            this.updateContactsPagination();
            this.renderContactsPage();
            
        } catch (error) {
            console.error('Error updating contacts table:', error);
        }
    }

    updateContactsPagination() {
        const totalItems = this.filteredContacts.length;
        this.contactsTotalPages = Math.ceil(totalItems / this.contactsPageSize);
        
        // Reset to first page if current page is out of bounds
        if (this.contactsCurrentPage > this.contactsTotalPages) {
            this.contactsCurrentPage = 1;
        }
        
        const paginationContainer = document.getElementById('contactsPagination');
        if (totalItems > 0) {
            paginationContainer.style.display = 'flex';
            this.updateContactsPaginationControls();
        } else {
            paginationContainer.style.display = 'none';
        }
    }

    updateContactsPaginationControls() {
        const firstBtn = document.getElementById('contactsFirstBtn');
        const prevBtn = document.getElementById('contactsPrevBtn');
        const nextBtn = document.getElementById('contactsNextBtn');
        const lastBtn = document.getElementById('contactsLastBtn');
        const pageInput = document.getElementById('contactsPageInput');
        const totalPagesDisplay = document.getElementById('contactsTotalPagesDisplay');
        
        if (firstBtn && prevBtn && nextBtn && lastBtn && pageInput && totalPagesDisplay) {
            firstBtn.disabled = this.contactsCurrentPage <= 1;
            prevBtn.disabled = this.contactsCurrentPage <= 1;
            nextBtn.disabled = this.contactsCurrentPage >= this.contactsTotalPages;
            lastBtn.disabled = this.contactsCurrentPage >= this.contactsTotalPages;
            
            pageInput.value = this.contactsCurrentPage;
            pageInput.max = this.contactsTotalPages;
            totalPagesDisplay.textContent = this.contactsTotalPages;
        }
    }
    
    contactsFirstPage() {
        this.contactsCurrentPage = 1;
        this.renderContactsPage();
    }
    
    contactsPreviousPage() {
        if (this.contactsCurrentPage > 1) {
            this.contactsCurrentPage--;
            this.renderContactsPage();
        }
    }
    
    contactsNextPage() {
        if (this.contactsCurrentPage < this.contactsTotalPages) {
            this.contactsCurrentPage++;
            this.renderContactsPage();
        }
    }
    
    contactsLastPage() {
        this.contactsCurrentPage = this.contactsTotalPages;
        this.renderContactsPage();
    }
    
    contactsGoToPage(page) {
        if (page >= 1 && page <= this.contactsTotalPages) {
            this.contactsCurrentPage = page;
            this.renderContactsPage();
        } else {
            const pageInput = document.getElementById('contactsPageInput');
            if (pageInput) {
                pageInput.value = this.contactsCurrentPage;
            }
        }
    }

    renderContactsPage() {
        const tbody = document.getElementById('contactsBody');
        tbody.innerHTML = '';
        
        // Đảm bảo dữ liệu phân trang được cập nhật đúng
        this.filteredContacts = this.filteredContacts || [];
        this.contactsTotalPages = Math.ceil(this.filteredContacts.length / this.contactsPageSize);
        
        // Đảm bảo currentPage không vượt quá totalPages
        if (this.contactsTotalPages > 0 && this.contactsCurrentPage > this.contactsTotalPages) {
            this.contactsCurrentPage = this.contactsTotalPages;
        }
        if (this.contactsCurrentPage < 1) {
            this.contactsCurrentPage = 1;
        }
        
        const startIndex = (this.contactsCurrentPage - 1) * this.contactsPageSize;
        const endIndex = Math.min(startIndex + this.contactsPageSize, this.filteredContacts.length);
        const pageData = this.filteredContacts.slice(startIndex, endIndex);
        
        pageData.forEach((contact, index) => {
            const actualIndex = startIndex + index;
            const row = document.createElement('tr');
            const phoneNumber = contact.number || contact.phoneNumber || '';
            
            // Lấy dữ liệu đã lưu từ localStorage
            const contactData = this.getContactDataFromStorage(phoneNumber);
            
            row.innerHTML = `
                <td>${actualIndex + 1}</td>
                <td>
                    <div class="ip-with-copy">
                        <i class="fas fa-copy copy-icon" onclick="cdrAnalyzer.copyToClipboard('${phoneNumber}')"></i>
                        <span class="ip-text"><strong>${phoneNumber}</strong></span>
                    </div>
                </td>
                <td>${contact.count || ''}</td>
                <td class="contact-editable-cell">
                    <input type="text" 
                           value="${contactData.zalo || ''}" 
                           placeholder="Nhập Zalo..."
                           onblur="cdrAnalyzer.saveContactData('${phoneNumber}', 'zalo', this.value)"
                           onkeypress="if(event.key==='Enter') this.blur()">
                </td>
                <td class="contact-editable-cell">
                    <input type="text" 
                           value="${contactData.facebook || ''}" 
                           placeholder="Nhập Facebook..."
                           onblur="cdrAnalyzer.saveContactData('${phoneNumber}', 'facebook', this.value)"
                           onkeypress="if(event.key==='Enter') this.blur()">
                </td>
                <td class="contact-editable-cell">
                    <input type="text" 
                           value="${contactData.telegram || ''}" 
                           placeholder="Nhập Telegram..."
                           onblur="cdrAnalyzer.saveContactData('${phoneNumber}', 'telegram', this.value)"
                           onkeypress="if(event.key==='Enter') this.blur()">
                </td>
                <td class="contact-editable-cell">
                    <input type="text" 
                           value="${contactData.note || ''}" 
                           placeholder="Nhập ghi chú..."
                           onblur="cdrAnalyzer.saveContactData('${phoneNumber}', 'note', this.value)"
                           onkeypress="if(event.key==='Enter') this.blur()">
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Luôn cập nhật pagination controls sau khi render
        this.updateContactsPaginationControls();
    }

    // Duplicate functions removed - using the ones defined earlier

    changeContactsPageSize() {
        const pageSizeSelect = document.getElementById('contactsPageSize');
        if (pageSizeSelect) {
            this.contactsPageSize = parseInt(pageSizeSelect.value);
            this.contactsCurrentPage = 1; // Reset to first page
            this.updateContactsPagination();
            this.renderContactsPage();
        }
    }

    updateLocationTable() {
        try {
            let locationsToShow;
            
            // Ưu tiên 1: Tìm kiếm theo số liên lạc cụ thể
            if (this.locationContactSearchData && this.filteredLocationsBySpecificContact.length > 0) {
                locationsToShow = [...this.filteredLocationsBySpecificContact];
            }
            // Ưu tiên 2: Lọc theo thời gian
            else if (this.filteredLocationsByTime.size > 0) {
                locationsToShow = [];
                for (const [key, interactions] of this.filteredLocationsByTime.entries()) {
                    // Tìm location trong locationStats bằng key (lac-cell)
                    let originalData = this.locationStats.get(key);
                    
                    // Nếu không tìm thấy, thử tìm bằng cách khác
                    if (!originalData) {
                        // Thử tìm bằng cách split key
                        const [lac, cell] = key.split('-');
                        if (lac && cell) {
                            // Tìm trong locationStats với key khác có thể
                            for (const [statsKey, statsValue] of this.locationStats.entries()) {
                                if (statsValue.lac === lac && statsValue.cell === cell) {
                                    originalData = statsValue;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (originalData) {
                        locationsToShow.push({
                            ...originalData,
                            count: interactions.length // Cập nhật count theo dữ liệu đã lọc
                        });
                    } else {
                        // Nếu không tìm thấy trong locationStats, tạo từ interactions
                        if (interactions.length > 0) {
                            const firstInteraction = interactions[0];
                            const [lac, cell] = key.split('-');
                            locationsToShow.push({
                                lac: lac || '',
                                cell: cell || '',
                                provinceCode: firstInteraction.record?.provinceCode || '',
                                stationName: firstInteraction.record?.stationName || firstInteraction.record?.location || '',
                                location: firstInteraction.record?.location || '',
                                count: interactions.length,
                                googleMapsLink: ''
                            });
                        }
                    }
                }
                locationsToShow.sort((a, b) => b.count - a.count);
            } else {
                // Sử dụng dữ liệu gốc
                locationsToShow = Array.from(this.locationStats.values())
                    .sort((a, b) => b.count - a.count);
            }

            // Set filtered data
            this.filteredLocations = [...locationsToShow];
            
            console.log('updateLocationTable - locationsToShow:', locationsToShow.length);
            console.log('updateLocationTable - filteredLocations:', this.filteredLocations.length);
            
            // Update pagination and render
            this.updateLocationPagination();
            this.renderLocationPage();
            
        } catch (error) {
            console.error('Error updating location table:', error);
        }
    }

    updateLocationPagination() {
        const totalItems = this.filteredLocations.length;
        this.locationTotalPages = Math.ceil(totalItems / this.locationPageSize);
        
        // Reset to first page if current page is out of bounds
        if (this.locationCurrentPage > this.locationTotalPages) {
            this.locationCurrentPage = 1;
        }
        
        const paginationContainer = document.getElementById('locationPagination');
        if (totalItems > 0) {
            paginationContainer.style.display = 'flex';
            this.updateLocationPaginationControls();
        } else {
            paginationContainer.style.display = 'none';
        }
    }

    updateLocationPaginationControls() {
        const firstBtn = document.getElementById('locationFirstBtn');
        const prevBtn = document.getElementById('locationPrevBtn');
        const nextBtn = document.getElementById('locationNextBtn');
        const lastBtn = document.getElementById('locationLastBtn');
        const pageInput = document.getElementById('locationPageInput');
        const totalPagesDisplay = document.getElementById('locationTotalPagesDisplay');
        
        if (firstBtn && prevBtn && nextBtn && lastBtn && pageInput && totalPagesDisplay) {
            firstBtn.disabled = this.locationCurrentPage <= 1;
            prevBtn.disabled = this.locationCurrentPage <= 1;
            nextBtn.disabled = this.locationCurrentPage >= this.locationTotalPages;
            lastBtn.disabled = this.locationCurrentPage >= this.locationTotalPages;
            
            pageInput.value = this.locationCurrentPage;
            pageInput.max = this.locationTotalPages;
            totalPagesDisplay.textContent = this.locationTotalPages;
        }
    }
    
    locationFirstPage() {
        this.locationCurrentPage = 1;
        this.renderLocationPage();
    }
    
    locationPreviousPage() {
        if (this.locationCurrentPage > 1) {
            this.locationCurrentPage--;
            this.renderLocationPage();
        }
    }
    
    locationNextPage() {
        if (this.locationCurrentPage < this.locationTotalPages) {
            this.locationCurrentPage++;
            this.renderLocationPage();
        }
    }
    
    locationLastPage() {
        this.locationCurrentPage = this.locationTotalPages;
        this.renderLocationPage();
    }
    
    locationGoToPage(page) {
        if (page >= 1 && page <= this.locationTotalPages) {
            this.locationCurrentPage = page;
            this.renderLocationPage();
        } else {
            const pageInput = document.getElementById('locationPageInput');
            if (pageInput) {
                pageInput.value = this.locationCurrentPage;
            }
        }
    }

    renderLocationPage() {
        const tbody = document.getElementById('locationBody');
        tbody.innerHTML = '';
        
        // Đảm bảo dữ liệu phân trang được cập nhật đúng
        this.filteredLocations = this.filteredLocations || [];
        this.locationTotalPages = Math.ceil(this.filteredLocations.length / this.locationPageSize);
        
        // Đảm bảo currentPage không vượt quá totalPages
        if (this.locationTotalPages > 0 && this.locationCurrentPage > this.locationTotalPages) {
            this.locationCurrentPage = this.locationTotalPages;
        }
        if (this.locationCurrentPage < 1) {
            this.locationCurrentPage = 1;
        }
        
        const startIndex = (this.locationCurrentPage - 1) * this.locationPageSize;
        const endIndex = Math.min(startIndex + this.locationPageSize, this.filteredLocations.length);
        const pageData = this.filteredLocations.slice(startIndex, endIndex);
        
        console.log('renderLocationPage:', {
            currentPage: this.locationCurrentPage,
            totalPages: this.locationTotalPages,
            pageSize: this.locationPageSize,
            filteredLocations: this.filteredLocations.length,
            pageData: pageData.length
        });
        
        pageData.forEach((location, index) => {
            const actualIndex = startIndex + index;
            const row = document.createElement('tr');
            
            // Tải dữ liệu đã lưu từ localStorage cho location này
            const locationKey = `${location.lac}-${location.cell}`;
            const storageKey = `location_${locationKey}`;
            const savedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
            
            // Cập nhật dữ liệu từ localStorage
            if (savedData.provinceCode) {
                location.provinceCode = savedData.provinceCode;
            }
            if (savedData.stationName) {
                location.stationName = savedData.stationName;
            }
            
            // Kiểm tra xem có link Google Maps đã lưu không
            let googleMapsLink = '';
            let linkText = 'Link';
            let linkClass = 'google-maps-link-empty';
            
            if (location.googleMapsLink && location.googleMapsLink.trim() !== '') {
                googleMapsLink = location.googleMapsLink;
                linkText = 'Link';
                linkClass = 'google-maps-link';
            } else if (location.lat && location.lon) {
                googleMapsLink = `https://www.google.com/maps?q=${location.lat},${location.lon}`;
                linkText = 'Link';
                linkClass = 'google-maps-link';
            }
            
            row.innerHTML = `
                <td>${actualIndex + 1}</td>
                <td>${location.lac || ''}</td>
                <td>${location.cell || ''}</td>
                <td class="location-editable-cell">
                    <input type="text" 
                           value="${location.provinceCode || ''}" 
                           class="location-input" 
                           data-field="provinceCode" 
                           data-lac="${location.lac}" 
                           data-cell="${location.cell}"
                           placeholder="Mã tỉnh">
                </td>
                <td class="location-editable-cell">
                    <input type="text" 
                           value="${location.stationName || ''}" 
                           class="location-input" 
                           data-field="stationName" 
                           data-lac="${location.lac}" 
                           data-cell="${location.cell}"
                           placeholder="Tên trạm BTS">
                </td>
                <td>${location.count || ''}</td>
                <td>
                    ${googleMapsLink ? 
                        `<a href="${googleMapsLink}" target="_blank" class="${linkClass}">${linkText}</a>` :
                        `<span class="${linkClass}">${linkText}</span>`
                    }
                    <button class="btn btn-sm btn-outline-primary" onclick="cdrAnalyzer.editGoogleMapsLink('${location.lac}', '${location.cell}')" style="margin-left: 5px;">✏️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Luôn cập nhật pagination controls sau khi render
        this.updateLocationPaginationControls();
    }

    locationPreviousPage() {
        if (this.locationCurrentPage > 1) {
            this.locationCurrentPage--;
            this.renderLocationPage();
        }
    }

    locationNextPage() {
        if (this.locationCurrentPage < this.locationTotalPages) {
            this.locationCurrentPage++;
            this.renderLocationPage();
        }
    }

    changeLocationPageSize() {
        const pageSizeSelect = document.getElementById('locationPageSize');
        if (pageSizeSelect) {
            this.locationPageSize = parseInt(pageSizeSelect.value);
            this.locationCurrentPage = 1; // Reset to first page
            this.updateLocationPagination();
            this.renderLocationPage();
        }
    }

    editGoogleMapsLink(lac, cell) {
        try {
            // Lưu thông tin LAC và Cell để sử dụng khi lưu
            this.currentEditingLocation = { lac, cell };
            
            // Hiển thị thông tin LAC và Cell trong modal
            document.getElementById('editLac').textContent = lac;
            document.getElementById('editCell').textContent = cell;
            
            // Lấy link hiện tại nếu có
            const locationKey = `${lac}-${cell}`;
            let currentLink = '';
            if (this.locationStats.has(locationKey)) {
                const location = this.locationStats.get(locationKey);
                currentLink = location.googleMapsLink || '';
            }
            
            // Điền link hiện tại vào input
            document.getElementById('googleMapsInput').value = currentLink;
            
            // Hiển thị modal
            this.showModal('editGoogleMapsModal');
            
        } catch (error) {
            console.error('Error showing Google Maps edit modal:', error);
        }
    }

    // Hàm mới để cập nhật link Google Maps trong bảng mà không reload toàn bộ
    updateGoogleMapsLinkInTable(lac, cell, newLink) {
        try {
            // Xác định link text và class
            let linkText, linkClass, linkHTML;
            
            if (newLink && newLink.trim() !== '') {
                linkText = 'Link';
                linkClass = 'google-maps-link';
                linkHTML = '<a href="' + newLink + '" target="_blank" class="' + linkClass + '">' + linkText + '</a>';
            } else {
                linkText = 'Link';
                linkClass = 'google-maps-link-empty';
                linkHTML = '<span class="' + linkClass + '">' + linkText + '</span>';
            }

            // Cập nhật trong bảng chính (top 10)
            const mainTable = document.getElementById('locationBody');
            if (mainTable) {
                const rows = mainTable.querySelectorAll('tr');
                rows.forEach(row => {
                    const lacCell = row.cells[1]?.textContent;
                    const cellCell = row.cells[2]?.textContent;
                    if (lacCell === lac && cellCell === cell) {
                        const linkCell = row.cells[6];
                        if (linkCell) {
                            linkCell.innerHTML = linkHTML +
                                '<button class="btn btn-sm btn-outline-primary" onclick="cdrAnalyzer.editGoogleMapsLink(\'' + lac + '\', \'' + cell + '\')" style="margin-left: 5px;">✏️</button>';
                        }
                    }
                });
            }

            // Cập nhật trong modal tất cả locations
            const allLocationsTable = document.getElementById('allLocationsBody');
            if (allLocationsTable) {
                const rows = allLocationsTable.querySelectorAll('tr');
                rows.forEach(row => {
                    const lacCell = row.cells[1]?.textContent;
                    const cellCell = row.cells[2]?.textContent;
                    if (lacCell === lac && cellCell === cell) {
                        const linkCell = row.cells[6];
                        if (linkCell) {
                            linkCell.innerHTML = linkHTML +
                                '<button class="btn btn-sm btn-outline-primary" onclick="cdrAnalyzer.editGoogleMapsLink(\'' + lac + '\', \'' + cell + '\')" style="margin-left: 5px;">✏️</button>';
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error updating Google Maps link in table:', error);
        }
    }

    // Modal methods for Google Maps editing
    hideGoogleMapsModal() {
        this.hideModal('editGoogleMapsModal');
        // Clear current editing location
        this.currentEditingLocation = null;
    }

    saveGoogleMapsLink() {
        try {
            if (!this.currentEditingLocation) {
                console.error('No location selected for editing');
                return;
            }

            const { lac, cell } = this.currentEditingLocation;
            const newLink = document.getElementById('googleMapsInput').value.trim();
            
            if (newLink && newLink !== '') {
                // Validate URL format
                try {
                    new URL(newLink);
                } catch (error) {
                    // Không hiện alert, chỉ log lỗi
                    console.warn('Invalid URL format:', newLink);
                    return;
                }

                // Tìm location trong locationStats và cập nhật
                const locationKey = `${lac}-${cell}`;
                if (this.locationStats.has(locationKey)) {
                    const location = this.locationStats.get(locationKey);
                    location.googleMapsLink = newLink;
                    
                    // Lưu vào localStorage
                    localStorage.setItem(`location_${lac}_${cell}`, newLink);
                    
                    // Cập nhật UI trực tiếp thay vì reload toàn bộ bảng
                    this.updateGoogleMapsLinkInTable(lac, cell, newLink);
                    console.log(`Updated Google Maps link for ${locationKey}: ${newLink}`);
                    
                    // Tự động đóng modal sau khi lưu
                    this.hideGoogleMapsModal();
                }
            }
            // Không hiện alert nếu link rỗng, chỉ log
            else if (newLink === '') {
                console.log('Empty link, clearing Google Maps link');
                // Xóa link nếu input rỗng
                const locationKey = `${lac}-${cell}`;
                if (this.locationStats.has(locationKey)) {
                    const location = this.locationStats.get(locationKey);
                    delete location.googleMapsLink;
                    
                    // Xóa khỏi localStorage
                    localStorage.removeItem(`location_${lac}_${cell}`);
                    
                    // Cập nhật UI
                    this.updateGoogleMapsLinkInTable(lac, cell, '');
                    console.log(`Cleared Google Maps link for ${locationKey}`);
                    
                    // Tự động đóng modal
                    this.hideGoogleMapsModal();
                }
            }
        } catch (error) {
            console.error('Error saving Google Maps link:', error);
            // Không hiện alert, chỉ log lỗi
        }
    }

    updateChangesLog() {
        try {
        const container = document.getElementById('changesLog');
            if (!container) {
                console.error('changesLog container not found');
                return;
            }
            
        let html = '';

        // IMEI changes (sắp xếp theo thời gian tăng dần)
        if (this.imeiChanges.length > 0) {
            html += '<h3>Thay đổi IMEI</h3>';
            // Sắp xếp theo thời gian tăng dần (lần đầu tiên trước, lần cuối sau)
            const sortedIMEIChanges = [...this.imeiChanges].sort((a, b) => {
                const timeA = new Date(a.timestamp);
                const timeB = new Date(b.timestamp);
                return timeA - timeB;
            });
            sortedIMEIChanges.forEach(change => {
                    const formattedTime = this.parseExcelDateTime(change.timestamp);
                    html += '<div class="change-item">' +
                        '<div class="change-time">Thay đổi IMEI lần thứ ' + change.changeNumber + ' vào lúc ' + formattedTime + '</div>' +
                        '<div class="change-description">IMEI: ' + change.imei + '</div>' +
                        '</div>';
            });
        }

        // IMSI changes (sắp xếp theo thời gian tăng dần)
        if (this.imsiChanges.length > 0) {
            html += '<h3>Thay đổi IMSI</h3>';
            // Sắp xếp theo thời gian tăng dần (lần đầu tiên trước, lần cuối sau)
            const sortedIMSIChanges = [...this.imsiChanges].sort((a, b) => {
                const timeA = new Date(a.timestamp);
                const timeB = new Date(b.timestamp);
                return timeA - timeB;
            });
            sortedIMSIChanges.forEach(change => {
                    const formattedTime = this.parseExcelDateTime(change.timestamp);
                    html += '<div class="change-item">' +
                        '<div class="change-time">Thay đổi IMSI lần thứ ' + change.changeNumber + ' vào lúc ' + formattedTime + '</div>' +
                        '<div class="change-description">IMSI: ' + change.imsi + '</div>' +
                        '</div>';
            });
        }

        if (html === '') {
            html = '<p>Không có thay đổi IMEI/IMSI nào được ghi nhận.</p>';
        }

        container.innerHTML = html;
            console.log('Changes log updated successfully');
        } catch (error) {
            console.error('Error updating changes log:', error);
        }
    }

    updateCharts() {
        try {
        // Update hourly chart
            if (this.hourlyChart) {
                // Update data
                this.hourlyChart.data.datasets[0].data = this.hourlyStats;
                
                // Update labels to show time ranges
                this.hourlyChart.data.labels = Array.from({length: 24}, (_, i) => {
                    const nextHour = (i + 1) % 24;
                    return `${i.toString().padStart(2, '0')} - ${nextHour.toString().padStart(2, '0')}`;
                });
                
                this.hourlyChart.update();
            }

        // Update weekly chart
            if (this.weeklyChart) {
        this.weeklyChart.data.datasets[0].data = this.weeklyStats;
        this.weeklyChart.update();
            }
            
            // Update message classification
            this.updateMessageClassification();
            
            console.log('Charts updated successfully');
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }
    
    // Phân loại tin nhắn
    updateMessageClassification() {
        try {
            const container = document.getElementById('messageClassification');
            if (!container) return;
            
            if (!this.callRecords || this.callRecords.length === 0) {
                container.innerHTML = '<p>Chưa có dữ liệu để phân tích.</p>';
                return;
            }
            
            // Danh sách các số ngân hàng (bao gồm số ngắn và số dài)
            // ============================================
            // DANH SÁCH CÁC SỐ NGÂN HÀNG
            // Vị trí này để thêm các ngân hàng mới khi cần
            // Format: 'Tên ngân hàng': ['pattern1', 'pattern2', ...]
            // Lưu ý: Tránh dùng pattern ngắn dễ gây nhầm lẫn (như 'tp', 'mbb')
            // ============================================
            const bankNumbers = {
                'Vietcombank': ['970436', '970415', '970422', '6168', '6169', '6167', 'vietcombank', 'vcb'],
                'Techcombank': ['970407', '970408', '6163', '6164', 'techcombank', 'tcb'],
                'OCB': ['970448', '6165', 'ocb'],
                'MSB': ['970426', '6166', 'msb'],
                'CIMB Bank': ['cimb', 'cimb bank', 'cimbank'], // Thêm CIMB Bank riêng - phải đặt trước MBBank
                'MBBank': ['970422', '970421', '6161', '6162', 'mbbank'], // Bỏ 'mbb' vì dễ nhầm với 'cimb'
                'VPBank': ['970432', '6167', 'vpbank', 'vp'],
                'ACB': ['970416', '6168', 'acb'],
                'TPBank': ['970423', '6169', 'tpbank'], // Bỏ 'tp' vì dễ nhầm với 'otp'
                'Vietinbank': ['970415', '6168', 'vietinbank', 'vietin'],
                'BIDV': ['970418', '6169', 'bidv'],
                'Agribank': ['970405', '6168', 'agribank'],
                'Sacombank': ['970403', '6163', 'sacombank', 'stb'],
                'DongA Bank': ['970406', '6165', 'donga', 'dab'],
                'Eximbank': ['970431', '6164', 'eximbank', 'eib'],
                'HDBank': ['970437', '6166', 'hdbank', 'hdb'],
                'SHB': ['970443', '6161', 'shb'],
                'VIB': ['970441', '6162', 'vib'],
                'SeABank': ['970440', '6167', 'seabank', 'seab'],
                'VietABank': ['970427', '6168', 'vietabank'],
                'NamABank': ['970428', '6169', 'namabank'],
                'PGBank': ['970430', '6161', 'pgbank'],
                'PVcomBank': ['970412', '6162', 'pvcombank'],
                'GPBank': ['970408', '6163', 'gpbank'],
                'BacABank': ['970409', '6164', 'bacabank'],
                'ABBank': ['970425', '6165', 'abbank'],
                'KienLongBank': ['970452', '6166', 'kienlongbank', 'klb'],
                'LienVietPostBank': ['970449', '6167', 'lienvietpostbank', 'lpb'],
                'PublicBank': ['970437', '6168', 'publicbank'],
                'NCB': ['970419', '6169', 'ncb']
            };
            
            // Danh sách các số dịch vụ
            const serviceNumbers = {
                'VIETTEL_POST': ['198', '18008168', '18008000'],
                'LAZADA': ['1900', '1800'],
                'SHOPPEE': ['1900', '1800'],
                'TIKI': ['1900', '1800'],
                'SENDO': ['1900'],
                'FPT': ['1900', '1800'],
                'VNPT': ['1800', '1900'],
                'MOBIFONE': ['1800', '1900'],
                'VINAPHONE': ['1800', '1900']
            };
            
            // ============================================
            // DANH SÁCH CÁC SỐ MẠNG XÃ HỘI
            // Vị trí này để thêm các mạng xã hội mới khi cần
            // Format: 'Tên mạng xã hội': ['pattern1', 'pattern2', ...]
            // ============================================
            const socialNumbers = {
                'Facebook': ['facebook', 'fb'],
                'Tiktok': ['tiktok'],
                'Signal': ['signal'],
                'Lotus': ['lotus'],
                'Zalo': ['zalo', 'zalopay'],
                'Telegram': ['telegram'],
                'WhatsApp': ['whatsapp'],
                'Instagram': ['instagram'],
                'Twitter': ['twitter'],
                'LinkedIn': ['linkedin']
                // Thêm mạng xã hội mới ở đây:
                // 'Tên mạng xã hội mới': ['pattern1', 'pattern2'],
            };
            
            // Lọc tin nhắn
            const messages = this.callRecords.filter(record => {
                const callType = record.callTypeReadable || record.callType || '';
                return callType.includes('Tin nhắn') || callType.includes('SMS') || 
                       callType === 'SMT' || callType === 'SMO';
            });
            
            // Phân loại tin nhắn
            const bankMessages = new Map();
            const serviceMessages = new Map();
            const socialMessages = new Map();
            
            messages.forEach(record => {
                const contactNumber = record.contactNumber || record.targetNumber || record.sourceNumber || '';
                const contactNumberClean = contactNumber.replace(/\s+/g, '').toLowerCase();
                
                // Lấy tên liên lạc nếu có (từ contacts)
                let contactName = '';
                if (this.contacts && this.contacts.has(contactNumber)) {
                    const contactData = this.contacts.get(contactNumber);
                    contactName = (contactData.name || '').toLowerCase();
                }
                
                // Hàm kiểm tra pattern match chính xác (tránh match substring)
                const isExactMatch = (text, pattern) => {
                    if (!text || !pattern) return false;
                    const textLower = text.toLowerCase();
                    const patternLower = pattern.toLowerCase();
                    
                    // Nếu pattern là số, kiểm tra chính xác trong số điện thoại
                    if (/^\d+$/.test(pattern)) {
                        return textLower.includes(patternLower);
                    }
                    
                    // Loại bỏ các trường hợp nhận diện sai
                    // "tp" không match "otp", "braxotp", "cloudotp"
                    if (patternLower === 'tp' && (textLower.includes('otp') || textLower.includes('braxotp') || textLower.includes('cloudotp'))) {
                        return false;
                    }
                    
                    // Loại bỏ các trường hợp nhận diện sai
                    // "mbbank" không match "cimb" hoặc "cimb bank"
                    if (patternLower === 'mbbank' && (textLower.includes('cimb') || textLower.includes('cimb bank'))) {
                        return false;
                    }
                    
                    // "mbb" không match "cimb"
                    if (patternLower === 'mbb' && textLower.includes('cimb')) {
                        return false;
                    }
                    
                    // Tách text thành các từ (theo khoảng trắng, dấu gạch, số)
                    const words = textLower.split(/[\s\-_\d]+/).filter(w => w.length > 0);
                    
                    // Kiểm tra pattern có match với một từ hoàn chỉnh không
                    for (const word of words) {
                        // Match chính xác
                        if (word === patternLower) {
                            // Kiểm tra thêm: không phải là substring của từ khác
                            if (patternLower === 'mbbank' && word.includes('cimb')) {
                                continue; // Bỏ qua nếu chứa "cimb"
                            }
                            return true;
                        }
                        // Match ở đầu từ (như "tpbank", "mbbank")
                        if (word.startsWith(patternLower) && (word === patternLower + 'bank' || word.length > patternLower.length + 3)) {
                            // Kiểm tra không phải là "cimb" với "mbbank"
                            if (patternLower === 'mbbank' && word.includes('cimb')) {
                                continue;
                            }
                            return true;
                        }
                        // Match ở cuối từ (như "viettp", "techcombank" với "tcb")
                        if (word.endsWith(patternLower) && word.length > patternLower.length) {
                            return true;
                        }
                    }
                    
                    // Kiểm tra pattern ở đầu hoặc cuối toàn bộ chuỗi
                    if (textLower.startsWith(patternLower)) {
                        const charAfter = textLower[patternLower.length];
                        // Chấp nhận nếu: ở đầu chuỗi và có khoảng trắng/dấu gạch/số sau, hoặc là "tpbank", "mbbank"
                        if (!charAfter || /[\s\-_\d]/.test(charAfter) || textLower.startsWith(patternLower + 'bank')) {
                            return true;
                        }
                    }
                    
                    if (textLower.endsWith(patternLower)) {
                        const charBefore = textLower[textLower.length - patternLower.length - 1];
                        // Chấp nhận nếu: ở cuối chuỗi và có khoảng trắng/dấu gạch/số trước
                        if (!charBefore || /[\s\-_\d]/.test(charBefore)) {
                            return true;
                        }
                    }
                    
                    return false;
                };
                
                // Kiểm tra ngân hàng (dựa vào số và tên)
                // Ưu tiên kiểm tra CIMB Bank trước để tránh nhận diện sai
                let bankFound = false;
                const bankEntries = Object.entries(bankNumbers);
                
                // Sắp xếp để CIMB Bank được kiểm tra trước
                bankEntries.sort((a, b) => {
                    if (a[0] === 'CIMB Bank') return -1;
                    if (b[0] === 'CIMB Bank') return 1;
                    return 0;
                });
                
                for (const [bankName, patterns] of bankEntries) {
                    for (const pattern of patterns) {
                        // Kiểm tra trong số điện thoại (số thì dùng includes)
                        if (/^\d+$/.test(pattern)) {
                            if (contactNumberClean.includes(pattern.toLowerCase())) {
                                if (!bankMessages.has(bankName)) {
                                    bankMessages.set(bankName, []);
                                }
                                bankMessages.get(bankName).push({
                                    number: contactNumber,
                                    timestamp: record.timestamp,
                                    direction: record.callTypeReadable || ''
                                });
                                bankFound = true;
                                break;
                            }
                        } else {
                            // Kiểm tra trong số điện thoại (chữ thì dùng exact match)
                            if (isExactMatch(contactNumberClean, pattern)) {
                                if (!bankMessages.has(bankName)) {
                                    bankMessages.set(bankName, []);
                                }
                                bankMessages.get(bankName).push({
                                    number: contactNumber,
                                    timestamp: record.timestamp,
                                    direction: record.callTypeReadable || ''
                                });
                                bankFound = true;
                                break;
                            }
                        }
                        
                        // Kiểm tra trong tên liên lạc
                        if (contactName) {
                            if (/^\d+$/.test(pattern)) {
                                // Số thì không kiểm tra trong tên
                                continue;
                            }
                            if (isExactMatch(contactName, pattern)) {
                                if (!bankMessages.has(bankName)) {
                                    bankMessages.set(bankName, []);
                                }
                                bankMessages.get(bankName).push({
                                    number: contactNumber,
                                    timestamp: record.timestamp,
                                    direction: record.callTypeReadable || ''
                                });
                                bankFound = true;
                                break;
                            }
                        }
                    }
                    if (bankFound) break;
                }
                
                if (bankFound) return;
                
                // Kiểm tra dịch vụ
                for (const [serviceName, patterns] of Object.entries(serviceNumbers)) {
                    for (const pattern of patterns) {
                        if (contactNumberClean.includes(pattern)) {
                            if (!serviceMessages.has(serviceName)) {
                                serviceMessages.set(serviceName, []);
                            }
                            serviceMessages.get(serviceName).push({
                                number: contactNumber,
                                timestamp: record.timestamp,
                                direction: record.callTypeReadable || ''
                            });
                            return;
                        }
                    }
                }
                
                // Kiểm tra mạng xã hội (dựa vào số hoặc tên)
                for (const [socialName, patterns] of Object.entries(socialNumbers)) {
                    for (const pattern of patterns) {
                        if (contactNumberClean.includes(pattern)) {
                            if (!socialMessages.has(socialName)) {
                                socialMessages.set(socialName, []);
                            }
                            socialMessages.get(socialName).push({
                                number: contactNumber,
                                timestamp: record.timestamp,
                                direction: record.callTypeReadable || ''
                            });
                            return;
                        }
                    }
                }
            });
            
            // Hiển thị kết quả (dạng danh sách ngang)
            let html = '';
            
            // Ngân hàng
            html += '<div class="message-category">';
            html += '<h4>🏦 Tin nhắn ngân hàng</h4>';
            if (bankMessages.size > 0) {
                bankMessages.forEach((contacts, bankName) => {
                    const uniqueNumbers = [...new Set(contacts.map(c => c.number))];
                    html += `<div class="message-item">`;
                    html += `<strong>${bankName}:</strong> `;
                    html += `<span class="message-count">${uniqueNumbers.length} số liên lạc - </span>`;
                    html += `<span class="message-numbers-inline">${uniqueNumbers.join(', ')}</span>`;
                    html += `</div>`;
                });
            } else {
                html += '<p class="no-data">Không có tin nhắn từ ngân hàng</p>';
            }
            html += '</div>';
            
            // Dịch vụ
            html += '<div class="message-category">';
            html += '<h4>🛒 Tin nhắn dịch vụ</h4>';
            if (serviceMessages.size > 0) {
                serviceMessages.forEach((contacts, serviceName) => {
                    const uniqueNumbers = [...new Set(contacts.map(c => c.number))];
                    html += `<div class="message-item">`;
                    html += `<strong>${serviceName}:</strong> `;
                    html += `<span class="message-count">${uniqueNumbers.length} số liên lạc - </span>`;
                    html += `<span class="message-numbers-inline">${uniqueNumbers.join(', ')}</span>`;
                    html += `</div>`;
                });
            } else {
                html += '<p class="no-data">Không có tin nhắn từ dịch vụ</p>';
            }
            html += '</div>';
            
            // Mạng xã hội
            html += '<div class="message-category">';
            html += '<h4>📱 Tin nhắn mạng xã hội</h4>';
            if (socialMessages.size > 0) {
                socialMessages.forEach((contacts, socialName) => {
                    const uniqueNumbers = [...new Set(contacts.map(c => c.number))];
                    html += `<div class="message-item">`;
                    html += `<strong>${socialName}:</strong> `;
                    html += `<span class="message-count">${uniqueNumbers.length} số liên lạc - </span>`;
                    html += `<span class="message-numbers-inline">${uniqueNumbers.join(', ')}</span>`;
                    html += `</div>`;
                });
            } else {
                html += '<p class="no-data">Không có tin nhắn từ mạng xã hội</p>';
            }
            html += '</div>';
            container.innerHTML = html;
            
        } catch (error) {
            console.error('Error updating message classification:', error);
        }
    }

    // Utility Methods
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN');
        } catch (error) {
            return dateString;
        }
    }

    formatDateTime(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('vi-VN');
        } catch (error) {
            return dateString;
        }
    }

    parseExcelDateTime(value) {
        if (!value) return '';
        
        try {
            let date;
            
            // Handle Excel date serial numbers
            if (typeof value === 'number' && value > 1000) {
                // Excel dates are serial numbers starting from 1900-01-01
                const excelEpoch = new Date(1900, 0, 1);
                const daysSinceEpoch = value - 2;
                date = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
            } else if (typeof value === 'string') {
                // Handle string dates - check if it's already in dd/mm/yyyy format
                if (value.includes('/')) {
                    const parts = value.split(/[\/\s:]/);
                    if (parts.length >= 3) {
                        // Assume the format is dd/mm/yyyy (European format)
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                        const year = parseInt(parts[2]);
                        const hours = parts[3] ? parseInt(parts[3]) : 0;
                        const minutes = parts[4] ? parseInt(parts[4]) : 0;
                        const seconds = parts[5] ? parseInt(parts[5]) : 0;
                        
                        date = new Date(year, month, day, hours, minutes, seconds);
                    } else {
                        date = new Date(value);
                    }
                } else {
                    // Xử lý các định dạng số 6 chữ số
                    if (/^\d{6}$/.test(value)) {
                        const part1 = parseInt(value.substring(0, 2));
                        const part2 = parseInt(value.substring(2, 4));
                        const part3 = parseInt(value.substring(4, 6));
                        
                        // Kiểm tra xem có phải định dạng sai không (tháng > 12)
                        if (part2 > 12) {
                            // Đây là định dạng sai dd/yy/mm, cần chuyển đổi thành dd/mm/yy
                            // Ví dụ: 202506 -> 20/25/06 (tháng 25 > 12) -> 20/06/25 (dd/mm/yy)
                            
                            const fullYear = part3 < 50 ? 2000 + part3 : 1900 + part3;
                            const month = part2 - 12; // Tháng thực tế
                            const day = part1;
                            
                            console.log(`Fixed date format from ${value} (dd/yy/mm) to ${day}/${month}/${fullYear} (dd/mm/yyyy)`);
                            date = new Date(fullYear, month - 1, day); // Month is 0-indexed
                        } else {
                            // Định dạng đúng yy/mm/dd
                            const fullYear = part3 < 50 ? 2000 + part3 : 1900 + part3;
                            const month = part2;
                            const day = part1;
                            
                            date = new Date(fullYear, month - 1, day);
                        }
                    } else {
                        date = new Date(value);
                    }
                }
            } else {
                return value;
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
            return value;
            }
            
            // Format as dd/mm/yyyy hh:mm:ss
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes + ':' + seconds;
        } catch (error) {
            return value;
        }
    }

    formatPhoneNumber(phone) {
        if (!phone) return '';
        
        let phoneStr = String(phone).replace(/\D/g, '');
        
        // If it's 9 digits, add 0 at the beginning
        if (phoneStr.length === 9) {
            phoneStr = '0' + phoneStr;
        }
        
        return phoneStr;
    }

    // Event Handlers
    switchTab(tabName) {
        // Hide all tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab pane
        document.getElementById(tabName).classList.add('active');

        // Add active class to clicked button
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Remove keyboard navigation for all tabs first
        this.removeCallHistoryKeyboardNavigation();
        this.removeContactsKeyboardNavigation();
        this.removeLocationKeyboardNavigation();

        // Handle specific tab logic and reset pagination
        if (tabName === 'call-history') {
            // Check if there are active filters
            const searchTerm = document.getElementById('callHistorySearch')?.value.trim() || '';
            const dateFrom = document.getElementById('callHistoryDateFrom')?.value || '';
            const dateTo = document.getElementById('callHistoryDateTo')?.value || '';
            const timeFrom = document.getElementById('callHistoryTimeFrom')?.value || '';
            const timeTo = document.getElementById('callHistoryTimeTo')?.value || '';
            const typeFilter = document.getElementById('callHistoryTypeFilter')?.value || '';
            
            const hasActiveFilters = searchTerm !== '' || dateFrom !== '' || dateTo !== '' || 
                                    timeFrom !== '' || timeTo !== '' || typeFilter !== '';
            
            if (hasActiveFilters) {
                // If there are active filters, reapply them instead of resetting
                this.searchCallHistory();
            } else {
                // Reset call history pagination only if no filters
                this.currentPage = 1;
                this.pageSize = 50;
                this.filteredRecords = this.callRecords || [];
                this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
                this.updateCallHistoryTable();
            }
            
            this.setupCallHistoryKeyboardNavigation();
        } else if (tabName === 'contacts') {
            // Reset contacts pagination
            this.contactsCurrentPage = 1;
            this.contactsPageSize = 50;
            this.contactsTotalPages = Math.ceil((this.contacts ? this.contacts.size : 0) / this.contactsPageSize);
            
            this.updateContactsTable();
            this.setupContactsKeyboardNavigation();
        } else if (tabName === 'location') {
            // Reset location pagination
            this.locationCurrentPage = 1;
            this.locationPageSize = 50;
            this.locationTotalPages = Math.ceil((this.locationStats ? this.locationStats.size : 0) / this.locationPageSize);
            
            this.updateLocationTable();
            this.setupLocationKeyboardNavigation();
        } else if (tabName === 'compare') {
            // Update compare tab dropdowns and counts when switching to compare tab
            this.updateCompareFileDropdowns();
            this.updateCompareFileCounts();
        }
        
        // Update scroll to top buttons visibility when switching tabs
        this.updateScrollToTopButtons();
    }

    showCallHistory() {
        try {
            // Sử dụng hệ thống modal mới
            this.showModal('callHistoryModal');
            
            // Check if there are active filters
            const searchTerm = document.getElementById('callHistorySearch')?.value.trim() || '';
            const dateFrom = document.getElementById('callHistoryDateFrom')?.value || '';
            const dateTo = document.getElementById('callHistoryDateTo')?.value || '';
            const timeFrom = document.getElementById('callHistoryTimeFrom')?.value || '';
            const timeTo = document.getElementById('callHistoryTimeTo')?.value || '';
            const typeFilter = document.getElementById('callHistoryTypeFilter')?.value || '';
            
            const hasActiveFilters = searchTerm !== '' || dateFrom !== '' || dateTo !== '' || 
                                    timeFrom !== '' || timeTo !== '' || typeFilter !== '';
            
            if (hasActiveFilters) {
                // If there are active filters, reapply them
                this.searchCallHistory();
            } else {
                // Otherwise, just update the table normally
                this.updateCallHistoryTable();
            }
            
        } catch (error) {
            console.error('Error showing call history:', error);
            this.showToast('Lỗi khi hiển thị lịch sử cuộc gọi: ' + error.message, 'error');
        }
    }

    updateCallHistoryTable() {
        try {
            const tbody = document.getElementById('callHistoryBody');
            if (!tbody) return;

            // Check if there are active filters
            const searchTerm = document.getElementById('callHistorySearch')?.value.trim() || '';
            const dateFrom = document.getElementById('callHistoryDateFrom')?.value || '';
            const dateTo = document.getElementById('callHistoryDateTo')?.value || '';
            const timeFrom = document.getElementById('callHistoryTimeFrom')?.value || '';
            const timeTo = document.getElementById('callHistoryTimeTo')?.value || '';
            const typeFilter = document.getElementById('callHistoryTypeFilter')?.value || '';
            
            const hasActiveFilters = searchTerm !== '' || dateFrom !== '' || dateTo !== '' || 
                                    timeFrom !== '' || timeTo !== '' || typeFilter !== '';

            // Only reset filteredRecords if no active filters
            if (!hasActiveFilters) {
                // Initialize pagination for full data
                this.filteredRecords = this.callRecords || [];
                this.totalPages = Math.ceil(this.callRecords.length / this.pageSize);
                this.currentPage = 1;
                
                // Cập nhật số lượng kết quả
                const resultsSpan = document.getElementById('callHistoryResults');
                if (resultsSpan) {
                    resultsSpan.textContent = `📊 Kết quả: ${this.callRecords.length}/${this.callRecords.length}`;
                }
            } else {
                // If filters are active, keep current filteredRecords and update pagination
                if (!this.filteredRecords || this.filteredRecords.length === 0) {
                    this.filteredRecords = this.callRecords || [];
                }
                this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
                
                // Cập nhật số lượng kết quả
                const resultsSpan = document.getElementById('callHistoryResults');
                if (resultsSpan) {
                    const totalCount = this.callRecords.length;
                    const resultCount = this.filteredRecords.length;
                    resultsSpan.textContent = `📊 Kết quả: ${resultCount}/${totalCount}`;
                }
            }
            
            // Show pagination if needed
            this.showPaginationIfNeeded();

            // Update table with current page
            this.updateCallHistoryTableWithCurrentPage();
            
        } catch (error) {
            console.error('Error updating call history table:', error);
        }
    }

    hideCallHistory() {
        this.hideModal('callHistoryModal');
    }

    // Search functionality for call history
    searchCallHistory() {
        try {
            const searchTerm = document.getElementById('callHistorySearch').value.trim().toLowerCase();
            const dateFrom = document.getElementById('callHistoryDateFrom').value;
            const dateTo = document.getElementById('callHistoryDateTo').value;
            const timeFrom = document.getElementById('callHistoryTimeFrom').value;
            const timeTo = document.getElementById('callHistoryTimeTo').value;
            const typeFilter = document.getElementById('callHistoryTypeFilter').value;
            
            const tbody = document.getElementById('callHistoryBody');
            const resultsSpan = document.getElementById('callHistoryResults');
            
            if (!tbody || !resultsSpan) return;

            let filteredRecords = this.callRecords;

            // Filter by search term with multiple conditions separated by semicolon
            if (searchTerm !== '') {
                // Split search term by semicolon and trim each condition
                const conditions = searchTerm.split(';').map(condition => condition.trim()).filter(condition => condition);
                
                if (conditions.length > 0) {
                    filteredRecords = filteredRecords.filter(record => {
                        // Tìm kiếm trong tất cả các trường có thể có
                        const searchableFields = [
                            record.sourceNumber,
                            record.targetNumber,
                            record.contactNumber,
                            record.imei,
                            record.location,
                            record.provinceCode,
                            record.callTypeReadable,
                            record.service,
                            record.address,
                            record.lac,
                            record.cell,
                            record.duration,
                            record.timestamp
                        ];
                        
                        // Apply conditions with priority order (first matching condition wins)
                        for (const condition of conditions) {
                            const matches = searchableFields.some(field => 
                                field && field.toString().toLowerCase().includes(condition)
                            );
                            if (matches) {
                                return true; // Return true for first matching condition
                            }
                        }
                        return false;
                    });
                }
            }

            // Filter by date range
            if (dateFrom || dateTo) {
                filteredRecords = filteredRecords.filter(record => {
                    if (!record.timestamp) return false;
                    
                    try {
                        const recordDate = this.parseDateFromTimestamp(record.timestamp);
                        if (!recordDate) {
                            return false;
                        }
                        
                        if (dateFrom) {
                            const fromDate = new Date(dateFrom + 'T00:00:00');
                            if (recordDate < fromDate) {
                                return false;
                            }
                        }
                        if (dateTo) {
                            const toDate = new Date(dateTo + 'T23:59:59');
                            if (recordDate > toDate) {
                                return false;
                            }
                        }
                        
                        return true;
                    } catch (error) {
                        return false;
                    }
                });
            }

            // Filter by time range (supports overnight search)
            if (timeFrom || timeTo) {
                console.log('Filtering by time:', { timeFrom, timeTo });
                const beforeTimeFilter = filteredRecords.length;
                filteredRecords = filteredRecords.filter(record => {
                    if (!record.timestamp) return false;
                    
                    try {
                        const recordDate = this.parseDateFromTimestamp(record.timestamp);
                        if (!recordDate) {
                            console.log('Failed to parse date for record:', record.timestamp);
                            return false;
                        }
                        
                        // Convert to total seconds for precise comparison
                        const recordTimeInSeconds = recordDate.getHours() * 3600 + recordDate.getMinutes() * 60 + recordDate.getSeconds();
                        const recordTimeString = `${recordDate.getHours().toString().padStart(2, '0')}:${recordDate.getMinutes().toString().padStart(2, '0')}`;
                        
                        let passesTimeFilter = true;
                        
                        // Parse time from and to values
                        let fromTimeInSeconds = 0;
                        let toTimeInSeconds = 0;
                        let isOvernight = false;
                        
                        if (timeFrom) {
                            const [fromHour, fromMinute] = timeFrom.split(':').map(t => parseInt(t));
                            fromTimeInSeconds = fromHour * 3600 + fromMinute * 60;
                        }
                        
                        if (timeTo) {
                            const [toHour, toMinute] = timeTo.split(':').map(t => parseInt(t));
                            toTimeInSeconds = toHour * 3600 + toMinute * 60;
                            
                            // Check if this is an overnight search (timeFrom > timeTo)
                            if (timeFrom && fromTimeInSeconds > toTimeInSeconds) {
                                isOvernight = true;
                            }
                        }
                        
                        if (isOvernight) {
                            // Overnight search: from 22:00 previous day to 04:00 next day
                            // Record should be >= fromTime OR <= toTime
                            if (recordTimeInSeconds >= fromTimeInSeconds || recordTimeInSeconds <= toTimeInSeconds) {
                                passesTimeFilter = true;
                            } else {
                                passesTimeFilter = false;
                            }
                        } else {
                            // Normal search within same day
                            if (timeFrom && recordTimeInSeconds < fromTimeInSeconds) {
                                passesTimeFilter = false;
                            }
                            if (timeTo && recordTimeInSeconds > toTimeInSeconds) {
                                passesTimeFilter = false;
                            }
                        }
                        
                        if (!passesTimeFilter) {
                            console.log(`Record filtered out by time: ${recordTimeString} (${record.timestamp}) - Overnight: ${isOvernight}`);
                        }
                        
                        return passesTimeFilter;
                    } catch (error) {
                        console.log('Error parsing time for record:', record.timestamp, error);
                        return false;
                    }
                });
                console.log(`Time filter result: ${filteredRecords.length}/${beforeTimeFilter} records`);
            }

            // Filter by call type
            if (typeFilter) {
                filteredRecords = filteredRecords.filter(record => {
                    return record.callTypeReadable === typeFilter;
                });
            }

            // Store filtered records and reset pagination
            this.filteredRecords = filteredRecords;
            this.currentPage = 1;
            this.totalPages = Math.ceil(filteredRecords.length / this.pageSize);

            const resultCount = filteredRecords.length;
            const totalCount = this.callRecords.length;

            console.log('Final filter results:', {
                resultCount,
                totalCount,
                searchTerm,
                dateFrom,
                dateTo,
                timeFrom,
                timeTo,
                typeFilter
            });

            // Update results count
            resultsSpan.textContent = `📊 Kết quả: ${resultCount}/${totalCount}`;

            // Show pagination if needed
            this.showPaginationIfNeeded();

            // Update table with current page data
            this.updateCallHistoryTableWithCurrentPage();

        } catch (error) {
            console.error('Error searching call history:', error);
        }
    }

    resetCallHistory() {
        try {
            document.getElementById('callHistorySearch').value = '';
            document.getElementById('callHistoryDateFrom').value = '';
            document.getElementById('callHistoryDateTo').value = '';
            document.getElementById('callHistoryTimeFrom').value = '';
            document.getElementById('callHistoryTimeTo').value = '';
            document.getElementById('callHistoryTypeFilter').value = '';
            
            // Reset pagination
            this.currentPage = 1;
            this.filteredRecords = this.callRecords;
            this.totalPages = Math.ceil(this.callRecords.length / this.pageSize);
            
            document.getElementById('callHistoryResults').textContent = `📊 Kết quả: ${this.callRecords.length}/${this.callRecords.length}`;
            
            // Show pagination if needed
            this.showPaginationIfNeeded();
            
            // Update table with current page
            this.updateCallHistoryTableWithCurrentPage();
        } catch (error) {
            console.error('Error resetting call history:', error);
        }
    }

    updateCallHistoryTableWithData(records) {
        try {
            const tbody = document.getElementById('callHistoryBody');
            if (!tbody) return;

            const fragment = document.createDocumentFragment();
            
            records.forEach((record, index) => {
                const row = document.createElement('tr');
                
                // Xác định số chủ dựa trên hướng cuộc gọi
                let ownerPhone = '';
                
                // Ưu tiên 1: Sử dụng số từ subscriberInfo
                if (this.subscriberInfo && this.subscriberInfo.phoneNumber) {
                    ownerPhone = this.subscriberInfo.phoneNumber;
                    console.log('Using phone from subscriberInfo:', ownerPhone);
                }
                
                // Ưu tiên 2: Xác định dựa trên hướng cuộc gọi
                if (!ownerPhone && record.direction === 'outgoing') {
                    ownerPhone = record.sourceNumber || '';
                    console.log('Using phone from outgoing direction:', ownerPhone);
                } else if (!ownerPhone && record.direction === 'incoming') {
                    ownerPhone = record.targetNumber || '';
                    console.log('Using phone from incoming direction:', ownerPhone);
                }
                
                // Ưu tiên 3: Fallback - lấy từ record
                if (!ownerPhone) {
                    if (record.sourceNumber && record.sourceNumber !== record.contactNumber) {
                        ownerPhone = record.sourceNumber;
                        console.log('Using phone from sourceNumber fallback:', ownerPhone);
                    } else if (record.targetNumber && record.targetNumber !== record.contactNumber) {
                        ownerPhone = record.targetNumber;
                        console.log('Using phone from targetNumber fallback:', ownerPhone);
                    }
                }
                
                // Ưu tiên 4: Lấy số đầu tiên tìm thấy trong record
                if (!ownerPhone) {
                    if (record.sourceNumber) {
                        ownerPhone = record.sourceNumber;
                        console.log('Using phone from sourceNumber (last resort):', ownerPhone);
                    } else if (record.targetNumber) {
                        ownerPhone = record.targetNumber;
                        console.log('Using phone from targetNumber (last resort):', ownerPhone);
                    }
                }
                
                // Debug log để kiểm tra
                if (!ownerPhone) {
                    console.warn('Template 3: No owner phone found for record:', record);
                    console.warn('Record details:', {
                        sourceNumber: record.sourceNumber,
                        targetNumber: record.targetNumber,
                        contactNumber: record.contactNumber,
                        direction: record.direction,
                        subscriberInfo: this.subscriberInfo
                    });
                } else {
                    console.log('Final owner phone:', ownerPhone);
                }
                
                row.innerHTML = `
                    <td>${record.tt || ''}</td>
                    <td><strong>${ownerPhone}</strong></td>
                    <td>${record.contactNumber || ''}</td>
                    <td>${record.timestamp || ''}</td>
                    <td>${record.duration || ''}</td>
                    <td>${record.imei || ''}</td>
                    <td>${record.provinceCode || ''}</td>
                    <td>${record.callTypeReadable || ''}</td>
                    <td>${record.serviceType || ''}</td>
                    <td>${record.location || ''}</td>
                    <td>${record.lac || ''}</td>
                    <td>${record.cell || ''}</td>
                `;
                fragment.appendChild(row);
            });
            
            tbody.innerHTML = '';
            tbody.appendChild(fragment);
            
        } catch (error) {
            console.error('Error updating call history table with data:', error);
        }
    }

    // Helper method to parse timestamp for date filtering
    parseDateFromTimestamp(timestamp) {
        if (!timestamp) return null;
        
        try {
            // Handle dd/mm/yyyy hh:mm:ss format
            if (typeof timestamp === 'string' && timestamp.includes('/')) {
                const parts = timestamp.split(/[\/\s:]/);
                if (parts.length >= 3) {
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                    const year = parseInt(parts[2]);
                    const hours = parts[3] ? parseInt(parts[3]) : 0;
                    const minutes = parts[4] ? parseInt(parts[4]) : 0;
                    const seconds = parts[5] ? parseInt(parts[5]) : 0;
                    
                    return new Date(year, month, day, hours, minutes, seconds);
                }
            }
            
            // Handle other date formats
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    // Pagination methods
    showPaginationIfNeeded() {
        const pagination = document.getElementById('callHistoryPagination');
        
        if (this.filteredRecords.length > this.pageSize) {
            pagination.style.display = 'flex';
        } else {
            pagination.style.display = 'none';
        }
    }

    updateCallHistoryTableWithCurrentPage() {
        // Đảm bảo dữ liệu phân trang được cập nhật đúng
        this.filteredRecords = this.filteredRecords || this.callRecords || [];
        this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
        
        // Đảm bảo currentPage không vượt quá totalPages
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
            this.currentPage = this.totalPages;
        }
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredRecords.slice(startIndex, endIndex);
        
        console.log('updateCallHistoryTableWithCurrentPage:', {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            pageSize: this.pageSize,
            filteredRecords: this.filteredRecords.length,
            pageData: pageData.length
        });
        
        this.updateCallHistoryTableWithData(pageData);
        this.updatePaginationControls();
    }

    updatePaginationControls() {
        const firstBtn = document.getElementById('firstPageBtn');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const lastBtn = document.getElementById('lastPageBtn');
        const pageInput = document.getElementById('pageInput');
        const totalPagesDisplay = document.getElementById('totalPagesDisplay');
        
        if (firstBtn && prevBtn && nextBtn && lastBtn && pageInput && totalPagesDisplay) {
            firstBtn.disabled = this.currentPage <= 1;
            prevBtn.disabled = this.currentPage <= 1;
            nextBtn.disabled = this.currentPage >= this.totalPages;
            lastBtn.disabled = this.currentPage >= this.totalPages;
            
            pageInput.value = this.currentPage;
            pageInput.max = this.totalPages;
            totalPagesDisplay.textContent = this.totalPages;
        }
    }
    
    firstPage() {
        this.currentPage = 1;
        this.updateCallHistoryTableWithCurrentPage();
    }
    
    lastPage() {
        this.currentPage = this.totalPages;
        this.updateCallHistoryTableWithCurrentPage();
    }
    
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.updateCallHistoryTableWithCurrentPage();
        } else {
            // Reset input if invalid
            const pageInput = document.getElementById('pageInput');
            if (pageInput) {
                pageInput.value = this.currentPage;
            }
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateCallHistoryTableWithCurrentPage();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updateCallHistoryTableWithCurrentPage();
        }
    }

    changePageSize() {
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (pageSizeSelect) {
            this.pageSize = parseInt(pageSizeSelect.value);
            this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
            this.currentPage = 1;
            this.updateCallHistoryTableWithCurrentPage();
        }
    }

    changeCallHistoryPageSize() {
        const pageSizeSelect = document.getElementById('callHistoryPageSize');
        if (pageSizeSelect) {
            console.log('Changing page size to:', pageSizeSelect.value);
            this.pageSize = parseInt(pageSizeSelect.value);
            this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
            this.currentPage = 1;
            console.log('New pageSize:', this.pageSize, 'totalPages:', this.totalPages);
            this.updateCallHistoryTableWithCurrentPage();
        }
    }

    // Keyboard navigation for call history (simplified approach from IP folder)
    setupCallHistoryKeyboardNavigation() {
        this.callHistoryKeyHandler = (e) => {
            // Chỉ xử lý phím mũi tên trái/phải
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                return;
            }

            // Kiểm tra xem tab call-history có đang active không
            const callHistoryTab = document.getElementById('call-history');
            if (!callHistoryTab || !callHistoryTab.classList.contains('active')) {
                return;
            }

            // Ngăn scroll mặc định
            e.preventDefault();
            
            // Đảm bảo dữ liệu phân trang được cập nhật đúng
            this.filteredRecords = this.filteredRecords || this.callRecords || [];
            this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
            
            console.log('Call history keyboard navigation - Key:', e.key);
            console.log('Current page:', this.currentPage, 'Total pages:', this.totalPages, 'Filtered records:', this.filteredRecords.length);

            if (e.key === 'ArrowLeft') {
                // Chuyển về trang trước
                if (this.currentPage > 1) {
                    console.log('Changing to previous page:', this.currentPage - 1);
                    this.previousPage();
                } else {
                    console.log('Already at first page');
                }
            } else if (e.key === 'ArrowRight') {
                // Chuyển đến trang sau
                if (this.currentPage < this.totalPages) {
                    console.log('Changing to next page:', this.currentPage + 1);
                    this.nextPage();
                } else {
                    console.log('Already at last page');
                }
            }
        };

        // Thêm event listener vào document thay vì table
        document.addEventListener('keydown', this.callHistoryKeyHandler);
        console.log('Call history keyboard navigation setup completed');
    }

    removeCallHistoryKeyboardNavigation() {
        if (this.callHistoryKeyHandler) {
            document.removeEventListener('keydown', this.callHistoryKeyHandler);
            this.callHistoryKeyHandler = null;
            console.log('Call history keyboard navigation removed');
        }
    }

    // Keyboard navigation for contacts
    setupContactsKeyboardNavigation() {
        this.contactsKeyHandler = (e) => {
            // Chỉ xử lý phím mũi tên trái/phải
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                return;
            }

            // Kiểm tra xem tab contacts có đang active không
            const contactsTab = document.getElementById('contacts');
            if (!contactsTab || !contactsTab.classList.contains('active')) {
                return;
            }

            // Ngăn scroll mặc định
            e.preventDefault();
            
            // Đảm bảo dữ liệu phân trang được cập nhật đúng
            const contactsCount = this.contacts ? this.contacts.size : 0;
            this.contactsTotalPages = Math.ceil(contactsCount / this.contactsPageSize);
            
            console.log('Contacts keyboard navigation - Key:', e.key);
            console.log('Current page:', this.contactsCurrentPage, 'Total pages:', this.contactsTotalPages, 'Contacts count:', contactsCount);

            if (e.key === 'ArrowLeft') {
                // Chuyển về trang trước
                if (this.contactsCurrentPage > 1) {
                    console.log('Changing to previous page:', this.contactsCurrentPage - 1);
                    this.contactsPreviousPage();
                } else {
                    console.log('Already at first page');
                }
            } else if (e.key === 'ArrowRight') {
                // Chuyển đến trang sau
                if (this.contactsCurrentPage < this.contactsTotalPages) {
                    console.log('Changing to next page:', this.contactsCurrentPage + 1);
                    this.contactsNextPage();
                } else {
                    console.log('Already at last page');
                }
            }
        };

        // Thêm event listener vào document thay vì table
        document.addEventListener('keydown', this.contactsKeyHandler);
        console.log('Contacts keyboard navigation setup completed');
    }

    removeContactsKeyboardNavigation() {
        if (this.contactsKeyHandler) {
            document.removeEventListener('keydown', this.contactsKeyHandler);
            this.contactsKeyHandler = null;
            console.log('Contacts keyboard navigation removed');
        }
    }

    // Keyboard navigation for location
    setupLocationKeyboardNavigation() {
        this.locationKeyHandler = (e) => {
            // Chỉ xử lý phím mũi tên trái/phải
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                return;
            }

            // Kiểm tra xem tab location có đang active không
            const locationTab = document.getElementById('location');
            if (!locationTab || !locationTab.classList.contains('active')) {
                return;
            }

            // Ngăn scroll mặc định
            e.preventDefault();
            
            // Đảm bảo dữ liệu phân trang được cập nhật đúng
            const locationCount = this.locationStats ? this.locationStats.size : 0;
            this.locationTotalPages = Math.ceil(locationCount / this.locationPageSize);
            
            console.log('Location keyboard navigation - Key:', e.key);
            console.log('Current page:', this.locationCurrentPage, 'Total pages:', this.locationTotalPages, 'Location count:', locationCount);

            if (e.key === 'ArrowLeft') {
                // Chuyển về trang trước
                if (this.locationCurrentPage > 1) {
                    console.log('Changing to previous page:', this.locationCurrentPage - 1);
                    this.locationPreviousPage();
                } else {
                    console.log('Already at first page');
                }
            } else if (e.key === 'ArrowRight') {
                // Chuyển đến trang sau
                if (this.locationCurrentPage < this.locationTotalPages) {
                    console.log('Changing to next page:', this.locationCurrentPage + 1);
                    this.locationNextPage();
                } else {
                    console.log('Already at last page');
                }
            }
        };

        // Thêm event listener vào document thay vì table
        document.addEventListener('keydown', this.locationKeyHandler);
        console.log('Location keyboard navigation setup completed');
    }

    removeLocationKeyboardNavigation() {
        if (this.locationKeyHandler) {
            document.removeEventListener('keydown', this.locationKeyHandler);
            this.locationKeyHandler = null;
            console.log('Location keyboard navigation removed');
        }
    }

    // Search functions for contacts
    searchContacts() {
        const searchInput = document.getElementById('contactsSearchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        // Get all contacts
        const allContacts = Array.from(this.contacts.values());
        
        // Filter contacts with multiple conditions separated by semicolon
        this.filteredContacts = allContacts.filter(contact => {
            if (!searchTerm) return true;
            
            // Split search term by semicolon and trim each condition
            const conditions = searchTerm.split(';').map(condition => condition.trim()).filter(condition => condition);
            
            if (conditions.length === 0) return true;
            
            // Apply conditions with priority order (first matching condition wins)
            for (const condition of conditions) {
                const matches = (contact.number && contact.number.toLowerCase().includes(condition)) ||
                               (contact.phoneNumber && contact.phoneNumber.toLowerCase().includes(condition));
                if (matches) {
                    return true; // Return true for first matching condition
                }
            }
            return false;
        }).sort((a, b) => b.count - a.count);
        
        // Reset to first page and update
        this.contactsCurrentPage = 1;
        this.updateContactsPagination();
        this.renderContactsPage();
    }

    resetContactsFilters() {
        try {
            // Clear all filter inputs
            document.getElementById('contactsSearchInput').value = '';
            document.getElementById('contactsDateFrom').value = '';
            document.getElementById('contactsDateTo').value = '';
            document.getElementById('contactsTimeFrom').value = '';
            document.getElementById('contactsTimeTo').value = '';
            
            // Reset to show all data
            const allContacts = Array.from(this.contacts.values())
                .sort((a, b) => b.count - a.count);
            this.filteredContacts = [...allContacts];
            this.filteredContactsByTime.clear();
            
            // Reset to first page and update
            this.contactsCurrentPage = 1;
            this.updateContactsPagination();
            this.updateContactsStats();
            this.renderContactsPage();
        } catch (error) {
            console.error('Error resetting contacts filters:', error);
        }
    }

    // Filter contacts by time range
    filterContactsByTime() {
        try {
            const dateFrom = document.getElementById('contactsDateFrom').value;
            const dateTo = document.getElementById('contactsDateTo').value;
            const timeFrom = document.getElementById('contactsTimeFrom').value;
            const timeTo = document.getElementById('contactsTimeTo').value;
            
            console.log('Filtering contacts by time:', { dateFrom, dateTo, timeFrom, timeTo });
            
            this.filteredContactsByTime.clear();
            
            this.contactsWithTimeData.forEach((contactData, phoneNumber) => {
                const filteredInteractions = contactData.interactions.filter(interaction => {
                    const recordDate = this.parseDateFromTimestamp(interaction.timestamp);
                    if (!recordDate) return false;
                    
                    // Lọc theo ngày
                    if (dateFrom || dateTo) {
                        if (dateFrom) {
                            const fromDate = new Date(dateFrom + 'T00:00:00');
                            if (recordDate < fromDate) return false;
                        }
                        if (dateTo) {
                            const toDate = new Date(dateTo + 'T23:59:59');
                            if (recordDate > toDate) return false;
                        }
                    }
                    
                    // Lọc theo giờ (hỗ trợ tìm kiếm qua đêm)
                    if (timeFrom || timeTo) {
                        // Convert to total seconds for precise comparison
                        const recordTimeInSeconds = recordDate.getHours() * 3600 + recordDate.getMinutes() * 60 + recordDate.getSeconds();
                        
                        // Parse time from and to values
                        let fromTimeInSeconds = 0;
                        let toTimeInSeconds = 0;
                        let isOvernight = false;
                        
                        if (timeFrom) {
                            const [fromHour, fromMinute] = timeFrom.split(':').map(t => parseInt(t));
                            fromTimeInSeconds = fromHour * 3600 + fromMinute * 60;
                        }
                        
                        if (timeTo) {
                            const [toHour, toMinute] = timeTo.split(':').map(t => parseInt(t));
                            toTimeInSeconds = toHour * 3600 + toMinute * 60;
                            
                            // Check if this is an overnight search (timeFrom > timeTo)
                            if (timeFrom && fromTimeInSeconds > toTimeInSeconds) {
                                isOvernight = true;
                            }
                        }
                        
                        if (isOvernight) {
                            // Overnight search: from 22:00 previous day to 04:00 next day
                            // Record should be >= fromTime OR <= toTime
                            if (recordTimeInSeconds >= fromTimeInSeconds || recordTimeInSeconds <= toTimeInSeconds) {
                                // Continue processing
                            } else {
                                return false;
                            }
                        } else {
                            // Normal search within same day
                            if (timeFrom && recordTimeInSeconds < fromTimeInSeconds) {
                                return false;
                            }
                            if (timeTo && recordTimeInSeconds > toTimeInSeconds) {
                                return false;
                            }
                        }
                    }
                    
                    return true;
                });
                
                if (filteredInteractions.length > 0) {
                    this.filteredContactsByTime.set(phoneNumber, {
                        number: phoneNumber,
                        count: filteredInteractions.length,
                        interactions: filteredInteractions,
                        types: new Set(filteredInteractions.map(i => i.type))
                    });
                }
            });
            
            console.log(`Time filter result: ${this.filteredContactsByTime.size} contacts with interactions in time range`);
            
            // Update stats and table
            this.updateContactsStats();
            this.updateContactsTable();
            
        } catch (error) {
            console.error('Error filtering contacts by time:', error);
        }
    }

    // Update contacts statistics
    updateContactsStats() {
        try {
            const totalContacts = this.contacts.size;
            const filteredContacts = this.filteredContactsByTime.size;
            const totalInteractions = Array.from(this.filteredContactsByTime.values())
                .reduce((sum, contact) => sum + contact.count, 0);
            
            document.getElementById('totalContactsCount').textContent = totalContacts;
            document.getElementById('filteredContactsCount').textContent = filteredContacts;
            document.getElementById('totalInteractionsCount').textContent = totalInteractions;
        } catch (error) {
            console.error('Error updating contacts stats:', error);
        }
    }

    // Search functions for location
    searchLocation() {
        const searchInput = document.getElementById('locationSearchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        // Get all locations
        const allLocations = Array.from(this.locationStats.values());
        
        // Filter locations with multiple conditions separated by semicolon
        this.filteredLocations = allLocations.filter(location => {
            if (!searchTerm) return true;
            
            // Split search term by semicolon and trim each condition
            const conditions = searchTerm.split(';').map(condition => condition.trim()).filter(condition => condition);
            
            if (conditions.length === 0) return true;
            
            // Tìm kiếm trong tất cả các trường có thể có
            const searchableFields = [
                location.lac,
                location.cell,
                location.location,
                location.provinceCode,
                location.stationName,
                location.count,
                location.googleMapsLink
            ];
            
            // Apply conditions with priority order (first matching condition wins)
            for (const condition of conditions) {
                const matches = searchableFields.some(field => 
                    field && field.toString().toLowerCase().includes(condition)
                );
                if (matches) {
                    return true; // Return true for first matching condition
                }
            }
            return false;
        }).sort((a, b) => b.count - a.count);
        
        // Reset to first page and update
        this.locationCurrentPage = 1;
        this.updateLocationPagination();
        this.renderLocationPage();
    }

    searchLocationByContact() {
        const contactSearchInput = document.getElementById('locationContactSearchInput');
        const contactNumber = contactSearchInput ? contactSearchInput.value.trim() : '';
        
        if (!contactNumber) {
            this.showToast('Vui lòng nhập số điện thoại để tìm kiếm vị trí!', 'warning');
            return;
        }
        
        // Tìm kiếm vị trí theo số liên lạc cụ thể
        this.locationContactSearchData = contactNumber;
        this.filteredLocationsBySpecificContact = [];
        
        // Tìm tất cả vị trí mà số liên lạc này xuất hiện
        const contactLocations = new Map();
        
        // Duyệt qua tất cả call records để tìm vị trí của số liên lạc này
        this.callRecords.forEach(record => {
            if (record.targetNumber === contactNumber || record.sourceNumber === contactNumber) {
                const locationKey = `${record.lac}-${record.cell}`;
                if (!contactLocations.has(locationKey)) {
                    contactLocations.set(locationKey, {
                        lac: record.lac,
                        cell: record.cell,
                        location: record.location || '',
                        provinceCode: record.provinceCode || '',
                        stationName: record.stationName || record.location || '',
                        count: 0,
                        googleMapsLink: record.googleMapsLink || ''
                    });
                }
                contactLocations.get(locationKey).count++;
            }
        });
        
        // Chuyển đổi thành mảng và sắp xếp theo tần suất giảm dần
        this.filteredLocationsBySpecificContact = Array.from(contactLocations.values())
            .sort((a, b) => b.count - a.count);
        
        // Cập nhật filteredLocations để hiển thị kết quả tìm kiếm
        this.filteredLocations = [...this.filteredLocationsBySpecificContact];
        
        // Reset to first page and update
        this.locationCurrentPage = 1;
        this.updateLocationPagination();
        this.renderLocationPage();
        this.updateLocationStats();
        
        // Hiển thị thông báo kết quả
        const resultCount = this.filteredLocationsBySpecificContact.length;
        if (resultCount > 0) {
            this.showCopyMessage(`Tìm thấy ${resultCount} vị trí cho số ${contactNumber}`, 'success');
        } else {
            this.showCopyMessage(`Không tìm thấy vị trí nào cho số ${contactNumber}`, 'warning');
        }
    }

    setupLocationEditableInputs() {
        // Sử dụng event delegation để xử lý các input có thể được tạo động
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('location-input')) {
                this.updateLocationData(e.target);
            }
        });
        
        document.addEventListener('blur', (e) => {
            if (e.target.classList.contains('location-input')) {
                this.saveLocationData(e.target);
            }
        });
    }

    updateLocationData(input) {
        const field = input.dataset.field;
        const lac = input.dataset.lac;
        const cell = input.dataset.cell;
        const value = input.value.trim();
        
        if (!lac || !cell) return;
        
        const locationKey = `${lac}-${cell}`;
        
        // Cập nhật dữ liệu trong locationStats
        if (this.locationStats.has(locationKey)) {
            this.locationStats.get(locationKey)[field] = value;
        }
        
        // Cập nhật dữ liệu trong filteredLocations
        const location = this.filteredLocations.find(loc => loc.lac === lac && loc.cell === cell);
        if (location) {
            location[field] = value;
        }
    }

    saveLocationData(input) {
        const field = input.dataset.field;
        const lac = input.dataset.lac;
        const cell = input.dataset.cell;
        const value = input.value.trim();
        
        if (!lac || !cell) return;
        
        // Lưu vào localStorage
        this.saveLocationDataToStorage(lac, cell, field, value);
    }

    saveLocationDataToStorage(lac, cell, field, value) {
        const locationKey = `${lac}-${cell}`;
        const storageKey = `location_${locationKey}`;
        
        let locationData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        locationData[field] = value;
        localStorage.setItem(storageKey, JSON.stringify(locationData));
    }

    loadLocationDataFromStorage() {
        // Tải dữ liệu đã lưu từ localStorage
        this.locationStats.forEach((location, key) => {
            const storageKey = `location_${key}`;
            const savedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
            
            if (savedData.provinceCode) {
                location.provinceCode = savedData.provinceCode;
            }
            if (savedData.stationName) {
                location.stationName = savedData.stationName;
            }
            if (savedData.location) {
                location.location = savedData.location;
            }
            if (savedData.mnc) {
                location.mnc = savedData.mnc;
            }
        });
    }
    
    // Đồng bộ dữ liệu location từ locationStats sang callRecords
    syncLocationToCallHistory() {
        try {
            if (!this.callRecords || this.callRecords.length === 0) {
                this.showToast('Không có dữ liệu cuộc gọi để đồng bộ!', 'warning');
                return;
            }
            
            if (!this.locationStats || this.locationStats.size === 0) {
                this.showToast('Không có dữ liệu vị trí để đồng bộ!', 'warning');
                return;
            }
            
            // Cập nhật locationStats từ tất cả input fields hiện tại trước khi đồng bộ
            const locationInputs = document.querySelectorAll('.location-input');
            locationInputs.forEach(input => {
                this.updateLocationData(input);
                this.saveLocationData(input);
            });
            
            // Reload dữ liệu từ localStorage để đảm bảo có dữ liệu mới nhất
            this.loadLocationDataFromStorage();
            
            let syncCount = 0;
            const updatedRecords = new Set(); // Track which records were updated
            
            // Duyệt qua tất cả locationStats
            this.locationStats.forEach((locationData, key) => {
                const [lac, cell] = key.split('-');
                
                if (!lac || !cell) return;
                
                // Tìm tất cả callRecords có cùng LAC-Cell
                this.callRecords.forEach((record, index) => {
                    if (record.lac === lac && record.cell === cell) {
                        let recordUpdated = false;
                        
                        // Đồng bộ stationName (Tên trạm BTS) từ tab vị trí sang location (Địa chỉ) trong lịch sử cuộc gọi
                        // Xử lý cả trường hợp có giá trị và trường hợp xóa (rỗng)
                        const newStationName = locationData.stationName ? locationData.stationName.trim() : '';
                        if (record.location !== newStationName || record.stationName !== newStationName) {
                            record.location = newStationName;
                            record.stationName = newStationName;
                            recordUpdated = true;
                        }
                        
                        // Cập nhật provinceCode nếu có thay đổi
                        const newProvinceCode = locationData.provinceCode ? locationData.provinceCode.trim() : '';
                        if (record.provinceCode !== newProvinceCode) {
                            record.provinceCode = newProvinceCode;
                            recordUpdated = true;
                        }
                        
                        // Đếm record nếu có ít nhất một field được cập nhật
                        if (recordUpdated && !updatedRecords.has(index)) {
                            updatedRecords.add(index);
                            syncCount++;
                        }
                    }
                });
            });
            
            // Cập nhật lại filteredRecords nếu có
            if (this.filteredRecords && this.filteredRecords.length > 0) {
                this.filteredRecords.forEach(record => {
                    if (record.lac && record.cell) {
                        const key = `${record.lac}-${record.cell}`;
                        const locationData = this.locationStats.get(key);
                        
                        if (locationData) {
                            // Đồng bộ stationName (Tên trạm BTS) sang location (Địa chỉ)
                            // Xử lý cả trường hợp xóa (rỗng)
                            const newStationName = locationData.stationName ? locationData.stationName.trim() : '';
                            record.location = newStationName;
                            record.stationName = newStationName;
                            
                            const newProvinceCode = locationData.provinceCode ? locationData.provinceCode.trim() : '';
                            record.provinceCode = newProvinceCode;
                        }
                    }
                });
            }
            
            // Cập nhật lại dữ liệu trong filesData nếu đang xem file từ multi-file system
            if (this.currentFileId && this.filesData.has(this.currentFileId)) {
                const fileData = this.filesData.get(this.currentFileId);
                fileData.callRecords = [...this.callRecords];
            }
            
            // Cập nhật lại bảng lịch sử cuộc gọi
            this.updateCallHistoryTable();
            
            // Hiển thị thông báo
            if (syncCount > 0) {
                this.showToast(`Đã đồng bộ thành công ${syncCount} bản ghi từ tab Vị trí sang Lịch sử cuộc gọi!`, 'success');
            } else {
                this.showToast('Không có dữ liệu nào được đồng bộ. Vui lòng kiểm tra lại dữ liệu trong tab Vị trí.', 'warning');
            }
            
            console.log(`Synced ${syncCount} records from location to call history`);
            
        } catch (error) {
            console.error('Error syncing location to call history:', error);
            this.showToast('Lỗi khi đồng bộ dữ liệu: ' + error.message, 'error');
        }
    }

    resetLocationFilters() {
        // Clear search input
        document.getElementById('locationSearchInput').value = '';
        document.getElementById('locationContactSearchInput').value = '';
        document.getElementById('locationDateFrom').value = '';
        document.getElementById('locationDateTo').value = '';
        document.getElementById('locationTimeFrom').value = '';
        document.getElementById('locationTimeTo').value = '';
        
        // Reset contact search data
        this.locationContactSearchData = null;
        this.filteredLocationsBySpecificContact = [];
        
        // Reset to show all data
        const allLocations = Array.from(this.locationStats.values())
            .sort((a, b) => b.count - a.count);
        this.filteredLocations = [...allLocations];
        this.filteredLocationsByTime.clear();
        
        // Reset to first page and update
        this.locationCurrentPage = 1;
        this.updateLocationStats();
        this.updateLocationPagination();
        this.renderLocationPage();
    }

    filterLocationByTime() {
        const dateFrom = document.getElementById('locationDateFrom').value;
        const dateTo = document.getElementById('locationDateTo').value;
        const timeFrom = document.getElementById('locationTimeFrom').value;
        const timeTo = document.getElementById('locationTimeTo').value;

        console.log('Filtering locations by time:', { dateFrom, dateTo, timeFrom, timeTo });

        // Clear contact search data khi lọc theo thời gian
        this.locationContactSearchData = null;
        this.filteredLocationsBySpecificContact = [];

        // Nếu không có bất kỳ filter nào, reset về dữ liệu gốc
        if (!dateFrom && !dateTo && !timeFrom && !timeTo) {
            this.filteredLocationsByTime.clear();
            this.updateLocationStats();
            this.updateLocationTable();
            this.updateLocationPagination();
            return;
        }

        this.filteredLocationsByTime.clear();

        for (const [key, interactions] of this.locationsWithTimeData) {
            const filteredInteractions = interactions.filter(interaction => {
                return this.passesLocationTimeFilter(interaction.timestamp, dateFrom, dateTo, timeFrom, timeTo);
            });

            if (filteredInteractions.length > 0) {
                this.filteredLocationsByTime.set(key, filteredInteractions);
            }
        }

        console.log('Location time filtering completed. Filtered locations:', this.filteredLocationsByTime.size);
        console.log('Filtered locations keys:', Array.from(this.filteredLocationsByTime.keys()));
        console.log('Location stats keys:', Array.from(this.locationStats.keys()));
        
        this.updateLocationStats();
        this.updateLocationTable();
        this.updateLocationPagination();
    }

    passesLocationTimeFilter(timestamp, dateFrom, dateTo, timeFrom, timeTo) {
        try {
            const recordDate = this.parseDateFromTimestamp(timestamp);
            if (!recordDate || isNaN(recordDate.getTime())) {
                return false;
            }

            // Kiểm tra ngày
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                if (recordDate < fromDate) {
                    return false;
                }
            }

            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999); // Đến cuối ngày
                if (recordDate > toDate) {
                    return false;
                }
            }

            // Kiểm tra giờ (hỗ trợ tìm kiếm qua đêm)
            if (timeFrom || timeTo) {
                // Convert to total seconds for precise comparison
                const recordTimeInSeconds = recordDate.getHours() * 3600 + recordDate.getMinutes() * 60 + recordDate.getSeconds();
                
                // Parse time from and to values
                let fromTimeInSeconds = 0;
                let toTimeInSeconds = 0;
                let isOvernight = false;
                
                if (timeFrom) {
                    const [fromHour, fromMinute] = timeFrom.split(':').map(t => parseInt(t));
                    fromTimeInSeconds = fromHour * 3600 + fromMinute * 60;
                }
                
                if (timeTo) {
                    const [toHour, toMinute] = timeTo.split(':').map(t => parseInt(t));
                    toTimeInSeconds = toHour * 3600 + toMinute * 60;
                    
                    // Check if this is an overnight search (timeFrom > timeTo)
                    if (timeFrom && fromTimeInSeconds > toTimeInSeconds) {
                        isOvernight = true;
                    }
                }
                
                if (isOvernight) {
                    // Overnight search: from 22:00 previous day to 04:00 next day
                    // Record should be >= fromTime OR <= toTime
                    if (recordTimeInSeconds >= fromTimeInSeconds || recordTimeInSeconds <= toTimeInSeconds) {
                        // Continue processing
                    } else {
                        return false;
                    }
                } else {
                    // Normal search within same day
                    if (timeFrom && recordTimeInSeconds < fromTimeInSeconds) {
                        return false;
                    }
                    if (timeTo && recordTimeInSeconds > toTimeInSeconds) {
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            console.warn('Error filtering location time:', error);
            return false;
        }
    }

    updateLocationStats() {
        // Nếu đang tìm kiếm theo số liên lạc cụ thể
        if (this.locationContactSearchData && this.filteredLocationsBySpecificContact.length > 0) {
            const totalLocationsCount = this.filteredLocationsBySpecificContact.length;
            const totalInteractionsCount = this.filteredLocationsBySpecificContact.reduce((sum, location) => sum + location.count, 0);
            
            document.getElementById('totalLocationsCount').textContent = totalLocationsCount;
            document.getElementById('filteredLocationsCount').textContent = totalLocationsCount; // Chỉ có 1 số liên lạc
            document.getElementById('totalLocationInteractionsCount').textContent = totalInteractionsCount;
        } else {
            // Thống kê bình thường
            const totalLocationsCount = this.locationStats.size;
            const filteredLocationsCount = this.filteredLocationsByTime.size;
            
            let totalInteractionsCount = 0;
            if (this.filteredLocationsByTime.size > 0) {
                for (const interactions of this.filteredLocationsByTime.values()) {
                    totalInteractionsCount += interactions.length;
                }
            } else {
                for (const interactions of this.locationsWithTimeData.values()) {
                    totalInteractionsCount += interactions.length;
                }
            }

            document.getElementById('totalLocationsCount').textContent = totalLocationsCount;
            document.getElementById('filteredLocationsCount').textContent = filteredLocationsCount;
            document.getElementById('totalLocationInteractionsCount').textContent = totalInteractionsCount;
        }
    }

    // Initialize time select dropdowns with 24-hour format
    initializeTimeSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Chỉ khởi tạo nếu chưa có options (tránh ghi đè lên HTML có sẵn)
        if (select.options.length <= 1) {
            // Clear existing options except the first one
            select.innerHTML = '<option value="">Tất cả</option>';

            // Generate options for 24 hours (00:00 to 23:59)
            for (let hour = 0; hour < 24; hour++) {
                for (let minute = 0; minute < 60; minute += 30) { // 30-minute intervals
                    const hourStr = hour.toString().padStart(2, '0');
                    const minuteStr = minute.toString().padStart(2, '0');
                    const timeValue = `${hourStr}:${minuteStr}`;
                    const timeDisplay = `${hourStr}:${minuteStr}`;
                    
                    const option = document.createElement('option');
                    option.value = timeValue;
                    option.textContent = timeDisplay;
                    select.appendChild(option);
                }
            }
        }
    }

    // Initialize scroll to top functionality
    initializeScrollToTop() {
        // Add scroll event listener to show/hide scroll to top buttons
        window.addEventListener('scroll', () => {
            this.updateScrollToTopButtons();
        });
    }

    // Update scroll to top buttons visibility
    updateScrollToTopButtons() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        // Get all scroll to top buttons (both old and new class names)
        const buttons = document.querySelectorAll('.scroll-to-top-btn, .scroll-to-top');
        
        // Get the currently active tab pane
        const activeTabPane = document.querySelector('.tab-pane.active');
        
        buttons.forEach(button => {
            // Check if this button belongs to the active tab
            const buttonTabPane = button.closest('.tab-pane');
            const isInActiveTab = buttonTabPane && buttonTabPane.classList.contains('active');
            
            // Only show button if it's in the active tab and we're scrolled down
            if (isInActiveTab && scrollTop > 300) {
                button.classList.add('visible');
            } else {
                button.classList.remove('visible');
            }
        });
    }

    // Scroll to top function
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    scrollToTopOfTable(tableId) {
        const table = document.getElementById(tableId);
        if (table) {
            table.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    // Scroll to top of tab
    scrollToTopOfTab(tabId) {
        const tabPane = document.getElementById(tabId);
        if (tabPane) {
            tabPane.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        } else {
            // Fallback: scroll to top of page
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }

    // Copy to clipboard function - không notification
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    // Fallback copy method for older browsers
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyMessage('Đã copy!');
        } catch (err) {
            this.showCopyMessage('Không thể copy', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    // Show copy message - giống hệt folder IP
    showCopyMessage(message, type = 'info') {
        // Remove existing message if any
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        // Add to page
        const container = document.querySelector('.container');
        container.insertBefore(messageDiv, container.firstChild);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    async showAllLocations() {
        try {
            const tbody = document.getElementById('allLocationsBody');
            if (!tbody) return;
            
            // Xóa nội dung cũ
            tbody.innerHTML = '';

            const allLocations = Array.from(this.locationStats.values())
                .sort((a, b) => b.count - a.count);

            // Tạo tất cả rows cùng lúc để tránh reflow và làm chậm
            const fragment = document.createDocumentFragment();
            allLocations.forEach((loc, index) => {
                const row = document.createElement('tr');
                
                // Kiểm tra xem có link Google Maps đã lưu không
                let googleMapsLink = '';
                let linkText = 'Link';
                let linkClass = 'google-maps-link-empty';
                
                if (loc.googleMapsLink && loc.googleMapsLink.trim() !== '') {
                    googleMapsLink = loc.googleMapsLink;
                    linkText = 'Link';
                    linkClass = 'google-maps-link';
                }
                
                row.innerHTML = '<td>' + (index + 1) + '</td>' +
                    '<td>' + (loc.lac || '') + '</td>' +
                    '<td>' + (loc.cell || '') + '</td>' +
                    '<td>' + (loc.provinceCode || '') + '</td>' +
                    '<td>' + (loc.location || '') + '</td>' +
                    '<td>' + (loc.count || '') + '</td>' +
                    '<td>' +
                        (googleMapsLink ? 
                            '<a href="' + googleMapsLink + '" target="_blank" class="' + linkClass + '">' + linkText + '</a>' :
                            '<span class="' + linkClass + '">' + linkText + '</span>'
                        ) +
                        '<button class="btn btn-sm btn-outline-primary" onclick="cdrAnalyzer.editGoogleMapsLink(\'' + loc.lac + '\', \'' + loc.cell + '\')" style="margin-left: 5px;">✏️</button>' +
                    '</td>';
                fragment.appendChild(row);
            });

            // Thêm tất cả rows vào tbody cùng lúc
            tbody.appendChild(fragment);

            this.showModal('allLocationsModal');
        } catch (error) {
            console.error('Error showing all locations:', error);
            this.showToast('Lỗi khi tải dữ liệu vị trí: ' + error.message, 'error');
        }
    }

    hideAllLocations() {
        this.hideModal('allLocationsModal');
    }
    

    showFileInfo(fileName) {
        this.currentFileName = fileName;
        document.getElementById('fileName').textContent = fileName;
        
        const fileInfo = document.getElementById('fileInfo');
        
        // Remove existing template info if any
        const existingTemplateInfo = fileInfo.querySelector('.template-info');
        if (existingTemplateInfo) {
            existingTemplateInfo.remove();
        }
        
        // Add template info
        const templateInfo = document.createElement('div');
        templateInfo.className = 'template-info';
        templateInfo.innerHTML = `
            <div class="template-badge">
                📋 Mẫu: ${this.getTemplateDisplayName(this.currentTemplate)}
            </div>
        `;
        
        fileInfo.appendChild(templateInfo);
        
        fileInfo.style.display = 'block';
    }

    // Get template display name
    getTemplateDisplayName(template) {
        const names = {
            'template1': 'VIETTEL',
            'template3': 'MOBI',
            'template2': 'VINA'
        };
        return names[template] || 'Không xác định';
    }

    // Show template change notification
    showTemplateChangeNotification() {
        // Tạo notification element
        const notification = document.createElement('div');
        notification.className = 'template-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span>🔄 Đã chuyển sang ${this.getTemplateDisplayName(this.currentTemplate)}</span>
                <button class="notification-close">✕</button>
            </div>
        `;
        
        // Thêm vào body
        document.body.appendChild(notification);
        
        // Auto remove sau 3 giây
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
        // Close button event
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }
    }

    // Convert date to standard format dd/mm/yyyy or dd/mm/yyyy hh:mm:ss
    convertToStandardDateFormat(dateString) {
        if (!dateString) return '';
        
        try {
            console.log('Converting date:', dateString);
            
            // Nếu đã có định dạng dd/mm/yyyy thì giữ nguyên
            if (dateString.includes('/')) {
                return dateString;
            }
            
            // Xử lý định dạng "2010-11-10 21:21:30" hoặc "2010-11-10 21"
            if (dateString.includes('-') && dateString.includes(' ')) {
                const parts = dateString.split(' ');
                const datePart = parts[0]; // "2010-11-10"
                const timePart = parts[1]; // "21:21:30" hoặc "21"
                
                // Parse date part
                const dateParts = datePart.split('-');
                if (dateParts.length === 3) {
                    const year = dateParts[0];
                    const month = dateParts[1];
                    const day = dateParts[2];
                    
                    // Parse time part
                    if (timePart && timePart.includes(':')) {
                        const timeParts = timePart.split(':');
                        const hours = timeParts[0].padStart(2, '0');
                        const minutes = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';
                        const seconds = timeParts[2] ? timeParts[2].padStart(2, '0') : '00';
                        
                        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                    } else if (timePart) {
                        // Chỉ có giờ
                        const hours = timePart.padStart(2, '0');
                        return `${day}/${month}/${year} ${hours}:00:00`;
                    } else {
                        // Không có giờ
                        return `${day}/${month}/${year}`;
                    }
                }
            }
            
            // Parse các định dạng khác bằng Date object
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                
                // Kiểm tra xem có phải là ngày có giờ không
                if (dateString.includes(' ') || dateString.includes('T') || dateString.includes(':')) {
                    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                } else {
                    return `${day}/${month}/${year}`;
                }
            }
            
            return dateString;
        } catch (error) {
            console.error('Error converting date format:', error);
            return dateString;
        }
    }

    removeFile() {
        this.data = null;
        this.subscriberInfo = null;
        this.currentFileName = null; // Reset tên file
        this.subscriberInfoDisplay = {}; // Reset thông tin hiển thị
        this.callRecords = [];
        this.imeiList.clear();
        this.contacts.clear();
        this.hourlyStats.fill(0);
        this.weeklyStats.fill(0);
        this.locationStats.clear();
        this.imeiChanges = [];
        this.imsiChanges = [];

        // Reset pagination
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.filteredRecords = [];

        // Reset contacts pagination
        this.contactsCurrentPage = 1;
        this.contactsPageSize = 50;
        this.contactsTotalPages = 1;
        this.filteredContacts = [];

        // Reset location pagination
        this.locationCurrentPage = 1;
        this.locationPageSize = 50;
        this.locationTotalPages = 1;
        this.filteredLocations = [];

        // Reset template
        this.currentTemplate = 'template1';

        // Đóng tất cả modal
        this.hideAllModals();

        // Clear template info
        const templateInfo = document.querySelector('.template-info');
        if (templateInfo) {
            templateInfo.remove();
        }

        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';

        // Reset charts
        this.updateCharts();
    }

    // Xóa tất cả dữ liệu localStorage
    clearAllLocalStorage() {
        try {
            // Xóa tất cả IMEI models
            const imeiInputs = document.querySelectorAll('.imei-input');
            imeiInputs.forEach(input => {
                const imei = input.dataset.originalImei;
                if (imei) {
                    localStorage.removeItem(`imei_model_${imei}`);
                    localStorage.removeItem(`imei_note_${imei}`);
                    localStorage.removeItem(`imei_edited_${imei}`);
                }
            });

            // Xóa cookies
            localStorage.removeItem('imei_cookies');

            // Xóa Google Maps links (nếu có)
            this.locationStats.forEach((location, key) => {
                if (location.googleMapsLink) {
                    delete location.googleMapsLink;
                }
            });

            // Xóa tất cả dữ liệu số liên lạc
            const contactKeys = Object.keys(localStorage).filter(key => key.startsWith('contact_data_'));
            contactKeys.forEach(key => {
                localStorage.removeItem(key);
            });

            console.log('✅ Đã xóa tất cả dữ liệu localStorage');
            this.showToast('Đã xóa tất cả dữ liệu thành công!', 'success');
            
            // Refresh UI
            this.updateIMEITable();
            this.updateLocationTable();
            this.renderContactsPage();
            
        } catch (error) {
            console.error('❌ Lỗi khi xóa localStorage:', error);
            this.showToast('Lỗi khi xóa dữ liệu: ' + error.message, 'error');
        }
    }

    // Xóa dữ liệu theo IMEI cụ thể
    clearIMEIData(imei) {
        try {
            localStorage.removeItem(`imei_model_${imei}`);
            localStorage.removeItem(`imei_note_${imei}`);
            localStorage.removeItem(`imei_edited_${imei}`);
            
            console.log(`✅ Đã xóa dữ liệu cho IMEI: ${imei}`);
            
            // Refresh UI
            this.updateIMEITable();
            
        } catch (error) {
            console.error(`❌ Lỗi khi xóa dữ liệu IMEI ${imei}:`, error);
        }
    }

    // Xác nhận xóa tất cả dữ liệu
    confirmClearAllData() {
        const confirmed = confirm(
            '⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ DỮ LIỆU?\n\n' +
            'Dữ liệu sẽ bị xóa vĩnh viễn:\n' +
            '• Tất cả IMEI models\n' +
            '• Tất cả ghi chú\n' +
            '• Cookies IMEI\n' +
            '• Google Maps links\n\n' +
            'Nhấn OK để xóa, Cancel để hủy.'
        );
        
        if (confirmed) {
            this.clearAllLocalStorage();
        }
    }

    showMainContent() {
        document.getElementById('mainContent').style.display = 'block';
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) uploadSection.style.display = 'none';
    }
    
    // Show file manager interface
    showFileManager() {
        const uploadSection = document.getElementById('uploadSection');
        const mainContent = document.getElementById('mainContent');
        if (uploadSection) uploadSection.style.display = 'block';
        if (mainContent) mainContent.style.display = 'none';
    }

    // IMEI Management
    updateIMEI(input) {
        const originalIMEI = input.dataset.originalImei;
        const newIMEI = input.value.trim();
        const index = parseInt(input.dataset.index);
        
        // Validate IMEI format
        const isValid = this.isValidIMEI(newIMEI);
        
        // Update styling based on validity
        if (isValid) {
            input.classList.remove('imei-error');
            input.parentElement.parentElement.classList.remove('invalid-imei');
        } else {
            input.classList.add('imei-error');
            input.parentElement.parentElement.classList.add('invalid-imei');
        }
        
        // Update the IMEI in our data structure
        if (newIMEI !== originalIMEI) {
            // Remove old IMEI from set
            this.imeiList.delete(originalIMEI);
            // Add new IMEI to set
            this.imeiList.add(newIMEI);
            
            // Update fileData if we have a current file
            if (this.currentFileId) {
                const fileData = this.filesData.get(this.currentFileId);
                if (fileData) {
                    fileData.imeiList.delete(originalIMEI);
                    fileData.imeiList.add(newIMEI);
                }
            }
            
            // Update localStorage keys
            const oldModel = localStorage.getItem(`imei_model_${originalIMEI}`);
            const oldNote = localStorage.getItem(`imei_note_${originalIMEI}`);
            
            if (oldModel) {
                localStorage.setItem(`imei_model_${newIMEI}`, oldModel);
                localStorage.removeItem(`imei_model_${originalIMEI}`);
            }
            if (oldNote) {
                localStorage.setItem(`imei_note_${newIMEI}`, oldNote);
                localStorage.removeItem(`imei_note_${originalIMEI}`);
            }
            
            // Save edited IMEI
            localStorage.setItem(`imei_edited_${newIMEI}`, newIMEI);
            
            // Update dataset
            input.dataset.originalImei = newIMEI;
            
            // Update model input dataset
            const modelInput = input.parentElement.parentElement.querySelector('.model-input');
            if (modelInput) {
                modelInput.dataset.imei = newIMEI;
            }
            
            // Update note input dataset
            const noteInput = input.parentElement.parentElement.querySelector('.note-input');
            if (noteInput) {
                noteInput.dataset.imei = newIMEI;
            }
            
            // Update statistics
            this.updateIMEIStats();
            
            // Auto-update IMEI comparison if it's currently displayed
            if (this.currentCompareAnalysis && this.currentCompareAnalysis.type === 'shared-imei') {
                // Re-run IMEI comparison
                setTimeout(() => {
                    this.analyzeSharedIMEI();
                }, 500); // Small delay to ensure data is updated
            }
        }
        
        // Update the input styling after saving
        input.style.background = 'transparent';
        input.style.border = 'none';
        input.style.padding = '0';
    }

    updateModel(input) {
        const imei = input.dataset.imei;
        const model = input.value;
        
        if (!imei) {
            console.error('No IMEI found in dataset');
            return;
        }
        
        // Store in localStorage for persistence
        localStorage.setItem(`imei_model_${imei}`, model);
        console.log(`Model saved for IMEI ${imei}: ${model}`);
        
        // Update the input styling after saving
        input.style.background = 'transparent';
        input.style.border = 'none';
        input.style.padding = '0';
    }

    updateNote(input) {
        const imei = input.dataset.imei;
        const note = input.value;
        
        if (!imei) {
            console.error('No IMEI found in dataset');
            return;
        }
        
        // Store in localStorage for persistence
        localStorage.setItem(`imei_note_${imei}`, note);
        console.log(`Note saved for IMEI ${imei}: ${note}`);
        
        // Update the input styling after saving
        input.style.background = 'transparent';
        input.style.border = 'none';
        input.style.padding = '0';
    }

    // Cookies Management
    showCookiesModal() {
        this.showModal('cookiesModal');
        const savedCookies = localStorage.getItem('imei_cookies');
        if (savedCookies) {
            document.getElementById('cookiesInput').value = savedCookies;
        }
    }

    hideCookiesModal() {
        this.hideModal('cookiesModal');
    }

    saveCookies() {
        const cookies = document.getElementById('cookiesInput').value.trim();
        if (cookies) {
            localStorage.setItem('imei_cookies', cookies);
            this.hideCookiesModal();
            this.showToast('Cookies đã được lưu thành công!', 'success');
        } else {
            this.showToast('Vui lòng nhập cookies string!', 'warning');
        }
    }

    // IMEI Lookup
    async lookupAllIMEI() {
        const cookies = localStorage.getItem('imei_cookies');
        if (!cookies) {
            this.showToast('Vui lòng nhập cookies string trước khi tra cứu!', 'warning');
            this.showCookiesModal();
            return;
        }
        
        const imeiArray = Array.from(this.imeiList);
        if (imeiArray.length === 0) {
            this.showToast('Không có IMEI nào để tra cứu!', 'warning');
            return;
        }

        if (!confirm(`Bạn có muốn tra cứu ${imeiArray.length} IMEI? Quá trình này có thể mất vài phút.`)) {
            return;
        }

        try {
            // Show progress
            const lookupBtn = document.getElementById('lookupAllIMEI');
            const originalText = lookupBtn.textContent;
            lookupBtn.textContent = '⏳ Đang tra cứu...';
            lookupBtn.disabled = true;

            // Process each IMEI
            for (let i = 0; i < imeiArray.length; i++) {
                const imei = imeiArray[i];
                const progress = Math.round(((i + 1) / imeiArray.length) * 100);
                
                // Update progress
                lookupBtn.textContent = `⏳ Tra cứu ${i + 1}/${imeiArray.length} (${progress}%)`;
                console.log(`Tra cứu IMEI ${i + 1}/${imeiArray.length}: ${imei} (${progress}%)`);
                
                try {
                    // Call IMEI.info API with cookies
                    const deviceInfo = await this.lookupIMEIFromAPI(imei, cookies);
                    
                    // Store result in localStorage
                    localStorage.setItem(`imei_model_${imei}`, deviceInfo);
                    
                    // Update the model input in the table
                    this.updateModelInTable(imei, deviceInfo);
                    
                    console.log(`✅ IMEI ${imei}: ${deviceInfo}`);
                } catch (error) {
                    console.error(`❌ Lỗi tra cứu IMEI ${imei}:`, error);
                    // Set default value for failed lookups
                    localStorage.setItem(`imei_model_${imei}`, 'Null');
                    this.updateModelInTable(imei, 'Null');
                }
                
                // Small delay between requests to avoid overwhelming the API
                // IMEI.info may have rate limiting, so we add a delay
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Reset button
            lookupBtn.textContent = originalText;
            lookupBtn.disabled = false;
            
            this.showToast('Tra cứu IMEI hoàn tất!', 'success');
            
        } catch (error) {
            console.error('Error in lookupAllIMEI:', error);
            this.showToast('Lỗi khi tra cứu IMEI: ' + error.message, 'error');
            
            // Reset button
            const lookupBtn = document.getElementById('lookupAllIMEI');
            lookupBtn.textContent = '🔍 Tra cứu tất cả';
            lookupBtn.disabled = false;
        }
    }

    // API call to IMEI.info via Python Script
    async lookupIMEIFromAPI(imei, cookies) {
        try {
            console.log(`🔍 Tra cứu IMEI: ${imei} qua Python script`);
            
            // Call Python script using fetch to a local endpoint
            // We'll use a simple HTTP server approach
            const response = await fetch(`http://localhost:5000/imei/${imei}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cookies: cookies,
                    imei: imei
                })
            });
            
            if (!response.ok) {
                throw new Error(`Python server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.deviceInfo) {
                console.log(`✅ IMEI ${imei}: ${data.deviceInfo}`);
                return data.deviceInfo;
            } else {
                console.warn(`⚠️ Không tìm thấy thông tin thiết bị cho IMEI: ${imei}`);
                return 'Không tìm thấy thông tin';
            }
            
        } catch (error) {
            console.error(`❌ Lỗi tra cứu IMEI ${imei}:`, error);
            
            // Fallback: check if Python server is running
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Python server không hoạt động. Vui lòng khởi động Python server bằng lệnh: python imei_server.py');
            }
            
            throw new Error('Không thể tra cứu IMEI: ' + error.message);
        }
    }

    // Parse IMEI.info HTML response
    parseIMEIResponse(html) {
        try {
            // Create a temporary DOM element to parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Look for device name in h1 tag
            const h1Element = doc.querySelector('h1');
            if (h1Element) {
                const deviceName = h1Element.textContent.trim();
                console.log(`Found device name in h1: ${deviceName}`);
                
                // Look for model info in h2 tag
                const h2Element = doc.querySelector('h2');
                if (h2Element) {
                    const modelInfo = h2Element.textContent.trim();
                    console.log(`Found model info in h2: ${modelInfo}`);
                    return `${deviceName} - ${modelInfo}`;
                }
                
                return deviceName;
            }
            
            // Alternative: Look for device information in other elements
            const deviceElements = doc.querySelectorAll('h1, h2, h3, .device-name, .model-info');
            for (const element of deviceElements) {
                const text = element.textContent.trim();
                if (text && text.length > 0 && !text.includes('IMEI') && !text.includes('Check')) {
                    console.log(`Found device info in ${element.tagName}: ${text}`);
                    return text;
                }
            }
            
            // If no structured data found, try to extract from page content
            const bodyText = doc.body.textContent;
            const devicePatterns = [
                /iPhone\s+\d+[a-zA-Z]?/gi,
                /Samsung\s+Galaxy\s+[A-Z0-9]+/gi,
                /Xiaomi\s+[A-Za-z0-9\s]+/gi,
                /OPPO\s+[A-Za-z0-9\s]+/gi,
                /Vivo\s+[A-Za-z0-9\s]+/gi,
                /Huawei\s+[A-Za-z0-9\s]+/gi,
                /OnePlus\s+[A-Za-z0-9\s]+/gi,
                /Realme\s+[A-Za-z0-9\s]+/gi,
                /Nokia\s+[A-Za-z0-9\s]+/gi,
                /Motorola\s+[A-Za-z0-9\s]+/gi
            ];
            
            for (const pattern of devicePatterns) {
                const matches = bodyText.match(pattern);
                if (matches && matches.length > 0) {
                    const deviceInfo = matches[0].trim();
                    console.log(`Found device info with pattern: ${deviceInfo}`);
                    return deviceInfo;
                }
            }
            
            console.warn('No device information found in HTML response');
            return null;
            
        } catch (error) {
            console.error('Error parsing IMEI response:', error);
            return null;
        }
    }

    // Update model input in the table
    updateModelInTable(imei, deviceInfo) {
        try {
            const imeiInputs = document.querySelectorAll('.imei-input');
            imeiInputs.forEach(input => {
                if (input.dataset.originalImei === imei) {
                    const modelInput = input.parentElement.parentElement.querySelector('.model-input');
                    if (modelInput) {
                        modelInput.value = deviceInfo;
                        // Trigger change event to save to localStorage
                        modelInput.dispatchEvent(new Event('change'));
                    }
                }
            });
        } catch (error) {
            console.error('Error updating model in table:', error);
        }
    }

    // Search functionality for IMEI
    searchIMEI() {
        try {
            const searchTerm = document.getElementById('imeiSearch').value.trim().toLowerCase();
            const statusFilter = document.getElementById('imeiStatusFilter').value;
            const tbody = document.getElementById('imeiBody');
            const resultsSpan = document.getElementById('imeiResults');
            
            if (!tbody || !resultsSpan) return;

            let filteredIMEI = Array.from(this.imeiList);
            let resultCount = 0;

            // Filter by search term with multiple conditions separated by semicolon
            if (searchTerm !== '') {
                // Split search term by semicolon and trim each condition
                const conditions = searchTerm.split(';').map(condition => condition.trim()).filter(condition => condition);
                
                if (conditions.length > 0) {
                    filteredIMEI = filteredIMEI.filter(imei => {
                        const model = localStorage.getItem(`imei_model_${imei}`) || '';
                        const note = localStorage.getItem(`imei_note_${imei}`) || '';
                        
                        // Apply conditions with priority order (first matching condition wins)
                        for (const condition of conditions) {
                            const matches = imei.toLowerCase().includes(condition) ||
                                          model.toLowerCase().includes(condition) ||
                                          note.toLowerCase().includes(condition);
                            if (matches) {
                                return true; // Return true for first matching condition
                            }
                        }
                        return false;
                    });
                }
            }

            // Filter by status
            if (statusFilter !== 'all') {
                filteredIMEI = filteredIMEI.filter(imei => {
                                    const isValid = this.isValidIMEI(imei);
                return statusFilter === 'valid' ? isValid : !isValid;
                });
            }

            resultCount = filteredIMEI.length;
            const totalCount = this.imeiList.size;

            // Update results count
            resultsSpan.textContent = `📊 Kết quả: ${resultCount}/${totalCount}`;

            // Store filtered data
            this.filteredIMEI = filteredIMEI;
            
            // Update table with filtered data
            this.updateIMEITableWithData(filteredIMEI);

        } catch (error) {
            console.error('Error searching IMEI:', error);
        }
    }

    resetIMEI() {
        try {
            document.getElementById('imeiSearch').value = '';
            document.getElementById('imeiStatusFilter').value = 'all';
            document.getElementById('imeiResults').textContent = `📊 Kết quả: ${this.imeiList.size}/${this.imeiList.size}`;
            
            // Reset filtered data
            this.filteredIMEI = [];
            
            this.updateIMEITable();
        } catch (error) {
            console.error('Error resetting IMEI:', error);
        }
    }

    updateIMEITableWithData(imeiArray) {
        try {
            const tbody = document.getElementById('imeiBody');
            const countElement = document.getElementById('uniqueIMEICount');
            const validCountElement = document.getElementById('validIMEICount');
            const invalidCountElement = document.getElementById('invalidIMEICount');
            
            if (!tbody || !countElement || !validCountElement || !invalidCountElement) {
                console.error('IMEI table elements not found');
                return;
            }
            
            let validCount = 0;
            let invalidCount = 0;
            
            countElement.textContent = imeiArray.length;
            tbody.innerHTML = '';

            // Tạo tất cả rows cùng lúc để tránh reflow và làm chậm
            const fragment = document.createDocumentFragment();
            
            imeiArray.forEach((imei, index) => {
                const isValid = this.isValidIMEI(imei);
                if (isValid) validCount++;
                else invalidCount++;
                
                // Tính tần suất cho IMEI này
                const frequency = this.getIMEIFrequency(imei);
                
                // Tính các khoảng thời gian sử dụng
                const usagePeriods = this.getIMEIUsagePeriods(imei);
                
                // Lấy dữ liệu đã lưu từ localStorage
                const savedModel = localStorage.getItem(`imei_model_${imei}`) || '';
                const savedNote = localStorage.getItem(`imei_note_${imei}`) || '';
                
                const row = document.createElement('tr');
                row.className = isValid ? '' : 'invalid-imei';
                row.innerHTML = '<td>' + (index + 1) + '</td>' +
                    '<td>' +
                            '<div class="ip-with-copy">' +
                            '<i class="fas fa-copy copy-icon" onclick="cdrAnalyzer.copyToClipboard(\'' + imei + '\')"></i>' +
                            '<input type="text" class="imei-input ip-text" value="' + imei + '" ' +
                                   'data-original-imei="' + imei + '" ' +
                                   'data-index="' + index + '" ' +
                                   'onchange="cdrAnalyzer.updateIMEI(this)" ' +
                                   'onblur="cdrAnalyzer.updateIMEI(this)" ' +
                                   'onkeypress="if(event.key===\'Enter\') this.blur()">' +
                        '</div>' +
                    '</td>' +
                    '<td>' + frequency + '</td>' +
                    '<td>' +
                        '<input type="text" class="model-input" placeholder="Nhập model" ' +
                               'data-imei="' + imei + '" ' +
                               'value="' + savedModel + '" ' +
                               'onchange="cdrAnalyzer.updateModel(this)" ' +
                               'onblur="cdrAnalyzer.updateModel(this)" ' +
                               'onkeypress="if(event.key===\'Enter\') this.blur()">' +
                    '</td>' +
                    '<td style="white-space: normal; word-break: break-word; max-width: 300px;">' + (usagePeriods || '-') + '</td>' +
                    '<td>' +
                        '<input type="text" class="note-input" placeholder="Nhập ghi chú" ' +
                               'data-imei="' + imei + '" ' +
                               'value="' + savedNote + '" ' +
                               'onchange="cdrAnalyzer.updateNote(this)" ' +
                               'onblur="cdrAnalyzer.updateNote(this)" ' +
                               'onkeypress="if(event.key===\'Enter\') this.blur()">' +
                    '</td>';
                fragment.appendChild(row);
            });
            
            // Thêm tất cả rows vào tbody cùng lúc
            tbody.appendChild(fragment);
            
            validCountElement.textContent = validCount;
            invalidCountElement.textContent = invalidCount;
            
            console.log('IMEI table updated with filtered data successfully');
        } catch (error) {
            console.error('Error updating IMEI table with data:', error);
        }
    }

    // Refresh location coordinates - Tạm thời tắt
    async refreshLocationCoordinates() {
        this.showToast('Chức năng làm mới tọa độ đã tạm thời tắt để tránh làm chậm ứng dụng.', 'warning');
        return;
        
        // try {
        //     const button = document.getElementById('refreshCoordinates');
        //     const originalText = button.textContent;
        //     button.textContent = '⏳ Đang làm mới...';
        //     button.disabled = true;

        //     // Clear existing coordinates
        //     const locations = Array.from(this.locationStats.values());
        //     locations.forEach(location => {
        //         delete location.lat;
        //         delete location.lon;
        //     });

        //     // Update the table with fresh coordinates
        //     await this.updateLocationTable();

        //     button.textContent = originalText;
        //     button.disabled = false;
            
        //     const button = document.getElementById('refreshCoordinates');
        //     button.textContent = '🔄 Làm mới tọa độ';
        //     button.disabled = false;
        // }
    }

    // Test IMEI lookup with a single IMEI
    async testIMEILookup() {
        try {
            const cookies = localStorage.getItem('imei_cookies');
            if (!cookies) {
                this.showToast('Vui lòng nhập cookies string trước khi test!', 'warning');
                this.showCookiesModal();
                return;
            }

            const testIMEI = prompt('Nhập IMEI để test (ví dụ: 350481051313500):');
            if (!testIMEI || testIMEI.trim() === '') {
                return;
            }

            const button = document.getElementById('lookupAllIMEI');
            const originalText = button.textContent;
            button.textContent = '⏳ Đang test...';
            button.disabled = true;

            try {
                console.log(`🧪 Testing IMEI lookup for: ${testIMEI}`);
                const deviceInfo = await this.lookupIMEIFromAPI(testIMEI.trim(), cookies);
                
                this.showToast(`Test IMEI ${testIMEI}: Kết quả: ${deviceInfo}. Nếu kết quả đúng, bạn có thể tiến hành tra cứu hàng loạt.`, 'success', 6000);
                
            } catch (error) {
                this.showToast(`Lỗi test IMEI ${testIMEI}: ${error.message}. Vui lòng kiểm tra cookies string hoặc thử lại sau.`, 'error', 6000);
            }

            button.textContent = originalText;
            button.disabled = false;
            
        } catch (error) {
            console.error('Error in test IMEI lookup:', error);
            this.showToast('Lỗi khi test IMEI: ' + error.message, 'error');
            
            const button = document.getElementById('lookupAllIMEI');
            button.textContent = '🔍 Tra cứu tất cả';
            button.disabled = false;
        }
    }

    lookupIMEI(imei) {
        // Placeholder for future API integration
        this.showToast(`Chức năng tra cứu IMEI sẽ được phát triển sau. IMEI: ${imei}. Sẽ sử dụng API với cookies string để tra cứu thông tin điện thoại.`, 'info', 5000);
    }

    // Export Functions
    exportIMEI() {
        try {
            const imeiData = [];
            
            // Sử dụng dữ liệu hiển thị mới nhất
            const displayInfo = this.subscriberInfoDisplay && Object.keys(this.subscriberInfoDisplay).length > 0 
                ? this.subscriberInfoDisplay 
                : this.subscriberInfo;
            const ownerPhone = displayInfo ? displayInfo.phoneNumber : '';
            
            // Sử dụng dữ liệu đã lọc thay vì toàn bộ dữ liệu
            const imeiListToExport = this.filteredIMEI && this.filteredIMEI.length > 0 
                ? this.filteredIMEI 
                : Array.from(this.imeiList);
            
            imeiListToExport.forEach((imei, index) => {
                // Tính tần suất cho IMEI này
                const frequency = this.getIMEIFrequency(imei);
                
                // Tính các khoảng thời gian sử dụng
                const usagePeriods = this.getIMEIUsagePeriods(imei);
                
                const model = localStorage.getItem(`imei_model_${imei}`) || '';
                const note = localStorage.getItem(`imei_note_${imei}`) || '';
                
                imeiData.push({
            'TT': index + 1,
                    'Phone': ownerPhone, // Thêm cột Phone với số điện thoại chủ
            'IMEI': imei,
                    'Tần suất': frequency,
                    'Model': model,
                    'Thời gian sử dụng': usagePeriods || '',
                    'Ghi chú': note
                });
            });

        // Tạo tên file với số chủ
        const fileName = `${ownerPhone}_IMEI_analysis.xlsx`;
        
        this.exportToExcel(imeiData, fileName, 'IMEI Analysis');
        } catch (error) {
            console.error('Error exporting IMEI:', error);
            this.showToast('Lỗi khi xuất Excel: ' + error.message, 'error');
        }
    }

    exportContacts() {
        // Sử dụng dữ liệu hiển thị mới nhất
        const displayInfo = this.subscriberInfoDisplay && Object.keys(this.subscriberInfoDisplay).length > 0 
            ? this.subscriberInfoDisplay 
            : this.subscriberInfo;
        const ownerPhone = displayInfo ? displayInfo.phoneNumber : '';

        // Sử dụng dữ liệu đã lọc thay vì toàn bộ dữ liệu
        const contactsToExport = this.filteredContacts && this.filteredContacts.length > 0 
            ? this.filteredContacts 
            : Array.from(this.contacts.values()).sort((a, b) => b.count - a.count);

        const contactsData = contactsToExport.map((contact, index) => {
            const phoneNumber = contact.number || contact.phoneNumber || '';
            const contactData = this.getContactDataFromStorage(phoneNumber);
            
            return {
                'TT': index + 1,
                'Phone': ownerPhone, // Thêm cột Phone với số điện thoại chủ
                'Số điện thoại': phoneNumber,
                'Tần suất': contact.count,
                'Zalo': contactData.zalo || '',
                'Facebook': contactData.facebook || '',
                'Telegram': contactData.telegram || '',
                'Ghi chú': contactData.note || ''
            };
        });

        // Tạo tên file với số chủ
        const fileName = `${ownerPhone}_contacts_analysis.xlsx`;
        
        this.exportToExcel(contactsData, fileName, 'Contacts Analysis');
    }

    exportCallHistory() {
        // Sử dụng dữ liệu hiển thị mới nhất
        const displayInfo = this.subscriberInfoDisplay && Object.keys(this.subscriberInfoDisplay).length > 0 
            ? this.subscriberInfoDisplay 
            : this.subscriberInfo;
            
        // Sử dụng dữ liệu đã lọc thay vì toàn bộ dữ liệu
        const recordsToExport = this.filteredRecords && this.filteredRecords.length > 0 
            ? this.filteredRecords 
            : this.callRecords;
            
        // Giữ nguyên thứ tự import file, không sắp xếp
        const callHistoryData = recordsToExport.map((record, index) => {
            // Xác định số chủ giống như trong updateCallHistoryTableWithData
            let ownerPhone = '';
            
            if (displayInfo && displayInfo.phoneNumber) {
                ownerPhone = displayInfo.phoneNumber;
            } else if (!ownerPhone && record.direction === 'outgoing') {
                ownerPhone = record.sourceNumber || '';
            } else if (!ownerPhone && record.direction === 'incoming') {
                ownerPhone = record.targetNumber || '';
            } else if (!ownerPhone) {
                if (record.sourceNumber && record.sourceNumber !== record.contactNumber) {
                    ownerPhone = record.sourceNumber;
                } else if (record.targetNumber && record.targetNumber !== record.contactNumber) {
                    ownerPhone = record.targetNumber;
                } else if (record.sourceNumber) {
                    ownerPhone = record.sourceNumber;
                } else if (record.targetNumber) {
                    ownerPhone = record.targetNumber;
                }
            }

            return {
                'TT': index + 1,
                'Số chủ': ownerPhone,
                'Số liên hệ': record.contactNumber || '',
                'Thời gian': record.timestamp || '',
                'Thời lượng': record.duration || '',
                'IMEI': record.imei || '',
                'Mã tỉnh': record.provinceCode || '',
                'Loại': record.callTypeReadable || '',
                'Dịch vụ': record.serviceType || '',
                'Địa chỉ': record.location || '',
                'LAC': record.lac || '',
                'Cell': record.cell || ''
            };
        });

        // Tạo tên file với số chủ
        const ownerPhone = this.subscriberInfo ? this.subscriberInfo.phoneNumber : 'unknown';
        const fileName = `${ownerPhone}_call_history.xlsx`;
        
        this.exportToExcel(callHistoryData, fileName, 'Call History Analysis');
    }

    exportLocation() {
        // Sử dụng dữ liệu hiển thị mới nhất
        const displayInfo = this.subscriberInfoDisplay && Object.keys(this.subscriberInfoDisplay).length > 0 
            ? this.subscriberInfoDisplay 
            : this.subscriberInfo;
        
        // Lấy số điện thoại chủ từ nhiều nguồn
        let ownerPhone = '';
        if (displayInfo && displayInfo.phoneNumber) {
            ownerPhone = displayInfo.phoneNumber;
        } else if (this.subscriberInfo && this.subscriberInfo.phoneNumber) {
            ownerPhone = this.subscriberInfo.phoneNumber;
        } else if (this.callRecords && this.callRecords.length > 0) {
            const firstRecord = this.callRecords[0];
            if (firstRecord.sourceNumber) {
                ownerPhone = firstRecord.sourceNumber;
            } else if (firstRecord.targetNumber) {
                ownerPhone = firstRecord.targetNumber;
            }
        }
        
        // Chuẩn hóa số điện thoại
        if (ownerPhone) {
            ownerPhone = String(ownerPhone).trim().replace(/\s+/g, '');
            if (ownerPhone.startsWith('84')) {
                ownerPhone = '0' + ownerPhone.substring(2);
            }
            if (ownerPhone.length === 9 && !ownerPhone.startsWith('0')) {
                ownerPhone = '0' + ownerPhone;
            }
        }

        // Hàm xác định MNC từ số điện thoại chủ thuê bao
        const getMNCFromPhone = (phone) => {
            if (!phone) return '';
            let normalizedPhone = String(phone).trim().replace(/\s+/g, '');
            if (normalizedPhone.startsWith('84')) {
                normalizedPhone = '0' + normalizedPhone.substring(2);
            }
            if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
                normalizedPhone = '0' + normalizedPhone;
            }
            const provider = this.detectNetworkProvider(normalizedPhone);
            if (provider === 'viettel') return '04';
            if (provider === 'vina') return '02';
            if (provider === 'mobi') return '01';
            return '';
        };
        
        // Xác định MNC từ số điện thoại chủ
        const defaultMNC = getMNCFromPhone(ownerPhone);

        // Sử dụng dữ liệu đã lọc thay vì toàn bộ dữ liệu
        const locationsToExport = this.filteredLocations && this.filteredLocations.length > 0 
            ? this.filteredLocations 
            : Array.from(this.locationStats.values()).sort((a, b) => b.count - a.count);

        const locationData = locationsToExport.map((location, index) => {
            // Ưu tiên link Google Maps do người dùng nhập thủ công
            let googleMapsLink = '';
            if (location.googleMapsLink && location.googleMapsLink.trim() !== '') {
                googleMapsLink = location.googleMapsLink;
            } else if (location.lat && location.lon) {
                googleMapsLink = `https://www.google.com/maps?q=${location.lat},${location.lon}`;
            }

            // Ưu tiên MNC đã lưu trong location, nếu không có thì dùng MNC từ số điện thoại chủ
            let mnc = location.mnc || defaultMNC;
            if (!mnc && ownerPhone) {
                mnc = getMNCFromPhone(ownerPhone);
            }
            
            return {
                'TT': index + 1,
                'Phone': ownerPhone, // Cột Phone với số điện thoại chủ
                'MNC': mnc || '', // MNC từ location hoặc từ số điện thoại chủ
                'LAC': location.lac,
                'CID': location.cell,
                'Mã tỉnh': location.provinceCode || '',
                'Tên trạm BTS': location.stationName || location.location || '',
                'Tần suất': location.count,
                'Google Maps': googleMapsLink
            };
        });

        // Tạo tên file với số chủ
        const fileName = `${ownerPhone}_location_analysis.xlsx`;
        
        this.exportToExcel(locationData, fileName, 'Location Analysis');
    }

    exportToExcel(data, filename, sheetName) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, filename);
    }

    exportAllData() {
        try {
            if (!this.currentFileName) {
                console.log('Chưa có file nào được tải lên!');
                return;
            }

            // Sử dụng dữ liệu hiển thị mới nhất (đã chỉnh sửa hoặc dữ liệu gốc)
            const displayInfo = this.subscriberInfoDisplay && Object.keys(this.subscriberInfoDisplay).length > 0 
                ? this.subscriberInfoDisplay 
                : this.subscriberInfo;

            // Tạo tên file với số chủ
            const ownerPhone = displayInfo ? displayInfo.phoneNumber : 'unknown';
            const exportFileName = `${ownerPhone}_export_all.xlsx`;

            // Tạo workbook mới
            const wb = XLSX.utils.book_new();

            // Sheet 1: Thông tin thuê bao (TTTB) - sử dụng dữ liệu hiển thị
            if (displayInfo) {
                const subscriberData = [{
                    'Số điện thoại': displayInfo.phoneNumber || '',
                    'Họ tên chủ thuê bao': displayInfo.name || '',
                    'Ngày sinh': displayInfo.birthDate || '',
                    'Địa chỉ': displayInfo.address || '',
                    'Số giấy tờ tùy thân': displayInfo.idNumber || '',
                    'Ngày cấp ID': displayInfo.idIssueDate || '',
                    'Ngày kích hoạt': displayInfo.activationDate || ''
                }];
                const ws1 = XLSX.utils.json_to_sheet(subscriberData);
                XLSX.utils.book_append_sheet(wb, ws1, 'TTTB');
            }

            // Sheet 2: Lịch sử cuộc gọi (LIST)
            if (this.callRecords && this.callRecords.length > 0) {
                // Giữ nguyên thứ tự import file, không sắp xếp
                const callHistoryData = this.callRecords.map((record, index) => {
                    // Xác định số chủ dựa trên hướng cuộc gọi (giống như trong updateCallHistoryTableWithData)
                    let ownerPhone = '';
                    
                    // Ưu tiên 1: Sử dụng số từ dữ liệu hiển thị (đã chỉnh sửa hoặc gốc)
                    if (displayInfo && displayInfo.phoneNumber) {
                        ownerPhone = displayInfo.phoneNumber;
                    }
                    
                    // Ưu tiên 2: Xác định dựa trên hướng cuộc gọi
                    if (!ownerPhone && record.direction === 'outgoing') {
                        ownerPhone = record.sourceNumber || '';
                    } else if (!ownerPhone && record.direction === 'incoming') {
                        ownerPhone = record.targetNumber || '';
                    }
                    
                    // Ưu tiên 3: Fallback - lấy từ record
                    if (!ownerPhone) {
                        if (record.sourceNumber && record.sourceNumber !== record.contactNumber) {
                            ownerPhone = record.sourceNumber;
                        } else if (record.targetNumber && record.targetNumber !== record.contactNumber) {
                            ownerPhone = record.targetNumber;
                        }
                    }
                    
                    // Ưu tiên 4: Lấy số đầu tiên tìm thấy trong record
                    if (!ownerPhone) {
                        if (record.sourceNumber) {
                            ownerPhone = record.sourceNumber;
                        } else if (record.targetNumber) {
                            ownerPhone = record.targetNumber;
                        }
                    }
                    
                    // Xác định số liên hệ (giống như trong updateCallHistoryTableWithData)
                    let contactNumber = record.contactNumber || '';
                    
                    return {
                        'TT': index + 1,
                        'Số chủ': ownerPhone,
                        'Số liên hệ': contactNumber,
                        'Thời gian': record.timestamp || '',
                        'Thời lượng': record.duration || '',
                        'IMEI': record.imei || '',
                        'Mã tỉnh': record.provinceCode || '',
                        'Loại': record.callTypeReadable || record.callType || '',
                        'Dịch vụ': record.serviceType || record.service || '',
                        'Địa chỉ': record.location || record.address || '',
                        'LAC': record.lac || '',
                        'Cell': record.cell || ''
                    };
                });
                const ws2 = XLSX.utils.json_to_sheet(callHistoryData);
                XLSX.utils.book_append_sheet(wb, ws2, 'LIST');
            }

            // Sheet 3: Số liên lạc (Contact)
            if (this.contacts && this.contacts.size > 0) {
                const contactsData = Array.from(this.contacts.values())
                    .sort((a, b) => b.count - a.count) // Sắp xếp theo tần suất giảm dần
                    .map((contact, index) => {
                        const phoneNumber = contact.number || contact.phoneNumber || '';
                        const contactData = this.getContactDataFromStorage(phoneNumber);
                        
                        return {
                            'TT': index + 1,
                            'Phone': ownerPhone, // Thêm cột Phone với số điện thoại chủ
                            'Số điện thoại': phoneNumber,
                            'Tần suất': contact.count || 0,
                            'Zalo': contactData.zalo || '',
                            'Facebook': contactData.facebook || '',
                            'Telegram': contactData.telegram || '',
                            'Ghi chú': contactData.note || ''
                        };
                    });
                const ws3 = XLSX.utils.json_to_sheet(contactsData);
                XLSX.utils.book_append_sheet(wb, ws3, 'Contact');
            }

            // Sheet 4: IMEI
            if (this.imeiList && this.imeiList.size > 0) {
                const imeiArray = Array.from(this.imeiList)
                    .sort((a, b) => this.getIMEIFrequency(b) - this.getIMEIFrequency(a)); // Sắp xếp theo tần suất giảm dần
                
                const imeiData = imeiArray.map((imei, index) => {
                    const frequency = this.getIMEIFrequency(imei);
                    const isValid = imei && imei.length === 15 && /^\d{15}$/.test(imei);
                    
                    // Tính các khoảng thời gian sử dụng
                    const usagePeriods = this.getIMEIUsagePeriods(imei);
                    
                    // Load data from localStorage
                    const cachedData = getCachedIMEI(imei);
                    
                    return {
                        'TT': index + 1,
                        'Phone': ownerPhone, // Thêm cột Phone với số điện thoại chủ
                        'IMEI': imei || '',
                        'Tần suất': frequency,
                        'Model': cachedData.model || '',
                        'Thời gian sử dụng': usagePeriods || '',
                        'Ghi chú': cachedData.note || (isValid ? 'IMEI hợp lệ' : 'IMEI không hợp lệ')
                    };
                });
                const ws4 = XLSX.utils.json_to_sheet(imeiData);
                XLSX.utils.book_append_sheet(wb, ws4, 'IMEI');
            }

            // Sheet 5: Vị trí (Location)
            if (this.locationStats && this.locationStats.size > 0) {
                // Lấy số điện thoại chủ từ nhiều nguồn
                let ownerPhone = '';
                if (displayInfo && displayInfo.phoneNumber) {
                    ownerPhone = displayInfo.phoneNumber;
                } else if (this.subscriberInfo && this.subscriberInfo.phoneNumber) {
                    ownerPhone = this.subscriberInfo.phoneNumber;
                } else if (this.callRecords && this.callRecords.length > 0) {
                    // Lấy từ call records nếu có
                    const firstRecord = this.callRecords[0];
                    if (firstRecord.sourceNumber) {
                        ownerPhone = firstRecord.sourceNumber;
                    } else if (firstRecord.targetNumber) {
                        ownerPhone = firstRecord.targetNumber;
                    }
                }
                
                // Chuẩn hóa số điện thoại (loại bỏ khoảng trắng, chuyển 84 thành 0)
                if (ownerPhone) {
                    ownerPhone = String(ownerPhone).trim().replace(/\s+/g, '');
                    // Chuyển 84 thành 0 ở đầu
                    if (ownerPhone.startsWith('84')) {
                        ownerPhone = '0' + ownerPhone.substring(2);
                    }
                    // Đảm bảo bắt đầu bằng 0
                    if (ownerPhone.length === 9 && !ownerPhone.startsWith('0')) {
                        ownerPhone = '0' + ownerPhone;
                    }
                }
                
                console.log('Export Location: Found ownerPhone:', ownerPhone);
                
                // Hàm xác định MNC từ số điện thoại chủ thuê bao
                const getMNCFromPhone = (phone) => {
                    if (!phone) {
                        console.warn('getMNCFromPhone: No phone number provided');
                        return '';
                    }
                    // Chuẩn hóa số điện thoại
                    let normalizedPhone = String(phone).trim().replace(/\s+/g, '');
                    if (normalizedPhone.startsWith('84')) {
                        normalizedPhone = '0' + normalizedPhone.substring(2);
                    }
                    if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
                        normalizedPhone = '0' + normalizedPhone;
                    }
                    
                    console.log('getMNCFromPhone: normalized phone:', normalizedPhone);
                    const provider = this.detectNetworkProvider(normalizedPhone);
                    console.log('getMNCFromPhone: detected provider:', provider);
                    
                    if (provider === 'viettel') return '04';
                    if (provider === 'vina') return '02';
                    if (provider === 'mobi') return '01';
                    
                    console.warn('getMNCFromPhone: Could not determine provider for phone:', normalizedPhone);
                    return '';
                };
                
                // Xác định MNC từ số điện thoại chủ
                let defaultMNC = getMNCFromPhone(ownerPhone);
                
                // Fallback: Nếu không tìm được từ số điện thoại, thử lấy từ networkProvider
                if (!defaultMNC && displayInfo && displayInfo.networkProvider) {
                    const provider = String(displayInfo.networkProvider).toUpperCase();
                    if (provider.includes('VIETTEL')) defaultMNC = '04';
                    else if (provider.includes('VINA')) defaultMNC = '02';
                    else if (provider.includes('MOBI')) defaultMNC = '01';
                }
                
                // Fallback cuối cùng: Thử từ subscriberInfo.networkProvider
                if (!defaultMNC && this.subscriberInfo && this.subscriberInfo.networkProvider) {
                    const provider = String(this.subscriberInfo.networkProvider).toUpperCase();
                    if (provider.includes('VIETTEL')) defaultMNC = '04';
                    else if (provider.includes('VINA')) defaultMNC = '02';
                    else if (provider.includes('MOBI')) defaultMNC = '01';
                }
                
                console.log('Export Location: ownerPhone:', ownerPhone, 'defaultMNC:', defaultMNC, 'displayInfo:', displayInfo);

                const locationData = Array.from(this.locationStats.values())
                    .sort((a, b) => b.count - a.count) // Sắp xếp theo tần suất giảm dần
                    .map((location, index) => {
                        // Ưu tiên link Google Maps do người dùng nhập thủ công
                        let googleMapsLink = '';
                        if (location.googleMapsLink && location.googleMapsLink.trim() !== '') {
                            googleMapsLink = location.googleMapsLink;
                        } else if (location.lat && location.lon) {
                            googleMapsLink = `https://www.google.com/maps?q=${location.lat},${location.lon}`;
                        }
                        
                        // Ưu tiên MNC đã lưu trong location, nếu không có thì dùng MNC từ số điện thoại chủ
                        let mnc = location.mnc || defaultMNC;
                        
                        // Nếu vẫn không có MNC, thử lấy từ số điện thoại trong Phone column nếu có
                        if (!mnc && ownerPhone) {
                            mnc = getMNCFromPhone(ownerPhone);
                        }
                        
                        console.log('Location export:', { index, lac: location.lac, cell: location.cell, mnc, locationMNC: location.mnc, defaultMNC });
                        
                        return {
                            'TT': index + 1,
                            'Phone': ownerPhone, // Cột Phone với số điện thoại chủ
                            'MNC': mnc || '', // MNC từ location hoặc từ số điện thoại chủ
                            'LAC': location.lac || '',
                            'CID': location.cell || '',
                            'Mã tỉnh': location.provinceCode || '',
                            'Tên trạm BTS': location.stationName || location.location || '',
                            'Tần suất': location.count || 0,
                            'Google Maps': googleMapsLink
                        };
                    });
                const ws5 = XLSX.utils.json_to_sheet(locationData);
                XLSX.utils.book_append_sheet(wb, ws5, 'Location');
            }

            // Xuất file
            XLSX.writeFile(wb, exportFileName);
            console.log(`Đã xuất tất cả dữ liệu ra file: ${exportFileName}`);

        } catch (error) {
            console.error('Error exporting all data:', error);
        }
    }

    // Export data for a specific fileData object (helper function)
    exportFileData(fileData) {
        try {
            if (!fileData || !fileData.analyzed) {
                return null;
            }

            // Sử dụng dữ liệu hiển thị mới nhất (đã chỉnh sửa hoặc dữ liệu gốc)
            const displayInfo = fileData.subscriberInfoDisplay && Object.keys(fileData.subscriberInfoDisplay).length > 0 
                ? fileData.subscriberInfoDisplay 
                : fileData.subscriberInfo;

            // Tạo tên file với số chủ
            const ownerPhone = displayInfo ? displayInfo.phoneNumber : 'unknown';
            const sanitizeForFileName = (value) => {
                if (!value) return 'unknown';
                return value.toString()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-zA-Z0-9]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_+|_+$/g, '');
            };
            const sanitizedPhone = sanitizeForFileName(ownerPhone);
            const exportFileName = `${sanitizedPhone}_export_all.xlsx`;

            // Tạo workbook mới
            const wb = XLSX.utils.book_new();

            // Sheet 1: Thông tin thuê bao (TTTB)
            if (displayInfo) {
                const subscriberData = [{
                    'Số điện thoại': displayInfo.phoneNumber || '',
                    'Họ tên chủ thuê bao': displayInfo.name || '',
                    'Ngày sinh': displayInfo.birthDate || '',
                    'Địa chỉ': displayInfo.address || '',
                    'Số giấy tờ tùy thân': displayInfo.idNumber || '',
                    'Ngày cấp ID': displayInfo.idIssueDate || '',
                    'Ngày kích hoạt': displayInfo.activationDate || ''
                }];
                const ws1 = XLSX.utils.json_to_sheet(subscriberData);
                XLSX.utils.book_append_sheet(wb, ws1, 'TTTB');
            }

            // Sheet 2: Lịch sử cuộc gọi (LIST)
            if (fileData.callRecords && fileData.callRecords.length > 0) {
                const callHistoryData = fileData.callRecords.map((record, index) => {
                    let ownerPhoneFromRecord = '';
                    if (displayInfo && displayInfo.phoneNumber) {
                        ownerPhoneFromRecord = displayInfo.phoneNumber;
                    } else if (record.direction === 'outgoing') {
                        ownerPhoneFromRecord = record.sourceNumber || '';
                    } else if (record.direction === 'incoming') {
                        ownerPhoneFromRecord = record.targetNumber || '';
                    } else if (record.sourceNumber && record.sourceNumber !== record.contactNumber) {
                        ownerPhoneFromRecord = record.sourceNumber;
                    } else if (record.targetNumber && record.targetNumber !== record.contactNumber) {
                        ownerPhoneFromRecord = record.targetNumber;
                    } else {
                        ownerPhoneFromRecord = record.sourceNumber || record.targetNumber || '';
                    }
                    
                    let contactNumber = record.contactNumber || '';
                    
                    return {
                        'TT': index + 1,
                        'Số chủ': ownerPhoneFromRecord,
                        'Số liên hệ': contactNumber,
                        'Thời gian': record.timestamp || '',
                        'Thời lượng': record.duration || '',
                        'IMEI': record.imei || '',
                        'Mã tỉnh': record.provinceCode || '',
                        'Loại': record.callTypeReadable || record.callType || '',
                        'Dịch vụ': record.serviceType || record.service || '',
                        'Địa chỉ': record.location || record.address || '',
                        'LAC': record.lac || '',
                        'Cell': record.cell || ''
                    };
                });
                const ws2 = XLSX.utils.json_to_sheet(callHistoryData);
                XLSX.utils.book_append_sheet(wb, ws2, 'LIST');
            }

            // Sheet 3: Số liên lạc (Contact)
            if (fileData.contacts && fileData.contacts.size > 0) {
                const contactsData = Array.from(fileData.contacts.values())
                    .sort((a, b) => b.count - a.count)
                    .map((contact, index) => {
                        const phoneNumber = contact.number || contact.phoneNumber || '';
                        const contactData = this.getContactDataFromStorage(phoneNumber);
                        
                        return {
                            'TT': index + 1,
                            'Phone': ownerPhone,
                            'Số điện thoại': phoneNumber,
                            'Tần suất': contact.count || 0,
                            'Zalo': contactData.zalo || '',
                            'Facebook': contactData.facebook || '',
                            'Telegram': contactData.telegram || '',
                            'Ghi chú': contactData.note || ''
                        };
                    });
                const ws3 = XLSX.utils.json_to_sheet(contactsData);
                XLSX.utils.book_append_sheet(wb, ws3, 'Contact');
            }

            // Sheet 4: IMEI
            if (fileData.imeiList && fileData.imeiList.size > 0) {
                // Temporarily set current data to access helper functions
                const originalImeiList = this.imeiList;
                const originalCallRecords = this.callRecords;
                this.imeiList = fileData.imeiList;
                this.callRecords = fileData.callRecords;
                
                const imeiArray = Array.from(fileData.imeiList)
                    .sort((a, b) => this.getIMEIFrequency(b) - this.getIMEIFrequency(a));
                
                const imeiData = imeiArray.map((imei, index) => {
                    const frequency = this.getIMEIFrequency(imei);
                    const isValid = imei && imei.length === 15 && /^\d{15}$/.test(imei);
                    const usagePeriods = this.getIMEIUsagePeriods(imei);
                    const cachedData = getCachedIMEI(imei);
                    
                    return {
                        'TT': index + 1,
                        'Phone': ownerPhone,
                        'IMEI': imei || '',
                        'Tần suất': frequency,
                        'Model': cachedData.model || '',
                        'Thời gian sử dụng': usagePeriods || '',
                        'Ghi chú': cachedData.note || (isValid ? 'IMEI hợp lệ' : 'IMEI không hợp lệ')
                    };
                });
                
                // Restore original data
                this.imeiList = originalImeiList;
                this.callRecords = originalCallRecords;
                
                const ws4 = XLSX.utils.json_to_sheet(imeiData);
                XLSX.utils.book_append_sheet(wb, ws4, 'IMEI');
            }

            // Sheet 5: Vị trí (Location)
            if (fileData.locationStats && fileData.locationStats.size > 0) {
                // Chuẩn hóa số điện thoại chủ
                let normalizedOwnerPhone = ownerPhone;
                if (normalizedOwnerPhone) {
                    normalizedOwnerPhone = String(normalizedOwnerPhone).trim().replace(/\s+/g, '');
                    // Chuyển 84 thành 0 ở đầu
                    if (normalizedOwnerPhone.startsWith('84')) {
                        normalizedOwnerPhone = '0' + normalizedOwnerPhone.substring(2);
                    }
                    // Đảm bảo bắt đầu bằng 0
                    if (normalizedOwnerPhone.length === 9 && !normalizedOwnerPhone.startsWith('0')) {
                        normalizedOwnerPhone = '0' + normalizedOwnerPhone;
                    }
                }
                
                // Hàm xác định MNC từ số điện thoại chủ thuê bao
                const getMNCFromPhone = (phone) => {
                    if (!phone) {
                        console.warn('getMNCFromPhone: No phone number provided');
                        return '';
                    }
                    // Chuẩn hóa số điện thoại
                    let normalizedPhone = String(phone).trim().replace(/\s+/g, '');
                    if (normalizedPhone.startsWith('84')) {
                        normalizedPhone = '0' + normalizedPhone.substring(2);
                    }
                    if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
                        normalizedPhone = '0' + normalizedPhone;
                    }
                    
                    const provider = this.detectNetworkProvider(normalizedPhone);
                    
                    if (provider === 'viettel') return '04';
                    if (provider === 'vina') return '02';
                    if (provider === 'mobi') return '01';
                    
                    console.warn('getMNCFromPhone: Could not determine provider for phone:', normalizedPhone);
                    return '';
                };
                
                // Xác định MNC từ số điện thoại chủ
                let defaultMNC = getMNCFromPhone(normalizedOwnerPhone);
                
                // Fallback: Nếu không tìm được từ số điện thoại, thử lấy từ networkProvider
                if (!defaultMNC && displayInfo && displayInfo.networkProvider) {
                    const provider = String(displayInfo.networkProvider).toUpperCase();
                    if (provider.includes('VIETTEL')) defaultMNC = '04';
                    else if (provider.includes('VINA')) defaultMNC = '02';
                    else if (provider.includes('MOBI')) defaultMNC = '01';
                }
                
                // Fallback cuối cùng: Thử từ fileData.subscriberInfo.networkProvider
                if (!defaultMNC && fileData.subscriberInfo && fileData.subscriberInfo.networkProvider) {
                    const provider = String(fileData.subscriberInfo.networkProvider).toUpperCase();
                    if (provider.includes('VIETTEL')) defaultMNC = '04';
                    else if (provider.includes('VINA')) defaultMNC = '02';
                    else if (provider.includes('MOBI')) defaultMNC = '01';
                }
                
                console.log('ExportFileData Location: ownerPhone:', normalizedOwnerPhone, 'defaultMNC:', defaultMNC, 'displayInfo:', displayInfo);

                const locationData = Array.from(fileData.locationStats.values())
                    .sort((a, b) => b.count - a.count)
                    .map((location, index) => {
                        let googleMapsLink = '';
                        if (location.googleMapsLink && location.googleMapsLink.trim() !== '') {
                            googleMapsLink = location.googleMapsLink;
                        } else if (location.lat && location.lon) {
                            googleMapsLink = `https://www.google.com/maps?q=${location.lat},${location.lon}`;
                        }
                        
                        // Ưu tiên MNC đã lưu trong location, nếu không có thì dùng MNC từ số điện thoại chủ
                        let mnc = location.mnc || defaultMNC;
                        
                        // Nếu vẫn không có MNC, thử lấy từ số điện thoại trong Phone column nếu có
                        if (!mnc && normalizedOwnerPhone) {
                            mnc = getMNCFromPhone(normalizedOwnerPhone);
                        }
                        
                        console.log('Location export (fileData):', { index, lac: location.lac, cell: location.cell, mnc, locationMNC: location.mnc, defaultMNC });
                        
                        return {
                            'TT': index + 1,
                            'Phone': ownerPhone,
                            'MNC': mnc || '', // MNC từ location hoặc từ số điện thoại chủ
                            'LAC': location.lac || '',
                            'CID': location.cell || '',
                            'Mã tỉnh': location.provinceCode || '',
                            'Tên trạm BTS': location.stationName || location.location || '',
                            'Tần suất': location.count || 0,
                            'Google Maps': googleMapsLink
                        };
                    });
                const ws5 = XLSX.utils.json_to_sheet(locationData);
                XLSX.utils.book_append_sheet(wb, ws5, 'Location');
            }

            // Convert workbook to binary string
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
            
            return {
                fileName: exportFileName,
                data: wbout
            };

        } catch (error) {
            console.error('Error exporting file data:', error);
            return null;
        }
    }

    // Export all analyzed files (all types)
    async exportAllFiles() {
        try {
            // Get all analyzed files (regardless of template type)
            const filesToExport = [];
            this.filesData.forEach((fileData, fileId) => {
                if (fileData.analyzed) {
                    filesToExport.push({ fileId, fileData });
                }
            });

            if (filesToExport.length === 0) {
                this.showToast('Không có file nào đã phân tích để xuất!', 'warning');
                return;
            }

            this.showToast(`Đang xuất ${filesToExport.length} file...`, 'info');

            // Create zip file
            const zip = new JSZip();
            let exportedCount = 0;

            // Export each file
            for (const { fileId, fileData } of filesToExport) {
                try {
                    const exportResult = this.exportFileData(fileData);
                    if (exportResult && exportResult.data) {
                        // Convert binary string to Uint8Array for JSZip
                        const arrayBuffer = this.s2ab(exportResult.data);
                        zip.file(exportResult.fileName, arrayBuffer);
                        exportedCount++;
                    }
                } catch (error) {
                    console.error(`Error exporting file ${fileData.fileName}:`, error);
                }
            }

            if (exportedCount === 0) {
                this.showToast('Không thể xuất file nào!', 'error');
                return;
            }

            // Generate zip file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Create download link
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const zipFileName = `export_all_${timestamp}.zip`;
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = zipFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            this.showToast(`Đã xuất ${exportedCount} file thành công!`, 'success');
            console.log(`✅ Exported ${exportedCount} files`);

        } catch (error) {
            console.error('Error exporting all files by template:', error);
            this.showToast('Lỗi khi xuất file: ' + error.message, 'error');
        }
    }

    // Helper function to convert binary string to ArrayBuffer
    s2ab(s) {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < s.length; i++) {
            view[i] = s.charCodeAt(i) & 0xFF;
        }
        return buf;
    }

    // Get template display name
    getTemplateName(template) {
        const names = {
            'template1': 'VIETTEL',
            'template2': 'VINA',
            'template3': 'MOBI'
        };
        return names[template] || template;
    }

    // Location Lookup API Integration - Tạm thời tắt
    async lookupLocation(lac, cell) {
        // Tạm thời tắt để tránh làm chậm ứng dụng
        console.log(`⚠️ Chức năng tra cứu vị trí đã tạm thời tắt cho LAC: ${lac}, Cell: ${cell}`);
        return null;
        
        // try {
        //     console.log(`Looking up location for LAC: ${lac}, Cell: ${cell}`);
            
        //     // API endpoint from 9. Tool Cell Lac.py
        //     const url = `https://api.findcellid.com/api/look_up?mnc=04&mcc=452&lac=${lac}&cid=${cell}`;
            
        //     const response = await fetch(url);
        //     if (response.ok) {
        //         const data = await response.json();
        //         const lat = data.lat;
        //         const lon = data.lon;
                
        //         if (lat && lon) {
        //             console.log(`✅ Found coordinates: ${lat}, ${lon}`);
        //             return {
        //                 latitude: lat,
        //                 longitude: lon,
        //                 address: `LAC: ${lac}, Cell: ${cell}`
        //             };
        //         } else {
        //             console.warn(`⚠️ Missing lat/lon data for LAC: ${lac}, CID: ${cell}`);
        //             return null;
        //         }
        //     } else {
        //         console.error(`❌ HTTP Error: ${response.status} for LAC: ${lac}, CID: ${cell}`);
        //         return null;
        //     }
        // } catch (error) {
        //     console.error(`❌ Exception occurred for LAC: ${lac}, CID: ${cell}:`, error);
        //     return null;
        // }
    }

    // Folium Maps
    // Map file import functions
    showMapFileImport() {
        const fileImportSection = document.getElementById('fileImportSection');
        const mapsPlaceholder = document.getElementById('mapsPlaceholder');
        
        if (fileImportSection.style.display === 'none' || fileImportSection.style.display === '') {
            fileImportSection.style.display = 'block';
            mapsPlaceholder.style.display = 'none';
            // Focus vào file input khi hiển thị
            setTimeout(() => {
                const mapFileInput = document.getElementById('mapFileInput');
                if (mapFileInput) {
                    mapFileInput.click();
                }
            }, 100);
        } else {
            fileImportSection.style.display = 'none';
            mapsPlaceholder.style.display = 'block';
        }
    }

    async handleMapFileImport(files) {
        if (!files || files.length === 0) {
            console.warn('⚠️ No files selected');
            return;
        }

        console.log(`📁 Processing ${files.length} file(s)...`);
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`📄 Processing file ${i + 1}/${files.length}: ${file.name}`);
            
            // Check if file is Excel
            const isExcel = file.type.includes('sheet') || 
                           file.type.includes('excel') ||
                           file.name.endsWith('.xlsx') || 
                           file.name.endsWith('.xls');
            
            if (!isExcel) {
                console.warn(`⚠️ File ${file.name} is not an Excel file`);
                this.showToast(`File ${file.name} không phải là file Excel hợp lệ`, 'error');
                errorCount++;
                continue;
            }
            
            try {
                const data = await this.readMapExcelFile(file);
                
                if (!data || data.length === 0) {
                    console.warn(`⚠️ File ${file.name} has no valid data`);
                    this.showToast(`File ${file.name} không có dữ liệu hợp lệ`, 'warning');
                    errorCount++;
                    continue;
                }
                
                // Check if file already exists
                if (this.mapFiles.has(file.name)) {
                    console.log(`🔄 File ${file.name} already exists, replacing...`);
                }
                
                this.mapFiles.set(file.name, {
                    file: file,
                    data: data
                });
                
                this.addFileToList(file.name);
                successCount++;
                console.log(`✅ Imported file: ${file.name} with ${data.length} records`);
                this.showToast(`✅ Đã import ${file.name} (${data.length} bản ghi)`, 'success');
                
            } catch (error) {
                console.error(`❌ Error importing file ${file.name}:`, error);
                const errorMessage = error.message || 'Lỗi không xác định';
                this.showToast(`❌ Lỗi khi import ${file.name}: ${errorMessage}`, 'error');
                errorCount++;
            }
        }
        
        // Update file list and map data
        this.updateFileList();
        this.updateMapData();
        
        // Show summary
        if (successCount > 0) {
            console.log(`✅ Successfully imported ${successCount} file(s)`);
            if (errorCount > 0) {
                this.showToast(`Đã import ${successCount} file thành công, ${errorCount} file lỗi`, 'warning');
            }
        } else {
            this.showToast('Không có file nào được import thành công', 'error');
        }
    }

    // Extract lat/lon from Google Maps URL
    extractLatLonFromGoogleMaps(url) {
        if (!url || typeof url !== 'string') return null;
        
        try {
            // Pattern 1: https://www.google.com/maps?q=lat,lon
            const qMatch = url.match(/[?&]q=([^&]+)/);
            if (qMatch) {
                const coords = qMatch[1].split(',');
                if (coords.length >= 2) {
                    const lat = parseFloat(coords[0].trim());
                    const lon = parseFloat(coords[1].trim());
                    if (!isNaN(lat) && !isNaN(lon)) {
                        return { lat, lon };
                    }
                }
            }
            
            // Pattern 2: https://www.google.com/maps/@lat,lon,zoom
            const atMatch = url.match(/@([^,]+),([^,]+)/);
            if (atMatch) {
                const lat = parseFloat(atMatch[1].trim());
                const lon = parseFloat(atMatch[2].trim());
                if (!isNaN(lat) && !isNaN(lon)) {
                    return { lat, lon };
                }
            }
            
            // Pattern 3: https://maps.google.com/?ll=lat,lon
            const llMatch = url.match(/[?&]ll=([^&]+)/);
            if (llMatch) {
                const coords = llMatch[1].split(',');
                if (coords.length >= 2) {
                    const lat = parseFloat(coords[0].trim());
                    const lon = parseFloat(coords[1].trim());
                    if (!isNaN(lat) && !isNaN(lon)) {
                        return { lat, lon };
                    }
                }
            }
            
            // Pattern 4: lat,lon directly in URL
            const directMatch = url.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (directMatch) {
                const lat = parseFloat(directMatch[1]);
                const lon = parseFloat(directMatch[2]);
                if (!isNaN(lat) && !isNaN(lon) && 
                    lat >= -90 && lat <= 90 && 
                    lon >= -180 && lon <= 180) {
                    return { lat, lon };
                }
            }
        } catch (error) {
            console.warn('Error extracting lat/lon from Google Maps URL:', error);
        }
        
        return null;
    }

    async readMapExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    console.log(`📖 Reading Excel file: ${file.name}`);
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                        reject(new Error('File Excel không có sheet nào'));
                        return;
                    }
                    
                    console.log(`📑 Available sheets: ${workbook.SheetNames.join(', ')}`);
                    
                    // Priority: 1. Sheet named "location" (case-insensitive), 2. All other sheets
                    let targetSheetName = null;
                    let targetWorksheet = null;
                    
                    // First, try to find sheet named "location"
                    const locationSheetIndex = workbook.SheetNames.findIndex(name => 
                        name.toLowerCase().trim() === 'location'
                    );
                    
                    if (locationSheetIndex !== -1) {
                        targetSheetName = workbook.SheetNames[locationSheetIndex];
                        targetWorksheet = workbook.Sheets[targetSheetName];
                        console.log(`✅ Found "location" sheet: ${targetSheetName}`);
                    } else {
                        console.log(`ℹ️ No "location" sheet found, will search all sheets`);
                    }
                    
                    // Function to check if a sheet has required columns
                    const checkSheetFormat = (sheetName, worksheet) => {
                        if (!worksheet) return false;
                        
                        try {
                            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                            if (jsonData.length === 0) return false;
                            
                            const firstRow = jsonData[0];
                            const availableKeys = Object.keys(firstRow);
                            
                            // Check for required columns
                            const requiredColumns = {
                                'Phone': ['Phone', 'phone', 'Số điện thoại', 'Số chủ', 'Số chủ thuê bao'],
                                'LAC': ['LAC', 'lac', 'Lac'],
                                'CID': ['CID', 'cid', 'Cell', 'cell', 'Cell ID']
                            };
                            
                            let hasAllRequired = true;
                            for (const [standardName, possibleNames] of Object.entries(requiredColumns)) {
                                const found = availableKeys.some(key => 
                                    possibleNames.some(name => 
                                        key.toLowerCase().trim() === name.toLowerCase().trim() ||
                                        key.trim() === name.trim()
                                    )
                                );
                                if (!found) {
                                    hasAllRequired = false;
                                    break;
                                }
                            }
                            
                            // Check for coordinates (Lat/Lon or Google Maps)
                            const hasLatLon = availableKeys.some(key => {
                                const lowerKey = key.toLowerCase().trim();
                                return lowerKey === 'lat' || lowerKey === 'lon' || 
                                       lowerKey === 'latitude' || lowerKey === 'longitude' ||
                                       lowerKey === 'vĩ độ' || lowerKey === 'kinh độ';
                            });
                            
                            const hasGoogleMaps = availableKeys.some(key => {
                                const lowerKey = key.toLowerCase().trim();
                                return lowerKey.includes('google') && lowerKey.includes('map');
                            });
                            
                            const hasCoordinates = hasLatLon || hasGoogleMaps;
                            
                            return hasAllRequired && hasCoordinates;
                        } catch (error) {
                            console.warn(`Error checking sheet ${sheetName}:`, error);
                            return false;
                        }
                    };
                    
                    // If we found location sheet, check if it has correct format
                    if (targetSheetName && targetWorksheet) {
                        if (checkSheetFormat(targetSheetName, targetWorksheet)) {
                            console.log(`✅ Sheet "${targetSheetName}" has correct format`);
                        } else {
                            console.log(`⚠️ Sheet "${targetSheetName}" does not have correct format, searching other sheets...`);
                            targetSheetName = null;
                            targetWorksheet = null;
                        }
                    }
                    
                    // If no location sheet or it doesn't have correct format, search all sheets
                    if (!targetSheetName || !targetWorksheet) {
                        for (let i = 0; i < workbook.SheetNames.length; i++) {
                            const sheetName = workbook.SheetNames[i];
                            // Skip if this is the location sheet we already checked
                            if (sheetName.toLowerCase().trim() === 'location') continue;
                            
                            const worksheet = workbook.Sheets[sheetName];
                            if (checkSheetFormat(sheetName, worksheet)) {
                                targetSheetName = sheetName;
                                targetWorksheet = worksheet;
                                console.log(`✅ Found valid sheet: ${targetSheetName}`);
                                break;
                            }
                        }
                    }
                    
                    // If still no valid sheet found, reject
                    if (!targetSheetName || !targetWorksheet) {
                        reject(new Error('Không tìm thấy sheet nào có đầy đủ các cột bắt buộc (Phone, LAC, CID và Lat/Lon hoặc Google Maps link)'));
                        return;
                    }
                    
                    console.log(`📄 Using sheet: ${targetSheetName}`);
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(targetWorksheet, { defval: '' });
                    console.log(`📊 Raw Excel data from "${targetSheetName}": ${jsonData.length} rows`);
                    console.log(`📋 First 3 rows:`, jsonData.slice(0, 3));
                    
                    if (jsonData.length === 0) {
                        reject(new Error(`Sheet "${targetSheetName}" không có dữ liệu`));
                        return;
                    }
                    
                    const firstRow = jsonData[0];
                    const availableKeys = Object.keys(firstRow);
                    console.log('🔑 Available columns:', availableKeys);
                    
                    // Map column names (case-insensitive and support Vietnamese)
                    // Required columns
                    const requiredColumnMapping = {
                        'Phone': ['Phone', 'phone', 'Số điện thoại', 'Số chủ', 'Số chủ thuê bao'],
                        'LAC': ['LAC', 'lac', 'Lac'],
                        'CID': ['CID', 'cid', 'Cell', 'cell', 'Cell ID']
                    };
                    
                    // Optional columns
                    const optionalColumnMapping = {
                        'TT': ['TT', 'tt', 'Tt', 'STT', 'stt', 'Số thứ tự'],
                        'MNC': ['MNC', 'mnc', 'Mnc'],
                        'Datetime': ['Datetime', 'datetime', 'Thời gian', 'Time', 'time', 'Timestamp', 'timestamp'],
                        'Lat': ['Lat', 'lat', 'Latitude', 'latitude', 'Vĩ độ'],
                        'Lon': ['Lon', 'lon', 'Longitude', 'longitude', 'Kinh độ', 'Long'],
                        'GoogleMaps': ['Google Maps', 'GoogleMaps', 'googlemaps', 'Google Maps Link', 'Link', 'link', 'Maps', 'maps']
                    };
                    
                    // Find required column mappings
                    const mappedColumns = {};
                    for (const [standardName, possibleNames] of Object.entries(requiredColumnMapping)) {
                        const foundKey = availableKeys.find(key => 
                            possibleNames.some(name => 
                                key.toLowerCase().trim() === name.toLowerCase().trim() ||
                                key.trim() === name.trim()
                            )
                        );
                        if (foundKey) {
                            mappedColumns[standardName] = foundKey;
                            console.log(`✅ Mapped required ${standardName} -> ${foundKey}`);
                        } else {
                            console.error(`❌ Required column ${standardName} not found`);
                            reject(new Error(`Thiếu cột bắt buộc: ${standardName} (có thể là: ${possibleNames.join(', ')})`));
                            return;
                        }
                    }
                    
                    // Find optional column mappings
                    for (const [standardName, possibleNames] of Object.entries(optionalColumnMapping)) {
                        const foundKey = availableKeys.find(key => 
                            possibleNames.some(name => 
                                key.toLowerCase().trim() === name.toLowerCase().trim() ||
                                key.trim() === name.trim()
                            )
                        );
                        if (foundKey) {
                            mappedColumns[standardName] = foundKey;
                            console.log(`✅ Mapped optional ${standardName} -> ${foundKey}`);
                        } else {
                            console.log(`ℹ️ Optional column ${standardName} not found (will skip)`);
                        }
                    }
                    
                    // Map data to standard column names and extract coordinates
                    const mappedData = jsonData.map((row, index) => {
                        const mappedRow = {};
                        
                        // Copy all mapped columns
                        for (const [standardName, originalKey] of Object.entries(mappedColumns)) {
                            mappedRow[standardName] = row[originalKey];
                        }
                        
                        // Extract lat/lon if not present but Google Maps link exists
                        if ((!mappedRow.Lat || !mappedRow.Lon) && mappedRow.GoogleMaps) {
                            const coords = this.extractLatLonFromGoogleMaps(mappedRow.GoogleMaps);
                            if (coords) {
                                mappedRow.Lat = coords.lat;
                                mappedRow.Lon = coords.lon;
                                console.log(`📍 Extracted lat/lon from Google Maps link for row ${index + 1}:`, coords);
                            }
                        }
                        
                        return mappedRow;
                    });
                    
                    console.log(`📊 Mapped data (first 2 rows):`, mappedData.slice(0, 2));
                    
                    // Filter valid data (must have Phone, LAC, CID, and either Lat/Lon or extracted from Google Maps)
                    const validData = mappedData.filter((row, index) => {
                        // Check required fields
                        if (!row.Phone || !row.LAC || !row.CID) {
                            console.warn(`⚠️ Row ${index + 1} missing required fields (Phone, LAC, or CID)`);
                            return false;
                        }
                        
                        // Check coordinates
                        const lat = parseFloat(row.Lat);
                        const lon = parseFloat(row.Lon);
                        
                        if (isNaN(lat) || isNaN(lon)) {
                            console.warn(`⚠️ Row ${index + 1} missing valid Lat/Lon coordinates`);
                            return false;
                        }
                        
                        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                            console.warn(`⚠️ Row ${index + 1} has invalid Lat/Lon range: ${lat}, ${lon}`);
                            return false;
                        }
                        
                        return true;
                    });
                    
                    console.log(`✅ Valid data count: ${validData.length} out of ${jsonData.length}`);
                    if (validData.length === 0) {
                        reject(new Error('Không có dữ liệu hợp lệ. Cần có: Phone, LAC, CID và Lat/Lon (hoặc Google Maps link chứa tọa độ)'));
                        return;
                    }
                    
                    console.log('📋 Sample valid data:', validData.slice(0, 2));
                    
                    resolve(validData);
                } catch (error) {
                    console.error('❌ Error reading Excel file:', error);
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                console.error('❌ FileReader error:', error);
                reject(new Error('Lỗi đọc file: ' + (error.message || 'Unknown error')));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    addFileToList(fileName) {
        const fileList = document.getElementById('mapFileList');
        const fileItems = document.getElementById('mapFileItems');
        
        // Create file item
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">${fileName}</span>
            <button class="remove-file" onclick="cdrAnalyzer.removeMapFile('${fileName}')">✕</button>
        `;
        
        fileItems.appendChild(fileItem);
        fileList.style.display = 'block';
    }

    removeMapFile(fileName) {
        this.mapFiles.delete(fileName);
        this.updateFileList();
        this.updateMapData();
    }

    updateFileList() {
        const fileList = document.getElementById('mapFileList');
        const fileItems = document.getElementById('mapFileItems');
        const fileCount = document.getElementById('fileCount');
        
        fileItems.innerHTML = '';
        
        if (this.mapFiles.size === 0) {
            fileList.style.display = 'none';
        } else {
            fileList.style.display = 'block';
            if (fileCount) {
                fileCount.textContent = this.mapFiles.size;
            }
            this.mapFiles.forEach((fileData, fileName) => {
                this.addFileToList(fileName);
            });
        }
    }

    updateMapData() {
        this.mapData = [];
        this.mapFiles.forEach((fileData, fileName) => {
            console.log(`Processing file ${fileName}:`, fileData.data);
            this.mapData = this.mapData.concat(fileData.data);
        });
        
        console.log(`📊 Total map data: ${this.mapData.length} records from ${this.mapFiles.size} files`);
        console.log('Sample map data:', this.mapData.slice(0, 3));
    }

    async drawFoliumMap() {
        console.log('🗺️ Starting drawFoliumMap...');
        
        const mapsPlaceholder = document.getElementById('mapsPlaceholder');
        const loadingContainer = document.getElementById('loadingContainer');
        const mapResult = document.getElementById('mapResult');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        console.log('Elements found:', {
            mapsPlaceholder: !!mapsPlaceholder,
            loadingContainer: !!loadingContainer,
            mapResult: !!mapResult,
            progressFill: !!progressFill,
            progressText: !!progressText
        });

        // Check if we have map data
        console.log('Map data length:', this.mapData.length);
        console.log('Map files size:', this.mapFiles.size);
        console.log('Map data sample:', this.mapData.slice(0, 2));
        
        if (this.mapData.length === 0) {
            this.showToast('Vui lòng import file Excel có dữ liệu vị trí trước khi vẽ bản đồ!', 'warning');
            return;
        }

        // Show loading
        if (mapsPlaceholder) mapsPlaceholder.style.display = 'none';
        if (loadingContainer) loadingContainer.style.display = 'block';
        if (mapResult) mapResult.style.display = 'none';

        try {
            // Process map data
            let processedCount = 0;
            const totalRecords = this.mapData.length;
            console.log(`Processing ${totalRecords} records...`);
            
            // Simulate processing delay for better UX
            for (let i = 0; i < totalRecords; i++) {
                await new Promise(resolve => setTimeout(resolve, 10));
                
                processedCount++;
                const progress = Math.round((processedCount / totalRecords) * 100);
                
                if (progressFill) {
                progressFill.style.width = `${progress}%`;
                }
                if (progressText) {
                progressText.textContent = `${progress}%`;
                }
            }

            console.log('Generating map HTML...');
            // Generate Folium map HTML based on Python code reference
            const mapHTML = this.generateFoliumMapHTML(this.mapData);
            console.log('Map HTML generated, length:', mapHTML.length);
            
            // Save to file
            const blob = new Blob([mapHTML], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            console.log('Map URL created:', url);
            
            // Store URL for later use
            localStorage.setItem('folium_map_url', url);
            
            // Show success
            if (loadingContainer) loadingContainer.style.display = 'none';
            if (mapResult) mapResult.style.display = 'block';
            
            // Hide file import section
            const fileImportSection = document.getElementById('fileImportSection');
            if (fileImportSection) fileImportSection.style.display = 'none';
            
            console.log('✅ Map generated successfully!');
            
        } catch (error) {
            console.error('❌ Error drawing map:', error);
            this.showToast('Lỗi khi vẽ bản đồ: ' + error.message, 'error');
            
            // Reset to placeholder
            if (loadingContainer) loadingContainer.style.display = 'none';
            if (mapsPlaceholder) mapsPlaceholder.style.display = 'block';
        }
    }

    generateFoliumMapHTML(mapData) {
        // Tạo bản đồ với vị trí trung tâm là Việt Nam (theo code Python)
        const centerLat = 14.0583;
        const centerLon = 108.2772;
        
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>🗺️ Bản đồ vị trí từ dữ liệu Excel</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.css" />
    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/leaflet.markercluster.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/MarkerCluster.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/MarkerCluster.Default.css" />
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif; 
        }
        #map { 
            height: 100vh; 
            width: 100vw; 
        }
        .info { 
            position: absolute; 
            top: 10px; 
            left: 10px; 
            z-index: 1000; 
            background: white; 
            padding: 15px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.3); 
            max-width: 300px; 
        }
        .info h3 { 
            margin: 0 0 10px 0; 
            color: #2563eb; 
        }
        .info p { 
            margin: 5px 0; 
            color: #64748b; 
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 2000;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        /* Custom tooltip styles - nhỏ hơn */
        .leaflet-tooltip { 
            font-size: 11px !important; 
            padding: 4px 6px !important; 
            max-width: 120px !important; 
            white-space: nowrap !important;
        }
        .leaflet-tooltip-tip { 
            width: 6px !important; 
            height: 6px !important; 
        }
        
        /* Popup content styles - nhỏ hơn 30% */
        .leaflet-popup-content { 
            font-size: 11px !important; 
            line-height: 1.3 !important;
        }
        .leaflet-popup-content-wrapper { 
            max-width: 210px !important; 
        }
        
        
        /* Custom marker styles */
        .custom-marker {
            background: transparent !important;
            border: none !important;
        }
        
        /* Custom popup styles */
        .custom-popup .leaflet-popup-content-wrapper {
            border-radius: 6px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
        }
        
        .custom-popup .leaflet-popup-content {
            margin: 8px 12px !important;
        }
        
        .custom-popup .leaflet-popup-tip {
            width: 8px !important;
            height: 8px !important;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">⏳ Đang tải bản đồ...</div>
    <div class="info">
        <h3>🗺️ Bản đồ vị trí từ Excel</h3>
        <p>📊 Tổng số điểm: ${mapData.length}</p>
        <p>📁 Số file: ${this.mapFiles.size}</p>
    </div>
    <div id="map"></div>
    
    <script>
        console.log('🗺️ Starting map initialization...');
        
        // Wait for DOM to be ready
        document.addEventListener('DOMContentLoaded', function() {
            console.log('📄 DOM ready, initializing map...');
            initializeMap();
        });
        
        function initializeMap() {
            try {
                // Check if Leaflet is loaded
                if (typeof L === 'undefined') {
                    console.error('❌ Leaflet library not loaded!');
                    document.getElementById('loading').innerHTML = '❌ Lỗi: Không thể tải thư viện Leaflet';
                    return;
                }
                
                console.log('✅ Leaflet loaded successfully');
                
                // Hàm chuyển đổi datetime thành định dạng thời gian
                function formatDateTime(datetime) {
                    if (!datetime || datetime === "N/A") return "N/A";
                    try {
                        // Nếu là số (Excel date serial number)
                        if (typeof datetime === "number") {
                            // Chuyển đổi Excel date serial number thành Date object
                            // Excel date starts from 1900-01-01, JavaScript from 1970-01-01
                            const excelDate = new Date((datetime - 25569) * 86400 * 1000);
                            return excelDate.toLocaleString("vi-VN", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            });
                        }
                        // Nếu là string, thử parse
                        const date = new Date(datetime);
                        if (!isNaN(date.getTime())) {
                            return date.toLocaleString("vi-VN", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            });
                        }
                        return datetime.toString();
                    } catch (e) {
                        console.warn("Error formatting datetime:", datetime, e);
                        return datetime.toString();
                    }
                }
                
                // Hàm tạo màu sắc cho từng số điện thoại - màu sáng rõ nét
                function getPhoneColor(phone) {
                    // Danh sách màu sắc sáng rõ nét để phân biệt các số điện thoại
                    const colors = [
                        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF',
                        '#00FFFF', '#FF8000', '#8000FF', '#FF0080', '#80FF00',
                        '#0080FF', '#FF4040', '#40FF40', '#4040FF', '#FFFF40',
                        '#FF40FF', '#40FFFF', '#FF8040', '#8040FF', '#FF4080'
                    ];
                    
                    // Tạo hash từ số điện thoại để có màu cố định cho mỗi số
                    let hash = 0;
                    for (let i = 0; i < phone.length; i++) {
                        hash = phone.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    
                    // Lấy màu từ danh sách dựa trên hash
                    const colorIndex = Math.abs(hash) % colors.length;
                    return colors[colorIndex];
                }
                
                // Create map with center in Vietnam
                const map = L.map('map').setView([${centerLat}, ${centerLon}], 6);
                console.log('✅ Map created');
                
                // Add tile layer
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(map);
                console.log('✅ Tile layer added');
                
                // Create MarkerCluster
                const markerCluster = L.markerClusterGroup();
                console.log('✅ MarkerCluster created');
                
                // Map data
                const mapData = ${JSON.stringify(mapData)};
                console.log('📊 Processing ' + mapData.length + ' data points...');
                
                let markerCount = 0;
                mapData.forEach((row, index) => {
                    const lat = parseFloat(row.Lat);
                    const lon = parseFloat(row.Lon);
                    
                    if (!isNaN(lat) && !isNaN(lon)) {
                        // Format phone number
                        let phone = row.Phone || "N/A";
                        if (phone !== "N/A" && phone !== "") {
                            phone = String(parseInt(phone)).padStart(10, "0");
                        }
                        const datetime = formatDateTime(row.Datetime);
                        
                        // Lấy màu sắc cho số điện thoại này
                        const phoneColor = getPhoneColor(phone);
                        
                        // Create tooltip (không có emoji, có màu sắc)
                        const tooltipText = phone;
                        
                        // Create popup với thông tin chi tiết (không có emoji, nhỏ hơn 30%)
                        const popupText = '<b>Phone:</b> ' + phone + '<br>' +
                                        '<b>Thời gian:</b> ' + datetime + '<br>' +
                                        '<b>CID:</b> ' + (row.CID || "N/A") + '<br>' +
                                        '<b>LAC:</b> ' + (row.LAC || "N/A") + '<br>' +
                                        '<a href="https://www.google.com/maps?q=' + lat + ',' + lon + '" target="_blank">Google Maps</a>';
                        
                        // Create custom marker với màu sắc riêng cho từng số điện thoại
                        const marker = L.marker([lat, lon], {
                            icon: L.divIcon({
                                className: 'custom-marker',
                                html: '<div style="background-color: ' + phoneColor + '; width: 19px; height: 19px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
                                iconSize: [19, 19],
                                iconAnchor: [9, 9]
                            })
                        });
                        
                        marker.bindTooltip(tooltipText, {
                            direction: "top",
                            offset: [0, -10],
                            className: "custom-tooltip",
                            permanent: false,
                            opacity: 0.9,
                            style: 'background: ' + phoneColor + '; color: white; border: none; font-size: 11px; padding: 4px 6px; max-width: 120px; white-space: nowrap;'
                        });
                        
                        marker.bindPopup(popupText, {
                            maxWidth: 210,
                            className: 'custom-popup'
                        });
                        
                        markerCluster.addLayer(marker);
                        markerCount++;
                    }
                });
                
                console.log('✅ Created ' + markerCount + ' markers');
                
                // Add markerCluster to map
                map.addLayer(markerCluster);
                console.log('✅ MarkerCluster added to map');
                
                // Hide loading
                document.getElementById('loading').style.display = 'none';
                console.log('✅ Map initialization completed successfully!');
                
            } catch (error) {
                console.error('❌ Error initializing map:', error);
                document.getElementById('loading').innerHTML = '❌ Lỗi: ' + error.message;
            }
        }
        
        // Fallback if DOMContentLoaded already fired
        if (document.readyState === 'loading') {
            // DOM is still loading, wait for DOMContentLoaded
        } else {
            // DOM is already loaded, initialize immediately
            initializeMap();
        }
    </script>
</body>
</html>`;
    }

    openMapFile() {
        const mapUrl = localStorage.getItem('folium_map_url');
        if (mapUrl) {
            window.open(mapUrl, '_blank');
        } else {
            this.showToast('Không tìm thấy file bản đồ!', 'error');
        }
    }

    downloadMapFile() {
        const mapUrl = localStorage.getItem('folium_map_url');
        if (mapUrl) {
            // Tạo tên file với timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const fileName = `folium_map_${timestamp}.html`;
            
            // Tạo link download
            const link = document.createElement('a');
            link.href = mapUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ Downloaded map file: ${fileName}`);
        } else {
            this.showToast('Không tìm thấy file bản đồ!', 'error');
        }
    }

    // ===== CONTACT DATA MANAGEMENT =====
    
    // Lưu dữ liệu số liên lạc vào localStorage
    saveContactData(phoneNumber, field, value) {
        try {
            const storageKey = `contact_data_${phoneNumber}`;
            let contactData = this.getContactDataFromStorage(phoneNumber);
            
            // Cập nhật field cụ thể
            contactData[field] = value;
            
            // Lưu vào localStorage
            localStorage.setItem(storageKey, JSON.stringify(contactData));
            
            console.log(`Đã lưu ${field} cho số ${phoneNumber}:`, value);
        } catch (error) {
            console.error('Lỗi khi lưu dữ liệu số liên lạc:', error);
        }
    }
    
    // Lấy dữ liệu số liên lạc từ localStorage
    getContactDataFromStorage(phoneNumber) {
        try {
            const storageKey = `contact_data_${phoneNumber}`;
            const storedData = localStorage.getItem(storageKey);
            
            if (storedData) {
                return JSON.parse(storedData);
            }
            
            // Trả về object mặc định nếu chưa có dữ liệu
            return {
                zalo: '',
                facebook: '',
                telegram: '',
                note: ''
            };
        } catch (error) {
            console.error('Lỗi khi đọc dữ liệu số liên lạc:', error);
            return {
                zalo: '',
                facebook: '',
                telegram: '',
                note: ''
            };
        }
    }
    
    // Xóa dữ liệu số liên lạc khỏi localStorage
    clearContactData(phoneNumber) {
        try {
            const storageKey = `contact_data_${phoneNumber}`;
            localStorage.removeItem(storageKey);
            console.log(`Đã xóa dữ liệu cho số ${phoneNumber}`);
        } catch (error) {
            console.error('Lỗi khi xóa dữ liệu số liên lạc:', error);
        }
    }
    
    // Xóa tất cả dữ liệu số liên lạc
    clearAllContactData() {
        try {
            const keys = Object.keys(localStorage);
            const contactKeys = keys.filter(key => key.startsWith('contact_data_'));
            
            contactKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log(`Đã xóa ${contactKeys.length} bản ghi dữ liệu số liên lạc`);
            
            // Refresh lại bảng contacts
            this.renderContactsPage();
            
            return contactKeys.length;
        } catch (error) {
            console.error('Lỗi khi xóa tất cả dữ liệu số liên lạc:', error);
            return 0;
        }
    }
    
    // Lấy danh sách tất cả số liên lạc đã có dữ liệu
    getAllContactData() {
        try {
            const keys = Object.keys(localStorage);
            const contactKeys = keys.filter(key => key.startsWith('contact_data_'));
            const contactDataList = [];
            
            contactKeys.forEach(key => {
                const phoneNumber = key.replace('contact_data_', '');
                const data = this.getContactDataFromStorage(phoneNumber);
                contactDataList.push({
                    phoneNumber: phoneNumber,
                    ...data
                });
            });
            
            return contactDataList;
        } catch (error) {
            console.error('Lỗi khi lấy danh sách dữ liệu số liên lạc:', error);
            return [];
        }
    }
}

// Initialize the application
let cdrAnalyzer;

document.addEventListener('DOMContentLoaded', () => {
    cdrAnalyzer = new CDRAnalyzer();
    
    // Global helper functions for onclick handlers
    window.openCompareFilesModal = function() {
        if (cdrAnalyzer && cdrAnalyzer.openCompareFilesModal) {
            cdrAnalyzer.openCompareFilesModal();
        } else {
            console.error('cdrAnalyzer not initialized or openCompareFilesModal not found');
        }
    };
    
    window.closeCompareFilesModal = function() {
        if (cdrAnalyzer && cdrAnalyzer.closeCompareFilesModal) {
            cdrAnalyzer.closeCompareFilesModal();
        }
    };
    
    window.applyCompareFilesSelection = function() {
        if (cdrAnalyzer && cdrAnalyzer.applyCompareFilesSelection) {
            cdrAnalyzer.applyCompareFilesSelection();
        }
    };
    
    window.selectAllCompareFiles = function() {
        if (cdrAnalyzer && cdrAnalyzer.selectAllCompareFiles) {
            cdrAnalyzer.selectAllCompareFiles();
        }
    };
    
    window.deselectAllCompareFiles = function() {
        if (cdrAnalyzer && cdrAnalyzer.deselectAllCompareFiles) {
            cdrAnalyzer.deselectAllCompareFiles();
        }
    };
    
    window.clearCompareSearch = function() {
        if (cdrAnalyzer && cdrAnalyzer.clearCompareSearch) {
            cdrAnalyzer.clearCompareSearch();
        }
    };
    
    // Load saved IMEI models and notes from localStorage
    setTimeout(() => {
        try {
            const imeiInputs = document.querySelectorAll('.imei-input');
        const modelInputs = document.querySelectorAll('.model-input');
            const noteInputs = document.querySelectorAll('.note-input');
            
            imeiInputs.forEach(input => {
                const imei = input.dataset.originalImei;
                const savedIMEI = localStorage.getItem(`imei_edited_${imei}`);
                if (savedIMEI) {
                    input.value = savedIMEI;
                    // Update the dataset
                    input.dataset.originalImei = savedIMEI;
                }
            });
            
        modelInputs.forEach(input => {
            const imei = input.dataset.imei;
            const savedModel = localStorage.getItem(`imei_model_${imei}`);
            if (savedModel) {
                input.value = savedModel;
            }
        });
            
            noteInputs.forEach(input => {
                const imei = input.dataset.imei;
                const savedNote = localStorage.getItem(`imei_note_${imei}`);
                if (savedNote) {
                    input.value = savedNote;
                }
            });
            
            console.log('Saved data loaded successfully');
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }, 100);
});

// Helper function for getting cached IMEI data
function getCachedIMEI(imei) {
    try {
        const model = localStorage.getItem(`imei_model_${imei}`) || '';
        const note = localStorage.getItem(`imei_note_${imei}`) || '';
        return { model, note };
    } catch (error) {
        console.error('Error getting cached IMEI:', error);
        return { model: '', note: '' };
    }
}

// Add Compare Tab Methods to CDRAnalyzer class
CDRAnalyzer.prototype.initializeCompareEventListeners = function() {
    // Compare file input events
    const compareFileInput = document.getElementById('compareFileInput');
    const compareDropZone = document.getElementById('compareDropZone');
    const addCompareFileBtn = document.getElementById('addCompareFile');
    const exportCompareResultsBtn = document.getElementById('exportCompareResults');
    const clearCompareFilesBtn = document.getElementById('clearCompareFiles');

    if (compareFileInput) {
        compareFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleCompareFiles(e.target.files);
            }
        });
    }

    if (compareDropZone) {
        compareDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            compareDropZone.classList.add('dragover');
        });

        compareDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            compareDropZone.classList.remove('dragover');
        });

        compareDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            compareDropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleCompareFiles(files);
            }
        });

        compareDropZone.addEventListener('click', (e) => {
            if (!e.target.closest('.template-selector')) {
                compareFileInput.value = '';
                compareFileInput.click();
            }
        });
    }

    // Remove file button
    const removeCompareFileBtn = document.getElementById('removeCompareFile');
    if (removeCompareFileBtn) {
        removeCompareFileBtn.addEventListener('click', () => {
            this.removeCompareFile();
        });
    }

    if (addCompareFileBtn) {
        addCompareFileBtn.addEventListener('click', () => {
            compareFileInput.click();
        });
    }

    if (exportCompareResultsBtn) {
        exportCompareResultsBtn.addEventListener('click', () => {
            this.exportCompareResults();
        });
    }

    if (clearCompareFilesBtn) {
        clearCompareFilesBtn.addEventListener('click', () => {
            this.clearCompareFiles();
        });
    }

    // Analysis buttons - New compare functions
    const analyzeSharedContactsBtn = document.getElementById('analyzeSharedContacts');
    const analyzeSharedIMEIBtn = document.getElementById('analyzeSharedIMEI');
    const analyzeSharedLocationsBtn = document.getElementById('analyzeSharedLocations');
    const analyzeTwoFilesBtn = document.getElementById('analyzeTwoFiles');
    const performTwoFilesCompareBtn = document.getElementById('performTwoFilesCompare');

    if (analyzeSharedContactsBtn) {
        analyzeSharedContactsBtn.addEventListener('click', () => {
            this.analyzeSharedContacts();
        });
    }

    if (analyzeSharedIMEIBtn) {
        analyzeSharedIMEIBtn.addEventListener('click', () => {
            this.analyzeSharedIMEI();
        });
    }

    if (analyzeSharedLocationsBtn) {
        analyzeSharedLocationsBtn.addEventListener('click', () => {
            this.analyzeSharedLocations();
        });
    }

    if (analyzeTwoFilesBtn) {
        analyzeTwoFilesBtn.addEventListener('click', () => {
            this.showTwoFilesComparison();
        });
    }

    if (performTwoFilesCompareBtn) {
        performTwoFilesCompareBtn.addEventListener('click', () => {
            this.performTwoFilesComparison();
        });
    }

    // Update compare file counts when tab is shown
    const compareTab = document.querySelector('[data-tab="compare"]');
    if (compareTab) {
        compareTab.addEventListener('click', () => {
            this.updateCompareFileCounts();
            this.updateCompareFileDropdowns();
        });
    }

    // Compare results search and pagination
    const compareSearchInput = document.getElementById('compareSearch');
    const filterCompareResultsBtn = document.getElementById('filterCompareResults');
    const resetCompareResultsBtn = document.getElementById('resetCompareResults');
    const prevComparePageBtn = document.getElementById('prevComparePageBtn');
    const nextComparePageBtn = document.getElementById('nextComparePageBtn');

    if (compareSearchInput) {
        compareSearchInput.addEventListener('input', () => {
            this.updateCompareSearchClearButton();
            this.filterCompareResults();
        });
        // Show/hide clear button on load
        compareSearchInput.addEventListener('focus', () => {
            this.updateCompareSearchClearButton();
        });
    }

    if (filterCompareResultsBtn) {
        filterCompareResultsBtn.addEventListener('click', () => {
            this.filterCompareResults();
        });
    }

    if (resetCompareResultsBtn) {
        resetCompareResultsBtn.addEventListener('click', () => {
            this.resetCompareFilters();
        });
    }

    // Event listeners removed - using onclick in HTML instead

    // Keyboard navigation for compare results
    document.addEventListener('keydown', (e) => {
        // Only handle keyboard navigation when compare results are visible
        const compareResults = document.getElementById('compareResults');
        if (compareResults && compareResults.style.display !== 'none') {
            if (e.key === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                this.previousComparePage();
            } else if (e.key === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                this.nextComparePage();
            }
        }
    });

    // Results actions
    const exportCurrentResultsBtn = document.getElementById('exportCurrentResults');
    const clearResultsBtn = document.getElementById('clearResults');

    if (exportCurrentResultsBtn) {
        exportCurrentResultsBtn.addEventListener('click', () => {
            this.exportCurrentCompareResults();
        });
    }

    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', () => {
            this.clearCompareResults();
        });
    }

    // Compare files selection modal
    // Use event delegation for buttons that might not exist yet
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'openCompareFilesModal') {
            e.preventDefault();
            e.stopPropagation();
            this.openCompareFilesModal();
        } else if (e.target && e.target.id === 'closeCompareFilesModal') {
            e.preventDefault();
            e.stopPropagation();
            this.closeCompareFilesModal();
            this.updateCompareFileCheckboxes();
        } else if (e.target && e.target.id === 'cancelCompareFilesSelection') {
            e.preventDefault();
            e.stopPropagation();
            this.closeCompareFilesModal();
            this.updateCompareFileCheckboxes();
        } else if (e.target && e.target.id === 'applyCompareFilesSelection') {
            e.preventDefault();
            e.stopPropagation();
            this.applyCompareFilesSelection();
        }
    });

    // Also try to attach directly if elements exist
    const openCompareFilesModalBtn = document.getElementById('openCompareFilesModal');
    const closeCompareFilesModalBtn = document.getElementById('closeCompareFilesModal');
    const cancelCompareFilesSelectionBtn = document.getElementById('cancelCompareFilesSelection');
    const applyCompareFilesSelectionBtn = document.getElementById('applyCompareFilesSelection');

    if (openCompareFilesModalBtn) {
        openCompareFilesModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openCompareFilesModal();
        });
    }

    if (closeCompareFilesModalBtn) {
        closeCompareFilesModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeCompareFilesModal();
            this.updateCompareFileCheckboxes();
        });
    }

    if (cancelCompareFilesSelectionBtn) {
        cancelCompareFilesSelectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeCompareFilesModal();
            this.updateCompareFileCheckboxes();
        });
    }

    if (applyCompareFilesSelectionBtn) {
        applyCompareFilesSelectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.applyCompareFilesSelection();
        });
    }

    this.updateCompareSelectedSummary();
};

// Initialize compare data
CDRAnalyzer.prototype.initializeCompareData = function() {
    this.compareFiles = [];
    this.compareResults = null;
    this.currentCompareAnalysis = null;
};

// Handle files for comparison (multiple files supported)
CDRAnalyzer.prototype.handleCompareFiles = async function(files) {
    try {
        const fileArray = Array.from(files);
        const validFiles = [];
        const invalidFiles = [];

        console.log('Processing compare files:', fileArray.length);

        for (const file of fileArray) {
            try {
                if (!this.isValidExcelFile(file)) {
                    invalidFiles.push(`${file.name}: Không phải file Excel`);
                    continue;
                }

                const fileData = await this.readCompareExcelFile(file);
                console.log(`File ${file.name} loaded, rows:`, fileData ? fileData.length : 0);

                if (!fileData || fileData.length === 0) {
                    invalidFiles.push(`${file.name}: File rỗng`);
                    continue;
                }

                // Kiểm tra có cột Phone không (linh hoạt hơn)
                const hasPhone = this.hasPhoneColumn(fileData);
                console.log(`File ${file.name} has phone column:`, hasPhone);

                if (!hasPhone) {
                    invalidFiles.push(`${file.name}: Không tìm thấy cột "Phone"`);
                    continue;
                }

                const columns = this.detectColumns(fileData);
                validFiles.push({
                    name: file.name,
                    data: fileData,
                    columns: columns
                });
                console.log(`File ${file.name} added successfully`);
            } catch (fileError) {
                console.error(`Error processing file ${file.name}:`, fileError);
                invalidFiles.push(`${file.name}: ${fileError.message}`);
            }
        }

        if (validFiles.length > 0) {
            this.compareFiles.push(...validFiles);
            this.updateCompareFilesList();
            this.updateCompareOptions();
            
            let message = `Đã thêm ${validFiles.length} file hợp lệ`;
            if (invalidFiles.length > 0) {
                message += `\n\nCác file không hợp lệ:\n${invalidFiles.join('\n')}`;
            }
            this.showToast(message, 'error', 6000);
        } else {
            let message = 'Không có file hợp lệ nào được thêm.';
            if (invalidFiles.length > 0) {
                message += `\n\nChi tiết:\n${invalidFiles.join('\n')}`;
            } else {
                message += '\nVui lòng kiểm tra file có cột "Phone" không.';
            }
            this.showToast(message, 'error', 6000);
        }
    } catch (error) {
        console.error('Error handling compare files:', error);
        this.showToast('Lỗi khi xử lý files: ' + error.message, 'error');
    }
};

// Read Excel file for comparison
CDRAnalyzer.prototype.readCompareExcelFile = async function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Check if file is valid Excel
CDRAnalyzer.prototype.isValidExcelFile = function(file) {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
};

// Check if data has Phone column (linh hoạt hơn)
CDRAnalyzer.prototype.hasPhoneColumn = function(data) {
    if (!data || data.length === 0) return false;
    const headers = data[0];
    
    // Kiểm tra các pattern phổ biến cho số điện thoại
    const phonePatterns = ['phone', 'sdt', 'số điện thoại', 'số đt', 'tel', 'mobile', 'contact', 'số liên hệ'];
    
    return headers.some(header => {
        if (!header) return false;
        const headerLower = header.toString().toLowerCase().trim();
        return phonePatterns.some(pattern => headerLower.includes(pattern));
    });
};

// Detect columns in data
CDRAnalyzer.prototype.detectColumns = function(data) {
    if (!data || data.length === 0) return [];
    const headers = data[0];
    const columns = [];

    headers.forEach((header, index) => {
        if (header && header.toString().trim()) {
            const columnName = header.toString().trim().toLowerCase();
            columns.push({
                index: index,
                name: header.toString().trim(),
                type: this.detectColumnType(columnName)
            });
        }
    });

    return columns;
};

// Detect column type based on name
CDRAnalyzer.prototype.detectColumnType = function(columnName) {
    if (columnName.includes('phone')) return 'phone';
    if (columnName.includes('imei')) return 'imei';
    if (columnName.includes('contact') || columnName.includes('sdt') || columnName.includes('số')) return 'contact';
    return 'custom';
};

// Normalize phone number to standard format for comparison
CDRAnalyzer.prototype.normalizePhoneNumber = function(phoneNumber) {
    if (!phoneNumber) return '';
    
    // Convert to string and keep all characters (numbers and letters)
    let normalized = phoneNumber.toString().trim();
    
    // Remove only spaces and special characters but keep numbers and letters
    normalized = normalized.replace(/[\s\-\(\)]/g, '');
    
    // Convert to lowercase for case-insensitive comparison
    normalized = normalized.toLowerCase();
    
    // Return the normalized string (numbers and letters)
    return normalized;
};

// Normalize contact number (same logic as phone number)
CDRAnalyzer.prototype.normalizeContactNumber = function(contactNumber) {
    return this.normalizePhoneNumber(contactNumber);
};

// Update compare files list display
CDRAnalyzer.prototype.updateCompareFilesList = function() {
    const filesList = document.getElementById('compareFilesList');
    const fileNameDisplay = document.getElementById('compareFileName');

    if (!filesList) return;

    if (this.compareFiles.length === 0) {
        filesList.style.display = 'none';
        if (fileNameDisplay) fileNameDisplay.textContent = '';
        return;
    }

    filesList.style.display = 'block';
    
    // Hiển thị danh sách file
    if (fileNameDisplay) {
        const fileNames = this.compareFiles.map((file, index) => {
            return `${index + 1}. ${file.name} (${file.data.length - 1} dòng, ${file.columns.length} cột)`;
        }).join('<br>');
        fileNameDisplay.innerHTML = `<strong>Đã import ${this.compareFiles.length} file:</strong><br>${fileNames}`;
    }
};

// Remove compare file
CDRAnalyzer.prototype.removeCompareFile = function(index) {
    if (index !== undefined) {
        this.compareFiles.splice(index, 1);
    } else {
        this.compareFiles = [];
    }
    this.updateCompareFilesList();
    this.updateCompareOptions();
    this.clearCompareResults();
};

// Update compare options visibility
CDRAnalyzer.prototype.updateCompareOptions = function() {
    const compareOptions = document.getElementById('compareOptions');
    const compareActions = document.getElementById('compareActions');
    
    if (!compareOptions) return;

    if (this.compareFiles.length >= 1) {
        compareOptions.style.display = 'block';
        if (compareActions) {
            compareActions.style.display = 'block';
        }
    } else {
        compareOptions.style.display = 'none';
        if (compareActions) {
            compareActions.style.display = 'none';
        }
    }
};

// Update compare file counts
CDRAnalyzer.prototype.updateCompareFileCounts = function() {
    const totalFiles = this.filesData.size;
    const analyzedFiles = Array.from(this.filesData.values()).filter(f => f.analyzed).length;
    
    const filesCountEl = document.getElementById('compareFilesCount');
    const analyzedCountEl = document.getElementById('compareAnalyzedCount');
    
    if (filesCountEl) filesCountEl.textContent = totalFiles;
    if (analyzedCountEl) analyzedCountEl.textContent = analyzedFiles;
};

// Update compare file dropdowns
CDRAnalyzer.prototype.updateCompareFileDropdowns = function() {
    // Legacy function name - now updates checkboxes instead
    this.updateCompareFileCheckboxes();
};

CDRAnalyzer.prototype.updateCompareFileCheckboxes = function() {
    const checkboxList = document.getElementById('compareFilesCheckboxList');
    if (!checkboxList) return;
    
    // Clear existing checkboxes
    checkboxList.innerHTML = '';
    
    // Get analyzed files
    const analyzedFiles = Array.from(this.filesData.entries()).filter(([fileId, fileData]) => fileData.analyzed);
    const analyzedIds = analyzedFiles.map(([fileId]) => fileId);
    const currentSelection = Array.isArray(this.compareFileSelection) ? this.compareFileSelection : [];
    const validSelection = currentSelection.filter(fileId => analyzedIds.includes(fileId));
    this.compareFileSelection = validSelection;
    const selectedSet = new Set(validSelection);
    
    if (analyzedFiles.length === 0) {
        checkboxList.innerHTML = '<p style="color: #64748b; font-style: italic; padding: 10px;">Chưa có file nào được phân tích</p>';
        this.updateCompareSelectedSummary();
        return;
    }
    
    // Add checkboxes for each analyzed file
    analyzedFiles.forEach(([fileId, fileData]) => {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText = 'display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #e2e8f0;';
        
        const ownerLabel = fileData.subscriberInfo?.phoneNumber || fileData.fileName;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = fileId;
        checkbox.id = `compareFile_${fileId}`;
        checkbox.style.cssText = 'margin-right: 10px; width: 18px; height: 18px; cursor: pointer;';
        checkbox.checked = selectedSet.has(fileId);
        
        const label = document.createElement('label');
        label.htmlFor = `compareFile_${fileId}`;
        label.textContent = ownerLabel;
        label.style.cssText = 'cursor: pointer; flex: 1; user-select: none;';
        
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        checkboxList.appendChild(checkboxContainer);
    });

    this.updateCompareSelectedSummary();
};

CDRAnalyzer.prototype.openCompareFilesModal = function() {
    console.log('openCompareFilesModal called');
    const analyzedFiles = Array.from(this.filesData.values()).filter(f => f.analyzed);
    console.log('Analyzed files count:', analyzedFiles.length);
    
    if (analyzedFiles.length < 2) {
        this.showToast('Cần ít nhất 2 file đã phân tích để chọn số chủ so sánh!', 'warning');
        return;
    }
    
    this.updateCompareFileCheckboxes();
    this.showModal('compareFilesModal');
    console.log('Modal displayed');
};

CDRAnalyzer.prototype.closeCompareFilesModal = function() {
    this.hideModal('compareFilesModal');
};

CDRAnalyzer.prototype.applyCompareFilesSelection = function() {
    const checkboxes = document.querySelectorAll('#compareFilesCheckboxList input[type="checkbox"]:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedIds.length < 2) {
        this.showToast('Vui lòng chọn ít nhất 2 số chủ để so sánh!', 'warning');
        return;
    }
    
    this.compareFileSelection = selectedIds;
    this.updateCompareSelectedSummary();
    this.closeCompareFilesModal();
};

CDRAnalyzer.prototype.updateCompareSelectedSummary = function() {
    const summaryEl = document.getElementById('compareSelectedSummary');
    if (!summaryEl) return;
    
    if (!this.compareFileSelection || this.compareFileSelection.length === 0) {
        summaryEl.textContent = 'Chưa chọn số chủ nào';
        return;
    }
    
    const ownerLabels = this.compareFileSelection.map(fileId => {
        const fileData = this.filesData.get(fileId);
        return fileData?.subscriberInfo?.phoneNumber || fileData?.fileName || fileId;
    }).filter(Boolean);
    
    summaryEl.textContent = `Đã chọn ${ownerLabels.length} số chủ: ${ownerLabels.join(', ')}`;
};

CDRAnalyzer.prototype.selectAllCompareFiles = function() {
    const checkboxes = document.querySelectorAll('#compareFilesCheckboxList input[type="checkbox"]');
    const selectedIds = [];
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        selectedIds.push(checkbox.value);
    });
    this.compareFileSelection = selectedIds;
    this.updateCompareSelectedSummary();
};

CDRAnalyzer.prototype.deselectAllCompareFiles = function() {
    const checkboxes = document.querySelectorAll('#compareFilesCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    this.compareFileSelection = [];
    this.updateCompareSelectedSummary();
};

// Show two files comparison section (now supports multiple files)
CDRAnalyzer.prototype.showTwoFilesComparison = function() {
    const section = document.getElementById('compareTwoFilesSection');
    if (!section) return;
    
    const analyzedFiles = Array.from(this.filesData.values()).filter(f => f.analyzed);
    if (analyzedFiles.length < 2) {
        this.showToast('Cần ít nhất 2 file đã phân tích để so sánh!', 'warning');
        return;
    }
    
    this.updateCompareFileCheckboxes();
    section.style.display = 'block';
};

// Analyze shared contacts across all files
CDRAnalyzer.prototype.analyzeSharedContacts = function() {
    const analyzedFiles = Array.from(this.filesData.values()).filter(f => f.analyzed);
    
    if (analyzedFiles.length < 2) {
        this.showToast('Cần ít nhất 2 file đã phân tích để tìm số liên lạc chung!', 'warning');
        return;
    }
    
    try {
        const contactAnalysis = this.performSharedContactsComparison();
        this.displayCompareResults(contactAnalysis, 'shared-contacts');
        this.currentCompareAnalysis = contactAnalysis;
    } catch (error) {
        console.error('Error analyzing shared contacts:', error);
        this.showToast('Lỗi khi phân tích số liên lạc chung: ' + error.message, 'error');
    }
};

// Analyze shared IMEI across all files
CDRAnalyzer.prototype.analyzeSharedIMEI = function() {
    const analyzedFiles = Array.from(this.filesData.values()).filter(f => f.analyzed);
    
    if (analyzedFiles.length < 2) {
        this.showToast('Cần ít nhất 2 file đã phân tích để tìm IMEI chung!', 'warning');
        return;
    }
    
    try {
        const imeiAnalysis = this.performSharedIMEIComparison();
        this.displayCompareResults(imeiAnalysis, 'shared-imei');
        this.currentCompareAnalysis = imeiAnalysis;
    } catch (error) {
        console.error('Error analyzing shared IMEI:', error);
        this.showToast('Lỗi khi phân tích IMEI chung: ' + error.message, 'error');
    }
};

// Analyze shared locations across all files
CDRAnalyzer.prototype.analyzeSharedLocations = function() {
    const analyzedFiles = Array.from(this.filesData.values()).filter(f => f.analyzed);
    
    if (analyzedFiles.length < 2) {
        this.showToast('Cần ít nhất 2 file đã phân tích để tìm vị trí chung!', 'warning');
        return;
    }
    
    try {
        const locationAnalysis = this.performSharedLocationsComparison();
        this.displayCompareResults(locationAnalysis, 'shared-locations');
        this.currentCompareAnalysis = locationAnalysis;
    } catch (error) {
        console.error('Error analyzing shared locations:', error);
        this.showToast('Lỗi khi phân tích vị trí chung: ' + error.message, 'error');
    }
};

// Perform multiple files comparison
CDRAnalyzer.prototype.performTwoFilesComparison = function() {
    const compareType = document.getElementById('compareType')?.value || 'contacts';
    
    let selectedFileIds = Array.isArray(this.compareFileSelection) ? [...this.compareFileSelection] : [];
    
    if (selectedFileIds.length < 2) {
        const checkboxes = document.querySelectorAll('#compareFilesCheckboxList input[type="checkbox"]:checked');
        const fallbackSelection = Array.from(checkboxes).map(cb => cb.value);
        if (fallbackSelection.length >= 2) {
            selectedFileIds = fallbackSelection;
            this.compareFileSelection = fallbackSelection;
            this.updateCompareSelectedSummary();
        }
    }
    
    if (selectedFileIds.length < 2) {
        this.showToast('Vui lòng chọn ít nhất 2 số chủ để so sánh!', 'warning');
        this.openCompareFilesModal();
        return;
    }
    
    // Get file data for selected files
    const selectedFiles = selectedFileIds
        .map(fileId => {
            const fileData = this.filesData.get(fileId);
            if (!fileData || !fileData.analyzed) {
                return null;
            }
            return { fileId, ...fileData };
        })
        .filter(file => file !== null);
    
    if (selectedFiles.length < 2) {
        this.showToast('Các số chủ đã chọn phải thuộc các file đã được phân tích!', 'warning');
        return;
    }
    
    try {
        const comparison = this.performMultipleFilesComparisonAnalysis(selectedFiles, compareType);
        this.displayCompareResults(comparison, 'multiple-files');
        this.currentCompareAnalysis = comparison;
    } catch (error) {
        console.error('Error performing multiple files comparison:', error);
        this.showToast('Lỗi khi so sánh các file: ' + error.message, 'error');
    }
};

// Perform shared contacts comparison across all analyzed files
CDRAnalyzer.prototype.performSharedContactsComparison = function() {
    // Map: last9Digits -> Set of owner phone numbers and their contacts
    const last9ToOwnersMap = new Map();
    const ownerToContactsMap = new Map();
    
    // Iterate through all analyzed files
    Array.from(this.filesData.entries()).forEach(([fileId, fileData]) => {
        if (!fileData.analyzed || !fileData.subscriberInfo || !fileData.subscriberInfo.phoneNumber) {
            return;
        }
        
        const ownerPhone = this.normalizePhoneNumber(fileData.subscriberInfo.phoneNumber);
        if (!ownerPhone) return;
        
        // Get contacts from this file - using last 9 digits for comparison
        if (fileData.contacts && fileData.contacts.size > 0) {
            fileData.contacts.forEach((contactData, contactNumber) => {
                const normalizedContact = this.normalizePhoneNumber(contactNumber);
                if (!normalizedContact || normalizedContact === ownerPhone) return;
                
                // Get last 9 digits for comparison
                const last9 = this.getLast9Digits(contactNumber);
                if (!last9 || last9.length !== 9) return;
                
                // Track which owners have this last9Digits
                if (!last9ToOwnersMap.has(last9)) {
                    last9ToOwnersMap.set(last9, {
                        last9Digits: last9,
                        contacts: new Map(), // Map: ownerPhone -> Set of contact numbers
                        owners: new Set(),
                        fileNames: new Set()
                    });
                }
                
                const last9Data = last9ToOwnersMap.get(last9);
                last9Data.owners.add(ownerPhone);
                last9Data.fileNames.add(fileData.fileName);
                
                if (!last9Data.contacts.has(ownerPhone)) {
                    last9Data.contacts.set(ownerPhone, new Set());
                }
                last9Data.contacts.get(ownerPhone).add(contactNumber);
                
                // Track contacts for each owner
                if (!ownerToContactsMap.has(ownerPhone)) {
                    ownerToContactsMap.set(ownerPhone, {
                        ownerPhone: fileData.subscriberInfo.phoneNumber,
                        fileName: fileData.fileName,
                        contacts: new Set()
                    });
                }
                ownerToContactsMap.get(ownerPhone).contacts.add(last9);
            });
        }
    });
    
    // Find contacts shared by multiple owners (matching last 9 digits)
    const sharedContacts = [];
    last9ToOwnersMap.forEach((data, last9) => {
        if (data.owners.size > 1) {
            // Get all contact numbers for this last9Digits
            const allContacts = [];
            data.contacts.forEach((contactSet, ownerPhone) => {
                contactSet.forEach(contact => {
                    allContacts.push(contact);
                });
            });
            
            // Use the first contact as representative, or combine all
            sharedContacts.push({
                contact: allContacts[0] || last9, // Use first contact as representative
                allContacts: allContacts, // Store all contacts for reference
                last9Digits: last9,
                owners: Array.from(data.owners),
                ownerCount: data.owners.size,
                fileNames: Array.from(data.fileNames)
            });
        }
    });
    
    // Sort by number of owners (most shared first)
    sharedContacts.sort((a, b) => b.ownerCount - a.ownerCount);
    
    return {
        type: 'shared-contacts',
        data: sharedContacts,
        summary: {
            totalSharedContacts: sharedContacts.length,
            totalUniqueContacts: last9ToOwnersMap.size,
            totalOwners: ownerToContactsMap.size
        }
    };
};

// Perform shared IMEI comparison across all analyzed files
CDRAnalyzer.prototype.performSharedIMEIComparison = function() {
    // Map: first14Digits -> Set of owner phone numbers and their IMEIs
    const first14ToOwnersMap = new Map();
    const ownerToIMEIMap = new Map();
    
    // Iterate through all analyzed files
    Array.from(this.filesData.entries()).forEach(([fileId, fileData]) => {
        if (!fileData.analyzed || !fileData.subscriberInfo || !fileData.subscriberInfo.phoneNumber) {
            return;
        }
        
        const ownerPhone = this.normalizePhoneNumber(fileData.subscriberInfo.phoneNumber);
        if (!ownerPhone) return;
        
        // Get IMEI list from this file - using first 14 digits for comparison
        if (fileData.imeiList && fileData.imeiList.size > 0) {
            fileData.imeiList.forEach((imei) => {
                const imeiStr = imei.toString().trim();
                if (!imeiStr) return;
                
                // Get first 14 digits for comparison
                const first14 = this.getFirst14Digits(imei);
                if (!first14 || first14.length !== 14) return;
                
                // Track which owners have this first14Digits
                if (!first14ToOwnersMap.has(first14)) {
                    first14ToOwnersMap.set(first14, {
                        first14Digits: first14,
                        imeis: new Map(), // Map: ownerPhone -> Set of IMEI numbers
                        owners: new Set(),
                        fileNames: new Set()
                    });
                }
                
                const first14Data = first14ToOwnersMap.get(first14);
                first14Data.owners.add(ownerPhone);
                first14Data.fileNames.add(fileData.fileName);
                
                if (!first14Data.imeis.has(ownerPhone)) {
                    first14Data.imeis.set(ownerPhone, new Set());
                }
                first14Data.imeis.get(ownerPhone).add(imeiStr);
                
                // Track IMEIs for each owner
                if (!ownerToIMEIMap.has(ownerPhone)) {
                    ownerToIMEIMap.set(ownerPhone, {
                        ownerPhone: fileData.subscriberInfo.phoneNumber,
                        fileName: fileData.fileName,
                        imeis: new Set()
                    });
                }
                ownerToIMEIMap.get(ownerPhone).imeis.add(first14);
            });
        }
    });
    
    // Find IMEIs shared by multiple owners (matching first 14 digits)
    const sharedIMEIs = [];
    first14ToOwnersMap.forEach((data, first14) => {
        if (data.owners.size > 1) {
            // Get all IMEI numbers for this first14Digits
            const allIMEIs = [];
            data.imeis.forEach((imeiSet, ownerPhone) => {
                imeiSet.forEach(imei => {
                    allIMEIs.push(imei);
                });
            });
            
            // Use the first IMEI as representative, or combine all
            sharedIMEIs.push({
                imei: allIMEIs[0] || first14, // Use first IMEI as representative
                allIMEIs: allIMEIs, // Store all IMEIs for reference
                first14Digits: first14,
                owners: Array.from(data.owners),
                ownerCount: data.owners.size,
                fileNames: Array.from(data.fileNames)
            });
        }
    });
    
    // Sort by number of owners (most shared first)
    sharedIMEIs.sort((a, b) => b.ownerCount - a.ownerCount);
    
    return {
        type: 'shared-imei',
        data: sharedIMEIs,
        summary: {
            totalSharedIMEIs: sharedIMEIs.length,
            totalUniqueIMEIs: first14ToOwnersMap.size,
            totalOwners: ownerToIMEIMap.size
        }
    };
};

// Perform shared locations comparison across all analyzed files
// Logic: Two locations are considered the same if they have the same Cell-Lac AND the same network provider (provinceCode)
// Station name and address are NOT used for comparison - only Cell-Lac and provinceCode matter
CDRAnalyzer.prototype.performSharedLocationsComparison = function() {
    // Map: locationKey (lac-cell-provinceCode) -> Set of owner phone numbers
    // IMPORTANT: Key is based ONLY on lac, cell, and provinceCode - NOT on stationName or location
    const locationToOwnersMap = new Map();
    const ownerToLocationsMap = new Map();
    
    console.log('Starting shared locations comparison...');
    const analyzedFiles = Array.from(this.filesData.entries()).filter(([id, data]) => data.analyzed);
    console.log('Total analyzed files:', analyzedFiles.length);
    
    // Iterate through all analyzed files
    Array.from(this.filesData.entries()).forEach(([fileId, fileData]) => {
        if (!fileData.analyzed || !fileData.subscriberInfo || !fileData.subscriberInfo.phoneNumber) {
            return;
        }
        
        const ownerPhone = this.normalizePhoneNumber(fileData.subscriberInfo.phoneNumber);
        if (!ownerPhone) return;
        
        // Get location stats from this file
        if (fileData.locationStats && fileData.locationStats.size > 0) {
            fileData.locationStats.forEach((locationData, key) => {
                // Extract only the fields used for comparison: lac, cell, provinceCode
                const lac = String(locationData.lac || '').trim();
                const cell = String(locationData.cell || '').trim();
                // Handle provinceCode: use empty string if undefined/null, but still allow comparison
                let provinceCode = locationData.provinceCode;
                if (provinceCode === undefined || provinceCode === null) {
                    provinceCode = '';
                } else {
                    provinceCode = String(provinceCode).trim();
                }
                
                // Only process if we have lac and cell (provinceCode can be empty)
                // Note: stationName and location are NOT used in the comparison key
                if (lac && cell) {
                    // Create location key using Cell-Lac and provinceCode (network provider)
                    // Format: "lac-cell-provinceCode" (provinceCode can be empty string)
                    // This ensures locations with same Cell-Lac and same network are considered the same,
                    // regardless of different station names or addresses
                    const locationKey = `${lac}-${cell}-${provinceCode}`;
                    
                    // Track which owners have this location (same Cell-Lac + same network)
                    if (!locationToOwnersMap.has(locationKey)) {
                        locationToOwnersMap.set(locationKey, {
                            lac: lac,
                            cell: cell,
                            provinceCode: provinceCode,
                            // Store stationName and location for display only, not for comparison
                            stationName: locationData.stationName || '',
                            location: locationData.location || '',
                            owners: new Set(),
                            fileNames: new Set(),
                            templates: new Set() // Store templates for display
                        });
                    }
                    locationToOwnersMap.get(locationKey).owners.add(ownerPhone);
                    locationToOwnersMap.get(locationKey).fileNames.add(fileData.fileName);
                    // Store template
                    if (fileData.template) {
                        locationToOwnersMap.get(locationKey).templates.add(fileData.template);
                    }
                    
                    // Track locations for each owner
                    if (!ownerToLocationsMap.has(ownerPhone)) {
                        ownerToLocationsMap.set(ownerPhone, {
                            ownerPhone: fileData.subscriberInfo.phoneNumber,
                            fileName: fileData.fileName,
                            locations: new Set()
                        });
                    }
                    ownerToLocationsMap.get(ownerPhone).locations.add(locationKey);
                }
            });
        }
    });
    
    console.log('Total unique location keys:', locationToOwnersMap.size);
    console.log('Location keys (first 5):', Array.from(locationToOwnersMap.keys()).slice(0, 5));
    
    // Find locations shared by multiple owners
    const sharedLocations = [];
    locationToOwnersMap.forEach((data, locationKey) => {
        if (data.owners.size > 1) {
            // Get template name for display
            const templateNames = Array.from(data.templates || []);
            let templateDisplay = '';
            if (templateNames.length > 0) {
                const templateMap = {
                    'template1': 'VIETTEL',
                    'template2': 'VINA',
                    'template3': 'MOBI'
                };
                templateDisplay = templateNames.map(t => templateMap[t] || t).join(', ');
            }
            
            sharedLocations.push({
                lac: data.lac,
                cell: data.cell,
                lacCell: `${data.lac}-${data.cell}`, // Changed from cellLac to lacCell (Lac-Cell format)
                provinceCode: data.provinceCode,
                template: templateDisplay, // Add template name for display
                stationName: data.stationName,
                location: data.location,
                owners: Array.from(data.owners),
                ownerCount: data.owners.size,
                fileNames: Array.from(data.fileNames)
            });
        }
    });
    
    console.log('Shared locations found:', sharedLocations.length);
    
    // Sort by number of owners (most shared first)
    sharedLocations.sort((a, b) => b.ownerCount - a.ownerCount);
    
    return {
        type: 'shared-locations',
        data: sharedLocations,
        summary: {
            totalSharedLocations: sharedLocations.length,
            totalUniqueLocations: locationToOwnersMap.size,
            totalOwners: ownerToLocationsMap.size
        }
    };
};

// Helper function to get last 9 digits of phone number
CDRAnalyzer.prototype.getLast9Digits = function(phoneNumber) {
    if (!phoneNumber) return '';
    const normalized = phoneNumber.toString().replace(/\D/g, ''); // Remove non-digits
    return normalized.length >= 9 ? normalized.slice(-9) : normalized;
};

// Helper function to get first 14 digits of IMEI
CDRAnalyzer.prototype.getFirst14Digits = function(imei) {
    if (!imei) return '';
    const normalized = imei.toString().replace(/\D/g, ''); // Remove non-digits
    return normalized.length >= 14 ? normalized.slice(0, 14) : normalized;
};

// Perform two files comparison analysis
CDRAnalyzer.prototype.performTwoFilesComparisonAnalysis = function(userFile, targetFile, compareType) {
    const results = {
        userFileName: userFile.fileName,
        targetFileName: targetFile.fileName,
        userOwnerPhone: userFile.subscriberInfo?.phoneNumber || 'N/A',
        targetOwnerPhone: targetFile.subscriberInfo?.phoneNumber || 'N/A',
        compareType: compareType,
        data: []
    };
    
    if (compareType === 'contacts') {
        // Compare contacts - using last 9 digits
        const userContactsMap = new Map(); // Map: last9Digits -> original contact
        const targetContactsMap = new Map();
        
        if (userFile.contacts) {
            userFile.contacts.forEach((contactData, contactNumber) => {
                const normalized = this.normalizePhoneNumber(contactNumber);
                if (normalized && normalized !== this.normalizePhoneNumber(userFile.subscriberInfo?.phoneNumber)) {
                    const last9 = this.getLast9Digits(contactNumber);
                    if (last9 && last9.length === 9) {
                        if (!userContactsMap.has(last9)) {
                            userContactsMap.set(last9, []);
                        }
                        userContactsMap.get(last9).push(contactNumber);
                    }
                }
            });
        }
        
        if (targetFile.contacts) {
            targetFile.contacts.forEach((contactData, contactNumber) => {
                const normalized = this.normalizePhoneNumber(contactNumber);
                if (normalized && normalized !== this.normalizePhoneNumber(targetFile.subscriberInfo?.phoneNumber)) {
                    const last9 = this.getLast9Digits(contactNumber);
                    if (last9 && last9.length === 9) {
                        if (!targetContactsMap.has(last9)) {
                            targetContactsMap.set(last9, []);
                        }
                        targetContactsMap.get(last9).push(contactNumber);
                    }
                }
            });
        }
        
        // Find common contacts (matching last 9 digits)
        const commonContacts = [];
        userContactsMap.forEach((userContacts, last9) => {
            if (targetContactsMap.has(last9)) {
                // Add all combinations
                userContacts.forEach(userContact => {
                    targetContactsMap.get(last9).forEach(targetContact => {
                        commonContacts.push({
                            userContact: userContact,
                            targetContact: targetContact,
                            last9Digits: last9
                        });
                    });
                });
            }
        });
        
        results.data.push({
            type: 'contacts',
            common: commonContacts,
            userTotal: userContactsMap.size,
            targetTotal: targetContactsMap.size,
            commonCount: commonContacts.length
        });
    }
    
    if (compareType === 'imei') {
        // Compare IMEI - using first 14 digits
        const userIMEIMap = new Map(); // Map: first14Digits -> original IMEI
        const targetIMEIMap = new Map();
        
        if (userFile.imeiList) {
            userFile.imeiList.forEach(imei => {
                if (imei) {
                    const first14 = this.getFirst14Digits(imei);
                    if (first14 && first14.length === 14) {
                        if (!userIMEIMap.has(first14)) {
                            userIMEIMap.set(first14, []);
                        }
                        userIMEIMap.get(first14).push(imei.toString().trim());
                    }
                }
            });
        }
        
        if (targetFile.imeiList) {
            targetFile.imeiList.forEach(imei => {
                if (imei) {
                    const first14 = this.getFirst14Digits(imei);
                    if (first14 && first14.length === 14) {
                        if (!targetIMEIMap.has(first14)) {
                            targetIMEIMap.set(first14, []);
                        }
                        targetIMEIMap.get(first14).push(imei.toString().trim());
                    }
                }
            });
        }
        
        // Find common IMEIs (matching first 14 digits)
        const commonIMEIs = [];
        userIMEIMap.forEach((userIMEIs, first14) => {
            if (targetIMEIMap.has(first14)) {
                // Add all combinations
                userIMEIs.forEach(userIMEI => {
                    targetIMEIMap.get(first14).forEach(targetIMEI => {
                        commonIMEIs.push({
                            userIMEI: userIMEI,
                            targetIMEI: targetIMEI,
                            first14Digits: first14
                        });
                    });
                });
            }
        });
        
        results.data.push({
            type: 'imei',
            common: commonIMEIs,
            userTotal: userIMEIMap.size,
            targetTotal: targetIMEIMap.size,
            commonCount: commonIMEIs.length
        });
    }
    
    if (compareType === 'location') {
        // Compare locations - ONLY Cell-Lac + provinceCode (network provider)
        // Logic: Two locations are considered the same if they have the same Cell-Lac AND the same network provider
        // Station name and address are NOT used for comparison
        const userLocationsMap = new Map(); // Map: "lac-cell-provinceCode" -> location data
        const targetLocationsMap = new Map();
        
        // Get template for each file to determine network provider
        const userTemplate = userFile.template || 'template1';
        const targetTemplate = targetFile.template || 'template1';
        
        // Template to network provider mapping
        const templateToNetwork = {
            'template1': 'VIETTEL',
            'template2': 'VINA',
            'template3': 'MOBI'
        };
        
        console.log('Comparing locations - User file:', userFile.fileName, 'Template:', userTemplate);
        console.log('User locationStats size:', userFile.locationStats ? userFile.locationStats.size : 0);
        console.log('Target file:', targetFile.fileName, 'Template:', targetTemplate);
        console.log('Target locationStats size:', targetFile.locationStats ? targetFile.locationStats.size : 0);
        
        if (userFile.locationStats && userFile.locationStats.size > 0) {
            userFile.locationStats.forEach((locationData, key) => {
                // Extract only the fields used for comparison: lac, cell, provinceCode
                const lac = String(locationData.lac || '').trim();
                const cell = String(locationData.cell || '').trim();
                // Get provinceCode from locationData, if not available use template
                let provinceCode = locationData.provinceCode;
                if (provinceCode === undefined || provinceCode === null || provinceCode === '') {
                    // If provinceCode is not available, use template to determine network
                    provinceCode = templateToNetwork[userTemplate] || '';
                } else {
                    provinceCode = String(provinceCode).trim();
                }
                
                // Only process if we have lac and cell (provinceCode can be empty)
                // Note: stationName and location are NOT used in the comparison key
                if (lac && cell) {
                    // Create location key using Cell-Lac and provinceCode (network provider)
                    // Format: "lac-cell-provinceCode" (provinceCode can be empty string)
                    const locationKey = `${lac}-${cell}-${provinceCode}`;
                    
                    if (!userLocationsMap.has(locationKey)) {
                        userLocationsMap.set(locationKey, []);
                    }
                    userLocationsMap.get(locationKey).push({
                        lac: lac,
                        cell: cell,
                        provinceCode: provinceCode,
                        template: userTemplate, // Store template for display
                        // Store stationName and location for display only, not for comparison
                        stationName: locationData.stationName || '',
                        location: locationData.location || '',
                        count: locationData.count || 0
                    });
                } else {
                    console.warn('User file - Skipping location with missing lac or cell:', { lac, cell, provinceCode, key });
                }
            });
        }
        
        if (targetFile.locationStats && targetFile.locationStats.size > 0) {
            targetFile.locationStats.forEach((locationData, key) => {
                // Extract only the fields used for comparison: lac, cell, provinceCode
                const lac = String(locationData.lac || '').trim();
                const cell = String(locationData.cell || '').trim();
                // Get provinceCode from locationData, if not available use template
                let provinceCode = locationData.provinceCode;
                if (provinceCode === undefined || provinceCode === null || provinceCode === '') {
                    // If provinceCode is not available, use template to determine network
                    provinceCode = templateToNetwork[targetTemplate] || '';
                } else {
                    provinceCode = String(provinceCode).trim();
                }
                
                // Only process if we have lac and cell (provinceCode can be empty)
                // Note: stationName and location are NOT used in the comparison key
                if (lac && cell) {
                    // Create location key using Cell-Lac and provinceCode (network provider)
                    // Format: "lac-cell-provinceCode" (provinceCode can be empty string)
                    const locationKey = `${lac}-${cell}-${provinceCode}`;
                    
                    if (!targetLocationsMap.has(locationKey)) {
                        targetLocationsMap.set(locationKey, []);
                    }
                    targetLocationsMap.get(locationKey).push({
                        lac: lac,
                        cell: cell,
                        provinceCode: provinceCode,
                        template: targetTemplate, // Store template for display
                        // Store stationName and location for display only, not for comparison
                        stationName: locationData.stationName || '',
                        location: locationData.location || '',
                        count: locationData.count || 0
                    });
                } else {
                    console.warn('Target file - Skipping location with missing lac or cell:', { lac, cell, provinceCode, key });
                }
            });
        }
        
        console.log('User locations map size:', userLocationsMap.size);
        console.log('Target locations map size:', targetLocationsMap.size);
        console.log('User location keys (first 5):', Array.from(userLocationsMap.keys()).slice(0, 5));
        console.log('Target location keys (first 5):', Array.from(targetLocationsMap.keys()).slice(0, 5));
        
        // Find common locations (matching lac-cell-provinceCode)
        // Locations with same Cell-Lac and same network provider are considered the same,
        // regardless of different station names or addresses
        const commonLocations = [];
        userLocationsMap.forEach((userLocations, locationKey) => {
            if (targetLocationsMap.has(locationKey)) {
                // Add all combinations - locations match if they have same Cell-Lac and same network
                userLocations.forEach(userLocation => {
                    targetLocationsMap.get(locationKey).forEach(targetLocation => {
                        // Get network provider from template if provinceCode is empty
                        let networkProvider = userLocation.provinceCode || '';
                        if (!networkProvider && userLocation.template) {
                            networkProvider = templateToNetwork[userLocation.template] || '';
                        }
                        // Fallback to target template if still empty
                        if (!networkProvider && targetLocation.template) {
                            networkProvider = templateToNetwork[targetLocation.template] || '';
                        }
                        
                        commonLocations.push({
                            userLocation: userLocation,
                            targetLocation: targetLocation,
                            lac: userLocation.lac,
                            cell: userLocation.cell,
                            provinceCode: networkProvider || userLocation.provinceCode || '',
                            template: userLocation.template || targetLocation.template || ''
                        });
                    });
                });
            }
        });
        
        console.log('Common locations found:', commonLocations.length);
        
        results.data.push({
            type: 'location',
            common: commonLocations,
            userTotal: userLocationsMap.size,
            targetTotal: targetLocationsMap.size,
            commonCount: commonLocations.length
        });
    }
    
    return {
        type: 'two-files',
        data: results,
        summary: {
            userFileName: userFile.fileName,
            targetFileName: targetFile.fileName
        }
    };
};

// Perform multiple files comparison analysis
CDRAnalyzer.prototype.performMultipleFilesComparisonAnalysis = function(selectedFiles, compareType) {
    const getOwnerKey = (file, index) => {
        const normalized = this.normalizePhoneNumber(file.subscriberInfo?.phoneNumber || '');
        if (normalized) return normalized;
        if (file.fileId) return file.fileId.toString();
        if (file.fileName) return `file-${file.fileName}`;
        return `owner-${index}`;
    };
    
    const getOwnerLabel = (file, index) => file.subscriberInfo?.phoneNumber || file.fileName || `Số chủ ${index + 1}`;
    
    const fileNames = selectedFiles.map(f => f.fileName);
    const ownerLabelMap = new Map();
    selectedFiles.forEach((file, index) => {
        const ownerKey = getOwnerKey(file, index);
        const ownerLabel = getOwnerLabel(file, index);
        if (!ownerLabelMap.has(ownerKey)) {
            ownerLabelMap.set(ownerKey, ownerLabel);
        }
    });
    const ownerLabels = Array.from(ownerLabelMap.values());
    
    const results = {
        fileNames,
        fileCount: selectedFiles.length,
        compareType,
        ownerLabels,
        ownerCount: ownerLabels.length,
        data: []
    };
    
    if (compareType === 'contacts') {
        const contactsMap = new Map(); // Map last9Digits -> Map ownerKey -> {owner, contacts}
        
        selectedFiles.forEach((file, fileIndex) => {
            if (!file.contacts) return;
            const ownerKey = getOwnerKey(file, fileIndex);
            const ownerLabel = getOwnerLabel(file, fileIndex);
            
            file.contacts.forEach((contactData, contactNumber) => {
                const normalized = this.normalizePhoneNumber(contactNumber);
                const ownerPhone = this.normalizePhoneNumber(file.subscriberInfo?.phoneNumber || '');
                if (!normalized || normalized === ownerPhone) return;
                
                const last9 = this.getLast9Digits(contactNumber);
                if (!last9 || last9.length !== 9) return;
                
                if (!contactsMap.has(last9)) {
                    contactsMap.set(last9, new Map());
                }
                const ownerMap = contactsMap.get(last9);
                if (!ownerMap.has(ownerKey)) {
                    ownerMap.set(ownerKey, { owner: ownerLabel, contacts: new Set() });
                }
                ownerMap.get(ownerKey).contacts.add(contactNumber);
            });
        });
        
        const commonContacts = [];
        contactsMap.forEach((ownerMap, last9) => {
            if (ownerMap.size < 2) return;
            const ownerEntries = Array.from(ownerMap.values());
            const representativeContact = ownerEntries[0].contacts.values().next().value || last9;
            commonContacts.push({
                contact: representativeContact,
                last9Digits: last9,
                owners: ownerEntries.map(entry => entry.owner),
                ownerCount: ownerEntries.length
            });
        });
        
        results.data.push({
            type: 'contacts',
            common: commonContacts,
            totalOwners: ownerLabels.length,
            commonCount: commonContacts.length
        });
    }
    
    if (compareType === 'imei') {
        const imeiMap = new Map(); // Map first14Digits -> Map ownerKey -> {owner, imeis}
        
        selectedFiles.forEach((file, fileIndex) => {
            if (!file.imeiList) return;
            const ownerKey = getOwnerKey(file, fileIndex);
            const ownerLabel = getOwnerLabel(file, fileIndex);
            
            file.imeiList.forEach(imei => {
                if (!imei) return;
                const first14 = this.getFirst14Digits(imei);
                if (!first14 || first14.length !== 14) return;
                
                if (!imeiMap.has(first14)) {
                    imeiMap.set(first14, new Map());
                }
                const ownerMap = imeiMap.get(first14);
                if (!ownerMap.has(ownerKey)) {
                    ownerMap.set(ownerKey, { owner: ownerLabel, imeis: new Set() });
                }
                ownerMap.get(ownerKey).imeis.add(imei.toString().trim());
            });
        });
        
        const commonIMEIs = [];
        imeiMap.forEach((ownerMap, first14) => {
            if (ownerMap.size < 2) return;
            const ownerEntries = Array.from(ownerMap.values());
            const representativeIMEI = ownerEntries[0].imeis.values().next().value || first14;
            commonIMEIs.push({
                imei: representativeIMEI,
                first14Digits: first14,
                owners: ownerEntries.map(entry => entry.owner),
                ownerCount: ownerEntries.length
            });
        });
        
        results.data.push({
            type: 'imei',
            common: commonIMEIs,
            totalOwners: ownerLabels.length,
            commonCount: commonIMEIs.length
        });
    }
    
    if (compareType === 'location') {
        const locationMap = new Map(); // Map key -> data with owners
        
        selectedFiles.forEach((file, fileIndex) => {
            if (!file.locationStats) return;
            const ownerKey = getOwnerKey(file, fileIndex);
            const ownerLabel = getOwnerLabel(file, fileIndex);
            
            file.locationStats.forEach((locationData, key) => {
                const lac = String(locationData.lac || '').trim();
                const cell = String(locationData.cell || '').trim();
                let provinceCode = locationData.provinceCode;
                if (provinceCode === undefined || provinceCode === null) {
                    provinceCode = '';
                } else {
                    provinceCode = String(provinceCode).trim();
                }
                
                if (!lac || !cell) return;
                
                const locationKey = `${lac}-${cell}-${provinceCode}`;
                if (!locationMap.has(locationKey)) {
                    locationMap.set(locationKey, {
                        lac,
                        cell,
                        lacCell: `${lac}-${cell}`,
                        provinceCode,
                        stationName: locationData.stationName || '',
                        location: locationData.location || '',
                        owners: new Map()
                    });
                }
                const locationEntry = locationMap.get(locationKey);
                if (!locationEntry.owners.has(ownerKey)) {
                    locationEntry.owners.set(ownerKey, ownerLabel);
                }
            });
        });
        
        const commonLocations = [];
        locationMap.forEach(locationEntry => {
            if (locationEntry.owners.size < 2) return;
            commonLocations.push({
                lac: locationEntry.lac,
                cell: locationEntry.cell,
                lacCell: locationEntry.lacCell,
                provinceCode: locationEntry.provinceCode,
                stationName: locationEntry.stationName,
                location: locationEntry.location,
                owners: Array.from(locationEntry.owners.values()),
                ownerCount: locationEntry.owners.size
            });
        });
        
        results.data.push({
            type: 'location',
            common: commonLocations,
            totalOwners: ownerLabels.length,
            commonCount: commonLocations.length
        });
    }
    
    return {
        type: 'multiple-files',
        data: results,
        summary: {
            fileNames,
            fileCount: selectedFiles.length,
            ownerLabels
        }
    };
};

// Perform custom comparison
CDRAnalyzer.prototype.performCustomComparison = function() {
    const results = [];
    
    // Analyze each file and each column to the right of Phone
    this.compareFiles.forEach((file, fileIndex) => {
        // Tìm cột Phone
        const phoneColumn = file.columns.find(col => 
            col.type === 'phone' || col.name.toLowerCase().includes('phone')
        );
        
        if (!phoneColumn) {
            console.log(`File ${file.name}: Không tìm thấy cột Phone`);
            return;
        }
        
        // Find all columns to the right of Phone column
        const phoneIndex = phoneColumn.index;
        const compareColumns = file.columns.filter(col => col.index > phoneIndex);
        
        if (compareColumns.length === 0) return;
        
        // Analyze each column to the right of Phone
        compareColumns.forEach(column => {
            const phoneValueMap = new Map();
            
            // Group phones by their values in this column
            for (let i = 1; i < file.data.length; i++) {
                const row = file.data[i];
                const phone = row[phoneIndex];
                const value = row[column.index];
                
                if (phone && value) {
                    const phoneStr = phone.toString().trim();
                    const valueStr = value.toString().trim();
                    
                    // Normalize phone number for comparison
                    const normalizedPhone = this.normalizePhoneNumber(phoneStr);
                    
                    // Skip if normalization failed (invalid number)
                    if (!normalizedPhone) continue;
                    
                    if (!phoneValueMap.has(valueStr)) {
                        phoneValueMap.set(valueStr, new Set());
                    }
                    phoneValueMap.get(valueStr).add(normalizedPhone);
                }
            }
            
            // Find values that appear with multiple phones
            const sharedValues = [];
            phoneValueMap.forEach((phones, value) => {
                if (phones.size > 1) {
                    sharedValues.push({
                        value: value,
                        phones: Array.from(phones),
                        phoneCount: phones.size
                    });
                }
            });
            
            // Sort by number of phones (most shared first)
            sharedValues.sort((a, b) => b.phoneCount - a.phoneCount);
            
            // Add to results with file context
            const columnKey = `${file.name}: ${column.name}`;
            results.push({
                columnName: columnKey,
                columnType: column.type,
                sharedValues: sharedValues,
                totalUniqueValues: phoneValueMap.size,
                totalSharedValues: sharedValues.length
            });
        });
    });

    if (results.length === 0) {
        throw new Error('Không có dữ liệu để so sánh');
    }

    return {
        type: 'custom',
        data: results,
        summary: {
            totalColumnsAnalyzed: results.length,
            totalSharedValues: results.reduce((sum, col) => sum + col.totalSharedValues, 0)
        }
    };
};

// Display compare results
CDRAnalyzer.prototype.displayCompareResults = function(analysis, analysisType) {
    const compareResults = document.getElementById('compareResults');
    const resultsPlaceholder = document.getElementById('resultsPlaceholder');
    const resultsTitle = document.getElementById('compareResultsTitle');

    if (!compareResults || !analysis) {
        console.error('Compare results container not found or analysis data is null');
        return;
    }

    // Hide placeholder and show results
    if (resultsPlaceholder) {
        resultsPlaceholder.style.display = 'none';
    }
    compareResults.style.display = 'block';

    // Store current analysis
    this.currentCompareAnalysis = analysis;

    // Update title based on analysis type
    if (resultsTitle) {
        if (analysis.type === 'shared-contacts') {
            resultsTitle.textContent = '📊 Số liên lạc chung giữa tất cả số chủ';
        } else if (analysis.type === 'shared-imei') {
            resultsTitle.textContent = '📊 IMEI chung giữa tất cả số chủ';
        } else if (analysis.type === 'shared-locations') {
            resultsTitle.textContent = '📊 Vị trí chung giữa tất cả số chủ';
        } else if (analysis.type === 'two-files') {
            resultsTitle.textContent = `📊 So sánh: ${analysis.data.userFileName} vs ${analysis.data.targetFileName}`;
        } else if (analysis.type === 'multiple-files') {
            const ownerCount = analysis.data.ownerLabels?.length || 0;
            const compareTypeText = analysis.data.compareType === 'contacts' ? 'Số liên lạc' : 
                                   analysis.data.compareType === 'imei' ? 'IMEI' : 'Vị trí';
            resultsTitle.textContent = `📊 So sánh ${compareTypeText} giữa ${ownerCount} số chủ`;
        } else {
            resultsTitle.textContent = '📊 Kết quả so sánh';
        }
    }

    // Initialize pagination - handle different data structures
    if (analysis.type === 'two-files') {
        // For two-files, flatten the data structure - ONLY COMMON RESULTS
        const comparisonData = analysis.data;
        let flatData = [];
        
        if (comparisonData && comparisonData.data) {
            comparisonData.data.forEach(compItem => {
                if (compItem.type === 'contacts') {
                    // Only add common contacts
                    compItem.common.forEach(contactItem => {
                        flatData.push({
                            type: 'contacts',
                            category: 'Chung',
                            userValue: contactItem.userContact,
                            targetValue: contactItem.targetContact,
                            matchKey: contactItem.last9Digits,
                            userTotal: compItem.userTotal,
                            targetTotal: compItem.targetTotal
                        });
                    });
                } else if (compItem.type === 'imei') {
                    // Only add common IMEIs
                    compItem.common.forEach(imeiItem => {
                        flatData.push({
                            type: 'imei',
                            category: 'Chung',
                            userValue: imeiItem.userIMEI,
                            targetValue: imeiItem.targetIMEI,
                            matchKey: imeiItem.first14Digits,
                            userTotal: compItem.userTotal,
                            targetTotal: compItem.targetTotal
                        });
                    });
                } else if (compItem.type === 'location') {
                    // Only add common locations
                    compItem.common.forEach(locationItem => {
                        flatData.push({
                            type: 'location',
                            category: 'Chung',
                            userLocation: locationItem.userLocation,
                            targetLocation: locationItem.targetLocation,
                            lac: locationItem.lac,
                            cell: locationItem.cell,
                            provinceCode: locationItem.provinceCode,
                            userTotal: compItem.userTotal,
                            targetTotal: compItem.targetTotal
                        });
                    });
                }
            });
        }
        this.filteredCompareResults = flatData;
    } else if (analysis.type === 'multiple-files') {
        // For multiple-files, flatten the data structure
        const comparisonData = analysis.data;
        let flatData = [];
        
        if (comparisonData && comparisonData.data) {
            comparisonData.data.forEach(compItem => {
                if (compItem.type === 'contacts') {
                    compItem.common.forEach(contactItem => {
                        flatData.push({
                            type: 'contacts',
                            contact: contactItem.contact || contactItem.last9Digits,
                            owners: contactItem.owners || [],
                            ownerCount: contactItem.ownerCount || 0,
                            last9Digits: contactItem.last9Digits || ''
                        });
                    });
                } else if (compItem.type === 'imei') {
                    compItem.common.forEach(imeiItem => {
                        flatData.push({
                            type: 'imei',
                            imei: imeiItem.imei || imeiItem.first14Digits,
                            owners: imeiItem.owners || [],
                            ownerCount: imeiItem.ownerCount || 0,
                            first14Digits: imeiItem.first14Digits || ''
                        });
                    });
                } else if (compItem.type === 'location') {
                    compItem.common.forEach(locationItem => {
                        flatData.push({
                            type: 'location',
                            lac: locationItem.lac,
                            cell: locationItem.cell,
                            lacCell: locationItem.lacCell || `${locationItem.lac}-${locationItem.cell}`,
                            provinceCode: locationItem.provinceCode,
                            stationName: locationItem.stationName,
                            location: locationItem.location,
                            owners: locationItem.owners || [],
                            ownerCount: locationItem.ownerCount || 0
                        });
                    });
                }
            });
        }
        this.filteredCompareResults = flatData;
    } else {
        // Ensure it's an array
        this.filteredCompareResults = Array.isArray(analysis.data) ? analysis.data : [];
    }
    this.compareCurrentPage = 1;
    this.updateComparePagination();
    this.renderComparePage();
};

// Update compare pagination
CDRAnalyzer.prototype.updateComparePagination = function() {
    // Ensure filteredCompareResults is an array
    if (!Array.isArray(this.filteredCompareResults)) {
        this.filteredCompareResults = [];
    }
    
    const totalItems = this.filteredCompareResults.length;
    this.compareTotalPages = Math.ceil(totalItems / this.comparePageSize);
    
    // Ensure current page is valid
    if (this.compareCurrentPage > this.compareTotalPages) {
        this.compareCurrentPage = Math.max(1, this.compareTotalPages);
    }
    
    // Update pagination controls
    const firstBtn = document.getElementById('firstComparePageBtn');
    const prevBtn = document.getElementById('prevComparePageBtn');
    const nextBtn = document.getElementById('nextComparePageBtn');
    const lastBtn = document.getElementById('lastComparePageBtn');
    const pageInput = document.getElementById('comparePageInput');
    const totalPagesDisplay = document.getElementById('compareTotalPagesDisplay');
    const pagination = document.getElementById('comparePagination');
    const resultsCount = document.getElementById('compareResultsCount');
    
    if (firstBtn) firstBtn.disabled = this.compareCurrentPage <= 1;
    if (prevBtn) prevBtn.disabled = this.compareCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.compareCurrentPage >= this.compareTotalPages;
    if (lastBtn) lastBtn.disabled = this.compareCurrentPage >= this.compareTotalPages;
    
    if (pageInput) {
        pageInput.value = this.compareCurrentPage;
        pageInput.max = this.compareTotalPages;
    }
    if (totalPagesDisplay) {
        totalPagesDisplay.textContent = this.compareTotalPages;
    }
    let totalAvailable = 0;
    if (this.currentCompareAnalysis?.type === 'multiple-files') {
        totalAvailable = this.filteredCompareResults.length;
    } else if (Array.isArray(this.currentCompareAnalysis?.data)) {
        totalAvailable = this.currentCompareAnalysis.data.length;
    } else if (Array.isArray(this.currentCompareAnalysis?.data?.data)) {
        totalAvailable = this.currentCompareAnalysis.data.data.length;
    }
    if (resultsCount) resultsCount.textContent = `📊 Kết quả: ${totalItems}/${totalAvailable}`;
    
    // Show/hide pagination
    if (pagination) {
        pagination.style.display = this.compareTotalPages > 1 ? 'flex' : 'none';
    }
};

CDRAnalyzer.prototype.compareFirstPage = function() {
    this.compareCurrentPage = 1;
    this.updateComparePagination();
    this.renderComparePage();
};

CDRAnalyzer.prototype.comparePreviousPage = function() {
    if (this.compareCurrentPage > 1) {
        this.compareCurrentPage--;
        this.updateComparePagination();
        this.renderComparePage();
    }
};

CDRAnalyzer.prototype.compareNextPage = function() {
    // Ensure totalPages is up to date
    if (!Array.isArray(this.filteredCompareResults)) {
        this.filteredCompareResults = [];
    }
    const totalItems = this.filteredCompareResults.length;
    const totalPages = Math.ceil(totalItems / this.comparePageSize);
    
    if (this.compareCurrentPage < totalPages) {
        this.compareCurrentPage++;
        this.updateComparePagination();
        this.renderComparePage();
    }
};

CDRAnalyzer.prototype.compareLastPage = function() {
    // Ensure totalPages is up to date
    if (!Array.isArray(this.filteredCompareResults)) {
        this.filteredCompareResults = [];
    }
    const totalItems = this.filteredCompareResults.length;
    const totalPages = Math.ceil(totalItems / this.comparePageSize);
    
    this.compareCurrentPage = totalPages;
    this.updateComparePagination();
    this.renderComparePage();
};

CDRAnalyzer.prototype.compareGoToPage = function(page) {
    // Ensure totalPages is up to date
    if (!Array.isArray(this.filteredCompareResults)) {
        this.filteredCompareResults = [];
    }
    const totalItems = this.filteredCompareResults.length;
    const totalPages = Math.ceil(totalItems / this.comparePageSize);
    
    if (page >= 1 && page <= totalPages) {
        this.compareCurrentPage = page;
        this.updateComparePagination();
        this.renderComparePage();
    } else {
        const pageInput = document.getElementById('comparePageInput');
        if (pageInput) {
            pageInput.value = this.compareCurrentPage;
        }
    }
};

// Render compare page
CDRAnalyzer.prototype.renderComparePage = function() {
    const tableHead = document.getElementById('compareTableHead');
    const tableBody = document.getElementById('compareTableBody');
    
    if (!tableHead || !tableBody) return;
    
    // Clear previous results
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    
    if (!this.currentCompareAnalysis) return;
    
    // Ensure filteredCompareResults is an array
    if (!Array.isArray(this.filteredCompareResults)) {
        console.error('filteredCompareResults is not an array');
        this.filteredCompareResults = [];
    }
    
    const startIndex = (this.compareCurrentPage - 1) * this.comparePageSize;
    const endIndex = Math.min(startIndex + this.comparePageSize, this.filteredCompareResults.length);
    const currentPageData = this.filteredCompareResults.slice(startIndex, endIndex);
    
    const analysis = this.currentCompareAnalysis;
    
    if (analysis.type === 'shared-contacts') {
        // Set up headers for shared contacts comparison
        tableHead.innerHTML = `
            <tr>
                <th>TT</th>
                <th>Số liên hệ</th>
                <th>Số lượng số chủ</th>
                <th>Các số chủ</th>
            </tr>
        `;

        // Add data rows
        currentPageData.forEach((item, index) => {
            const row = document.createElement('tr');
            const ownerList = item.owners.join(', ');
            
            row.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td><strong>${item.contact}</strong></td>
                <td>${item.ownerCount}</td>
                <td>${ownerList}</td>
            `;
            tableBody.appendChild(row);
        });

    } else if (analysis.type === 'shared-imei') {
        // Set up headers for shared IMEI comparison
        tableHead.innerHTML = `
            <tr>
                <th>TT</th>
                <th>IMEI</th>
                <th>Số lượng số chủ</th>
                <th>Các số chủ</th>
            </tr>
        `;

        // Add data rows
        currentPageData.forEach((item, index) => {
            const row = document.createElement('tr');
            const ownerList = item.owners.join(', ');
            
            row.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td><strong>${item.imei}</strong></td>
                <td>${item.ownerCount}</td>
                <td>${ownerList}</td>
            `;
            tableBody.appendChild(row);
        });

    } else if (analysis.type === 'shared-locations') {
        // Set up headers for shared locations comparison
        tableHead.innerHTML = `
            <tr>
                <th>TT</th>
                <th>Lac-Cell</th>
                <th>Nhà mạng</th>
                <th>Tên trạm</th>
                <th>Số lượng số chủ</th>
                <th>Các số chủ</th>
            </tr>
        `;

        // Add data rows
        currentPageData.forEach((item, index) => {
            const row = document.createElement('tr');
            const ownerList = item.owners.join(', ');
            // Get network provider from owners (phone numbers) instead of template
            const networkProvider = this.getNetworkProviderFromOwners(item.owners);
            
            row.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td><strong>${item.lacCell || `${item.lac}-${item.cell}`}</strong></td>
                <td>${networkProvider}</td>
                <td>${item.stationName || item.location || 'N/A'}</td>
                <td>${item.ownerCount}</td>
                <td>${ownerList}</td>
            `;
            tableBody.appendChild(row);
        });

    } else if (analysis.type === 'two-files') {
        // For two-files, use already flattened data from filteredCompareResults
        // Ensure filteredCompareResults is an array
        if (!Array.isArray(this.filteredCompareResults)) {
            console.error('filteredCompareResults is not an array for two-files');
            this.filteredCompareResults = [];
        }
        
        const comparisonData = analysis.data;
        const flatStartIndex = (this.compareCurrentPage - 1) * this.comparePageSize;
        const flatEndIndex = Math.min(flatStartIndex + this.comparePageSize, this.filteredCompareResults.length);
        const flatPageData = this.filteredCompareResults.slice(flatStartIndex, flatEndIndex);
        
        // Determine headers based on data types
        const hasContacts = flatPageData.some(item => item.type === 'contacts');
        const hasIMEI = flatPageData.some(item => item.type === 'imei');
        const hasLocation = flatPageData.some(item => item.type === 'location');
        
        let headerHTML = '<tr><th>TT</th><th>Loại</th>';
        if (hasContacts || hasIMEI) {
            headerHTML += `<th>User (${comparisonData.userFileName})</th><th>Target (${comparisonData.targetFileName})</th>`;
        }
        if (hasLocation) {
            headerHTML += `<th>Cell-Lac</th><th>Nhà mạng</th><th>User - Tên trạm</th><th>Target - Tên trạm</th>`;
        }
        headerHTML += '</tr>';
        tableHead.innerHTML = headerHTML;
        
        flatPageData.forEach((item, index) => {
            const row = document.createElement('tr');
            let rowHTML = `<td>${flatStartIndex + index + 1}</td>`;
            
            if (item.type === 'contacts') {
                rowHTML += `<td>📞 Số liên lạc</td>`;
                rowHTML += `<td><strong>${item.userValue}</strong></td>`;
                rowHTML += `<td><strong>${item.targetValue}</strong></td>`;
            } else if (item.type === 'imei') {
                rowHTML += `<td>📱 IMEI</td>`;
                rowHTML += `<td><strong>${item.userValue}</strong></td>`;
                rowHTML += `<td><strong>${item.targetValue}</strong></td>`;
            } else if (item.type === 'location') {
                rowHTML += `<td>📍 Vị trí</td>`;
                rowHTML += `<td><strong>${item.lac}-${item.cell}</strong></td>`; // Changed to Lac-Cell format
                // Display network provider - use provinceCode if available, otherwise use template
                let networkDisplay = item.provinceCode || '';
                if (!networkDisplay && item.template) {
                    const templateToNetwork = {
                        'template1': 'VIETTEL',
                        'template2': 'VINA',
                        'template3': 'MOBI'
                    };
                    networkDisplay = templateToNetwork[item.template] || '';
                }
                rowHTML += `<td>${networkDisplay || 'N/A'}</td>`;
                rowHTML += `<td>${item.userLocation.stationName || item.userLocation.location || 'N/A'}</td>`;
                rowHTML += `<td>${item.targetLocation.stationName || item.targetLocation.location || 'N/A'}</td>`;
            }
            
            row.innerHTML = rowHTML;
            tableBody.appendChild(row);
        });

    } else if (analysis.type === 'multiple-files') {
        // For multiple-files, render based on compare type
        const comparisonData = analysis.data;
        const flatStartIndex = (this.compareCurrentPage - 1) * this.comparePageSize;
        const flatEndIndex = Math.min(flatStartIndex + this.comparePageSize, this.filteredCompareResults.length);
        const flatPageData = this.filteredCompareResults.slice(flatStartIndex, flatEndIndex);
        
        if (comparisonData.compareType === 'contacts') {
            tableHead.innerHTML = `
                <tr>
                    <th>TT</th>
                    <th>Số liên hệ</th>
                    <th>Số lượng số chủ</th>
                    <th>Các số chủ</th>
                </tr>
            `;
            
            flatPageData.forEach((item, index) => {
                const row = document.createElement('tr');
                const ownerList = (item.owners || []).join(', ') || 'N/A';
                row.innerHTML = `
                    <td>${flatStartIndex + index + 1}</td>
                    <td><strong>${item.contact}</strong></td>
                    <td>${item.ownerCount || 0}</td>
                    <td>${ownerList}</td>
                `;
                tableBody.appendChild(row);
            });
        } else if (comparisonData.compareType === 'imei') {
            tableHead.innerHTML = `
                <tr>
                    <th>TT</th>
                    <th>IMEI</th>
                    <th>Số lượng số chủ</th>
                    <th>Các số chủ</th>
                </tr>
            `;
            
            flatPageData.forEach((item, index) => {
                const row = document.createElement('tr');
                const ownerList = (item.owners || []).join(', ') || 'N/A';
                row.innerHTML = `
                    <td>${flatStartIndex + index + 1}</td>
                    <td><strong>${item.imei}</strong></td>
                    <td>${item.ownerCount || 0}</td>
                    <td>${ownerList}</td>
                `;
                tableBody.appendChild(row);
            });
        } else if (comparisonData.compareType === 'location') {
            tableHead.innerHTML = `
                <tr>
                    <th>TT</th>
                    <th>Lac-Cell</th>
                    <th>Nhà mạng</th>
                    <th>Tên trạm</th>
                    <th>Số lượng số chủ</th>
                    <th>Các số chủ</th>
                </tr>
            `;
            
            flatPageData.forEach((item, index) => {
                const row = document.createElement('tr');
                const ownerList = (item.owners || []).join(', ') || 'N/A';
                // Get network provider from owners (phone numbers) instead of provinceCode
                const networkProvider = this.getNetworkProviderFromOwners(item.owners || []);
                
                row.innerHTML = `
                    <td>${flatStartIndex + index + 1}</td>
                    <td><strong>${item.lacCell || `${item.lac}-${item.cell}`}</strong></td>
                    <td>${networkProvider}</td>
                    <td>${item.stationName || item.location || 'N/A'}</td>
                    <td>${item.ownerCount || 0}</td>
                    <td>${ownerList}</td>
                `;
                tableBody.appendChild(row);
            });
        }

    } else if (analysis.type === 'contacts') {
        // Legacy support for old contacts type
        tableHead.innerHTML = `
            <tr>
                <th>TT</th>
                <th>Số liên hệ</th>
                <th>Số lượng số chủ</th>
                <th>Các số chủ liên hệ</th>
            </tr>
        `;

        currentPageData.forEach((item, index) => {
            const row = document.createElement('tr');
            const phoneList = item.phones.map(phone => phone).join(', ');
            
            row.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td><strong>${item.contact}</strong></td>
                <td>${item.phoneCount}</td>
                <td>${phoneList}</td>
            `;
            tableBody.appendChild(row);
        });

    } else if (analysis.type === 'imei') {
        // Legacy support for old imei type
        tableHead.innerHTML = `
            <tr>
                <th>TT</th>
                <th>IMEI</th>
                <th>Số lượng số chủ</th>
                <th>Các số chủ sử dụng</th>
            </tr>
        `;

        currentPageData.forEach((item, index) => {
            const row = document.createElement('tr');
            const phoneList = item.phones.map(phone => phone).join(', ');
            
            row.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td><strong>${item.imei}</strong></td>
                <td>${item.phoneCount}</td>
                <td>${phoneList}</td>
            `;
            tableBody.appendChild(row);
        });

    } else if (analysis.type === 'custom') {
        // For custom comparison, we need to flatten all shared values
        const allSharedValues = [];
        analysis.data.forEach(column => {
            column.sharedValues.forEach(item => {
                allSharedValues.push({
                    columnName: column.columnName,
                    value: item.value,
                    phones: item.phones
                });
            });
        });
        
        // Get current page data from flattened list
        const customPageData = allSharedValues.slice(startIndex, endIndex);
        
        // Collect all unique phones for headers
        const allPhones = new Set();
        analysis.data.forEach(column => {
            column.sharedValues.forEach(item => {
                item.phones.forEach(phone => allPhones.add(phone));
            });
        });
        
        // Set up headers
        const headers = ['TT', 'Giá trị'];
        const displayPhones = Array.from(allPhones).sort();
        headers.push(...displayPhones);
        tableHead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

        // Add data rows
        customPageData.forEach((item, index) => {
            const row = document.createElement('tr');
            const cells = [
                startIndex + index + 1,
                `${item.columnName}: ${item.value}`
            ];
            
            // Add phone indicators for each phone
            displayPhones.forEach(phone => {
                const hasPhone = item.phones.includes(phone);
                cells.push(hasPhone ? '✓' : '');
            });
            
            row.innerHTML = cells.map(cell => `<td>${cell}</td>`).join('');
            tableBody.appendChild(row);
        });
    }
};

// Filter compare results
CDRAnalyzer.prototype.filterCompareResults = function() {
    const searchInput = document.getElementById('compareSearch');
    if (!searchInput || !this.currentCompareAnalysis) return;
    
    const searchValue = searchInput.value.trim();
    
    // If no search value, show all results
    if (!searchValue) {
        this.compareSearchTerm = '';
        // Reset to show all results (same as resetCompareFilters logic)
        this.resetCompareFilters();
        return;
    }
    
    // Split by comma and trim each value, filter out empty strings
    const searchTerms = searchValue.split(',')
        .map(term => term.trim())
        .filter(term => term.length > 0)
        .map(term => term.toLowerCase());
    
    this.compareSearchTerm = searchValue.toLowerCase();
    
    // Helper function to check if item matches ALL search terms (AND logic)
    // All search terms must be found in the item
    // This is a fallback function for cases where we don't have direct access to owners array
    const matchesSearchTerms = (item, getSearchableText) => {
        if (searchTerms.length === 0) return true;
        const itemText = getSearchableText(item).toLowerCase();
        
        // Check if ALL search terms are found (AND logic)
        return searchTerms.every(term => {
            // Check in full text
            if (itemText.includes(term)) {
                return true;
            }
            
            // If text contains comma-separated values (like owners), check each value
            if (itemText.includes(',')) {
                const textParts = itemText.split(',').map(p => p.trim());
                return textParts.some(part => part.includes(term));
            }
            
            return false;
        });
    };
    
    if (!this.compareSearchTerm) {
        if (this.currentCompareAnalysis.type === 'two-files') {
            // For two-files, flatten the data structure
            const comparisonData = this.currentCompareAnalysis.data;
            let flatData = [];
            
            if (comparisonData && comparisonData.data) {
                comparisonData.data.forEach(compItem => {
                    if (compItem.type === 'contacts') {
                        compItem.common.forEach(contact => {
                            flatData.push({
                                type: 'contacts',
                                category: 'Chung',
                                value: contact,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        });
                        compItem.uniqueToUser.forEach(contact => {
                            flatData.push({
                                type: 'contacts',
                                category: 'Chỉ có ở User',
                                value: contact,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        });
                        compItem.uniqueToTarget.forEach(contact => {
                            flatData.push({
                                type: 'contacts',
                                category: 'Chỉ có ở Target',
                                value: contact,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        });
                    } else if (compItem.type === 'imei') {
                        compItem.common.forEach(imei => {
                            flatData.push({
                                type: 'imei',
                                category: 'Chung',
                                value: imei,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        });
                        compItem.uniqueToUser.forEach(imei => {
                            flatData.push({
                                type: 'imei',
                                category: 'Chỉ có ở User',
                                value: imei,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        });
                        compItem.uniqueToTarget.forEach(imei => {
                            flatData.push({
                                type: 'imei',
                                category: 'Chỉ có ở Target',
                                value: imei,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        });
                    }
                });
            }
            this.filteredCompareResults = flatData;
        } else if (this.currentCompareAnalysis.type === 'multiple-files') {
            const comparisonData = this.currentCompareAnalysis.data;
            let flatData = [];
            
            if (comparisonData && comparisonData.data) {
                comparisonData.data.forEach(compItem => {
                    if (compItem.type === 'contacts') {
                        compItem.common.forEach(contactItem => {
                            flatData.push({
                                type: 'contacts',
                                contact: contactItem.contact || contactItem.last9Digits,
                                owners: contactItem.owners || [],
                                ownerCount: contactItem.ownerCount || 0,
                                last9Digits: contactItem.last9Digits || ''
                            });
                        });
                    } else if (compItem.type === 'imei') {
                        compItem.common.forEach(imeiItem => {
                            flatData.push({
                                type: 'imei',
                                imei: imeiItem.imei || imeiItem.first14Digits,
                                owners: imeiItem.owners || [],
                                ownerCount: imeiItem.ownerCount || 0,
                                first14Digits: imeiItem.first14Digits || ''
                            });
                        });
                    } else if (compItem.type === 'location') {
                        compItem.common.forEach(locationItem => {
                            flatData.push({
                                type: 'location',
                                lac: locationItem.lac,
                                cell: locationItem.cell,
                                lacCell: locationItem.lacCell || `${locationItem.lac}-${locationItem.cell}`,
                                provinceCode: locationItem.provinceCode,
                                stationName: locationItem.stationName,
                                location: locationItem.location,
                                owners: locationItem.owners || [],
                                ownerCount: locationItem.ownerCount || 0
                            });
                        });
                    }
                });
            }
            this.filteredCompareResults = flatData;
        } else {
            // Ensure it's an array
            this.filteredCompareResults = Array.isArray(this.currentCompareAnalysis.data) 
                ? this.currentCompareAnalysis.data 
                : [];
        }
    } else {
        const analysis = this.currentCompareAnalysis;
        
        if (analysis.type === 'shared-contacts') {
            this.filteredCompareResults = analysis.data.filter(item => {
                // Get all searchable text
                const searchableText = `${item.contact} ${item.owners.join(', ')} ${(item.fileNames || []).join(' ')}`.toLowerCase();
                // Get owners as array for precise matching
                const owners = (item.owners || []).map(o => String(o).toLowerCase().trim());
                
                // Check if ALL search terms match (AND logic)
                return searchTerms.every(term => {
                    // Check in full text
                    if (searchableText.includes(term)) return true;
                    // Check in owners array (more precise)
                    return owners.some(owner => owner.includes(term));
                });
            });
        } else if (analysis.type === 'shared-imei') {
            this.filteredCompareResults = analysis.data.filter(item => {
                const searchableText = `${item.imei} ${item.owners.join(', ')} ${(item.fileNames || []).join(' ')}`.toLowerCase();
                const owners = (item.owners || []).map(o => String(o).toLowerCase().trim());
                
                return searchTerms.every(term => {
                    if (searchableText.includes(term)) return true;
                    return owners.some(owner => owner.includes(term));
                });
            });
        } else if (analysis.type === 'shared-locations') {
            this.filteredCompareResults = analysis.data.filter(item => {
                const searchableText = `${item.lacCell || `${item.lac}-${item.cell}`} ${item.template || item.provinceCode || ''} ${item.stationName || ''} ${item.location || ''} ${item.owners.join(', ')} ${(item.fileNames || []).join(' ')}`.toLowerCase();
                const owners = (item.owners || []).map(o => String(o).toLowerCase().trim());
                
                return searchTerms.every(term => {
                    if (searchableText.includes(term)) return true;
                    return owners.some(owner => owner.includes(term));
                });
            });
        } else if (analysis.type === 'two-files') {
            // For two-files, filter the flat data structure - ONLY COMMON RESULTS
            const comparisonData = analysis.data;
            let flatData = [];
            
            comparisonData.data.forEach(compItem => {
                if (compItem.type === 'contacts') {
                    // Only filter common contacts
                    compItem.common.forEach(contactItem => {
                        const searchText = `${contactItem.userContact} ${contactItem.targetContact} ${contactItem.last9Digits}`.toLowerCase();
                        if (matchesSearchTerms(contactItem, () => searchText)) {
                            flatData.push({
                                type: 'contacts',
                                category: 'Chung',
                                userValue: contactItem.userContact,
                                targetValue: contactItem.targetContact,
                                matchKey: contactItem.last9Digits,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        }
                    });
                } else if (compItem.type === 'imei') {
                    // Only filter common IMEIs
                    compItem.common.forEach(imeiItem => {
                        const searchText = `${imeiItem.userIMEI} ${imeiItem.targetIMEI} ${imeiItem.first14Digits}`.toLowerCase();
                        if (matchesSearchTerms(imeiItem, () => searchText)) {
                            flatData.push({
                                type: 'imei',
                                category: 'Chung',
                                userValue: imeiItem.userIMEI,
                                targetValue: imeiItem.targetIMEI,
                                matchKey: imeiItem.first14Digits,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        }
                    });
                } else if (compItem.type === 'location') {
                    // Only filter common locations
                    compItem.common.forEach(locationItem => {
                        const lacCell = `${locationItem.lac}-${locationItem.cell}`.toLowerCase();
                        const stationName = (locationItem.userLocation.stationName || '').toLowerCase();
                        const targetStationName = (locationItem.targetLocation.stationName || '').toLowerCase();
                        const provinceCode = (locationItem.provinceCode || '').toLowerCase();
                        const searchText = `${lacCell} ${stationName} ${targetStationName} ${provinceCode}`;
                        if (matchesSearchTerms(locationItem, () => searchText)) {
                            flatData.push({
                                type: 'location',
                                category: 'Chung',
                                userLocation: locationItem.userLocation,
                                targetLocation: locationItem.targetLocation,
                                lac: locationItem.lac,
                                cell: locationItem.cell,
                                provinceCode: locationItem.provinceCode,
                                userTotal: compItem.userTotal,
                                targetTotal: compItem.targetTotal
                            });
                        }
                    });
                }
            });
            
            this.filteredCompareResults = flatData;
        } else if (analysis.type === 'multiple-files') {
            // For multiple-files, filter the flat data structure
            const comparisonData = analysis.data;
            let flatData = [];
            
            if (comparisonData && comparisonData.data) {
                comparisonData.data.forEach(compItem => {
                    if (compItem.type === 'contacts') {
                        compItem.common.forEach(contactItem => {
                            const searchText = `${contactItem.contact || ''} ${contactItem.last9Digits || ''} ${(contactItem.owners || []).join(', ')}`.toLowerCase();
                            const owners = (contactItem.owners || []).map(o => String(o).toLowerCase().trim());
                            
                            // Check if ALL search terms match (AND logic)
                            const matches = searchTerms.every(term => {
                                if (searchText.includes(term)) return true;
                                return owners.some(owner => owner.includes(term));
                            });
                            
                            if (matches) {
                                flatData.push({
                                    type: 'contacts',
                                    contact: contactItem.contact || contactItem.last9Digits,
                                    owners: contactItem.owners || [],
                                    ownerCount: contactItem.ownerCount || 0,
                                    last9Digits: contactItem.last9Digits || ''
                                });
                            }
                        });
                    } else if (compItem.type === 'imei') {
                        compItem.common.forEach(imeiItem => {
                            const searchText = `${imeiItem.imei || ''} ${imeiItem.first14Digits || ''} ${(imeiItem.owners || []).join(', ')}`.toLowerCase();
                            const owners = (imeiItem.owners || []).map(o => String(o).toLowerCase().trim());
                            
                            const matches = searchTerms.every(term => {
                                if (searchText.includes(term)) return true;
                                return owners.some(owner => owner.includes(term));
                            });
                            
                            if (matches) {
                                flatData.push({
                                    type: 'imei',
                                    imei: imeiItem.imei || imeiItem.first14Digits,
                                    owners: imeiItem.owners || [],
                                    ownerCount: imeiItem.ownerCount || 0,
                                    first14Digits: imeiItem.first14Digits || ''
                                });
                            }
                        });
                    } else if (compItem.type === 'location') {
                        compItem.common.forEach(locationItem => {
                            const searchText = `${locationItem.lac}-${locationItem.cell} ${locationItem.provinceCode || ''} ${locationItem.stationName || ''} ${locationItem.location || ''} ${(locationItem.owners || []).join(', ')}`.toLowerCase();
                            const owners = (locationItem.owners || []).map(o => String(o).toLowerCase().trim());
                            
                            const matches = searchTerms.every(term => {
                                if (searchText.includes(term)) return true;
                                return owners.some(owner => owner.includes(term));
                            });
                            
                            if (matches) {
                                flatData.push({
                                    type: 'location',
                                    lac: locationItem.lac,
                                    cell: locationItem.cell,
                                    lacCell: locationItem.lacCell || `${locationItem.lac}-${locationItem.cell}`,
                                    provinceCode: locationItem.provinceCode,
                                    stationName: locationItem.stationName,
                                    location: locationItem.location,
                                    owners: locationItem.owners || [],
                                    ownerCount: locationItem.ownerCount || 0
                                });
                            }
                        });
                    }
                });
            }
            
            this.filteredCompareResults = flatData;
        } else if (analysis.type === 'contacts') {
            this.filteredCompareResults = analysis.data.filter(item => 
                matchesSearchTerms(item, (item) => 
                    `${item.contact} ${item.phones.join(' ')}`
                )
            );
        } else if (analysis.type === 'imei') {
            this.filteredCompareResults = analysis.data.filter(item => 
                matchesSearchTerms(item, (item) => 
                    `${item.imei} ${item.phones.join(' ')}`
                )
            );
        } else if (analysis.type === 'custom') {
            // For custom, we need to filter the original data and then flatten
            const filteredData = analysis.data.map(column => ({
                ...column,
                sharedValues: column.sharedValues.filter(item =>
                    matchesSearchTerms(item, (item) => 
                        `${item.value} ${item.phones.join(' ')} ${column.columnName}`
                    )
                )
            })).filter(column => column.sharedValues.length > 0);
            
            // Flatten the filtered data
            this.filteredCompareResults = [];
            filteredData.forEach(column => {
                column.sharedValues.forEach(item => {
                    this.filteredCompareResults.push({
                        columnName: column.columnName,
                        value: item.value,
                        phones: item.phones
                    });
                });
            });
        }
    }
    
    this.compareCurrentPage = 1;
    this.updateComparePagination();
    this.renderComparePage();
};

// Reset compare filters
CDRAnalyzer.prototype.resetCompareFilters = function() {
    const searchInput = document.getElementById('compareSearch');
    if (searchInput) {
        searchInput.value = '';
        this.updateCompareSearchClearButton();
    }
    
    this.compareSearchTerm = '';
    
    // Reset filtered results based on analysis type
        if (this.currentCompareAnalysis) {
            if (this.currentCompareAnalysis.type === 'two-files') {
                // For two-files, flatten the data structure - ONLY COMMON RESULTS
                const comparisonData = this.currentCompareAnalysis.data;
                let flatData = [];
                
                if (comparisonData && comparisonData.data) {
                    comparisonData.data.forEach(compItem => {
                        if (compItem.type === 'contacts') {
                            // Only add common contacts
                            compItem.common.forEach(contactItem => {
                                flatData.push({
                                    type: 'contacts',
                                    category: 'Chung',
                                    userValue: contactItem.userContact,
                                    targetValue: contactItem.targetContact,
                                    matchKey: contactItem.last9Digits,
                                    userTotal: compItem.userTotal,
                                    targetTotal: compItem.targetTotal
                                });
                            });
                        } else if (compItem.type === 'imei') {
                            // Only add common IMEIs
                            compItem.common.forEach(imeiItem => {
                                flatData.push({
                                    type: 'imei',
                                    category: 'Chung',
                                    userValue: imeiItem.userIMEI,
                                    targetValue: imeiItem.targetIMEI,
                                    matchKey: imeiItem.first14Digits,
                                    userTotal: compItem.userTotal,
                                    targetTotal: compItem.targetTotal
                                });
                            });
                        } else if (compItem.type === 'location') {
                            // Only add common locations
                            compItem.common.forEach(locationItem => {
                                flatData.push({
                                    type: 'location',
                                    category: 'Chung',
                                    userLocation: locationItem.userLocation,
                                    targetLocation: locationItem.targetLocation,
                                    lac: locationItem.lac,
                                    cell: locationItem.cell,
                                    provinceCode: locationItem.provinceCode,
                                    userTotal: compItem.userTotal,
                                    targetTotal: compItem.targetTotal
                                });
                            });
                        }
                    });
                }
                this.filteredCompareResults = flatData;
            } else if (this.currentCompareAnalysis.type === 'multiple-files') {
                // For multiple-files, flatten the data structure
                const comparisonData = this.currentCompareAnalysis.data;
                let flatData = [];
                
                if (comparisonData && comparisonData.data) {
                    comparisonData.data.forEach(compItem => {
                        if (compItem.type === 'contacts') {
                            compItem.common.forEach(contactItem => {
                                flatData.push({
                                    type: 'contacts',
                                    contact: contactItem.contact || contactItem.last9Digits,
                                    owners: contactItem.owners || [],
                                    ownerCount: contactItem.ownerCount || 0,
                                    last9Digits: contactItem.last9Digits || ''
                                });
                            });
                        } else if (compItem.type === 'imei') {
                            compItem.common.forEach(imeiItem => {
                                flatData.push({
                                    type: 'imei',
                                    imei: imeiItem.imei || imeiItem.first14Digits,
                                    owners: imeiItem.owners || [],
                                    ownerCount: imeiItem.ownerCount || 0,
                                    first14Digits: imeiItem.first14Digits || ''
                                });
                            });
                        } else if (compItem.type === 'location') {
                            compItem.common.forEach(locationItem => {
                                flatData.push({
                                    type: 'location',
                                    lac: locationItem.lac,
                                    cell: locationItem.cell,
                                    lacCell: locationItem.lacCell || `${locationItem.lac}-${locationItem.cell}`,
                                    provinceCode: locationItem.provinceCode,
                                    stationName: locationItem.stationName,
                                    location: locationItem.location,
                                    owners: locationItem.owners || [],
                                    ownerCount: locationItem.ownerCount || 0
                                });
                            });
                        }
                    });
                }
                
                this.filteredCompareResults = flatData;
            } else {
                this.filteredCompareResults = Array.isArray(this.currentCompareAnalysis.data) 
                    ? this.currentCompareAnalysis.data 
                    : [];
            }
        } else {
            this.filteredCompareResults = [];
        }
    
    this.compareCurrentPage = 1;
    this.updateComparePagination();
    this.renderComparePage();
    this.updateCompareSearchClearButton();
};

CDRAnalyzer.prototype.updateCompareSearchClearButton = function() {
    const searchInput = document.getElementById('compareSearch');
    const clearBtn = document.getElementById('clearCompareSearch');
    if (searchInput && clearBtn) {
        if (searchInput.value.trim().length > 0) {
            clearBtn.style.display = 'block';
        } else {
            clearBtn.style.display = 'none';
        }
    }
};

CDRAnalyzer.prototype.clearCompareSearch = function() {
    const searchInput = document.getElementById('compareSearch');
    if (searchInput) {
        searchInput.value = '';
        this.updateCompareSearchClearButton();
        this.resetCompareFilters();
    }
};

// Previous compare page
CDRAnalyzer.prototype.previousComparePage = function() {
    if (this.compareCurrentPage > 1) {
        this.compareCurrentPage--;
        this.updateComparePagination();
        this.renderComparePage();
    }
};

// Next compare page
CDRAnalyzer.prototype.nextComparePage = function() {
    if (this.compareCurrentPage < this.compareTotalPages) {
        this.compareCurrentPage++;
        this.updateComparePagination();
        this.renderComparePage();
    }
};

// Export compare results
CDRAnalyzer.prototype.exportCompareResults = function() {
    if (!this.currentCompareAnalysis || !this.currentCompareAnalysis.data) {
        this.showToast('Không có dữ liệu để xuất', 'warning');
        return;
    }

    try {
        const analysis = this.currentCompareAnalysis;
        let filename = '';
        let sheetName = '';
        let exportData = [];

        // Lấy số điện thoại chủ từ compare files hoặc subscriberInfo
        let ownerPhone = 'unknown';
        if (this.compareFiles && this.compareFiles.length > 0) {
            // Lấy số chủ từ file đầu tiên
            const firstFile = this.compareFiles[0];
            if (firstFile.subscriberInfo && firstFile.subscriberInfo.phoneNumber) {
                ownerPhone = firstFile.subscriberInfo.phoneNumber;
            }
        } else if (this.subscriberInfo && this.subscriberInfo.phoneNumber) {
            ownerPhone = this.subscriberInfo.phoneNumber;
        }

        const sanitizeForFileName = (value) => {
            if (!value) return '';
            return value.toString()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '');
        };

        // Sử dụng dữ liệu đã lọc thay vì toàn bộ dữ liệu
        const dataToExport = this.filteredCompareResults && this.filteredCompareResults.length > 0 
            ? this.filteredCompareResults 
            : analysis.data;

        if (analysis.type === 'shared-contacts') {
            filename = `so_lien_lac_chung_tat_ca_so_chu.xlsx`;
            sheetName = 'Số liên lạc chung';
            // Ensure dataToExport is an array
            const exportArray = Array.isArray(dataToExport) ? dataToExport : [];
            exportData = exportArray.map((item, index) => ({
                'TT': index + 1,
                'Số liên hệ': item.contact,
                'Số lượng số chủ': item.ownerCount,
                'Các số chủ': item.owners.join(', ')
            }));
        } else if (analysis.type === 'shared-imei') {
            filename = `imei_chung_tat_ca_so_chu.xlsx`;
            sheetName = 'IMEI chung';
            // Ensure dataToExport is an array
            const exportArray = Array.isArray(dataToExport) ? dataToExport : [];
            exportData = exportArray.map((item, index) => ({
                'TT': index + 1,
                'IMEI': item.imei,
                'Số lượng số chủ': item.ownerCount,
                'Các số chủ': item.owners.join(', ')
            }));
        } else if (analysis.type === 'shared-locations') {
            filename = `vi_tri_chung_tat_ca_so_chu.xlsx`;
            sheetName = 'Vị trí chung';
            // Ensure dataToExport is an array
            const exportArray = Array.isArray(dataToExport) ? dataToExport : [];
            exportData = exportArray.map((item, index) => {
                // Get network provider from owners (phone numbers) instead of template
                const networkProvider = this.getNetworkProviderFromOwners(item.owners || []);
                return {
                    'TT': index + 1,
                    'Lac-Cell': item.lacCell || `${item.lac}-${item.cell}`,
                    'Nhà mạng': networkProvider,
                    'Tên trạm': item.stationName || item.location || 'N/A',
                    'Số lượng số chủ': item.ownerCount,
                    'Các số chủ': item.owners.join(', ')
                };
            });
        } else if (analysis.type === 'two-files') {
            const comparisonData = analysis.data;
            filename = `so_sanh_${comparisonData.userFileName}_vs_${comparisonData.targetFileName}.xlsx`;
            sheetName = 'So sánh 2 file';
            
            // Use filteredCompareResults if available, otherwise flatten from analysis.data - ONLY COMMON
            if (Array.isArray(this.filteredCompareResults) && this.filteredCompareResults.length > 0) {
                exportData = this.filteredCompareResults.map((item, index) => {
                    const baseRow = {
                        'TT': index + 1,
                        'Loại': item.type === 'contacts' ? 'Số liên lạc' : (item.type === 'imei' ? 'IMEI' : 'Vị trí'),
                        'Phân loại': item.category
                    };
                    
                    if (item.type === 'contacts') {
                        baseRow['User - Số liên lạc'] = item.userValue;
                        baseRow['Target - Số liên lạc'] = item.targetValue;
                        baseRow['9 số cuối (khớp)'] = item.matchKey;
                    } else if (item.type === 'imei') {
                        baseRow['User - IMEI'] = item.userValue;
                        baseRow['Target - IMEI'] = item.targetValue;
                        baseRow['14 số đầu (khớp)'] = item.matchKey;
                    } else if (item.type === 'location') {
                        baseRow['Lac-Cell'] = `${item.lac}-${item.cell}`;
                        // Get network provider - use provinceCode if available, otherwise use template
                        let networkProvider = item.provinceCode || '';
                        if (!networkProvider && item.template) {
                            const templateToNetwork = {
                                'template1': 'VIETTEL',
                                'template2': 'VINA',
                                'template3': 'MOBI'
                            };
                            networkProvider = templateToNetwork[item.template] || '';
                        }
                        // Fallback to userLocation or targetLocation template
                        if (!networkProvider && item.userLocation && item.userLocation.template) {
                            const templateToNetwork = {
                                'template1': 'VIETTEL',
                                'template2': 'VINA',
                                'template3': 'MOBI'
                            };
                            networkProvider = templateToNetwork[item.userLocation.template] || '';
                        } else if (!networkProvider && item.targetLocation && item.targetLocation.template) {
                            const templateToNetwork = {
                                'template1': 'VIETTEL',
                                'template2': 'VINA',
                                'template3': 'MOBI'
                            };
                            networkProvider = templateToNetwork[item.targetLocation.template] || '';
                        }
                        baseRow['Nhà mạng'] = networkProvider || 'N/A';
                        baseRow['User - Tên trạm'] = item.userLocation.stationName || item.userLocation.location || 'N/A';
                        baseRow['Target - Tên trạm'] = item.targetLocation.stationName || item.targetLocation.location || 'N/A';
                    }
                    
                    return baseRow;
                });
            } else {
                // Flatten data for export - ONLY COMMON
                exportData = [];
                if (comparisonData && comparisonData.data) {
                    comparisonData.data.forEach(compItem => {
                        if (compItem.type === 'contacts') {
                            compItem.common.forEach(contactItem => {
                                exportData.push({
                                    'Loại': 'Số liên lạc',
                                    'Phân loại': 'Chung',
                                    'User - Số liên lạc': contactItem.userContact,
                                    'Target - Số liên lạc': contactItem.targetContact,
                                    '9 số cuối (khớp)': contactItem.last9Digits
                                });
                            });
                        } else if (compItem.type === 'imei') {
                            compItem.common.forEach(imeiItem => {
                                exportData.push({
                                    'Loại': 'IMEI',
                                    'Phân loại': 'Chung',
                                    'User - IMEI': imeiItem.userIMEI,
                                    'Target - IMEI': imeiItem.targetIMEI,
                                    '14 số đầu (khớp)': imeiItem.first14Digits
                                });
                            });
                        } else if (compItem.type === 'location') {
                            compItem.common.forEach(locationItem => {
                                // Get network provider - use provinceCode if available, otherwise use template
                                let networkProvider = locationItem.provinceCode || '';
                                if (!networkProvider && locationItem.template) {
                                    const templateToNetwork = {
                                        'template1': 'VIETTEL',
                                        'template2': 'VINA',
                                        'template3': 'MOBI'
                                    };
                                    networkProvider = templateToNetwork[locationItem.template] || '';
                                }
                                // Fallback to userLocation or targetLocation template
                                if (!networkProvider) {
                                    const templateToNetwork = {
                                        'template1': 'VIETTEL',
                                        'template2': 'VINA',
                                        'template3': 'MOBI'
                                    };
                                    if (locationItem.userLocation && locationItem.userLocation.template) {
                                        networkProvider = templateToNetwork[locationItem.userLocation.template] || '';
                                    } else if (locationItem.targetLocation && locationItem.targetLocation.template) {
                                        networkProvider = templateToNetwork[locationItem.targetLocation.template] || '';
                                    }
                                }
                                
                                exportData.push({
                                    'Loại': 'Vị trí',
                                    'Phân loại': 'Chung',
                                    'Lac-Cell': `${locationItem.lac}-${locationItem.cell}`, // Changed to Lac-Cell format
                                    'Nhà mạng': networkProvider || locationItem.provinceCode || 'N/A',
                                    'User - Tên trạm': locationItem.userLocation.stationName || locationItem.userLocation.location || 'N/A',
                                    'Target - Tên trạm': locationItem.targetLocation.stationName || locationItem.targetLocation.location || 'N/A'
                                });
                            });
                        }
                    });
                }
            }
        } else if (analysis.type === 'multiple-files') {
            const comparisonData = analysis.data;
            const compareType = comparisonData.compareType;
            const ownerLabels = comparisonData.ownerLabels || [];
            const ownerSlug = ownerLabels.map(label => sanitizeForFileName(label)).filter(Boolean).join('_') || 'unknown';
            
            const buildMultipleExportArray = () => {
                const exportArray = [];
                if (!comparisonData || !comparisonData.data) return exportArray;
                comparisonData.data.forEach(compItem => {
                    if (compItem.type === 'contacts' && compareType === 'contacts') {
                        compItem.common.forEach(contactItem => {
                            exportArray.push({
                                type: 'contacts',
                                contact: contactItem.contact || contactItem.last9Digits,
                                owners: contactItem.owners || [],
                                ownerCount: contactItem.ownerCount || 0,
                                last9Digits: contactItem.last9Digits || ''
                            });
                        });
                    } else if (compItem.type === 'imei' && compareType === 'imei') {
                        compItem.common.forEach(imeiItem => {
                            exportArray.push({
                                type: 'imei',
                                imei: imeiItem.imei || imeiItem.first14Digits,
                                owners: imeiItem.owners || [],
                                ownerCount: imeiItem.ownerCount || 0,
                                first14Digits: imeiItem.first14Digits || ''
                            });
                        });
                    } else if (compItem.type === 'location' && compareType === 'location') {
                        compItem.common.forEach(locationItem => {
                            exportArray.push({
                                type: 'location',
                                lacCell: locationItem.lacCell || `${locationItem.lac}-${locationItem.cell}`,
                                provinceCode: locationItem.provinceCode,
                                stationName: locationItem.stationName,
                                location: locationItem.location,
                                owners: locationItem.owners || [],
                                ownerCount: locationItem.ownerCount || 0
                            });
                        });
                    }
                });
                return exportArray;
            };
            
            const exportArray = Array.isArray(this.filteredCompareResults) && this.filteredCompareResults.length > 0
                ? this.filteredCompareResults
                : buildMultipleExportArray();
            
            if (compareType === 'contacts') {
                filename = `so_sanh_sdt_${ownerSlug}.xlsx`;
                sheetName = 'So sánh số liên lạc';
                exportData = exportArray.map((item, index) => ({
                    'TT': index + 1,
                    'Số liên lạc': item.contact || item.last9Digits,
                    'Số lượng số chủ': item.ownerCount || 0,
                    'Các số chủ': (item.owners || []).join(', ')
                }));
            } else if (compareType === 'imei') {
                filename = `So_sanh_imei_${ownerSlug}.xlsx`;
                sheetName = 'So sánh IMEI';
                exportData = exportArray.map((item, index) => ({
                    'TT': index + 1,
                    'IMEI': item.imei || item.first14Digits,
                    '14 số đầu': item.first14Digits || '',
                    'Số lượng số chủ': item.ownerCount || 0,
                    'Các số chủ': (item.owners || []).join(', ')
                }));
            } else if (compareType === 'location') {
                filename = `So_sanh_vi_tri_${ownerSlug}.xlsx`;
                sheetName = 'So sánh vị trí';
                exportData = exportArray.map((item, index) => {
                    // Get network provider from owners (phone numbers) instead of provinceCode
                    const networkProvider = this.getNetworkProviderFromOwners(item.owners || []);
                    return {
                        'TT': index + 1,
                        'Lac-Cell': item.lacCell || '',
                        'Nhà mạng': networkProvider,
                        'Tên trạm': item.stationName || item.location || 'N/A',
                        'Số lượng số chủ': item.ownerCount || 0,
                        'Các số chủ': (item.owners || []).join(', ')
                    };
                });
            }
        } else if (analysis.type === 'contacts') {
            filename = `${ownerPhone}_so_sanh_so_lien_lac.xlsx`;
            sheetName = 'Số liên lạc chung';
            exportData = dataToExport.map((item, index) => ({
                'TT': index + 1,
                'Số liên hệ': item.contact,
                'Số lượng số chủ': item.phoneCount,
                'Các số chủ liên hệ': item.phones.join(', ')
            }));
        } else if (analysis.type === 'imei') {
            filename = `${ownerPhone}_so_sanh_imei.xlsx`;
            sheetName = 'IMEI chung';
            exportData = dataToExport.map((item, index) => ({
                'TT': index + 1,
                'IMEI': item.imei,
                'Số lượng số chủ': item.phoneCount,
                'Các số chủ sử dụng': item.phones.join(', ')
            }));
        } else if (analysis.type === 'custom') {
            filename = `${ownerPhone}_so_sanh_tuy_chinh.xlsx`;
            sheetName = 'So sánh tùy chỉnh';
            exportData = dataToExport.map((item, index) => ({
                'TT': index + 1,
                'Cột': item.columnName,
                'Giá trị': item.value,
                'Số lượng số chủ': item.phoneCount,
                'Các số chủ': item.phones.join(', ')
            }));
        }

        this.exportToExcel(exportData, filename, sheetName);
        // Removed success alert - no popup notification needed
    } catch (error) {
        console.error('Error exporting compare results:', error);
        this.showToast('Lỗi khi xuất file: ' + error.message, 'error');
    }
};

// Export current results (same as exportCompareResults)
CDRAnalyzer.prototype.exportCurrentCompareResults = function() {
    this.exportCompareResults();
};

// Clear compare results
CDRAnalyzer.prototype.clearCompareResults = function() {
    const compareResults = document.getElementById('compareResults');
    const resultsPlaceholder = document.getElementById('resultsPlaceholder');
    
    if (compareResults) {
        compareResults.style.display = 'none';
    }
    if (resultsPlaceholder) {
        resultsPlaceholder.style.display = 'flex';
    }
    this.currentCompareAnalysis = null;
};

// Clear all compare files
CDRAnalyzer.prototype.clearCompareFiles = function() {
    this.compareFiles = [];
    this.compareResults = null;
    this.currentCompareAnalysis = null;
    this.compareFileSelection = [];
    this.updateCompareSelectedSummary();
    
    const compareFilesList = document.getElementById('compareFilesList');
    const compareOptions = document.getElementById('compareOptions');
    const compareActions = document.getElementById('compareActions');
    const compareResults = document.getElementById('compareResults');
    const resultsPlaceholder = document.getElementById('resultsPlaceholder');
    
    if (compareFilesList) compareFilesList.style.display = 'none';
    if (compareOptions) compareOptions.style.display = 'none';
    if (compareActions) compareActions.style.display = 'none';
    if (compareResults) compareResults.style.display = 'none';
    if (resultsPlaceholder) resultsPlaceholder.style.display = 'flex';
    
    // Clear file input
    const compareFileInput = document.getElementById('compareFileInput');
    if (compareFileInput) compareFileInput.value = '';
    
    // No alert needed - action is silent
};

