"""
Synthetic data service: generates vehicle telemetry via Gemini and persists it.
"""
from datetime import datetime
from typing import Any

from app.database import get_db
from app.models.synthetic_data import VehicleTelemetryOut
from app.services import ai_service


async def generate_and_store(count: int, scenario: str | None) -> list[VehicleTelemetryOut]:
    db = get_db()

    raw = await ai_service.generate_synthetic_telemetry(count, scenario)

    docs: list[dict[str, Any]] = []
    for r in raw:
        docs.append({
            "vehicle_id": r.get("vehicle_id", "TRK-0000"),
            "lat": float(r.get("lat", 34.05)),
            "lng": float(r.get("lng", -118.24)),
            "engine_temp": float(r.get("engine_temp", 200)),
            "rpm": int(r.get("rpm", 1500)),
            "fuel_level": float(r.get("fuel_level", 50)),
            "oil_pressure": float(r.get("oil_pressure", 45)),
            "speed": float(r.get("speed", 0)),
            "trip_id": r.get("trip_id", "TRIP-0000"),
            "status": r.get("status", "Active"),
            "timestamp": datetime.utcnow(),
        })

    if docs:
        await db.synthetic_data.insert_many(docs)

    return await get_telemetry(limit=count)


async def get_telemetry(limit: int = 50) -> list[VehicleTelemetryOut]:
    db = get_db()
    cursor = db.synthetic_data.find().sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [
        VehicleTelemetryOut(
            id=str(d["_id"]),
            vehicle_id=d["vehicle_id"],
            lat=d["lat"],
            lng=d["lng"],
            engine_temp=d["engine_temp"],
            rpm=d["rpm"],
            fuel_level=d["fuel_level"],
            oil_pressure=d["oil_pressure"],
            speed=d["speed"],
            trip_id=d["trip_id"],
            status=d["status"],
            timestamp=d["timestamp"],
        )
        for d in docs
    ]
