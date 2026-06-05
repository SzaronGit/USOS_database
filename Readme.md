# Opis projektu
**ASRPweb**, czyli **Akademicki System Rezerwacji Przedmiotów** to nowoczesna platforma służąca przede wszystkim studentom do rejestrowania się do zajęć prowadzonych na danej uczelni. Z Systemu korzystają również prowadzący, którzy mogą na bieżąco dodawać, usuwać czy modyfikować prowadzone przez nich zajęcia. Zarówno studenci jak i prowadzący mają wgląd do całego swojego planu, szczegółowych informacji o każdym prowadzonym przedmiocie na uczelni, a także dostęp do indywidualnej historii aktywności na platformie.

# Autorzy
Autorami projektu są **Szymon Kuźba** i **Kacper Mucha**.

# Wykorzystane technologie
**Serwer**: Relacyjna baza danych PostgreSQL / SQLite \
**Backend**: Python, FastAPI, SQLAlchemy, Pydanic, Uvicorn\
**Frontend**: HTML5, CSS3, Vanilia JavaScript

# Uruchomienie projektu
1. Ściągnij repozytorium za pomocą `git clone`.
2. Utwórz środowisko dla Python (wersja 3.9+) oraz działający serwer PostgreSQL / gotowość użycia wbudowanego SQLite. Możesz też uruchomić projekt przez Docker.
3. Zainstaluj paczki `pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic`.
4. Uruchom serwer za pomocą `uvicorn main:app --reload`.
5. Otwórz plik `index.html` przez dowolną przeglądarkę uzyskujac dostęp.

Alternatywnie (szybki start): Możesz pominąć kroki 2-4, uruchamiając projekt za pomocą Dockera (`docker-compose up`) i od razu przejść do ostatniego kroku.

# Szczegółowa dokumentacja
Cały raport projektu z opisem bazy danych, operacji i technologii znajduje się w pliku `Report_ASRPweb.pdf`
