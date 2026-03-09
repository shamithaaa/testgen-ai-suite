from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field
from app.models.requirement import PyObjectId


VehicleStatus = Literal["Active", "Idle", "Maintenance"]


class VehicleTelemetry(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    vehicle_id: str
    lat: float
    lng: float
    engine_temp: float       # Fahrenheit
    rpm: int
    fuel_level: float        # percentage
    oil_pressure: float      # psi
    speed: float             # mph
    trip_id: str
    status: VehicleStatus
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class VehicleTelemetryOut(BaseModel):
    id: str
    vehicle_id: str
    lat: float
    lng: float
    engine_temp: float
    rpm: int
    fuel_level: float
    oil_pressure: float
    speed: float
    trip_id: str
    status: VehicleStatus
    timestamp: datetime


class GenerateSyntheticRequest(BaseModel):
    count: int = Field(default=20, ge=1, le=100)
    scenario: Optional[str] = None   # e.g. "high traffic highway", "city stop-and-go"
