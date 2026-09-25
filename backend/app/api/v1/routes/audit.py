"""
Audit log route — admin sees all, members see their own actions only.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import AuditLog
from app.schemas import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("/", response_model=List[AuditLogResponse])
async def get_audit_logs(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(AuditLog)

    # Members only see their own actions
    if current_user.role != "admin":
        query = query.filter(AuditLog.changed_by_id == current_user.id)

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)

    return (query
            .order_by(AuditLog.timestamp.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all())
