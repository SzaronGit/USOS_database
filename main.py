from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import models
from database import engine, get_db

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
    db.commit()

app = FastAPI(title="Mini USOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Przy uruchomieniu automatycznie odświeżamy schemat i dane
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

@app.get("/api/students")
def get_students(db: Session = Depends(get_db)):
    """Pobierz listę wszystkich studentów"""
    return db.query(models.Student).order_by(models.Student.id).all()

@app.get("/api/classes")
def get_classes(db: Session = Depends(get_db)):
    """Pobierz listę wszystkich zajęć wraz z prowadzącym"""
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

@app.get("/api/students/{student_id}/schedule")
def get_student_schedule(student_id: int, db: Session = Depends(get_db)):
    """Pobierz plan zajęć danego studenta"""
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

@app.post("/api/enroll", status_code=status.HTTP_201_CREATED)
def enroll_student(request: EnrollmentRequest, db: Session = Depends(get_db)):
    """Zapisz studenta na zajęcia z użyciem blokowania pesymistycznego (FOR UPDATE)"""
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

    try:
        new_enrollment = models.Enrollment(
            student_id=request.student_id,
            class_id=request.class_id
        )
        db.add(new_enrollment)
        course.taken_seats += 1
        db.commit()

        return {"status": "success", "message": "Pomyślnie zapisano na zajęcia!"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Błąd serwera podczas zapisu."
        )

@app.post("/api/unenroll")
def unenroll_student(request: UnenrollmentRequest, db: Session = Depends(get_db)):
    """Wypisz studenta z zajęć"""
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
        
    try:
        db.delete(enrollment)
        if course.taken_seats > 0:
            course.taken_seats -= 1
        db.commit()
        return {"status": "success", "message": "Pomyślnie wypisano z zajęć!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Błąd serwera podczas wypisywania.")

@app.post("/api/reset-db")
def reset_database(db: Session = Depends(get_db)):
    """Zresetuj bazę danych do stanu domyślnego"""
    try:
        init_db(db)
        return {"status": "success", "message": "Baza danych została pomyślnie zresetowana!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd podczas resetowania bazy: {str(e)}")