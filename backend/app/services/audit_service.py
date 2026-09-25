"""
Audit log service — creates append-only audit entries.
Used by all routes that modify Contact Status, Registration Status, Assignment, and core contact fields.
"""
from sqlalchemy.orm import Session
from app.models import AuditLog


def log_audit(
    db: Session,
    *,
    entity_type: str,
    entity_id: int,
    changed_by_id: int,
    action: str,
    field_changed: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        changed_by_id=changed_by_id,
        action=action,
        field_changed=field_changed,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
    )
    db.add(entry)
    # Note: caller is responsible for db.commit()
    return entry
