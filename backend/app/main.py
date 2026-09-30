"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import api_router
from app.core.database import engine, Base

import sqlalchemy

# Create all tables on startup (use Alembic migrations in production)
Base.metadata.create_all(bind=engine)

# Auto-migrate contacts.college_id if using SQLite and column missing
try:
    with engine.connect() as conn:
        res = conn.execute(sqlalchemy.text("PRAGMA table_info(contacts)"))
        cols = [r[1] for r in res.fetchall()]
        if cols and "college_id" not in cols:
            conn.execute(sqlalchemy.text("ALTER TABLE contacts ADD COLUMN college_id INTEGER"))
            conn.commit()
except Exception:
    pass


def ensure_default_users():
    from app.core.database import SessionLocal
    from app.models import User, UserRole, College, Contact, ContactStatus
    from app.core.security import get_password_hash
    db = SessionLocal()
    try:
        # Primary Administrator
        sahil = db.query(User).filter(User.email == "sahilansari74808@gmail.com").first()
        if not sahil:
            sahil = User(
                name="Sahil Ansari",
                email="sahilansari74808@gmail.com",
                password_hash=get_password_hash("admin123"),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(sahil)
        else:
            sahil.role = UserRole.admin
            sahil.is_active = True

        admin = db.query(User).filter(User.email == "admin@fms.internal").first()
        if not admin:
            admin = User(
                name="System Administrator",
                email="admin@fms.internal",
                password_hash=get_password_hash("admin123"),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)

        # Seed default college if none exist
        default_college = db.query(College).first()
        if not default_college:
            default_college = College(
                name="Lingayas Vidyapeeth",
                code="LV-01",
                city="Faridabad",
                state="Haryana",
                status="registered",
                is_registered=True,
                notes="Primary partner institution",
            )
            db.add(default_college)
            db.flush()

        # Seed default contact if database is fresh/empty
        if db.query(Contact).filter(Contact.is_archived == False).count() == 0:
            sample_contact = Contact(
                name="Sahil Ansari",
                organization="Lingayas Vidyapeeth",
                designation="Faridabad",
                phone="9289345249",
                email="sahilansari74808@gmail.com",
                contact_status=ContactStatus.interested,
                college_id=default_college.id if default_college else None,
                is_archived=False,
            )
            db.add(sample_contact)

        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()


ensure_default_users()

app = FastAPI(
    title="Follow-Up Management System API",
    description="Internal tool for managing outreach contacts, attempts, feedback, and registration.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "fms-api"}
