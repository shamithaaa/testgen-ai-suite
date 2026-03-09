from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.requirement import PyObjectId


class TestCase(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    requirement_id: str
    tc_id: str                  # e.g. "TC-001"
    name: str
    description: str
    severity: str               # Critical | High | Medium | Low
    expected: str
    category: str               # functional | edge | api | failure | regression
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class TestCaseOut(BaseModel):
    id: str
    requirement_id: str
    tc_id: str
    name: str
    description: str
    severity: str
    expected: str
    category: str
    created_at: datetime
