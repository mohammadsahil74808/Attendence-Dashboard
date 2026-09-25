"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import api_router
from app.core.database import engine, Base

# Create all tables on startup (use Alembic migrations in production)
Base.metadata.create_all(bind=engine)


def ensure_default_users():
    from app.core.database import SessionLocal
    from app.models import User, UserRole
    from app.core.security import get_password_hash
    db = SessionLocal()
    try:
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
        member = db.query(User).filter(User.email == "member@fms.internal").first()
        if not member:
            member = User(
                name="Sarah Outreach",
                email="member@fms.internal",
                password_hash=get_password_hash("member123"),
                role=UserRole.member,
                is_active=True,
            )
            db.add(member)

        # Seed default contact if database is fresh/empty
        from app.models import Contact, ContactStatus
        if db.query(Contact).filter(Contact.is_archived == False).count() == 0:
            sample_contact = Contact(
                name="Sahil Ansari",
                organization="lingayas vidyapeeth",
                designation="faridabad",
                phone="9289345249",
                email="sahilansari74808@gmail.com",
                contact_status=ContactStatus.interested,
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
