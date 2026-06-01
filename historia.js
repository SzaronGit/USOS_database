const API_URL = 'http://127.0.0.1:8000/api';

// Safe localStorage wrapper to prevent crashes when cookies/storage is blocked in local/file views
const safeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return this[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            this[key] = value;
        }
    }
};

let studentsList = [];
let teachersList = [];
let allLogs = [];
let filteredLogs = [];
let selectedRole = safeStorage.getItem('selectedRole') || 'student';
let selectedStudentId = safeStorage.getItem('selectedStudentId');
let selectedTeacherId = safeStorage.getItem('selectedTeacherId');

document.addEventListener('DOMContentLoaded', async () => {
    await initSidebar();
    await loadActivityLogs();
    setupSearchListener();
});

// Setup sidebar selectors and navigation menu
async function initSidebar() {
    const roleSelect = document.getElementById('roleSelect');
    const userSelect = document.getElementById('userSelect');
    const userSelectLabel = document.getElementById('userSelectLabel');
    const actionLink = document.getElementById('actionLink');

    if (roleSelect) {
        roleSelect.value = selectedRole;
    }

    // Adjust shortcut action link based on role
    if (actionLink) {
        if (selectedRole === 'teacher') {
            actionLink.href = 'zarzadzanie.html';
            const linkText = actionLink.querySelector('span');
            if (linkText) linkText.innerText = 'PANEL PROWADZĄCEGO';
            const linkImg = actionLink.querySelector('img');
            if (linkImg) linkImg.src = 'img/info.png';
        } else {
            actionLink.href = 'zapisy.html';
            const linkText = actionLink.querySelector('span');
            if (linkText) linkText.innerText = 'REJESTRACJA NA ZAJĘCIA';
            const linkImg = actionLink.querySelector('img');
            if (linkImg) linkImg.src = 'img/sign.png';
        }
    }

    try {
        if (selectedRole === 'student') {
            if (userSelectLabel) userSelectLabel.innerText = 'Wybór studenta (Symulacja):';
            const response = await fetch(`${API_URL}/students`);
            if (response.ok) {
                studentsList = await response.json();
                if (userSelect) {
                    userSelect.innerHTML = '';
                    studentsList.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.id;
                        opt.innerText = `${s.first_name} ${s.last_name} (${s.index_number})`;
                        userSelect.appendChild(opt);
                    });

                    if (selectedStudentId && studentsList.some(s => s.id == selectedStudentId)) {
                        selectedStudentId = parseInt(selectedStudentId);
                        userSelect.value = selectedStudentId;
                    } else if (studentsList.length > 0) {
                        selectedStudentId = studentsList[0].id;
                        safeStorage.setItem('selectedStudentId', selectedStudentId);
                        userSelect.value = selectedStudentId;
                    }
                }
            }
        } else {
            if (userSelectLabel) userSelectLabel.innerText = 'Wybór prowadzącego (Symulacja):';
            const response = await fetch(`${API_URL}/teachers`);
            if (response.ok) {
                teachersList = await response.json();
                if (userSelect) {
                    userSelect.innerHTML = '';
                    teachersList.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.innerText = `${t.academic_title || ''} ${t.first_name} ${t.last_name}`.trim();
                        userSelect.appendChild(opt);
                    });

                    if (selectedTeacherId && teachersList.some(t => t.id == selectedTeacherId)) {
                        selectedTeacherId = parseInt(selectedTeacherId);
                        userSelect.value = selectedTeacherId;
                    } else if (teachersList.length > 0) {
                        selectedTeacherId = teachersList[0].id;
                        safeStorage.setItem('selectedTeacherId', selectedTeacherId);
                        userSelect.value = selectedTeacherId;
                    }
                }
            }
        }

        updateUserHeader();
    } catch (err) {
        console.error(err);
        showToast('Brak połączenia z backendem FastAPI.', 'error');
        const headerLabel = document.getElementById('currentUserLabel');
        if (headerLabel) headerLabel.innerText = 'Błąd połączenia';
    }

    // Role switcher
    if (roleSelect) {
        roleSelect.onchange = (e) => {
            selectedRole = e.target.value;
            safeStorage.setItem('selectedRole', selectedRole);
            window.location.reload();
        };
    }

    // User switcher
    if (userSelect) {
        userSelect.onchange = (e) => {
            const val = parseInt(e.target.value);
            if (selectedRole === 'student') {
                selectedStudentId = val;
                safeStorage.setItem('selectedStudentId', val);
            } else {
                selectedTeacherId = val;
                safeStorage.setItem('selectedTeacherId', val);
            }
            updateUserHeader();
        };
    }

    // Reset database handler
    const resetDbBtn = document.getElementById('resetDbBtn');
    if (resetDbBtn) {
        resetDbBtn.addEventListener('click', async () => {
            if (confirm('Czy na pewno chcesz zresetować bazę danych do stanu domyślnego? Wszystkie własne modyfikacje i zapisy zostaną usunięte.')) {
                try {
                    const response = await fetch(`${API_URL}/reset-db`, { method: 'POST' });
                    const data = await response.json();
                    if (response.ok) {
                        showToast('Baza danych została zresetowana!', 'success');
                        window.location.reload();
                    } else {
                        showToast(data.detail || 'Błąd resetowania bazy.', 'error');
                    }
                } catch (err) {
                    showToast('Brak połączenia z serwerem.', 'error');
                }
            }
        });
    }
}

// Update profile header
function updateUserHeader() {
    const curUserLabel = document.getElementById('currentUserLabel');
    const curIndexLabel = document.getElementById('currentIndexLabel');
    
    if (!curUserLabel || !curIndexLabel) return;

    if (selectedRole === 'student') {
        const student = studentsList.find(s => s.id === selectedStudentId);
        if (student) {
            curUserLabel.innerText = `${student.first_name} ${student.last_name}`;
            curIndexLabel.innerText = `indeks: ${student.index_number}`;
        }
    } else {
        const teacher = teachersList.find(t => t.id === selectedTeacherId);
        if (teacher) {
            const name = `${teacher.academic_title || ''} ${teacher.first_name} ${teacher.last_name}`.trim();
            curUserLabel.innerText = name;
            curIndexLabel.innerText = 'rola: prowadzący';
        }
    }
}

// Fetch logs from backend
async function loadActivityLogs() {
    const container = document.getElementById('logsContainer');
    try {
        const res = await fetch(`${API_URL}/logs`);
        if (res.ok) {
            allLogs = await res.json();
            filteredLogs = [...allLogs];
            renderLogs();
        } else {
            container.innerHTML = `<div style="text-align: center; padding: 48px; color: #ef4444;">Wystąpił błąd podczas ładowania historii z serwera.</div>`;
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="text-align: center; padding: 48px; color: #ef4444;">Brak połączenia z serwerem backendowym.</div>`;
    }
}

// Format SQLite/PostgreSQL timestamp string
function formatTimestamp(tsString) {
    if (!tsString) return '';
    try {
        const dt = new Date(tsString);
        if (isNaN(dt.getTime())) return tsString;
        const pad = (n) => String(n).padStart(2, '0');
        const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
        return `${date} o ${time}`;
    } catch (e) {
        return tsString;
    }
}

// Map database action names to polish descriptions
const actionLabels = {
    'ENROLL': 'Zapis na zajęcia',
    'UNENROLL': 'Wypis z zajęć',
    'CREATE_CLASS': 'Dodanie zajęć',
    'EDIT_CLASS': 'Modyfikacja zajęć',
    'DELETE_CLASS': 'Usunięcie zajęć',
    'RESET_DB': 'Reset bazy danych'
};

// Render activity timeline
function renderLogs() {
    const container = document.getElementById('logsContainer');
    container.innerHTML = '';

    if (filteredLogs.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 48px; color: #64748b; font-weight: 500;">Brak wpisów spełniających kryteria wyszukiwania.</div>`;
        return;
    }

    filteredLogs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item';

        const dotClass = log.action.toLowerCase();
        const actionLabel = actionLabels[log.action] || log.action;
        const timeFormatted = formatTimestamp(log.timestamp);
        
        let roleBadgeClass = 'system';
        let roleText = 'system';
        if (log.user_role === 'student') {
            roleBadgeClass = 'student';
            roleText = 'student';
        } else if (log.user_role === 'teacher') {
            roleBadgeClass = 'teacher';
            roleText = 'prowadzący';
        }

        item.innerHTML = `
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <div class="timeline-user-section">
                        <span class="timeline-user">${log.user_name}</span>
                        <span class="timeline-badge ${roleBadgeClass}">${roleText}</span>
                    </div>
                    <span class="timeline-time">${timeFormatted}</span>
                </div>
                <p class="timeline-details">
                    <span style="font-weight: 600; color: #0284c7; margin-right: 8px;">[${actionLabel}]</span>${log.details}
                </p>
            </div>
        `;
        container.appendChild(item);
    });
}

// Setup search bar filter
function setupSearchListener() {
    const searchBar = document.getElementById('searchBar');
    if (!searchBar) return;

    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            filteredLogs = [...allLogs];
        } else {
            filteredLogs = allLogs.filter(log => {
                const actionLabel = (actionLabels[log.action] || log.action).toLowerCase();
                return log.user_name.toLowerCase().includes(query) ||
                       log.details.toLowerCase().includes(query) ||
                       log.action.toLowerCase().includes(query) ||
                       actionLabel.includes(query) ||
                       log.user_role.toLowerCase().includes(query);
            });
        }
        renderLogs();
    });
}

// Toast helper
let toastTimeout = null;
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const tText = document.getElementById('toastText');
    const tIcon = document.getElementById('toastIcon');

    clearTimeout(toastTimeout);
    tText.innerText = msg;

    if (type === 'success') {
        tIcon.style.backgroundColor = '#22c55e';
        tIcon.style.color = 'white';
        tIcon.innerHTML = '✓';
    } else if (type === 'error') {
        tIcon.style.backgroundColor = '#ef4444';
        tIcon.style.color = 'white';
        tIcon.innerHTML = '✕';
    } else {
        tIcon.style.backgroundColor = '#0ea5e9';
        tIcon.style.color = 'white';
        tIcon.innerHTML = '!';
    }

    toast.classList.add('show-toast');
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show-toast');
    }, 3500);
}
