from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Transaction(BaseModel):
    model_config = ConfigDict(
        json_encoders={datetime: lambda v: v.isoformat()},
    )

    id: str = Field(..., pattern=r"^Tra-\d+$")
    record_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
