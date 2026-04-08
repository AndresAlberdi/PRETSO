from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from .enums import UserRole


class User(BaseModel):
    model_config = ConfigDict(
        json_encoders={datetime: lambda v: v.isoformat()},
    )

    uid: str
    email: str
    name: str
    institution: str
    role: Optional[UserRole] = None
    panel_access: bool = False
    search_history: list[dict] = []
    favorites: list[str] = []
    created_at: datetime
    email_verified: bool = False
