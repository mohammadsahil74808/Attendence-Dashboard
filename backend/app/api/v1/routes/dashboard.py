"""
Dashboard summary — all metric cards from PRD §15.1.
Scoped to current user's contacts for Team Members, team-wide for Admins.
Every metric maps to a filterable contact list (per PRD §15.4).
"""
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Contact, FollowUp, ContactAttempt, Registration, RegistrationStatus, FollowUpStatus
from app.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    base = db.query(Contact).filter(Contact.is_archived == False)
    contact_ids = [c.id for c in base.with_entities(Contact.id).all()]

    def count_by_status(status_val):
        return base.filter(Contact.contact_status == status_val).count()

    # Registration stats
    registered_contacts = (
        db.query(func.count(Registration.id))
        .filter(
            Registration.contact_id.in_(contact_ids),
            Registration.status == RegistrationStatus.registered,
        )
        .scalar()
    )
    not_registered_contacts = (
        db.query(func.count(Registration.id))
        .filter(
            Registration.contact_id.in_(contact_ids),
            Registration.status == RegistrationStatus.not_registered,
        )
        .scalar()
    )

    # Follow-up stats
    overdue_fus = (
        db.query(func.count(FollowUp.id))
        .filter(
            FollowUp.contact_id.in_(contact_ids),
            FollowUp.status == FollowUpStatus.scheduled,
            FollowUp.followup_date < now,
        )
        .scalar()
    )
    due_today = (
        db.query(func.count(FollowUp.id))
        .filter(
            FollowUp.contact_id.in_(contact_ids),
            FollowUp.status == FollowUpStatus.scheduled,
            FollowUp.followup_date >= today_start,
            FollowUp.followup_date <= today_end,
        )
        .scalar()
    )

    # Attempts completed today
    completed_today = (
        db.query(func.count(ContactAttempt.id))
        .filter(
            ContactAttempt.contact_id.in_(contact_ids),
            ContactAttempt.occurred_at >= today_start,
            ContactAttempt.occurred_at <= today_end,
            ContactAttempt.is_voided == False,
        )
        .scalar()
    )

    return DashboardSummary(
        total_contacts=base.count(),
        not_contacted=count_by_status("not_contacted"),
        contacted=count_by_status("contacted"),
        no_response=count_by_status("no_response"),
        follow_up_required=count_by_status("follow_up_required"),
        interested=count_by_status("interested"),
        not_interested=count_by_status("not_interested"),
        status_registered=count_by_status("registered"),
        closed=count_by_status("closed"),
        registered=registered_contacts or 0,
        not_registered=not_registered_contacts or 0,
        overdue_follow_ups=overdue_fus or 0,
        due_today=due_today or 0,
        completed_today=completed_today or 0,
        feedback_received=0,   # TODO: derived from feedback table
        feedback_pending=0,    # TODO: derived from feedback table
    )
