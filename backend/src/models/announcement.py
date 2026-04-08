from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .enums import AnnouncementCategory


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


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    category: AnnouncementCategory
    published_at: datetime
    created_by: str
