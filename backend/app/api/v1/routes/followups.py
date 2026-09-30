"""
Follow-ups dedicated view — due today, overdue, upcoming across all contacts.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import FollowUp, FollowUpStatus, Contact, ContactStatus
from app.schemas import FollowUpResponse, FollowUpUpdate
from fastapi import HTTPException

router = APIRouter(prefix="/followups", tags=["follow-ups"])


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


from sqlalchemy import or_
from app.models import Registration, RegistrationStatus, College

@router.get("/", response_model=List[FollowUpResponse])
async def list_followups(
    view: str = Query("all", pattern="^(all|overdue|due_today|upcoming|completed|registered)$"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Auto-heal: Ensure any contact marked as follow_up_required with NO follow-ups gets a scheduled follow-up
    unlinked = (
        db.query(Contact)
        .filter(
            Contact.is_archived == False,
            Contact.contact_status == ContactStatus.follow_up_required,
            ~Contact.follow_ups.any(),
        )
        .all()
    )
    has_new = False
    for c in unlinked:
        fu = FollowUp(
            contact_id=c.id,
            followup_date=datetime.now(timezone.utc),
            reason=c.notes or "Follow-up required",
            assigned_to_id=c.assigned_to_id or current_user.id,
            status=FollowUpStatus.scheduled,
            priority="normal",
            created_from_type="manual",
        )
        db.add(fu)
        has_new = True

    # Ensure any registered contacts have at least one follow-up record for visibility
    unlinked_registered = (
        db.query(Contact)
        .filter(
            Contact.is_archived == False,
            or_(
                Contact.contact_status == ContactStatus.registered,
                Contact.registrations.any(Registration.status == RegistrationStatus.registered),
            ),
            ~Contact.follow_ups.any(),
        )
        .all()
    )
    for c in unlinked_registered:
        fu = FollowUp(
            contact_id=c.id,
            followup_date=c.updated_at or c.created_at or datetime.now(timezone.utc),
            reason="Registered College / Contact",
            assigned_to_id=c.assigned_to_id or current_user.id,
            status=FollowUpStatus.completed,
            priority="normal",
            created_from_type="manual",
        )
        db.add(fu)
        has_new = True

    if has_new:
        db.commit()

    query = db.query(FollowUp).join(Contact, FollowUp.contact_id == Contact.id).filter(Contact.is_archived == False)

    if view == "overdue":
        query = query.filter(
            FollowUp.status == FollowUpStatus.scheduled,
            FollowUp.followup_date < today_start,
        )
    elif view == "due_today":
        query = query.filter(
            FollowUp.status == FollowUpStatus.scheduled,
            FollowUp.followup_date >= today_start,
            FollowUp.followup_date <= today_end,
        )
    elif view == "upcoming":
        query = query.filter(
            FollowUp.status == FollowUpStatus.scheduled,
            FollowUp.followup_date > today_end,
        )
    elif view == "completed":
        query = query.filter(FollowUp.status == FollowUpStatus.completed)
    elif view == "registered":
        query = query.filter(
            or_(
                Contact.contact_status == ContactStatus.registered,
                Contact.registrations.any(Registration.status == RegistrationStatus.registered),
                Contact.college.has(College.is_registered == True),
            )
        )
    else:
        query = query.filter(FollowUp.status == FollowUpStatus.scheduled)

    fus = query.order_by(FollowUp.followup_date.desc() if view == "registered" else FollowUp.followup_date.asc()).all()
    result = []
    for fu in fus:
        r = FollowUpResponse.model_validate(fu)
        r.is_overdue = fu.status == FollowUpStatus.scheduled and _to_utc(fu.followup_date) < now
        r.contact_name = fu.contact.name if fu.contact else None
        r.contact_phone = fu.contact.phone if fu.contact else None
        r.contact_organization = fu.contact.organization if fu.contact else None
        r.contact_status = fu.contact.contact_status.value if fu.contact and fu.contact.contact_status else None
        reg = fu.contact.registrations[-1] if (fu.contact and fu.contact.registrations) else None
        r.registration_status = reg.status.value if reg else "not_registered"
        result.append(r)
    return result


@router.patch("/{followup_id}", response_model=FollowUpResponse)
async def update_followup(
    followup_id: int,
    body: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to update follow-ups")

    fu = db.query(FollowUp).filter(FollowUp.id == followup_id).first()
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    old_status = fu.status.value if hasattr(fu.status, "value") else str(fu.status)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(fu, field, val)

    if body.status and old_status != body.status:
        from app.models import AuditLog
        log = AuditLog(
            entity_type="follow_up",
            entity_id=fu.id,
            changed_by_id=current_user.id,
            action="status_changed",
            field_changed="status",
            old_value=old_status,
            new_value=body.status,
        )
        db.add(log)

        # If completed, and contact is follow_up_required, transition contact to contacted if no other scheduled follow-ups
        if body.status == "completed" and fu.contact and fu.contact.contact_status == ContactStatus.follow_up_required:
            other_open = db.query(FollowUp).filter(
                FollowUp.contact_id == fu.contact_id,
                FollowUp.id != fu.id,
                FollowUp.status == FollowUpStatus.scheduled,
            ).first()
            if not other_open:
                old_cs = fu.contact.contact_status.value
                fu.contact.contact_status = ContactStatus.contacted
                c_log = AuditLog(
                    entity_type="contact",
                    entity_id=fu.contact.id,
                    changed_by_id=current_user.id,
                    action="updated",
                    field_changed="contact_status",
                    old_value=old_cs,
                    new_value="contacted",
                )
                db.add(c_log)

    db.commit()
    db.refresh(fu)
    now = datetime.now(timezone.utc)
    r = FollowUpResponse.model_validate(fu)
    r.is_overdue = fu.status == FollowUpStatus.scheduled and _to_utc(fu.followup_date) < now
    r.contact_name = fu.contact.name if fu.contact else None
    r.contact_phone = fu.contact.phone if fu.contact else None
    r.contact_organization = fu.contact.organization if fu.contact else None
    return r
