from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .enums import AuditAction


class AuditLog(BaseModel):
    model_config = ConfigDict(
        json_encoders={datetime: lambda v: v.isoformat()},
    )

    id: str
    record_id: str
    user_uid: str
    action: AuditAction
    timestamp: datetime
    details: dict
