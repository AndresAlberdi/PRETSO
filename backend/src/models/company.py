from typing import Literal

from pydantic import BaseModel, Field


class Company(BaseModel):
    id: str = Field(..., pattern=r"^Com-\d+$")
    siglas: str
    autor_principal: str
    temporadas: list[str]
    ambito: Literal["España", "América"]
    transaction_ids: list[str] = Field(default_factory=list)
