import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/windmill_scanner.db")

# SQLite requires check_same_thread=False when used with FastAPI's thread pool
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency: provides a SQLAlchemy session, closes on exit."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
