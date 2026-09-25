from fastapi import APIRouter
from app.api.v1.routes import auth, users, contacts, imports, dashboard, followups, audit

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(contacts.router)
api_router.include_router(imports.router)
api_router.include_router(dashboard.router)
api_router.include_router(followups.router)
api_router.include_router(audit.router)
