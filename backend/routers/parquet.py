"""Parquet file manager routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from domain.models import Windmill
from infra.db import get_db
from infra import windmill_repo
from infra import parquet as parquet_store

router = APIRouter()


@router.get("/parquet-files", summary="List Parquet archive files")
def list_parquet_files(db: Session = Depends(get_db)):
    """Return metadata for every .parquet file in the data directory."""
    running_ids = {wm.windmill_id for wm in db.query(Windmill).filter(Windmill.is_running.is_(True)).all()}
    return parquet_store.list_files(running_ids)


@router.delete("/parquet-files/{windmill_id}", status_code=204, summary="Delete a Parquet file")
def delete_parquet_file(windmill_id: str, db: Session = Depends(get_db)):
    """Delete the Parquet file for windmill_id. 409 if in_use."""
    wm = windmill_repo.get_by_windmill_id(db, windmill_id)
    if wm and wm.is_running:
        raise HTTPException(status_code=409, detail=f"Stop windmill {windmill_id} before deleting its Parquet file.")
    if not parquet_store.file_exists(windmill_id):
        raise HTTPException(status_code=404, detail="Parquet file not found.")
    parquet_store.delete_file(windmill_id)
