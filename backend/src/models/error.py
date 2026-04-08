from typing import Optional

from pydantic import BaseModel


class ApiError(BaseModel):
    code: str
    message: str
    field: Optional[str] = None


class ApiErrorResponse(BaseModel):
    error: ApiError
