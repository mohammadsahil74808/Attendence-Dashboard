"""
Contacts routes — full CRUD + attempts, feedback, registration, follow-ups, bulk ops, and export.
Row-level security: Team Members can only access contacts where assigned_to_id = current_user.id.
"""
import io
from datetime import datetime, timezone, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
import pandas as pd

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import (
    Contact, ContactAttempt, Feedback, Registration, FollowUp,
    ContactStatus, RegistrationStatus, FollowUpStatus, AuditLog
)
from app.schemas import (
    ContactCreate, ContactUpdate, ContactResponse, ContactListItem,
    PaginatedContacts, AttemptCreate, AttemptResponse,
    FeedbackCreate, FeedbackResponse,
    RegistrationCreate, RegistrationUpdate, RegistrationResponse,
    FollowUpCreate, FollowUpUpdate, FollowUpResponse,
    BulkAction, AuditLogResponse,
)
from app.services.audit_service import log_audit

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _apply_row_security(query, current_user, db):
    """Allow all authenticated users (Admin and Member) to view contacts."""
    return query


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _compute_derived_fields(contact: Contact, db: Session) -> dict:
    """Compute registration_status, feedback_status, next_followup_date, last_attempt_date."""
    now = datetime.now(timezone.utc)

    # Latest registration
    reg = (db.query(Registration)
           .filter(Registration.contact_id == contact.id)
           .order_by(Registration.created_at.desc())
           .first())
    registration_status = reg.status.value if reg else "not_registered"

    # Active follow-up (Scheduled status)
    active_fu = (db.query(FollowUp)
                 .filter(FollowUp.contact_id == contact.id,
                         FollowUp.status == FollowUpStatus.scheduled)
                 .order_by(FollowUp.followup_date.asc())
                 .first())
    next_followup_date = active_fu.followup_date if active_fu else None
    is_overdue = bool(active_fu and _to_utc(active_fu.followup_date) < now)

    # Last attempt
    last_attempt = (db.query(ContactAttempt)
                    .filter(ContactAttempt.contact_id == contact.id,
                            ContactAttempt.is_voided == False)
                    .order_by(ContactAttempt.occurred_at.desc())
                    .first())
    last_attempt_date = last_attempt.occurred_at if last_attempt else None

    # Feedback status
    latest_fb = (db.query(Feedback)
                 .filter(Feedback.contact_id == contact.id)
                 .order_by(Feedback.created_at.desc())
                 .first())
    if not latest_fb:
        feedback_status = "no_feedback_yet"
    elif latest_fb.followup_required_bool and (not latest_fb.next_followup_date or _to_utc(latest_fb.next_followup_date) > now):
        feedback_status = "feedback_received_followup_pending"
    else:
        feedback_status = "feedback_received"

    return {
        "registration_status": registration_status,
        "next_followup_date": next_followup_date,
        "last_attempt_date": last_attempt_date,
        "feedback_status": feedback_status,
        "is_overdue": is_overdue,
    }


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedContacts)
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    contact_status: Optional[str] = Query(None),
    registration_status: Optional[str] = Query(None),
    feedback_status: Optional[str] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    organization: Optional[str] = Query(None),
    import_batch_id: Optional[int] = Query(None),
    overdue_only: bool = Query(False),
    followup_date_from: Optional[date] = Query(None),
    followup_date_to: Optional[date] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    is_archived: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Contact).filter(Contact.is_archived == is_archived)
    query = _apply_row_security(query, current_user, db)

    # Filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(or_(
            Contact.name.ilike(search_term),
            Contact.phone.ilike(search_term),
            Contact.email.ilike(search_term),
            Contact.organization.ilike(search_term),
        ))
    if contact_status:
        query = query.filter(Contact.contact_status == contact_status)
    if organization:
        query = query.filter(Contact.organization.ilike(f"%{organization}%"))
    if assigned_to_id:
        query = query.filter(Contact.assigned_to_id == assigned_to_id)
    if import_batch_id:
        query = query.filter(Contact.import_batch_id == import_batch_id)

    # Sorting
    sort_col = getattr(Contact, sort_by, Contact.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    contacts = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    now = datetime.now(timezone.utc)
    for c in contacts:
        derived = _compute_derived_fields(c, db)

        # Apply derived filters post-query (registration_status, feedback_status, overdue_only)
        if registration_status and derived["registration_status"] != registration_status:
            continue
        if feedback_status and derived["feedback_status"] != feedback_status:
            continue
        if overdue_only and not derived["is_overdue"]:
            continue

        items.append(ContactListItem(
            id=c.id,
            name=c.name,
            organization=c.organization,
            phone=c.phone,
            email=c.email,
            contact_status=c.contact_status.value,
            assigned_to_id=c.assigned_to_id,
            assigned_to_name=c.assigned_to.name if c.assigned_to else None,
            registration_status=derived["registration_status"],
            next_followup_date=derived["next_followup_date"],
            last_attempt_date=derived["last_attempt_date"],
            feedback_status=derived["feedback_status"],
            is_overdue=derived["is_overdue"],
            created_at=c.created_at,
        ))

    return PaginatedContacts(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


# ─── Create ───────────────────────────────────────────────────────────────────

@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    body: ContactCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to create contacts")

    # Duplicate check (phone → email)
    if body.phone:
        existing = db.query(Contact).filter(
            Contact.phone == body.phone, Contact.is_archived == False
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Contact with phone {body.phone} already exists (id={existing.id})")
    if body.email:
        existing = db.query(Contact).filter(
            Contact.email == body.email, Contact.is_archived == False
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Contact with email {body.email} already exists (id={existing.id})")

    data = body.model_dump()
    followup_date = data.pop("followup_date", None)
    preferred_time = data.pop("preferred_time", None)
    followup_reason = data.pop("followup_reason", None)

    contact = Contact(**data)
    db.add(contact)
    db.flush()
    log_audit(db, entity_type="contact", entity_id=contact.id,
              changed_by_id=current_user.id, action="created")

    if contact.contact_status == ContactStatus.follow_up_required:
        fu_date = followup_date or datetime.now(timezone.utc)
        fu = FollowUp(
            contact_id=contact.id,
            followup_date=fu_date,
            preferred_time=preferred_time,
            reason=followup_reason or contact.notes or "Follow-up required",
            assigned_to_id=contact.assigned_to_id or current_user.id,
            status=FollowUpStatus.scheduled,
            priority="normal",
            created_from_type="manual",
        )
        db.add(fu)
        db.flush()
        log_audit(db, entity_type="follow_up", entity_id=fu.id,
                  changed_by_id=current_user.id, action="created",
                  new_value=str(fu.followup_date))

    db.commit()
    db.refresh(contact)

    derived = _compute_derived_fields(contact, db)
    resp = ContactResponse.model_validate(contact)
    resp.registration_status = derived["registration_status"]
    resp.next_followup_date = derived["next_followup_date"]
    resp.feedback_status = derived["feedback_status"]
    return resp


# ─── Export ───────────────────────────────────────────────────────────────────

@router.get("/export")
async def export_contacts(
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    search: Optional[str] = Query(None),
    contact_status: Optional[str] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    organization: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Contact).filter(Contact.is_archived == False)
    query = _apply_row_security(query, current_user, db)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Contact.name.ilike(s), Contact.phone.ilike(s), Contact.email.ilike(s)))
    if contact_status:
        query = query.filter(Contact.contact_status == contact_status)
    if assigned_to_id:
        query = query.filter(Contact.assigned_to_id == assigned_to_id)
    if organization:
        query = query.filter(Contact.organization.ilike(f"%{organization}%"))

    contacts = query.all()
    rows = []
    for c in contacts:
        derived = _compute_derived_fields(c, db)
        rows.append({
            "ID": c.id,
            "Name": c.name,
            "Organization": c.organization,
            "Designation": c.designation,
            "Phone": c.phone,
            "WhatsApp": c.whatsapp,
            "Email": c.email,
            "City": c.city,
            "Source": c.source,
            "Contact Status": c.contact_status.value if c.contact_status else "",
            "Registration Status": derived["registration_status"],
            "Feedback Status": derived["feedback_status"],
            "Next Follow-Up": str(derived["next_followup_date"]) if derived["next_followup_date"] else "",
            "Last Attempt": str(derived["last_attempt_date"]) if derived["last_attempt_date"] else "",
            "Assigned To": c.assigned_to.name if c.assigned_to else "",
            "Notes": c.notes,
            "Created At": str(c.created_at),
        })

    export_columns = [
        "ID", "Name", "Organization", "Designation", "Phone", "WhatsApp",
        "Email", "City", "Source", "Contact Status", "Registration Status",
        "Feedback Status", "Next Follow-Up", "Last Attempt", "Assigned To",
        "Notes", "Created At"
    ]
    df = pd.DataFrame(rows, columns=export_columns)
    buf = io.BytesIO()

    if format == "csv":
        df.to_csv(buf, index=False, encoding="utf-8-sig")
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=contacts.csv",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    else:
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Contacts")
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=contacts.xlsx",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )


# ─── Get Detail ───────────────────────────────────────────────────────────────

@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Contact).filter(Contact.id == contact_id, Contact.is_archived == False)
    q = _apply_row_security(q, current_user, db)
    contact = q.first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    derived = _compute_derived_fields(contact, db)
    resp = ContactResponse.model_validate(contact)
    resp.registration_status = derived["registration_status"]
    resp.next_followup_date = derived["next_followup_date"]
    resp.feedback_status = derived["feedback_status"]
    resp.last_attempt_date = derived["last_attempt_date"]
    return resp


# ─── Update ───────────────────────────────────────────────────────────────────

@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to edit contacts")

    q = db.query(Contact).filter(Contact.id == contact_id, Contact.is_archived == False)
    q = _apply_row_security(q, current_user, db)
    contact = q.first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    update_data = body.model_dump(exclude_unset=True)
    audited_fields = {"contact_status", "assigned_to_id"}

    for field, new_val in update_data.items():
        old_val = getattr(contact, field, None)
        # Handle enum serialization
        if hasattr(old_val, "value"):
            old_val = old_val.value
        if str(old_val) != str(new_val) and field in audited_fields:
            log_audit(db, entity_type="contact", entity_id=contact_id,
                      changed_by_id=current_user.id, action="updated",
                      field_changed=field, old_value=old_val, new_value=new_val)
        setattr(contact, field, new_val)

    if contact.contact_status == ContactStatus.follow_up_required:
        active_fu = db.query(FollowUp).filter(
            FollowUp.contact_id == contact.id,
            FollowUp.status == FollowUpStatus.scheduled,
        ).first()
        if not active_fu:
            fu = FollowUp(
                contact_id=contact.id,
                followup_date=datetime.now(timezone.utc),
                reason=contact.notes or "Follow-up required",
                assigned_to_id=contact.assigned_to_id or current_user.id,
                status=FollowUpStatus.scheduled,
                priority="normal",
                created_from_type="manual",
            )
            db.add(fu)
            db.flush()
            log_audit(db, entity_type="follow_up", entity_id=fu.id,
                      changed_by_id=current_user.id, action="created",
                      new_value=str(fu.followup_date))

    db.commit()
    db.refresh(contact)
    derived = _compute_derived_fields(contact, db)
    resp = ContactResponse.model_validate(contact)
    resp.registration_status = derived["registration_status"]
    resp.next_followup_date = derived["next_followup_date"]
    resp.feedback_status = derived["feedback_status"]
    return resp


# ─── Archive / Delete / Restore ───────────────────────────────────────────────

@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_contact(
    contact_id: int,
    permanent: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to delete contacts")
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if permanent:
        # Hard delete: permanently remove from database and free up storage
        db.query(FollowUp).filter(FollowUp.contact_id == contact_id).delete(synchronize_session=False)
        db.query(Feedback).filter(Feedback.contact_id == contact_id).delete(synchronize_session=False)
        db.query(Registration).filter(Registration.contact_id == contact_id).delete(synchronize_session=False)
        db.query(ContactAttempt).filter(ContactAttempt.contact_id == contact_id).delete(synchronize_session=False)
        db.query(AuditLog).filter(AuditLog.entity_type == "contact", AuditLog.entity_id == contact_id).delete(synchronize_session=False)
        db.delete(contact)
        db.commit()
        return

    # Soft delete: move to trash
    contact.is_archived = True
    contact.archived_at = datetime.now(timezone.utc)
    contact.archived_by_id = current_user.id
    log_audit(db, entity_type="contact", entity_id=contact_id,
              changed_by_id=current_user.id, action="archived")
    db.commit()


@router.post("/{contact_id}/restore", status_code=status.HTTP_200_OK)
async def restore_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to restore contacts")
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact.is_archived = False
    contact.archived_at = None
    contact.archived_by_id = None
    log_audit(db, entity_type="contact", entity_id=contact_id,
              changed_by_id=current_user.id, action="restored")
    db.commit()
    return {"message": "Contact restored successfully", "id": contact.id}


# ─── Contact Attempts ─────────────────────────────────────────────────────────

@router.get("/{contact_id}/attempts", response_model=List[AttemptResponse])
async def get_attempts(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Contact).filter(Contact.id == contact_id)
    q = _apply_row_security(q, current_user, db)
    if not q.first():
        raise HTTPException(status_code=404, detail="Contact not found")
    return (db.query(ContactAttempt)
            .filter(ContactAttempt.contact_id == contact_id)
            .order_by(ContactAttempt.occurred_at.asc())
            .all())


@router.post("/{contact_id}/attempts", response_model=AttemptResponse, status_code=201)
async def create_attempt(
    contact_id: int,
    body: AttemptCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to log attempts")

    q = db.query(Contact).filter(Contact.id == contact_id, Contact.is_archived == False)
    q = _apply_row_security(q, current_user, db)
    contact = q.first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Auto-increment attempt number
    count = db.query(func.count(ContactAttempt.id)).filter(
        ContactAttempt.contact_id == contact_id
    ).scalar()

    attempt = ContactAttempt(
        contact_id=contact_id,
        attempt_number=count + 1,
        occurred_at=body.occurred_at or datetime.now(timezone.utc),
        method=body.method,
        performed_by_id=current_user.id,
        outcome=body.outcome,
        notes=body.notes,
    )
    db.add(attempt)
    db.flush()

    log_audit(db, entity_type="attempt", entity_id=attempt.id,
              changed_by_id=current_user.id, action="created",
              new_value=f"method={body.method}, outcome={body.outcome}")

    # Auto-schedule follow-up if provided
    if body.next_followup_date:
        # Supersede any existing open follow-up
        db.query(FollowUp).filter(
            FollowUp.contact_id == contact_id,
            FollowUp.status == FollowUpStatus.scheduled,
        ).update({"status": FollowUpStatus.superseded})

        fu = FollowUp(
            contact_id=contact_id,
            followup_date=body.next_followup_date,
            reason=body.followup_reason,
            assigned_to_id=body.followup_assigned_to_id or contact.assigned_to_id,
            status=FollowUpStatus.scheduled,
            created_from_type="attempt",
            created_from_id=attempt.id,
        )
        db.add(fu)

    db.commit()
    db.refresh(attempt)
    return attempt


# ─── Feedback ─────────────────────────────────────────────────────────────────

@router.get("/{contact_id}/feedback", response_model=List[FeedbackResponse])
async def get_feedback(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Contact).filter(Contact.id == contact_id)
    q = _apply_row_security(q, current_user, db)
    if not q.first():
        raise HTTPException(status_code=404, detail="Contact not found")
    return db.query(Feedback).filter(Feedback.contact_id == contact_id).all()


@router.post("/{contact_id}/feedback", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    contact_id: int,
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to record feedback")

    q = db.query(Contact).filter(Contact.id == contact_id, Contact.is_archived == False)
    q = _apply_row_security(q, current_user, db)
    contact = q.first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    fb = Feedback(
        contact_id=contact_id,
        contact_attempt_id=body.contact_attempt_id,
        received_bool=body.received_bool,
        feedback_date=body.feedback_date or datetime.now(timezone.utc),
        category=body.category,
        details=body.details,
        followup_required_bool=body.followup_required_bool,
        next_followup_date=body.next_followup_date,
    )
    db.add(fb)
    db.flush()

    log_audit(db, entity_type="feedback", entity_id=fb.id,
              changed_by_id=current_user.id, action="created",
              new_value=f"received={body.received_bool}, followup_required={body.followup_required_bool}")

    # Auto-schedule follow-up if required
    if body.followup_required_bool and body.next_followup_date:
        db.query(FollowUp).filter(
            FollowUp.contact_id == contact_id,
            FollowUp.status == FollowUpStatus.scheduled,
        ).update({"status": FollowUpStatus.superseded})

        fu = FollowUp(
            contact_id=contact_id,
            followup_date=body.next_followup_date,
            assigned_to_id=contact.assigned_to_id,
            status=FollowUpStatus.scheduled,
            created_from_type="feedback",
            created_from_id=fb.id,
        )
        db.add(fu)

    db.commit()
    db.refresh(fb)
    return fb


# ─── Registration ─────────────────────────────────────────────────────────────

@router.get("/{contact_id}/registration", response_model=RegistrationResponse)
async def get_registration(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Contact).filter(Contact.id == contact_id)
    q = _apply_row_security(q, current_user, db)
    if not q.first():
        raise HTTPException(status_code=404, detail="Contact not found")
    reg = db.query(Registration).filter(Registration.contact_id == contact_id).order_by(Registration.created_at.desc()).first()
    if not reg:
        raise HTTPException(status_code=404, detail="No registration record found")
    return reg


@router.post("/{contact_id}/registration", response_model=RegistrationResponse, status_code=201)
async def create_or_update_registration(
    contact_id: int,
    body: RegistrationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    PRD §13.2: Registration Status is FULLY INDEPENDENT of Contact Status.
    This endpoint NEVER modifies contact_status.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to update registration")

    q = db.query(Contact).filter(Contact.id == contact_id, Contact.is_archived == False)
    q = _apply_row_security(q, current_user, db)
    contact = q.first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    existing = db.query(Registration).filter(Registration.contact_id == contact_id).order_by(Registration.created_at.desc()).first()
    old_status = existing.status.value if existing else "none"

    if existing:
        for field, val in body.model_dump(exclude_unset=True).items():
            setattr(existing, field, val)
        reg = existing
    else:
        reg = Registration(contact_id=contact_id, **body.model_dump())
        db.add(reg)

    db.flush()
    log_audit(db, entity_type="registration", entity_id=reg.id,
              changed_by_id=current_user.id, action="updated",
              field_changed="status", old_value=old_status, new_value=body.status)
    db.commit()
    db.refresh(reg)
    return reg


# ─── Follow-Ups ───────────────────────────────────────────────────────────────

@router.get("/{contact_id}/followups", response_model=List[FollowUpResponse])
async def get_followups(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Contact).filter(Contact.id == contact_id)
    q = _apply_row_security(q, current_user, db)
    if not q.first():
        raise HTTPException(status_code=404, detail="Contact not found")
    fus = db.query(FollowUp).filter(FollowUp.contact_id == contact_id).order_by(FollowUp.followup_date.asc()).all()
    now = datetime.now(timezone.utc)
    result = []
    for fu in fus:
        r = FollowUpResponse.model_validate(fu)
        r.is_overdue = fu.status == FollowUpStatus.scheduled and _to_utc(fu.followup_date) < now
        r.contact_name = contact.name if 'contact' in locals() and contact else (fu.contact.name if fu.contact else None)
        r.contact_phone = fu.contact.phone if fu.contact else None
        r.contact_organization = fu.contact.organization if fu.contact else None
        result.append(r)
    return result


@router.post("/{contact_id}/followups", response_model=FollowUpResponse, status_code=201)
async def create_followup(
    contact_id: int,
    body: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to schedule follow-ups")

    q = db.query(Contact).filter(Contact.id == contact_id, Contact.is_archived == False)
    q = _apply_row_security(q, current_user, db)
    contact = q.first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # PRD §14.2: Supersede existing open follow-up
    db.query(FollowUp).filter(
        FollowUp.contact_id == contact_id,
        FollowUp.status == FollowUpStatus.scheduled,
    ).update({"status": FollowUpStatus.superseded})

    fu = FollowUp(
        contact_id=contact_id,
        followup_date=body.followup_date,
        preferred_time=body.preferred_time,
        reason=body.reason,
        assigned_to_id=body.assigned_to_id or contact.assigned_to_id,
        priority=body.priority,
        status=FollowUpStatus.scheduled,
        created_from_type=body.created_from_type,
        created_from_id=body.created_from_id,
    )
    db.add(fu)

    # Sync contact status if not closed/registered/not_interested
    if contact.contact_status not in [ContactStatus.registered, ContactStatus.closed, ContactStatus.not_interested]:
        old_st = contact.contact_status.value if hasattr(contact.contact_status, "value") else str(contact.contact_status)
        contact.contact_status = ContactStatus.follow_up_required
        log_audit(db, entity_type="contact", entity_id=contact.id,
                  changed_by_id=current_user.id, action="updated",
                  field_changed="contact_status", old_value=old_st, new_value="follow_up_required")

    db.flush()
    log_audit(db, entity_type="follow_up", entity_id=fu.id,
              changed_by_id=current_user.id, action="created",
              new_value=str(body.followup_date))
    db.commit()
    db.refresh(fu)
    now = datetime.now(timezone.utc)
    r = FollowUpResponse.model_validate(fu)
    r.is_overdue = fu.status == FollowUpStatus.scheduled and _to_utc(fu.followup_date) < now
    r.contact_name = contact.name
    r.contact_phone = contact.phone
    r.contact_organization = contact.organization
    return r


# ─── Audit Log for a Contact ──────────────────────────────────────────────────

@router.get("/{contact_id}/audit", response_model=List[AuditLogResponse])
async def get_contact_audit(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Contact).filter(Contact.id == contact_id)
    q = _apply_row_security(q, current_user, db)
    if not q.first():
        raise HTTPException(status_code=404, detail="Contact not found")
    return (db.query(AuditLog)
            .filter(AuditLog.entity_type == "contact", AuditLog.entity_id == contact_id)
            .order_by(AuditLog.timestamp.desc())
            .all())


# ─── Bulk Actions ─────────────────────────────────────────────────────────────

@router.post("/bulk", status_code=200)
async def bulk_action(
    body: BulkAction,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required for bulk actions")

    if body.action in ["restore", "delete_permanent"]:
        q = db.query(Contact).filter(Contact.id.in_(body.contact_ids))
    else:
        q = db.query(Contact).filter(Contact.id.in_(body.contact_ids), Contact.is_archived == False)
    q = _apply_row_security(q, current_user, db)
    contacts = q.all()

    if not contacts:
        raise HTTPException(status_code=404, detail="No matching contacts found")

    for contact in contacts:
        if body.action == "assign":
            old_val = contact.assigned_to_id
            contact.assigned_to_id = int(body.value) if body.value else None
            log_audit(db, entity_type="contact", entity_id=contact.id,
                      changed_by_id=current_user.id, action="updated",
                      field_changed="assigned_to_id", old_value=old_val, new_value=body.value)
        elif body.action == "change_status":
            old_val = contact.contact_status.value if contact.contact_status else None
            contact.contact_status = body.value
            log_audit(db, entity_type="contact", entity_id=contact.id,
                      changed_by_id=current_user.id, action="updated",
                      field_changed="contact_status", old_value=old_val, new_value=body.value)
            if body.value == "follow_up_required":
                active_fu = db.query(FollowUp).filter(
                    FollowUp.contact_id == contact.id,
                    FollowUp.status == FollowUpStatus.scheduled,
                ).first()
                if not active_fu:
                    fu = FollowUp(
                        contact_id=contact.id,
                        followup_date=datetime.now(timezone.utc),
                        reason=contact.notes or "Follow-up required",
                        assigned_to_id=contact.assigned_to_id or current_user.id,
                        status=FollowUpStatus.scheduled,
                        priority="normal",
                        created_from_type="manual",
                    )
                    db.add(fu)
        elif body.action == "archive" and current_user.role == "admin":
            contact.is_archived = True
            contact.archived_at = datetime.now(timezone.utc)
            contact.archived_by_id = current_user.id
            log_audit(db, entity_type="contact", entity_id=contact.id,
                      changed_by_id=current_user.id, action="archived")
        elif body.action == "restore" and current_user.role == "admin":
            contact.is_archived = False
            contact.archived_at = None
            contact.archived_by_id = None
            log_audit(db, entity_type="contact", entity_id=contact.id,
                      changed_by_id=current_user.id, action="restored")
        elif body.action == "delete_permanent" and current_user.role == "admin":
            db.query(FollowUp).filter(FollowUp.contact_id == contact.id).delete(synchronize_session=False)
            db.query(Feedback).filter(Feedback.contact_id == contact.id).delete(synchronize_session=False)
            db.query(Registration).filter(Registration.contact_id == contact.id).delete(synchronize_session=False)
            db.query(ContactAttempt).filter(ContactAttempt.contact_id == contact.id).delete(synchronize_session=False)
            db.query(AuditLog).filter(AuditLog.entity_type == "contact", AuditLog.entity_id == contact.id).delete(synchronize_session=False)
            db.delete(contact)

    db.commit()
    return {"updated": len(contacts)}
