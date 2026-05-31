from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Default to SQLite for development; override DATABASE_URL env var for PostgreSQL
DATABASE_URL = "sqlite:///./telecom.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite only
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
