from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from database import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    academic_title = Column(String(20))


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    index_number = Column(String(10), unique=True, nullable=False)


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    max_seats = Column(Integer, nullable=False)
    taken_seats = Column(Integer, default=0)
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)
    room = Column(String(20), nullable=False)
    week_parity = Column(Integer, default=0)        # 0 = co tydzień, 1 = TP (parzyste), 2 = TN (nieparzyste)


class Enrollment(Base):
    __tablename__ = "enrollments"

    student_id = Column(Integer, ForeignKey("students.id"), primary_key=True)
    class_id = Column(Integer, ForeignKey("classes.id"), primary_key=True)
    enrollment_date = Column(DateTime, default=func.now())