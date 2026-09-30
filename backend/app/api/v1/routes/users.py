from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user, require_admin, get_password_hash
from app.models import User
from app.schemas import UserCreate, UserUpdate, UserResponse
from app.services.audit_service import log_audit

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[UserResponse])
async def list_users(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active == True)
    return query.order_by(User.name.asc()).all()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        name=body.name,
        email=body.email,
        password_hash=get_password_hash(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_audit(db, entity_type="user", entity_id=user.id,
              changed_by_id=current_user.id, action="created",
              new_value=f"User {user.email} created with role {user.role}")
    db.commit()
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))

    for field, val in update_data.items():
        old_val = getattr(user, field, None)
        setattr(user, field, val)
        if str(old_val) != str(val):
            log_audit(db, entity_type="user", entity_id=user_id,
                      changed_by_id=current_user.id, action="updated",
                      field_changed=field, old_value=old_val, new_value=val)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    permanent: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate or delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if permanent:
        # Reassign contacts to null
        from app.models import Contact
        db.query(Contact).filter(Contact.assigned_to_id == user_id).update({"assigned_to_id": None})
        db.delete(user)
        log_audit(db, entity_type="user", entity_id=user_id,
                  changed_by_id=current_user.id, action="deleted",
                  new_value=f"User {user.email} permanently removed")
    else:
        user.is_active = False
        log_audit(db, entity_type="user", entity_id=user_id,
                  changed_by_id=current_user.id, action="deactivated")
    db.commit()
