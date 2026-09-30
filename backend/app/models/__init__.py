"""
SQLAlchemy ORM models for the Follow-Up Management System.
All 8 core entities as specified in PRD §19.
"""
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Integer,
    String, Text, JSON, UniqueConstraint, event
)
from sqlalchemy.orm import relationship, Session
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class ContactStatus(str, enum.Enum):
    not_contacted = "not_contacted"
    contacted = "contacted"
    no_response = "no_response"
    call_back_later = "call_back_later"
    follow_up_required = "follow_up_required"
    interested = "interested"
    not_interested = "not_interested"
    registered = "registered"
    closed = "closed"


class ContactMethod(str, enum.Enum):
    phone_call = "phone_call"
    whatsapp = "whatsapp"
    email = "email"
    in_person = "in_person"
    other = "other"


class AttemptOutcome(str, enum.Enum):
    reached = "reached"
    no_answer = "no_answer"
    busy = "busy"
    wrong_number = "wrong_number"
    switched_off = "switched_off"
    requested_callback = "requested_callback"
    declined = "declined"
    other = "other"


class RegistrationStatus(str, enum.Enum):
    not_registered = "not_registered"
    registration_pending = "registration_pending"
    registered = "registered"
    registration_cancelled = "registration_cancelled"


class PaymentStatus(str, enum.Enum):
    na = "na"
    pending = "pending"
    paid = "paid"
    refunded = "refunded"


class FollowUpStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    superseded = "superseded"
    cancelled = "cancelled"


class ReminderStatus(str, enum.Enum):
    not_sent = "not_sent"
    sent = "sent"
    acknowledged = "acknowledged"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.member)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    assigned_contacts = relationship("Contact", back_populates="assigned_to", foreign_keys="Contact.assigned_to_id")
    contact_attempts = relationship("ContactAttempt", back_populates="performed_by")
    follow_ups = relationship("FollowUp", back_populates="assigned_to", foreign_keys="FollowUp.assigned_to_id")
    import_batches = relationship("ImportBatch", back_populates="imported_by")
    audit_logs = relationship("AuditLog", back_populates="changed_by")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(500), nullable=False)
    imported_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    imported_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    row_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    mapping_config = Column(JSON, nullable=True)

    # Relationships
    imported_by = relationship("User", back_populates="import_batches")
    contacts = relationship("Contact", back_populates="import_batch")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    organization = Column(String(255), nullable=True, index=True)
    designation = Column(String(255), nullable=True)  # course/dept/title
    phone = Column(String(50), nullable=True, index=True)
    whatsapp = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    city = Column(String(100), nullable=True)
    source = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSON, nullable=True)  # for unmapped import columns

    # Status — each independent per PRD §10 / §21.3
    contact_status = Column(
        Enum(ContactStatus),
        nullable=False,
        default=ContactStatus.not_contacted,
    )

    # Foreign keys
    college_id = Column(Integer, ForeignKey("colleges.id"), nullable=True, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)

    # Soft delete
    is_archived = Column(Boolean, default=False, nullable=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    archived_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    college = relationship("College", back_populates="contacts")
    assigned_to = relationship("User", back_populates="assigned_contacts", foreign_keys=[assigned_to_id])
    import_batch = relationship("ImportBatch", back_populates="contacts")
    contact_attempts = relationship("ContactAttempt", back_populates="contact", order_by="ContactAttempt.occurred_at")
    feedbacks = relationship("Feedback", back_populates="contact", order_by="Feedback.feedback_date")
    registrations = relationship("Registration", back_populates="contact", order_by="Registration.registration_date")
    follow_ups = relationship("FollowUp", back_populates="contact", order_by="FollowUp.followup_date")
    audit_logs = relationship("AuditLog", primaryjoin="and_(AuditLog.entity_type=='contact', foreign(AuditLog.entity_id)==Contact.id)", viewonly=True)


class College(Base):
    __tablename__ = "colleges"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    code = Column(String(50), nullable=True, index=True)
    university = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    contact_person = Column(String(255), nullable=True)
    contact_person_designation = Column(String(100), nullable=True)
    status = Column(String(50), default="active", nullable=False)
    is_registered = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    created_by = relationship("User")
    contacts = relationship("Contact", back_populates="college")


class ContactAttempt(Base):
    __tablename__ = "contact_attempts"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False, default=1)
    occurred_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    method = Column(Enum(ContactMethod), nullable=False)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    outcome = Column(Enum(AttemptOutcome), nullable=False)
    notes = Column(Text, nullable=True)

    # Append-only: soft void instead of hard delete
    is_voided = Column(Boolean, default=False, nullable=False)
    void_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    contact = relationship("Contact", back_populates="contact_attempts")
    performed_by = relationship("User", back_populates="contact_attempts")
    feedbacks = relationship("Feedback", back_populates="contact_attempt")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)
    contact_attempt_id = Column(Integer, ForeignKey("contact_attempts.id"), nullable=True)
    received_bool = Column(Boolean, nullable=False, default=False)
    feedback_date = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    category = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    followup_required_bool = Column(Boolean, default=False, nullable=False)
    next_followup_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    contact = relationship("Contact", back_populates="feedbacks")
    contact_attempt = relationship("ContactAttempt", back_populates="feedbacks")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)

    # PRD §13.2 — Registration Status fully independent of Contact Status
    status = Column(
        Enum(RegistrationStatus),
        nullable=False,
        default=RegistrationStatus.not_registered,
    )
    registration_date = Column(DateTime(timezone=True), nullable=True)
    registration_id_external = Column(String(255), nullable=True)
    registration_type = Column(String(255), nullable=True)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.na)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    contact = relationship("Contact", back_populates="registrations")


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)
    followup_date = Column(DateTime(timezone=True), nullable=False)
    preferred_time = Column(String(50), nullable=True)
    reason = Column(Text, nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(FollowUpStatus), nullable=False, default=FollowUpStatus.scheduled)
    reminder_status = Column(Enum(ReminderStatus), nullable=False, default=ReminderStatus.not_sent)

    # Traceability: what created this follow-up
    created_from_type = Column(String(50), nullable=True)  # "attempt" | "feedback" | "manual"
    created_from_id = Column(Integer, nullable=True)

    priority = Column(String(20), nullable=False, default="normal")  # "normal" | "high"

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    contact = relationship("Contact", back_populates="follow_ups")
    assigned_to = relationship("User", back_populates="follow_ups", foreign_keys=[assigned_to_id])


class AuditLog(Base):
    """
    Append-only audit trail per PRD §18.
    DB-level enforcement: no UPDATE/DELETE permissions on this table for app user.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # contact/attempt/feedback/registration/follow_up/user
    entity_id = Column(Integer, nullable=False, index=True)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    field_changed = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    action = Column(String(50), nullable=False)  # created/updated/archived/restored
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    # Relationships
    changed_by = relationship("User", back_populates="audit_logs")
