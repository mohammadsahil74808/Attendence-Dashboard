from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings, BASE_DIR

db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///./"):
    rel_path = db_url[len("sqlite:///./"):]
    db_url = f"sqlite:///{BASE_DIR / rel_path}"

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    engine = create_engine(db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
