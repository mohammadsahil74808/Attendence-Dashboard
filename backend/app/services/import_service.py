"""
Import service — handles Excel/CSV parsing, column mapping, duplicate detection, and batch commit.
"""
import io
import uuid
import re
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import Contact, ImportBatch, ContactStatus
from app.schemas import ImportPreviewRow, ImportPreviewResponse, ImportCommitRequest, ColumnMapping
from app.services.audit_service import log_audit

# In-memory session storage for preview batches (replace with Redis in production)
_preview_sessions: Dict[str, Dict] = {}

SYSTEM_FIELDS = {
    "name", "organization", "designation", "phone", "whatsapp",
    "email", "city", "source", "notes", "assigned_to_id"
}


def normalize_phone(phone: str) -> str:
    """Strip non-digit characters for comparison."""
    if not phone:
        return ""
    return re.sub(r"\D", "", str(phone))


def normalize_email(email: str) -> str:
    return str(email).strip().lower() if email else ""


def parse_upload(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, str]:
    """Parse .xlsx or .csv file, return DataFrame and detected format."""
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
        fmt = "csv"
    else:
        df = pd.read_excel(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
        fmt = "xlsx"
    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]
    df = df.fillna("")
    return df, fmt


def build_preview(file_bytes: bytes, filename: str, db: Session) -> ImportPreviewResponse:
    """Step 1: Parse file and return preview with validation and duplicate detection."""
    df, _ = parse_upload(file_bytes, filename)
    columns = list(df.columns)
    batch_id = str(uuid.uuid4())

    preview_rows = []
    valid_count = 0
    error_count = 0
    duplicate_count = 0

    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        errors: List[str] = []

        # Basic validation: try to guess name/phone/email
        name_val = row_dict.get("name", row_dict.get("Name", row_dict.get("Full Name", "")))
        phone_val = row_dict.get("phone", row_dict.get("Phone", row_dict.get("Mobile", "")))
        email_val = row_dict.get("email", row_dict.get("Email", ""))

        if not name_val:
            errors.append("Missing name — row will not be imported")
        if not phone_val and not email_val:
            errors.append("At least one of phone or email is required")

        # Duplicate detection
        dup_match = None
        if phone_val or email_val:
            query = db.query(Contact).filter(Contact.is_archived == False)
            conditions = []
            if phone_val:
                # Normalize and check
                norm_phone = normalize_phone(phone_val)
                conditions.append(Contact.phone.ilike(f"%{phone_val}%"))
            if email_val:
                conditions.append(Contact.email.ilike(normalize_email(email_val)))
            if conditions:
                existing = query.filter(or_(*conditions)).first()
                if existing:
                    dup_match = {
                        "id": existing.id,
                        "name": existing.name,
                        "phone": existing.phone,
                        "email": existing.email,
                        "contact_status": existing.contact_status.value if existing.contact_status else None,
                    }
                    duplicate_count += 1

        if errors:
            error_count += 1
        else:
            valid_count += 1

        preview_rows.append(ImportPreviewRow(
            row_index=int(idx),
            data=row_dict,
            validation_errors=errors,
            duplicate_match=dup_match,
        ))

    # Cache session for commit
    _preview_sessions[batch_id] = {
        "df": df,
        "filename": filename,
        "preview_rows": preview_rows,
    }

    return ImportPreviewResponse(
        batch_id=batch_id,
        filename=filename,
        total_rows=len(df),
        columns=columns,
        preview_rows=preview_rows[:20],  # first 20 for UI preview
        valid_count=valid_count,
        error_count=error_count,
        duplicate_count=duplicate_count,
    )


def commit_import(
    request: ImportCommitRequest,
    db: Session,
    imported_by_id: int,
) -> ImportBatch:
    """Step 2: Commit the import based on column mappings and duplicate actions."""
    session = _preview_sessions.get(request.batch_id)
    if not session:
        raise ValueError("Import session expired. Please re-upload the file.")

    df: pd.DataFrame = session["df"]
    filename: str = session["filename"]
    preview_rows: List[ImportPreviewRow] = session["preview_rows"]

    # Build field map: source_column -> target_field
    field_map: Dict[str, str] = {m.source_column: m.target_field for m in request.column_mappings}

    import_batch = ImportBatch(
        filename=filename,
        imported_by_id=imported_by_id,
        row_count=len(df),
        mapping_config={"mappings": [m.model_dump() for m in request.column_mappings]},
    )
    db.add(import_batch)
    db.flush()  # get import_batch.id

    success_count = 0
    error_count = 0

    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        preview_row = next((p for p in session["preview_rows"] if p.row_index == idx), None)

        # Skip rows with validation errors unless explicitly told to import
        action = request.duplicate_actions.get(int(idx), "auto")
        if preview_row and preview_row.validation_errors and action != "import_new":
            error_count += 1
            continue

        # Map columns to system fields
        contact_data: Dict[str, Any] = {}
        custom_fields: Dict[str, Any] = {}
        for src_col, val in row_dict.items():
            if not val:
                continue
            target = field_map.get(src_col, "custom")
            if target in SYSTEM_FIELDS:
                contact_data[target] = val
            elif target != "skip":
                custom_fields[src_col] = val

        if custom_fields:
            contact_data["custom_fields"] = custom_fields
        if request.assigned_to_id and "assigned_to_id" not in contact_data:
            contact_data["assigned_to_id"] = request.assigned_to_id

        # Handle duplicate action
        existing = None
        if preview_row and preview_row.duplicate_match:
            existing_id = preview_row.duplicate_match["id"]
            existing = db.query(Contact).filter(Contact.id == existing_id).first()

        if existing and action == "skip":
            continue
        elif existing and action == "update":
            # Update existing record, log audit for each changed field
            for field, new_val in contact_data.items():
                old_val = getattr(existing, field, None)
                if str(old_val) != str(new_val):
                    setattr(existing, field, new_val)
                    log_audit(
                        db, entity_type="contact", entity_id=existing.id,
                        changed_by_id=imported_by_id, action="updated",
                        field_changed=field, old_value=old_val, new_value=new_val,
                    )
            success_count += 1
        else:
            # Create new contact
            contact_data["import_batch_id"] = import_batch.id
            new_contact = Contact(**contact_data)
            db.add(new_contact)
            db.flush()
            log_audit(
                db, entity_type="contact", entity_id=new_contact.id,
                changed_by_id=imported_by_id, action="created",
                new_value=f"Imported from batch {import_batch.id}",
            )
            success_count += 1

    import_batch.success_count = success_count
    import_batch.error_count = error_count
    db.commit()

    # Clean up session
    _preview_sessions.pop(request.batch_id, None)

    return import_batch
