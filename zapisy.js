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
let classesList = [];
let enrolledClassIds = new Set();
let selectedRole = safeStorage.getItem('selectedRole') || 'student';
let selectedStudentId = safeStorage.getItem('selectedStudentId');

document.addEventListener('DOMContentLoaded', async () => {
    if (selectedRole === 'teacher') {
        window.location.href = 'zarzadzanie.html';
        return;
    }

    await initSidebar();

    const resetBtn = document.getElementById('resetDbBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (confirm('Czy na pewno chcesz zresetować bazę danych do stanu domyślnego? Wszystkie własne zapisy zostaną usunięte.')) {
                try {
                    const response = await fetch(`${API_URL}/reset-db`, { method: 'POST' });
                    const data = await response.json();
                    if (response.ok) {
                        showToast('Baza danych została zresetowana!', 'success');
                        await initSidebar();
                    } else {
                        showToast(data.detail || 'Błąd resetowania bazy danych.', 'error');
                    }
                } catch (err) {
                    showToast('Brak połączenia z serwerem.', 'error');
                }
            }
        });
    }
});

async function initSidebar() {
    const roleSelect = document.getElementById('roleSelect');
    const userSelect = document.getElementById('userSelect');
    const userSelectLabel = document.getElementById('userSelectLabel');
    const actionLink = document.getElementById('actionLink');

    if (roleSelect) {
        roleSelect.value = selectedRole;
    }

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
        }

        updateUserHeader();
        await refreshRegistrations();
    } catch (err) {
        console.error(err);
        showToast('Brak połączenia z backendem FastAPI.', 'error');
        const headerLabel = document.getElementById('currentUserLabel');
        if (headerLabel) headerLabel.innerText = 'Błąd połączenia';
    }

    if (roleSelect) {
        roleSelect.onchange = (e) => {
            const val = e.target.value;
            safeStorage.setItem('selectedRole', val);
            if (val === 'teacher') {
                window.location.href = 'zarzadzanie.html';
            } else {
                window.location.reload();
            }
        };
    }

    if (userSelect) {
        userSelect.onchange = async (e) => {
            selectedStudentId = parseInt(e.target.value);
            safeStorage.setItem('selectedStudentId', selectedStudentId);
            updateUserHeader();
            await refreshRegistrations();
        };
    }
}

function updateUserHeader() {
    const student = studentsList.find(s => s.id === selectedStudentId);
    if (student) {
        document.getElementById('currentUserLabel').innerText = `${student.first_name} ${student.last_name}`;
        document.getElementById('currentIndexLabel').innerText = `index: ${student.index_number}`;
    }
}

// Fetch classes and schedule registrations
async function refreshRegistrations() {
    if (!selectedStudentId) return;

    try {
        const [resClasses, resSchedule] = await Promise.all([
            fetch(`${API_URL}/classes`),
            fetch(`${API_URL}/students/${selectedStudentId}/schedule`)
        ]);

        if (resClasses.ok && resSchedule.ok) {
            classesList = await resClasses.json();
            const schedule = await resSchedule.json();

            enrolledClassIds = new Set(schedule.map(c => c.id));
            renderClassesTable();
        }
    } catch (err) {
        console.error(err);
        showToast('Błąd pobierania danych z serwera.', 'error');
    }
}

// Render registration items
function renderClassesTable() {
    const tbody = document.getElementById('classesTableBody');
    tbody.innerHTML = '';

    document.getElementById('classesCountBadge').innerText = `${classesList.length} zajęć`;

    const dayNames = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

    classesList.forEach(c => {
        const isEnrolled = enrolledClassIds.has(c.id);
        const isFull = c.taken_seats >= c.max_seats;
        const tr = document.createElement('tr');
        
        if (isEnrolled) {
            tr.classList.add('row-enrolled');
        }

        // Calculate progress color
        const seatsPct = (c.taken_seats / c.max_seats) * 100;
        let progressColor = '#2b4c7e';
        if (c.taken_seats >= c.max_seats) progressColor = '#ef4444';
        else if (c.taken_seats >= c.max_seats * 0.8) progressColor = '#f59e0b';

        // Registration action button
        let actionButtonHtml = '';
        if (isEnrolled) {
            actionButtonHtml = `
                <button onclick="unenrollStudent(${c.id})" class="btn-unenroll">
                    <span>Wypisz się</span>
                </button>
            `;
        } else if (isFull) {
            actionButtonHtml = `
                <button disabled class="btn-full">
                    <span>Brak miejsc</span>
                </button>
            `;
        } else {
            actionButtonHtml = `
                <button onclick="enrollStudent(${c.id})" class="btn-enroll">
                    <span>Zapisz się</span>
                </button>
            `;
        }

        // Alternating TP/TN badge
        let parityBadgeHtml = '';
        if (c.week_parity === 1) {
            parityBadgeHtml = ' <span class="parity-badge-tp" title="Co dwa tygodnie - tydzień parzysty (TP)">TP</span>';
        } else if (c.week_parity === 2) {
            parityBadgeHtml = ' <span class="parity-badge-tn" title="Co dwa tygodnie - tydzień nieparzysty (TN)">TN</span>';
        }

        tr.innerHTML = `
            <td class="table-id-cell">${c.id}</td>
            <td>
                <div class="class-name-cell">${c.name}</div>
            </td>
            <td class="teacher-name-cell">${c.teacher_name}</td>
            <td class="datetime-cell">
                <div class="datetime-row">${dayNames[c.day_of_week - 1]}, ${c.start_time} - ${c.end_time}${parityBadgeHtml}</div>
                <div class="room-subtext">Sala: ${c.room}</div>
            </td>
            <td>
                <div class="seats-info-row">
                    <span>${c.taken_seats} / ${c.max_seats}</span>
                    <span class="seats-label">miejsc</span>
                </div>
                <div class="progress-bg">
                    <div class="progress-fill" style="width: ${seatsPct}%; background-color: ${progressColor};"></div>
                </div>
            </td>
            <td>${actionButtonHtml}</td>
        `;

        tbody.appendChild(tr);
    });
}

// Enroll action
async function enrollStudent(classId) {
    if (!selectedStudentId) return;
    hideAlert();

    try {
        const response = await fetch(`${API_URL}/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: selectedStudentId,
                class_id: classId
            })
        });

        const data = await response.json();

        if (response.status === 201) {
            showToast('Zapisano pomyślnie!', 'success');
            showAlert(data.message, 'success');
            await refreshRegistrations();
        } else {
            showToast(data.detail || 'Błąd zapisu.', 'error');
            showAlert(data.detail || 'Wystąpił błąd podczas zapisu.', 'danger');
        }
    } catch (err) {
        console.error(err);
        showToast('Brak połączenia z serwerem.', 'error');
        showAlert('Nie udało się połączyć z serwerem backendowym.', 'danger');
    }
}

// Unenroll action
async function unenrollStudent(classId) {
    if (!selectedStudentId) return;
    hideAlert();

    try {
        const response = await fetch(`${API_URL}/unenroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: selectedStudentId,
                class_id: classId
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Wypisano pomyślnie!', 'success');
            showAlert(data.message, 'success');
            await refreshRegistrations();
        } else {
            showToast(data.detail || 'Błąd wypisu.', 'error');
            showAlert(data.detail || 'Wystąpił błąd podczas wypisywania.', 'danger');
        }
    } catch (err) {
        console.error(err);
        showToast('Brak połączenia z serwerem.', 'error');
        showAlert('Nie udało się połączyć z serwerem backendowym.', 'danger');
    }
}

// Notification alert banner controller
function showAlert(msg, type) {
    const box = document.getElementById('alert-message');
    const txt = document.getElementById('alertMessageText');
    
    box.classList.remove('success', 'danger');
    box.classList.add(type === 'success' ? 'success' : 'danger');
    box.classList.add('show-alert');
    
    txt.innerText = msg;
}

function hideAlert() {
    const box = document.getElementById('alert-message');
    box.classList.remove('show-alert');
}

// Toast popup notification
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
        tIcon.innerHTML = '<img src="img/info.png" alt="info" style="width:12px;height:12px;" />';
    }

    toast.classList.add('show-toast');
    
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show-toast');
    }, 3500);
}
