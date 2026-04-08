from typing import Callable
from fastapi import Header, HTTPException, Depends
from firebase_admin import auth as firebase_auth


def verify_firebase_token(token: str) -> dict:
    """Verify a Firebase JWT and return the decoded payload."""
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as exc:
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": str(exc), "field": None})


def get_current_user(authorization: str = Header(...)) -> dict:
    """Extract Bearer token from Authorization header and return user payload."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "Authorization header must start with 'Bearer '.", "field": None},
        )
    token = authorization.removeprefix("Bearer ").strip()
    payload = verify_firebase_token(token)
    return {
        "uid": payload.get("uid") or payload.get("user_id"),
        "role": payload.get("role"),
        "email": payload.get("email"),
    }


def require_role(*roles: str) -> Callable:
    """Return a FastAPI dependency that checks the user has one of the given roles."""

    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=403,
                detail={"code": "INSUFFICIENT_PERMISSIONS", "message": f"Required role: {roles}.", "field": None},
            )
        return user

    return dependency
