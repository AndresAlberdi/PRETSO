from pydantic import BaseModel, Field
from datetime import datetime

class CommentBase(BaseModel):
    text: str = Field(..., min_length=1)

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: str
    record_id: str
    user_uid: str
    user_email: str
    timestamp: str
