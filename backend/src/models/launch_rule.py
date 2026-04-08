from pydantic import BaseModel, Field


class LaunchRule(BaseModel):
    published_count: int = Field(default=0, ge=0)
    threshold: int = 20
    portal_active: bool = False

    def is_active(self) -> bool:
        return self.published_count >= self.threshold
