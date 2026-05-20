-- 1. Tabela Wykładowców
CREATE TABLE teachers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    academic_title VARCHAR(20)
);

-- 2. Tabela Studentów
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    index_number VARCHAR(10) UNIQUE NOT NULL
);

-- 3. Tabela Zajęć
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    max_seats INT NOT NULL,
    taken_seats INT DEFAULT 0,
    teacher_id INT REFERENCES teachers(id), -- Klucz obcy
    day_of_week INT NOT NULL,  -- 1 = Poniedziałek, 2 = Wtorek, 3 = Środa, etc.
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    room VARCHAR(20) NOT NULL,
    week_parity INT DEFAULT 0  -- 0 = co tydzień, 1 = TP (parzyste), 2 = TN (nieparzyste)
);

-- 4. Tabela Zapisów (tabela łącząca studentów i zajęcia)
CREATE TABLE enrollments (
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, class_id)
);

-- Czyszczenie tabel przed wstawieniem danych
TRUNCATE TABLE enrollments, classes, students, teachers RESTART IDENTITY CASCADE;

-- 1. Dodajemy wykładowców
INSERT INTO teachers (first_name, last_name, academic_title) VALUES
('Ada', 'Lovelace', 'prof.'),
('Alan', 'Turing', 'dr inż.'),
('Richard', 'Feynman', 'prof. dr hab.'),
('Grace', 'Hopper', 'dr');

-- 2. Dodajemy studentów
INSERT INTO students (first_name, last_name, index_number) VALUES
('Kacper', 'Mucha', '400101'),
('Wiktoria', 'Zielińska', '400102'),
('Tomasz', 'Kot', '400103'),
('Jan', 'Kowalski', '400104');

-- 3. Dodajemy zajęcia - dokładnie 1 termin na każdy przedmiot, bez group_number i class_type
INSERT INTO classes (name, max_seats, taken_seats, teacher_id, day_of_week, start_time, end_time, room, week_parity) VALUES
('Teoria automatów i języków formalnych', 30, 0, 1, 1, '08:00', '09:30', '1.01', 0),
('Programowanie w językach Erlang i Haskell', 30, 0, 1, 1, '09:45', '11:15', '1.02', 0),
('Programowanie w języku Rust', 2, 0, 2, 2, '09:45', '11:15', '4.28', 0),
('Systemy operacyjne', 30, 0, 1, 3, '08:00', '09:30', '1.03', 0),
('Bazy danych', 30, 0, 2, 3, '09:45', '11:15', '3.11', 0),
('Metody obliczeniowe w nauce i technice', 15, 0, 2, 3, '13:15', '14:45', '3.23', 0),
('Fizyka kwantowa', 20, 0, 3, 4, '08:00', '09:30', '1.12', 1),                -- TP (parzysty)
('Elektrodynamika klasyczna', 20, 0, 3, 4, '09:45', '11:15', '1.15', 2),       -- TN (nieparzysty)
('Architektura komputerów', 30, 0, 4, 5, '09:45', '11:15', '2.05', 0),
('Seminarium dyplomowe', 10, 0, 4, 5, '11:30', '13:00', '2.08', 1);          -- TP (parzysty)

-- 4. Opcjonalnie: zapisujemy Kacpra Muchę (student_id = 1) na te zajęcia
INSERT INTO enrollments (student_id, class_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10);

-- Zaktualizowanie liczników taken_seats dla powyższych zapisów
UPDATE classes SET taken_seats = 1 WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10);