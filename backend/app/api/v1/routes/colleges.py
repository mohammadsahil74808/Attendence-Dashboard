"""
Colleges route — CRUD for Colleges directory and contact linkage.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import College, Contact, ContactStatus, Registration, RegistrationStatus, UserRole
from app.schemas import (
    CollegeCreate, CollegeUpdate, CollegeResponse, PaginatedColleges
)
from app.services.audit_service import log_audit

router = APIRouter(prefix="/colleges", tags=["colleges"])


def _college_with_counts(c: College, db: Session) -> dict:
    total_contacts = db.query(func.count(Contact.id)).filter(
        Contact.is_archived == False,
        or_(Contact.college_id == c.id, Contact.organization.ilike(f"%{c.name}%"))
    ).scalar() or 0

    registered_contacts = db.query(func.count(Contact.id)).filter(
        Contact.is_archived == False,
        or_(Contact.college_id == c.id, Contact.organization.ilike(f"%{c.name}%")),
        or_(
            Contact.contact_status == ContactStatus.registered,
            Contact.registrations.any(Registration.status == RegistrationStatus.registered)
        )
    ).scalar() or 0

    resp = CollegeResponse.model_validate(c)
    resp.contacts_count = total_contacts
    resp.registered_contacts_count = registered_contacts
    return resp


@router.get("/", response_model=PaginatedColleges)
async def list_colleges(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_registered: Optional[bool] = Query(None),
    city: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(College).filter(College.is_archived == False)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                College.name.ilike(s),
                College.code.ilike(s),
                College.city.ilike(s),
                College.university.ilike(s),
                College.contact_person.ilike(s),
            )
        )

    if status:
        query = query.filter(College.status == status)

    if is_registered is not None:
        query = query.filter(College.is_registered == is_registered)

    if city:
        query = query.filter(College.city.ilike(f"%{city.strip()}%"))

    total = query.count()
    colleges = (
        query.order_by(College.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_college_with_counts(c, db) for c in colleges]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedColleges(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/all", response_model=List[CollegeResponse])
async def list_all_colleges(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lightweight list of all active colleges for dropdown selection."""
    colleges = (
        db.query(College)
        .filter(College.is_archived == False)
        .order_by(College.name.asc())
        .all()
    )
    return [_college_with_counts(c, db) for c in colleges]


@router.post("/", response_model=CollegeResponse, status_code=status.HTTP_201_CREATED)
async def create_college(
    body: CollegeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Check duplicate name
    existing = db.query(College).filter(
        College.name.ilike(body.name.strip()),
        College.is_archived == False,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"College '{body.name}' already exists (ID: {existing.id})"
        )

    data = body.model_dump()
    data["name"] = data["name"].strip()
    data["created_by_id"] = current_user.id
    if body.is_registered:
        data["status"] = "registered"

    college = College(**data)
    db.add(college)
    db.commit()
    db.refresh(college)

    log_audit(
        db,
        entity_type="college",
        entity_id=college.id,
        changed_by_id=current_user.id,
        action="created",
        new_value=college.name,
    )
    db.commit()

    return _college_with_counts(college, db)


@router.get("/{college_id}", response_model=CollegeResponse)
async def get_college(
    college_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    college = db.query(College).filter(College.id == college_id, College.is_archived == False).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    return _college_with_counts(college, db)


@router.patch("/{college_id}", response_model=CollegeResponse)
async def update_college(
    college_id: int,
    body: CollegeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    college = db.query(College).filter(College.id == college_id, College.is_archived == False).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    update_data = body.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()
        existing = db.query(College).filter(
            College.name.ilike(update_data["name"]),
            College.id != college_id,
            College.is_archived == False,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"College '{update_data['name']}' already exists")

    if update_data.get("is_registered") is True and "status" not in update_data:
        update_data["status"] = "registered"

    for field, val in update_data.items():
        setattr(college, field, val)

    college.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(college)

    log_audit(
        db,
        entity_type="college",
        entity_id=college.id,
        changed_by_id=current_user.id,
        action="updated",
    )
    db.commit()

    return _college_with_counts(college, db)


@router.delete("/{college_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_college(
    college_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    college = db.query(College).filter(College.id == college_id, College.is_archived == False).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")

    college.is_archived = True
    db.commit()

    log_audit(
        db,
        entity_type="college",
        entity_id=college.id,
        changed_by_id=current_user.id,
        action="archived",
    )
    db.commit()
