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

let teachersList = [];
let classesList = [];
let selectedRole = safeStorage.getItem('selectedRole') || 'student';
let selectedTeacherId = safeStorage.getItem('selectedTeacherId');

document.addEventListener('DOMContentLoaded', async () => {
    // Redirection check: Prowadzący panel is only for teachers
    if (selectedRole === 'student') {
        window.location.href = 'index.html';
        return;
    }

    await initSidebar();
    setupModalListeners();
    setupFormListener();
});

// Setup sidebar selectors and navigation
async function initSidebar() {
    const roleSelect = document.getElementById('roleSelect');
    const userSelect = document.getElementById('userSelect');
    const userSelectLabel = document.getElementById('userSelectLabel');
    const resetDbBtn = document.getElementById('resetDbBtn');

    if (roleSelect) {
        roleSelect.value = 'teacher'; // Locked to teacher since we're here

        // Listen for role switcher change
        roleSelect.addEventListener('change', (e) => {
            const newRole = e.target.value;
            safeStorage.setItem('selectedRole', newRole);
            if (newRole === 'student') {
                window.location.href = 'index.html';
            }
        });
    }

    // Reset database handler
    if (resetDbBtn) {
        resetDbBtn.addEventListener('click', async () => {
            if (confirm('Czy na pewno chcesz zresetować bazę danych do stanu domyślnego? Wszystkie własne modyfikacje i zapisy zostaną usunięte.')) {
                try {
                    const response = await fetch(`${API_URL}/reset-db`, { method: 'POST' });
                    const data = await response.json();
                    if (response.ok) {
                        showToast('Baza danych została zresetowana!', 'success');
                        await loadTeachers();
                    } else {
                        showToast(data.detail || 'Błąd resetowania bazy.', 'error');
                    }
                } catch (err) {
                    showToast('Brak połączenia z serwerem.', 'error');
                }
            }
        });
    }

    await loadTeachers();

    if (userSelect) {
        userSelect.addEventListener('change', (e) => {
            selectedTeacherId = parseInt(e.target.value);
            safeStorage.setItem('selectedTeacherId', selectedTeacherId);
            updateUserHeader();
            refreshClassesList();
        });
    }
}

// Fetch list of teachers
async function loadTeachers() {
    const userSelect = document.getElementById('userSelect');
    const userSelectLabel = document.getElementById('userSelectLabel');
    if (userSelectLabel) userSelectLabel.innerText = 'Wybór prowadzącego:';

    try {
        const res = await fetch(`${API_URL}/teachers`);
        if (res.ok) {
            teachersList = await res.json();
            if (userSelect) {
                userSelect.innerHTML = '';
                teachersList.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.innerText = `${t.academic_title || ''} ${t.first_name} ${t.last_name}`.trim();
                    userSelect.appendChild(opt);
                });

                // Recover selection or default
                if (selectedTeacherId && teachersList.some(t => t.id == selectedTeacherId)) {
                    userSelect.value = selectedTeacherId;
                    selectedTeacherId = parseInt(selectedTeacherId);
                } else if (teachersList.length > 0) {
                    selectedTeacherId = teachersList[0].id;
                    safeStorage.setItem('selectedTeacherId', selectedTeacherId);
                    userSelect.value = selectedTeacherId;
                }
            }

            updateUserHeader();
            await refreshClassesList();
        }
    } catch (err) {
        console.error(err);
        showToast('Błąd połączenia z serwerem.', 'error');
        const headerLabel = document.getElementById('currentUserLabel');
        if (headerLabel) headerLabel.innerText = 'Błąd połączenia';
    }
}

// Update profile labels
function updateUserHeader() {
    const curUserLabel = document.getElementById('currentUserLabel');
    const curIndexLabel = document.getElementById('currentIndexLabel');
    
    if (!curUserLabel || !curIndexLabel) return;

    const teacher = teachersList.find(t => t.id === selectedTeacherId);
    if (teacher) {
        const name = `${teacher.academic_title || ''} ${teacher.first_name} ${teacher.last_name}`.trim();
        curUserLabel.innerText = name;
        curIndexLabel.innerText = 'rola: prowadzący';
    }
}

// Fetch and render classes taught by the active teacher
async function refreshClassesList() {
    if (!selectedTeacherId) return;

    try {
        const res = await fetch(`${API_URL}/teachers/${selectedTeacherId}/schedule`);
        if (res.ok) {
            classesList = await res.json();
            renderClassesTable();
        }
    } catch (err) {
        console.error(err);
        showToast('Błąd pobierania listy zajęć.', 'error');
    }
}

// Render classes in the table
function renderClassesTable() {
    const tbody = document.getElementById('classesTableBody');
    const badge = document.getElementById('classesCountBadge');
    
    tbody.innerHTML = '';
    badge.innerText = `${classesList.length} zajęć`;

    if (classesList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">Brak prowadzonych zajęć. Kliknij "+ Dodaj zajęcia" powyżej, aby dodać pierwsze zajęcia.</td></tr>`;
        return;
    }

    const dayNames = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

    classesList.forEach(c => {
        const tr = document.createElement('tr');
        
        // Parity label styling
        let parityHtml = 'Co tydzień';
        if (c.week_parity === 1) {
            parityHtml = '<span class="parity-badge-tp">TP</span>';
        } else if (c.week_parity === 2) {
            parityHtml = '<span class="parity-badge-tn">TN</span>';
        }

        const dayName = dayNames[c.day_of_week - 1] || 'Nieznany';
        const termin = `${dayName}, ${c.start_time} - ${c.end_time}`;

        tr.innerHTML = `
            <td class="table-id-cell">${c.id}</td>
            <td style="font-weight: 600;">${c.name}</td>
            <td>${termin}</td>
            <td>sala ${c.room}</td>
            <td>
                <div class="seats-info-compact">
                    <span style="font-weight: 600; color: #0f172a;">${c.taken_seats}</span>
                    <span style="color: #94a3b8; margin: 0 4px;">/</span>
                    <span style="color: #64748b;">${c.max_seats}</span>
                </div>
            </td>
            <td>${parityHtml}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-edit" onclick="openEditModal(${c.id})">Edytuj</button>
                    <button class="btn-delete" onclick="deleteClass(${c.id})">Usuń</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal Setup
function setupModalListeners() {
    const modal = document.getElementById('classModal');
    const addBtn = document.getElementById('addClassBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');

    addBtn.addEventListener('click', () => {
        // Reset form
        document.getElementById('classForm').reset();
        document.getElementById('classIdInput').value = '';
        document.getElementById('modalTitle').innerText = 'Dodaj nowe zajęcia';
        hideAlert();
        modal.classList.add('show-modal');
    });

    const closeModal = () => {
        modal.classList.remove('show-modal');
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close on click outside container
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// Open modal in edit mode
window.openEditModal = function(id) {
    const course = classesList.find(c => c.id === id);
    if (!course) return;

    hideAlert();
    document.getElementById('modalTitle').innerText = 'Edytuj zajęcia';
    document.getElementById('classIdInput').value = course.id;
    document.getElementById('classNameInput').value = course.name;
    document.getElementById('classRoomInput').value = course.room;
    document.getElementById('classMaxSeatsInput').value = course.max_seats;
    document.getElementById('classDayInput').value = course.day_of_week;
    document.getElementById('classStartTimeInput').value = course.start_time;
    document.getElementById('classEndTimeInput').value = course.end_time;
    document.getElementById('classParityInput').value = course.week_parity;

    document.getElementById('classModal').classList.add('show-modal');
};

// Setup form submit listener
function setupFormListener() {
    const form = document.getElementById('classForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const id = document.getElementById('classIdInput').value;
        const name = document.getElementById('classNameInput').value.trim();
        const room = document.getElementById('classRoomInput').value.trim();
        const maxSeats = parseInt(document.getElementById('classMaxSeatsInput').value);
        const dayOfWeek = parseInt(document.getElementById('classDayInput').value);
        const startTime = document.getElementById('classStartTimeInput').value.trim();
        const endTime = document.getElementById('classEndTimeInput').value.trim();
        const weekParity = parseInt(document.getElementById('classParityInput').value);

        // Simple validation
        if (startTime >= endTime) {
            showAlert('Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
            return;
        }

        const payload = {
            name: name,
            max_seats: maxSeats,
            teacher_id: selectedTeacherId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            room: room,
            week_parity: weekParity
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/classes/${id}` : `${API_URL}/classes`;

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                showToast(id ? 'Zajęcia zostały zaktualizowane!' : 'Zajęcia zostały dodane!', 'success');
                document.getElementById('classModal').classList.remove('show-modal');
                await refreshClassesList();
            } else {
                showAlert(data.detail || 'Wystąpił błąd podczas zapisywania zajęć.');
            }
        } catch (err) {
            console.error(err);
            showAlert('Błąd połączenia z serwerem.');
        }
    });
}

// Delete class implementation
window.deleteClass = async function(id) {
    const course = classesList.find(c => c.id === id);
    if (!course) return;

    let warningMsg = `Czy na pewno chcesz usunąć zajęcia: "${course.name}"?`;
    if (course.taken_seats > 0) {
        warningMsg += `\nUWAGA: Na te zajęcia jest już zapisanych ${course.taken_seats} studentów! Zostaną oni automatycznie wyrejestrowani.`;
    }

    if (confirm(warningMsg)) {
        try {
            const res = await fetch(`${API_URL}/classes/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast('Zajęcia zostały pomyślnie usunięte!', 'success');
                await refreshClassesList();
            } else {
                showToast(data.detail || 'Wystąpił błąd podczas usuwania.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Błąd połączenia z serwerem.', 'error');
        }
    }
};

// Alert display helpers inside the modal
function showAlert(msg) {
    const alertDiv = document.getElementById('modal-alert-message');
    if (alertDiv) {
        const alertText = document.getElementById('modalAlertMessageText');
        alertText.innerText = msg;
        alertDiv.classList.add('show-alert');
    }
}

function hideAlert() {
    const alertDiv = document.getElementById('modal-alert-message');
    if (alertDiv) {
        alertDiv.classList.remove('show-alert');
    }
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
