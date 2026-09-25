"""
Import routes — multipart upload for preview, then commit.
"""
import os
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.core.config import settings
from app.schemas import ImportPreviewResponse, ImportCommitRequest, ImportBatchResponse
from app.services.import_service import build_preview, commit_import

router = APIRouter(prefix="/import", tags=["import"])

ALLOWED_MIME_TYPES = {
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}


@router.post("/preview", response_model=ImportPreviewResponse)
async def upload_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Step 1: Upload file → returns preview with column list, validation errors, duplicate hits."""
    # File security: validate type and size (PRD §25)
    if file.content_type not in ALLOWED_MIME_TYPES and not (
        file.filename.endswith(".csv") or file.filename.endswith(".xlsx")
    ):
        raise HTTPException(status_code=400, detail="Only .xlsx and .csv files are supported")

    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    try:
        preview = build_preview(contents, file.filename, db)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {str(e)}")

    return preview


@router.post("/commit", response_model=ImportBatchResponse)
async def commit_import_batch(
    body: ImportCommitRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Step 2: Commit import with column mappings and per-row duplicate actions."""
    try:
        batch = commit_import(body, db, imported_by_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return batch
