from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from .enums import AnnouncementCategory, AnnouncementImportance


class Announcement(BaseModel):
    model_config = ConfigDict(
        json_encoders={datetime: lambda v: v.isoformat()},
    )

    id: str
    title: str
    body: str
    category: AnnouncementCategory
    published_at: datetime
    created_by: str
    expires_at: Optional[datetime] = None
    importance: AnnouncementImportance = AnnouncementImportance.normal


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    category: AnnouncementCategory
    published_at: datetime
    created_by: str
    expires_at: Optional[datetime] = None
    importance: AnnouncementImportance = AnnouncementImportance.normal
