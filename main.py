from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from pydantic import BaseModel
import models
from database import engine, get_db

# INICIALIZACJA BAZY
def init_db(db: Session):
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)

    teachers = [
        models.Teacher(id=1, first_name="Ada", last_name="Lovelace", academic_title="prof."),
        models.Teacher(id=2, first_name="Alan", last_name="Turing", academic_title="dr inż."),
        models.Teacher(id=3, first_name="Richard", last_name="Feynman", academic_title="prof. dr hab."),
        models.Teacher(id=4, first_name="Grace", last_name="Hopper", academic_title="dr")
    ]
    for t in teachers:
        db.add(t)
    db.commit()

    students = [
        models.Student(id=1, first_name="Jeremy", last_name="Sochan", index_number="400101"),
        models.Student(id=2, first_name="Wiktoria", last_name="Zielińska", index_number="400102"),
        models.Student(id=3, first_name="Tomasz", last_name="Kot", index_number="400103"),
        models.Student(id=4, first_name="Jan", last_name="Kowalski", index_number="400104")
    ]
    for s in students:
        db.add(s)
    db.commit()

    classes = [
        models.Class(id=1, name="Teoria automatów i języków formalnych", max_seats=30, taken_seats=1, teacher_id=1, day_of_week=1, start_time="08:00", end_time="09:30", room="1.01", week_parity=0),
        models.Class(id=2, name="Programowanie w językach Erlang i Elixir", max_seats=30, taken_seats=1, teacher_id=1, day_of_week=1, start_time="09:45", end_time="11:15", room="1.02", week_parity=0),
        models.Class(id=3, name="Programowanie w języku Rust", max_seats=2, taken_seats=1, teacher_id=2, day_of_week=2, start_time="09:45", end_time="11:15", room="4.28", week_parity=0),
        models.Class(id=4, name="Systemy operacyjne", max_seats=30, taken_seats=1, teacher_id=1, day_of_week=3, start_time="08:00", end_time="09:30", room="1.03", week_parity=0),
        models.Class(id=5, name="Bazy danych 2", max_seats=30, taken_seats=1, teacher_id=2, day_of_week=3, start_time="09:45", end_time="11:15", room="3.11", week_parity=0),
        models.Class(id=6, name="Metody obliczeniowe w nauce i technice", max_seats=15, taken_seats=1, teacher_id=2, day_of_week=3, start_time="13:15", end_time="14:45", room="3.23", week_parity=0),
        models.Class(id=7, name="Projektowanie obiektowe", max_seats=20, taken_seats=1, teacher_id=3, day_of_week=4, start_time="08:00", end_time="09:30", room="1.12", week_parity=1),
        models.Class(id=8, name="Logika", max_seats=20, taken_seats=1, teacher_id=3, day_of_week=4, start_time="09:45", end_time="11:15", room="1.15", week_parity=2),
        models.Class(id=9, name="Matematyka Dyskretna", max_seats=1, taken_seats=1, teacher_id=4, day_of_week=5, start_time="09:45", end_time="11:15", room="2.05", week_parity=0),
        models.Class(id=10, name="Analiza matematyzcna", max_seats=10, taken_seats=1, teacher_id=4, day_of_week=5, start_time="11:30", end_time="13:00", room="2.08", week_parity=1)
    ]
    for c in classes:
        db.add(c)
    db.commit()

    enrollments = [
        models.Enrollment(student_id=1, class_id=1),
        models.Enrollment(student_id=1, class_id=2),
        models.Enrollment(student_id=1, class_id=3),
        models.Enrollment(student_id=1, class_id=4),
        models.Enrollment(student_id=1, class_id=5),
        models.Enrollment(student_id=1, class_id=6),
        models.Enrollment(student_id=1, class_id=7),
        models.Enrollment(student_id=1, class_id=8),
        models.Enrollment(student_id=1, class_id=9),
        models.Enrollment(student_id=1, class_id=10)
    ]
    for e in enrollments:
        db.add(e)
    db.commit()

    # Resetowanie sekwencji ID w PostgreSQL, aby kolejne automatyczne ID nie powodowały konfliktów
    db.execute(text("SELECT setval(pg_get_serial_sequence('teachers', 'id'), coalesce(max(id), 1)) FROM teachers;"))
    db.execute(text("SELECT setval(pg_get_serial_sequence('students', 'id'), coalesce(max(id), 1)) FROM students;"))
    db.execute(text("SELECT setval(pg_get_serial_sequence('classes', 'id'), coalesce(max(id), 1)) FROM classes;"))
    
    # Dodanie logów startowych
    logs = [
        models.ActivityLog(user_role="system", user_name="System", action="RESET_DB", details="Zresetowano bazę danych do stanu domyślnego"),
        models.ActivityLog(user_role="student", user_name="Jeremy Sochan", action="ENROLL", details="Zapisano studenta Jeremy Sochan (400101) na przedmiot 'Teoria automatów i języków formalnych'"),
        models.ActivityLog(user_role="student", user_name="Jeremy Sochan", action="ENROLL", details="Zapisano studenta Jeremy Sochan (400101) na przedmiot 'Programowanie w językach Erlang i Elixir'")
    ]
    for l in logs:
        db.add(l)
    db.commit()
    db.execute(text("SELECT setval(pg_get_serial_sequence('activity_logs', 'id'), coalesce(max(id), 1)) FROM activity_logs;"))
    db.commit()

app = FastAPI(title="Mini USOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ENDPOINTY
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        init_db(db)
        print("Database initialized successfully on startup!")
    except Exception as e:
        print(f"Error initializing database: {e}")
    finally:
        db.close()

class EnrollmentRequest(BaseModel):
    student_id: int
    class_id: int

class UnenrollmentRequest(BaseModel):
    student_id: int
    class_id: int

# Pobierz listę wszystkich studentów
@app.get("/api/students")
def get_students(db: Session = Depends(get_db)):
    return db.query(models.Student).order_by(models.Student.id).all()

# Pobierz listę wszystkich zajęć z prowadzącym"""
@app.get("/api/classes")
def get_classes(db: Session = Depends(get_db)):
    classes = db.query(models.Class).order_by(models.Class.id).all()
    result = []
    for c in classes:
        teacher = db.query(models.Teacher).filter(models.Teacher.id == c.teacher_id).first()
        teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip() if teacher else "Nieznany"
        result.append({
            "id": c.id,
            "name": c.name,
            "max_seats": c.max_seats,
            "taken_seats": c.taken_seats,
            "teacher_id": c.teacher_id,
            "teacher_name": teacher_name,
            "day_of_week": c.day_of_week,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "room": c.room,
            "week_parity": c.week_parity
        })
    return result

# Pobierz listę wszystkich zajęć z prowadzącym i zapisanych studentów
@app.get("/api/classes/details")
def get_classes_details(db: Session = Depends(get_db)):
    classes = db.query(models.Class).order_by(models.Class.id).all()
    result = []
    for c in classes:
        teacher = db.query(models.Teacher).filter(models.Teacher.id == c.teacher_id).first()
        teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip() if teacher else "Nieznany"
        
        students = db.query(models.Student).join(
            models.Enrollment, models.Enrollment.student_id == models.Student.id
        ).filter(models.Enrollment.class_id == c.id).order_by(models.Student.last_name, models.Student.first_name).all()
        
        student_list = []
        for s in students:
            student_list.append({
                "id": s.id,
                "first_name": s.first_name,
                "last_name": s.last_name,
                "index_number": s.index_number
            })
            
        result.append({
            "id": c.id,
            "name": c.name,
            "max_seats": c.max_seats,
            "taken_seats": c.taken_seats,
            "teacher_id": c.teacher_id,
            "teacher_name": teacher_name,
            "day_of_week": c.day_of_week,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "room": c.room,
            "week_parity": c.week_parity,
            "students": student_list
        })
    return result

# Pobierz plan zajęć danego studenta
@app.get("/api/students/{student_id}/schedule")
def get_student_schedule(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student nie istnieje.")
    
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.student_id == student_id).all()
    class_ids = [e.class_id for e in enrollments]
    
    if not class_ids:
        return []
        
    classes = db.query(models.Class).filter(models.Class.id.in_(class_ids)).all()
    result = []
    for c in classes:
        teacher = db.query(models.Teacher).filter(models.Teacher.id == c.teacher_id).first()
        teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip() if teacher else "Nieznany"
        result.append({
            "id": c.id,
            "name": c.name,
            "max_seats": c.max_seats,
            "taken_seats": c.taken_seats,
            "teacher_id": c.teacher_id,
            "teacher_name": teacher_name,
            "day_of_week": c.day_of_week,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "room": c.room,
            "week_parity": c.week_parity
        })
    return result

# Zapisz studenta na zajęcia (FOR UPDATE)
@app.post("/api/enroll", status_code=status.HTTP_201_CREATED)
def enroll_student(request: EnrollmentRequest, db: Session = Depends(get_db)):
    course = db.query(models.Class). \
        filter(models.Class.id == request.class_id). \
        with_for_update(). \
        first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono takich zajęć."
        )

    student = db.query(models.Student).filter(models.Student.id == request.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono takiego studenta."
        )

    if course.taken_seats >= course.max_seats:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Brak wolnych miejsc na tych zajęciach."
        )

    existing_enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == request.student_id,
        models.Enrollment.class_id == request.class_id
    ).first()

    if existing_enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student jest już zapisany na te zajęcia."
        )

    # Kolizje z zajęciami
    def to_minutes(t_str):
        h, m = map(int, t_str.split(':'))
        return h * 60 + m

    try:
        new_start = to_minutes(course.start_time)
        new_end = to_minutes(course.end_time)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy format czasu w zajęciach."
        )

    student_classes = db.query(models.Class).join(
        models.Enrollment, models.Enrollment.class_id == models.Class.id
    ).filter(models.Enrollment.student_id == request.student_id).all()

    for c in student_classes:
        if c.day_of_week != course.day_of_week:
            continue
        
        parity_overlap = (course.week_parity == 0 or c.week_parity == 0 or course.week_parity == c.week_parity)
        if not parity_overlap:
            continue
            
        try:
            curr_start = to_minutes(c.start_time)
            curr_end = to_minutes(c.end_time)
        except Exception:
            continue
            
        if new_start < curr_end and curr_start < new_end:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Kolizja planu zajęć! Jesteś już zapisany(a) na zajęcia w tym czasie: '{c.name}' ({c.start_time}-{c.end_time})."
            )

    try:
        new_enrollment = models.Enrollment(
            student_id=request.student_id,
            class_id=request.class_id
        )
        db.add(new_enrollment)
        course.taken_seats += 1
        db.commit()

        student_name = f"{student.first_name} {student.last_name}"
        log_activity(db, "student", student_name, "ENROLL", f"Zapisano studenta {student_name} ({student.index_number}) na przedmiot '{course.name}'")

        return {"status": "success", "message": "Pomyślnie zapisano na zajęcia!"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Błąd serwera podczas zapisu."
        )

# Wypisz studenta z zajęć
@app.post("/api/unenroll")
def unenroll_student(request: UnenrollmentRequest, db: Session = Depends(get_db)):
    course = db.query(models.Class). \
        filter(models.Class.id == request.class_id). \
        with_for_update(). \
        first()
        
    if not course:
        raise HTTPException(status_code=404, detail="Zajęcia nie istnieją.")
        
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == request.student_id,
        models.Enrollment.class_id == request.class_id
    ).first()
    
    if not enrollment:
        raise HTTPException(status_code=400, detail="Student nie jest zapisany na te zajęcia.")
        
    student = db.query(models.Student).filter(models.Student.id == request.student_id).first()
    try:
        db.delete(enrollment)
        if course.taken_seats > 0:
            course.taken_seats -= 1
        db.commit()
        
        student_name = f"{student.first_name} {student.last_name}" if student else "Nieznany student"
        log_activity(db, "student", student_name, "UNENROLL", f"Wypisano studenta {student_name} z przedmiotu '{course.name}'")
        
        return {"status": "success", "message": "Pomyślnie wypisano z zajęć!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Błąd serwera podczas wypisywania.")

# Zresetuj bazę danych do default
@app.post("/api/reset-db")
def reset_database(db: Session = Depends(get_db)):
    try:
        init_db(db)
        return {"status": "success", "message": "Baza danych została pomyślnie zresetowana!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd podczas resetowania bazy: {str(e)}")

def log_activity(db: Session, user_role: str, user_name: str, action: str, details: str):
    try:
        log_entry = models.ActivityLog(
            user_role=user_role,
            user_name=user_name,
            action=action,
            details=details
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        print(f"Failed to log activity: {e}")

# Pobierz historię działań użytkowników (Uzależniona od uprawnień)
@app.get("/api/logs")
def get_logs(role: str, user_id: int, db: Session = Depends(get_db)):
    if role == "student": # swoje wpisy i wypisy
        student = db.query(models.Student).filter(models.Student.id == user_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Ten student nie istnieje.")

        student_name = f"{student.first_name} {student.last_name}"
        return db.query(models.ActivityLog).filter(
            models.ActivityLog.user_name == student_name
        ).order_by(models.ActivityLog.id.desc()).all()

    elif role == "teacher": # swoje przedmioty oraz wpisy i wypisy z nich
        teacher = db.query(models.Teacher).filter(models.Teacher.id == user_id).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Ten prowadzący nie istnieje.")

        teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip()
        teacher_classes = db.query(models.Class).filter(models.Class.teacher_id == user_id).all()
        class_names = [c.name for c in teacher_classes]

        conditions = [models.ActivityLog.user_name == teacher_name]
        for c_name in class_names:
            conditions.append(models.ActivityLog.details.like(f"%'{c_name}'%"))

        return db.query(models.ActivityLog).filter(
            or_(*conditions)
        ).order_by(models.ActivityLog.id.desc()).all()

    else:
        raise HTTPException(status_code=400, detail="Nieprawidłowa rola użytkownika.")

# OPERACJE CRUD DLA TEACHERA
class ClassCreateRequest(BaseModel):
    name: str
    max_seats: int
    teacher_id: int
    day_of_week: int
    start_time: str
    end_time: str
    room: str
    week_parity: int

def check_teacher_collision(db: Session, teacher_id: int, day_of_week: int, start_time: str, end_time: str, week_parity: int, exclude_class_id: int = None):
    def to_minutes(t_str):
        h, m = map(int, t_str.split(':'))
        return h * 60 + m
    
    try:
        new_start = to_minutes(start_time)
        new_end = to_minutes(end_time)
    except Exception:
        return None

    query = db.query(models.Class).filter(
        models.Class.teacher_id == teacher_id,
        models.Class.day_of_week == day_of_week
    )
    if exclude_class_id:
        query = query.filter(models.Class.id != exclude_class_id)
        
    existing_classes = query.all()
    for c in existing_classes:
        parity_overlap = (week_parity == 0 or c.week_parity == 0 or week_parity == c.week_parity)
        if not parity_overlap:
            continue
            
        try:
            curr_start = to_minutes(c.start_time)
            curr_end = to_minutes(c.end_time)
        except Exception:
            continue
            
        if new_start < curr_end and curr_start < new_end:
            return c
    return None

# Pobierz listę wszystkich prowadzących
@app.get("/api/teachers")
def get_teachers(db: Session = Depends(get_db)):
    return db.query(models.Teacher).order_by(models.Teacher.id).all()

# Pobierz plan zajęć prowadzonych przez prowadzącego
@app.get("/api/teachers/{teacher_id}/schedule")
def get_teacher_schedule(teacher_id: int, db: Session = Depends(get_db)):
    teacher = db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Prowadzący nie istnieje.")
    
    classes = db.query(models.Class).filter(models.Class.teacher_id == teacher_id).order_by(models.Class.id).all()
    result = []
    for c in classes:
        teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip()
        result.append({
            "id": c.id,
            "name": c.name,
            "max_seats": c.max_seats,
            "taken_seats": c.taken_seats,
            "teacher_id": c.teacher_id,
            "teacher_name": teacher_name,
            "day_of_week": c.day_of_week,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "room": c.room,
            "week_parity": c.week_parity
        })
    return result

# Dodaj nowe zajęcia dla prowadzącego
@app.post("/api/classes", status_code=status.HTTP_201_CREATED)
def create_class(request: ClassCreateRequest, db: Session = Depends(get_db)):
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Nazwa przedmiotu nie może być pusta.")
    if request.max_seats <= 0:
        raise HTTPException(status_code=400, detail="Liczba miejsc musi być większa od 0.")
    if request.day_of_week < 1 or request.day_of_week > 5:
        raise HTTPException(status_code=400, detail="Dzień tygodnia musi być w przedziale 1-5 (Poniedziałek - Piątek).")
    if request.week_parity not in [0, 1, 2]:
        raise HTTPException(status_code=400, detail="Nieprawidłowa parzystość tygodnia.")
    
    try:
        sh, sm = map(int, request.start_time.split(':'))
        eh, em = map(int, request.end_time.split(':'))
        if not (0 <= sh < 24 and 0 <= sm < 60 and 0 <= eh < 24 and 0 <= em < 60):
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format godziny. Użyj HH:MM.")
        
    if request.start_time >= request.end_time:
        raise HTTPException(status_code=400, detail="Godzina rozpoczęcia musi być wcześniejsza niż zakończenia.")

    teacher = db.query(models.Teacher).filter(models.Teacher.id == request.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Wybrany prowadzący nie istnieje.")
    
    conflict = check_teacher_collision(
        db, request.teacher_id, request.day_of_week, 
        request.start_time, request.end_time, request.week_parity
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Kolizja planu zajęć prowadzącego! W tym samym czasie prowadzi już: '{conflict.name}' ({conflict.start_time}-{conflict.end_time})."
        )
    
    new_class = models.Class(
        name=request.name.strip(),
        max_seats=request.max_seats,
        taken_seats=0,
        teacher_id=request.teacher_id,
        day_of_week=request.day_of_week,
        start_time=request.start_time,
        end_time=request.end_time,
        room=request.room.strip(),
        week_parity=request.week_parity
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip()
    log_activity(db, "teacher", teacher_name, "CREATE_CLASS", f"Utworzono zajęcia '{new_class.name}' w sali {new_class.room} (limit: {new_class.max_seats} miejsc)")
    
    return new_class

# Edytuj istniejące zajęcia (Wymaga uprawnień)
@app.put("/api/classes/{class_id}")
def update_class(class_id: int, request: ClassCreateRequest, db: Session = Depends(get_db)):
    course = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Zajęcia nie istnieją.")

    if course.teacher_id != request.teacher_id:
        raise HTTPException(
            status_code=403,
            detail="Brak uprawnień. Możesz edytować wyłącznie swoje zajęcia!"
        )
    
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Nazwa przedmiotu nie może być pusta.")
    if request.max_seats <= 0:
        raise HTTPException(status_code=400, detail="Liczba miejsc musi być większa od 0.")
    if request.day_of_week < 1 or request.day_of_week > 5:
        raise HTTPException(status_code=400, detail="Dzień tygodnia musi być w przedziale 1-5.")
    if request.week_parity not in [0, 1, 2]:
        raise HTTPException(status_code=400, detail="Nieprawidłowa parzystość tygodnia.")
    
    try:
        sh, sm = map(int, request.start_time.split(':'))
        eh, em = map(int, request.end_time.split(':'))
        if not (0 <= sh < 24 and 0 <= sm < 60 and 0 <= eh < 24 and 0 <= em < 60):
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format godziny. Użyj HH:MM.")
        
    if request.start_time >= request.end_time:
        raise HTTPException(status_code=400, detail="Godzina rozpoczęcia musi być wcześniejsza niż zakończenia.")

    teacher = db.query(models.Teacher).filter(models.Teacher.id == request.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Wybrany prowadzący nie istnieje.")
    
    conflict = check_teacher_collision(
        db, request.teacher_id, request.day_of_week, 
        request.start_time, request.end_time, request.week_parity,
        exclude_class_id=class_id
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Kolizja planu zajęć prowadzącego! W tym samym czasie prowadzi już: '{conflict.name}' ({conflict.start_time}-{conflict.end_time})."
        )
    
    course.name = request.name.strip()
    course.max_seats = request.max_seats
    course.teacher_id = request.teacher_id
    course.day_of_week = request.day_of_week
    course.start_time = request.start_time
    course.end_time = request.end_time
    course.room = request.room.strip()
    course.week_parity = request.week_parity
    
    db.commit()
    db.refresh(course)
    
    teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip()
    log_activity(db, "teacher", teacher_name, "EDIT_CLASS", f"Zaktualizowano zajęcia '{course.name}' (sala: {course.room}, limit: {course.max_seats} miejsc)")
    
    return course

# Usuń zajęcia (Wymaga uprawnień)
@app.delete("/api/classes/{class_id}")
def delete_class(class_id: int, teacher_id: int, db: Session = Depends(get_db)):
    course = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Zajęcia nie istnieją.")

    if course.teacher_id != teacher_id:
        raise HTTPException(
            status_code=403,
            detail="Brak uprawnień. Możesz usuwać wyłącznie swoje zajęcia!"
        )

    teacher = db.query(models.Teacher).filter(models.Teacher.id == course.teacher_id).first()
    teacher_name = f"{teacher.academic_title or ''} {teacher.first_name} {teacher.last_name}".strip() if teacher else "Nieznany prowadzący"
    course_name = course.name
        
    try:
        db.query(models.Enrollment).filter(models.Enrollment.class_id == class_id).delete()
        db.delete(course)
        db.commit()
        
        log_activity(db, "teacher", teacher_name, "DELETE_CLASS", f"Usunięto zajęcia '{course_name}'")
        
        return {"status": "success", "message": "Zajęcia zostały pomyślnie usunięte."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd serwera podczas usuwania: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)