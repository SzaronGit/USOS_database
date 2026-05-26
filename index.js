const API_URL = 'http://127.0.0.1:8000/api';

let studentsList = [];
let selectedStudentId = null;
let currentMonday = new Date('2026-05-25');

document.addEventListener('DOMContentLoaded', async () => {
    generateGridLines();
    await loadStudents();
    
    // Handle student selector changes
    document.getElementById('studentSelect').addEventListener('change', async (e) => {
        selectedStudentId = parseInt(e.target.value);
        localStorage.setItem('selectedStudentId', selectedStudentId);
        updateUserHeader();
        await refreshSchedule();
    });

    // Date navigation controls
    document.getElementById('prevWeekBtn').addEventListener('click', async () => {
        currentMonday.setDate(currentMonday.getDate() - 7);
        updateDateDisplay();
        await refreshSchedule();
    });

    document.getElementById('nextWeekBtn').addEventListener('click', async () => {
        currentMonday.setDate(currentMonday.getDate() + 7);
        updateDateDisplay();
        await refreshSchedule();
    });

    // Database reset logic
    document.getElementById('resetDbBtn').addEventListener('click', async () => {
        if (confirm('Czy na pewno chcesz zresetować bazę danych do stanu domyślnego? Wszystkie własne zapisy zostaną usunięte.')) {
            try {
                const response = await fetch(`${API_URL}/reset-db`, { method: 'POST' });
                const data = await response.json();
                if (response.ok) {
                    showToast('Baza danych została zresetowana!', 'success');
                    await loadStudents();
                } else {
                    showToast(data.detail || 'Błąd resetowania bazy danych.', 'error');
                }
            } catch (err) {
                showToast('Brak połączenia z serwerem.', 'error');
            }
        }
    });

    updateDateDisplay();
});

// Date helper format
function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get ISO standard week number
function getISOWeekNumber(d) {
    const date = new Date(d.valueOf());
    const dayNum = (d.getDay() + 6) % 7;
    date.setDate(date.getDate() - dayNum + 3);
    const firstThursday = date.valueOf();
    date.setMonth(0, 1);
    if (date.getDay() !== 4) {
        date.setMonth(0, 1 + ((4 - date.getDay() + 7) % 7));
    }
    return 1 + Math.ceil((firstThursday - date) / 604800000);
}

// Update displayed date and week parity badges
function updateDateDisplay() {
    const sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() + 6);
    
    document.getElementById('dateRangeText').innerText = `${formatDate(currentMonday)} - ${formatDate(sunday)}`;
    
    const weekNum = getISOWeekNumber(currentMonday);
    const isEven = (weekNum % 2 === 0);
    const parityText = isEven ? 'TP' : 'TN';
    const badge = document.getElementById('weekParityText');
    
    badge.innerText = parityText;
    if (isEven) {
        badge.style.backgroundColor = '#2b4c7e';
        badge.title = "Tydzień Parzysty (TP)";
    } else {
        badge.style.backgroundColor = '#f05a28';
        badge.title = "Tydzień Nieparzysty (TN)";
    }
}

// Generate lines and hourly ticks in timetable grid
function generateGridLines() {
    const gridContainer = document.getElementById('timetableGrid');
    const hours = ['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
    
    // Clean up existing elements
    const oldLines = gridContainer.querySelectorAll('.grid-vertical-line, .grid-horizontal-line, .hour-label');
    oldLines.forEach(l => l.remove());

    // 5 vertical grids for Pon-Pią
    for (let day = 1; day <= 5; day++) {
        const line = document.createElement('div');
        line.style.gridColumn = day + 1;
        line.style.gridRow = '2 / 38';
        line.className = 'grid-vertical-line';
        gridContainer.appendChild(line);
    }

    // Horizontal grid lines and hours
    hours.forEach((h, idx) => {
        const rowStart = 2 + idx * 4;
        
        const label = document.createElement('div');
        label.style.gridColumn = '1';
        label.style.gridRow = `${rowStart} / span 4`;
        label.className = 'hour-label';
        label.innerText = h;
        gridContainer.appendChild(label);
        
        const line = document.createElement('div');
        line.style.gridColumn = '2 / 7';
        line.style.gridRow = `${rowStart}`;
        line.className = 'grid-horizontal-line';
        gridContainer.appendChild(line);
    });
}

// Fetch students from API
async function loadStudents() {
    const select = document.getElementById('studentSelect');
    try {
        const response = await fetch(`${API_URL}/students`);
        if (response.ok) {
            studentsList = await response.json();
            
            select.innerHTML = '';
            studentsList.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.innerText = `${s.first_name} ${s.last_name} (${s.index_number})`;
                select.appendChild(opt);
            });

            // Recover student selection state
            const savedId = localStorage.getItem('selectedStudentId');
            if (savedId && studentsList.some(s => s.id == savedId)) {
                select.value = savedId;
                selectedStudentId = parseInt(savedId);
            } else if (studentsList.length > 0) {
                select.value = studentsList[0].id;
                selectedStudentId = studentsList[0].id;
            }
            
            updateUserHeader();
            await refreshSchedule();
        }
    } catch (err) {
        console.error(err);
        showToast('Brak połączenia z backendem FastAPI.', 'error');
        document.getElementById('currentUserLabel').innerText = 'Błąd połączenia';
    }
}

// Update header visual text
function updateUserHeader() {
    const student = studentsList.find(s => s.id === selectedStudentId);
    if (student) {
        document.getElementById('currentUserLabel').innerText = `${student.first_name} ${student.last_name}`;
        document.getElementById('currentIndexLabel').innerText = `index: ${student.index_number}`;
    }
}

// Fetch and refresh weekly timetable
async function refreshSchedule() {
    if (!selectedStudentId) return;

    try {
        const res = await fetch(`${API_URL}/students/${selectedStudentId}/schedule`);
        if (res.ok) {
            const schedule = await res.json();
            renderScheduleGrid(schedule);
        }
    } catch (err) {
        console.error(err);
        showToast('Błąd pobierania danych z serwera.', 'error');
    }
}

// Render card layout
function renderScheduleGrid(schedule) {
    const gridContainer = document.getElementById('timetableGrid');
    
    // Clean up previous timetable cards
    const oldCards = gridContainer.querySelectorAll('.timetable-card');
    oldCards.forEach(c => c.remove());

    const weekNum = getISOWeekNumber(currentMonday);
    const currentWeekParity = (weekNum % 2 === 0) ? 1 : 2; // 1 = TP, 2 = TN

    const filteredSchedule = schedule.filter(c => c.week_parity === 0 || c.week_parity === currentWeekParity);

    filteredSchedule.forEach(c => {
        const card = document.createElement('div');
        card.className = 'timetable-card';
        
        const colIndex = c.day_of_week + 1;
        const rowStart = getRowIndex(c.start_time);
        const rowEnd = getRowIndex(c.end_time);

        card.style.gridColumn = colIndex;
        card.style.gridRow = `${rowStart} / ${rowEnd}`;
        
        let parityLabel = '';
        if (c.week_parity === 1) {
            parityLabel = ' <span class="card-parity-tp">TP</span>';
        } else if (c.week_parity === 2) {
            parityLabel = ' <span class="card-parity-tn">TN</span>';
        }

        card.innerHTML = `
            <div class="card-content-wrapper">
                <div class="card-title-text" title="${c.name}">${c.name}</div>
                <div class="card-room-text">sala: ${c.room}${parityLabel}</div>
            </div>
            <div class="card-time">
                ${c.start_time}
            </div>
        `;

        // Display info details
        card.addEventListener('click', () => {
            const weekText = c.week_parity === 1 ? 'TP (Tydzień parzysty)' : (c.week_parity === 2 ? 'TN (Tydzień nieparzysty)' : 'Co tydzień');
            showToast(`Zajęcia: ${c.name}\nProwadzący: ${c.teacher_name}\nSala: ${c.room}\nGodzina: ${c.start_time}-${c.end_time} (${weekText})`, 'info');
        });

        gridContainer.appendChild(card);
    });
}

// Return row index in grid from time string HH:MM
function getRowIndex(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const minutesSince7 = (h - 7) * 60 + m;
    return 2 + Math.floor(minutesSince7 / 15);
}

// Alert popup toast notification
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
