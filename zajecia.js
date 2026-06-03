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
let allClasses = [];
let filteredClasses = [];
let selectedRole = safeStorage.getItem('selectedRole') || 'student';
let selectedStudentId = safeStorage.getItem('selectedStudentId');
let selectedTeacherId = safeStorage.getItem('selectedTeacherId');

document.addEventListener('DOMContentLoaded', async () => {
    await initSidebar();
    await loadClassesCatalog();
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
            if (linkImg) linkImg.src = 'img/sign.png';
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
            if (userSelectLabel) userSelectLabel.innerText = 'Wybór studenta:';
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
            if (userSelectLabel) userSelectLabel.innerText = 'Wybór prowadzącego:';
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

// Fetch details of all classes and students enrolled
async function loadClassesCatalog() {
    const container = document.getElementById('catalogContainer');
    try {
        const res = await fetch(`${API_URL}/classes/details`);
        if (res.ok) {
            allClasses = await res.json();
            filteredClasses = [...allClasses];
            renderCatalog();
        } else {
            container.innerHTML = `<div style="text-align: center; padding: 48px; color: #ef4444;">Wystąpił błąd podczas ładowania danych z serwera.</div>`;
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="text-align: center; padding: 48px; color: #ef4444;">Brak połączenia z serwerem backendowym.</div>`;
    }
}

// Render catalog content
function renderCatalog() {
    const container = document.getElementById('catalogContainer');
    container.innerHTML = '';

    if (filteredClasses.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 48px; color: #64748b; font-weight: 500;">Brak zajęć spełniających kryteria wyszukiwania.</div>`;
        return;
    }

    const dayNames = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

    filteredClasses.forEach(c => {
        const card = document.createElement('div');
        card.className = 'catalog-card';

        // Parity label styling
        let parityHtml = 'Co tydzień';
        if (c.week_parity === 1) {
            parityHtml = '<span class="parity-badge-tp">TP</span>';
        } else if (c.week_parity === 2) {
            parityHtml = '<span class="parity-badge-tn">TN</span>';
        }

        const dayName = dayNames[c.day_of_week - 1] || 'Nieznany';
        const termin = `${dayName}, ${c.start_time} - ${c.end_time}`;

        // Student list sub-table
        let studentsTableHtml = '';
        if (c.students.length === 0) {
            studentsTableHtml = `<p class="no-students-placeholder">Brak zapisanych studentów na te zajęcia.</p>`;
        } else {
            studentsTableHtml = `
                <table class="student-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">Lp.</th>
                            <th>Nazwisko</th>
                            <th>Imię</th>
                            <th style="width: 120px;">Indeks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${c.students.map((s, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td style="font-weight: 600;">${s.last_name}</td>
                                <td>${s.first_name}</td>
                                <td style="font-family: monospace; color: #64748b;">${s.index_number}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        card.innerHTML = `
            <div class="catalog-card-header">
                <div class="catalog-card-header-left">
                    <h3 class="catalog-card-title">${c.name}</h3>
                    <div class="catalog-card-meta">
                        <span class="catalog-card-meta-item">
                            <span style="font-weight: 600;">Termin:</span> ${termin}
                        </span>
                        <span class="catalog-card-meta-item">
                            <span style="font-weight: 600;">Prowadzący:</span> ${c.teacher_name}
                        </span>
                        <span class="catalog-card-meta-item">
                            <span style="font-weight: 600;">Sala:</span> ${c.room}
                        </span>
                        <span class="catalog-card-meta-item">
                            <span style="font-weight: 600;">Parzystość:</span> ${parityHtml}
                        </span>
                    </div>
                </div>
                <div class="seats-info-compact">
                    <span style="font-weight: 600; color: #0f172a;">${c.taken_seats}</span>
                    <span style="color: #94a3b8; margin: 0 4px;">/</span>
                    <span style="color: #64748b;">${c.max_seats}</span>
                    <span style="font-size: 10px; color: #94a3b8; margin-left: 6px; font-weight: normal;">miejsc</span>
                </div>
            </div>
            <div class="catalog-card-body">
                <div class="student-list-container">
                    <h4 class="student-list-title">Zapisani studenci (${c.students.length})</h4>
                    ${studentsTableHtml}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// Setup searching/filtering by multiple fields
function setupSearchListener() {
    const searchBar = document.getElementById('searchBar');
    if (!searchBar) return;

    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            filteredClasses = [...allClasses];
        } else {
            const dayNames = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];
            filteredClasses = allClasses.filter(c => {
                const dayName = (dayNames[c.day_of_week - 1] || '').toLowerCase();
                return c.name.toLowerCase().includes(query) ||
                       c.teacher_name.toLowerCase().includes(query) ||
                       c.room.toLowerCase().includes(query) ||
                       dayName.includes(query);
            });
        }
        renderCatalog();
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
