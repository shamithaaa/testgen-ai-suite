from fastapi import APIRouter, HTTPException, Query
from app.models.synthetic_data import GenerateSyntheticRequest
from app.services import synthetic_data_service

router = APIRouter(prefix="/synthetic-data", tags=["Synthetic Data"])


@router.post("/generate", status_code=201)
async def generate_synthetic_data(body: GenerateSyntheticRequest):
    """Generate AI-powered vehicle telemetry records and persist them."""
    try:
        records = await synthetic_data_service.generate_and_store(body.count, body.scenario)
        return {"count": len(records), "records": records}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("")
async def get_synthetic_data(limit: int = Query(default=50, le=200)):
    return await synthetic_data_service.get_telemetry(limit=limit)
