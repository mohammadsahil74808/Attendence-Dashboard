"""
Pydantic v2 schemas for all API endpoints.
Covers Auth, Users, Contacts, Attempts, Feedback, Registration, FollowUps, ImportBatch, AuditLog, Dashboard.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    login_as: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


# ─── Users ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "member"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("admin", "member"):
            raise ValueError("role must be 'admin' or 'member'")
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Contacts ─────────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str
    organization: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    college_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    contact_status: Optional[str] = "not_contacted"
    custom_fields: Optional[Dict[str, Any]] = None
    followup_date: Optional[datetime] = None
    preferred_time: Optional[str] = None
    followup_reason: Optional[str] = None

    @model_validator(mode="after")
    def require_phone_or_email(self):
        if not self.phone and not self.email:
            raise ValueError("At least one of phone or email is required")
        return self


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    college_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    contact_status: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None


class ContactStatusUpdate(BaseModel):
    contact_status: str

    @field_validator("contact_status")
    @classmethod
    def validate_status(cls, v):
        valid = [
            "not_contacted", "contacted", "no_response", "call_back_later",
            "follow_up_required", "interested", "not_interested", "registered", "closed"
        ]
        if v not in valid:
            raise ValueError(f"contact_status must be one of {valid}")
        return v


class ContactResponse(BaseModel):
    id: int
    name: str
    organization: Optional[str]
    designation: Optional[str]
    phone: Optional[str]
    whatsapp: Optional[str]
    email: Optional[str]
    city: Optional[str]
    source: Optional[str]
    notes: Optional[str]
    contact_status: str
    college_id: Optional[int] = None
    assigned_to_id: Optional[int]
    assigned_to: Optional[UserResponse]
    import_batch_id: Optional[int]
    custom_fields: Optional[Dict[str, Any]]
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    # Computed fields (populated by service layer)
    registration_status: Optional[str] = None
    next_followup_date: Optional[datetime] = None
    last_attempt_date: Optional[datetime] = None
    feedback_status: Optional[str] = None

    model_config = {"from_attributes": True}


class ContactListItem(BaseModel):
    """Lightweight version for table rows"""
    id: int
    name: str
    organization: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    contact_status: str
    college_id: Optional[int] = None
    assigned_to_id: Optional[int]
    assigned_to_name: Optional[str] = None
    registration_status: Optional[str] = None
    next_followup_date: Optional[datetime] = None
    last_attempt_date: Optional[datetime] = None
    feedback_status: Optional[str] = None
    is_overdue: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedContacts(BaseModel):
    items: List[ContactListItem]
    total: int


# ─── Colleges ─────────────────────────────────────────────────────────────────

class CollegeCreate(BaseModel):
    name: str
    code: Optional[str] = None
    university: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    contact_person_designation: Optional[str] = None
    status: Optional[str] = "active"
    is_registered: Optional[bool] = False
    notes: Optional[str] = None


class CollegeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    university: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    contact_person_designation: Optional[str] = None
    status: Optional[str] = None
    is_registered: Optional[bool] = None
    notes: Optional[str] = None


class CollegeResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    university: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    contact_person_designation: Optional[str] = None
    status: str
    is_registered: bool = False
    notes: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by: Optional[UserResponse] = None
    contacts_count: int = 0
    registered_contacts_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedColleges(BaseModel):
    items: List[CollegeResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Contact Attempts ─────────────────────────────────────────────────────────

class AttemptCreate(BaseModel):
    method: str
    outcome: str
    notes: Optional[str] = None
    occurred_at: Optional[datetime] = None
    next_followup_date: Optional[datetime] = None
    followup_reason: Optional[str] = None
    followup_assigned_to_id: Optional[int] = None


class AttemptResponse(BaseModel):
    id: int
    contact_id: int
    attempt_number: int
    occurred_at: datetime
    method: str
    performed_by_id: int
    performed_by: Optional[UserResponse]
    outcome: str
    notes: Optional[str]
    is_voided: bool
    void_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    contact_attempt_id: Optional[int] = None
    received_bool: bool = False
    feedback_date: Optional[datetime] = None
    category: Optional[str] = None
    details: Optional[str] = None
    followup_required_bool: bool = False
    next_followup_date: Optional[datetime] = None


class FeedbackResponse(BaseModel):
    id: int
    contact_id: int
    contact_attempt_id: Optional[int]
    received_bool: bool
    feedback_date: datetime
    category: Optional[str]
    details: Optional[str]
    followup_required_bool: bool
    next_followup_date: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Registration ─────────────────────────────────────────────────────────────

class RegistrationCreate(BaseModel):
    status: str = "not_registered"
    registration_date: Optional[datetime] = None
    registration_id_external: Optional[str] = None
    registration_type: Optional[str] = None
    payment_status: Optional[str] = "na"
    notes: Optional[str] = None


class RegistrationUpdate(BaseModel):
    status: Optional[str] = None
    registration_date: Optional[datetime] = None
    registration_id_external: Optional[str] = None
    registration_type: Optional[str] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None


class RegistrationResponse(BaseModel):
    id: int
    contact_id: int
    status: str
    registration_date: Optional[datetime]
    registration_id_external: Optional[str]
    registration_type: Optional[str]
    payment_status: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Follow-Ups ───────────────────────────────────────────────────────────────

class FollowUpCreate(BaseModel):
    followup_date: datetime
    preferred_time: Optional[str] = None
    reason: Optional[str] = None
    assigned_to_id: Optional[int] = None
    priority: str = "normal"
    created_from_type: Optional[str] = None
    created_from_id: Optional[int] = None


class FollowUpUpdate(BaseModel):
    followup_date: Optional[datetime] = None
    preferred_time: Optional[str] = None
    reason: Optional[str] = None
    assigned_to_id: Optional[int] = None
    status: Optional[str] = None
    reminder_status: Optional[str] = None
    priority: Optional[str] = None


class FollowUpResponse(BaseModel):
    id: int
    contact_id: int
    followup_date: datetime
    preferred_time: Optional[str]
    reason: Optional[str]
    assigned_to_id: Optional[int]
    assigned_to: Optional[UserResponse]
    status: str
    reminder_status: str
    priority: str
    created_from_type: Optional[str]
    created_from_id: Optional[int]
    is_overdue: bool = False
    created_at: datetime
    contact_name: Optional[str] = None  # for follow-up list view
    contact_phone: Optional[str] = None
    contact_organization: Optional[str] = None
    contact_status: Optional[str] = None
    registration_status: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Import ───────────────────────────────────────────────────────────────────

class ImportPreviewRow(BaseModel):
    row_index: int
    data: Dict[str, Any]
    validation_errors: List[str] = []
    duplicate_match: Optional[Dict[str, Any]] = None  # matched existing contact info


class ImportPreviewResponse(BaseModel):
    batch_id: str  # temp ID for the upload session
    filename: str
    total_rows: int
    columns: List[str]
    preview_rows: List[ImportPreviewRow]
    valid_count: int
    error_count: int
    duplicate_count: int


class ColumnMapping(BaseModel):
    source_column: str
    target_field: str  # system field name or "custom"


class ImportCommitRequest(BaseModel):
    batch_id: str
    column_mappings: List[ColumnMapping]
    duplicate_actions: Dict[int, str]  # row_index -> "skip" | "update" | "import_new"
    assigned_to_id: Optional[int] = None


class ImportBatchResponse(BaseModel):
    id: int
    filename: str
    imported_by_id: int
    imported_at: datetime
    row_count: int
    success_count: int
    error_count: int

    model_config = {"from_attributes": True}


# ─── Bulk Operations ──────────────────────────────────────────────────────────

class BulkAction(BaseModel):
    contact_ids: List[int]
    action: str  # "assign" | "change_status" | "archive" | "export"
    value: Optional[str] = None  # assigned_to_id or status value


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_contacts: int
    not_contacted: int
    contacted: int
    no_response: int
    follow_up_required: int
    interested: int
    not_interested: int
    status_registered: int = 0
    closed: int = 0
    registered: int
    not_registered: int
    overdue_follow_ups: int
    due_today: int
    completed_today: int
    feedback_received: int
    feedback_pending: int


# ─── Audit Log ────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    changed_by_id: int
    changed_by: Optional[UserResponse]
    field_changed: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    action: str
    timestamp: datetime

    model_config = {"from_attributes": True}
