import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from backend.src.api.auth import require_role
from backend.src.models.enums import UserRole
from backend.src.models.comment import CommentCreate, CommentResponse
from backend.src.db.repositories import async_set_document, async_query_collection
from backend.src.db.firestore import get_db

router = APIRouter(tags=["admin-comments"])

@router.get("/admin/records/{record_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    record_id: str,
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.revisor.value, UserRole.administrador.value)),
):
    """Devuelve los comentarios de un registro."""
    # Como los comentarios están en una subcolección: records/{record_id}/comments
    # No tenemos wrapper para subcolecciones en repositories.py que retorne async, 
    # pero podemos consultar una colección principal si la hacemos plana,
    # o usar db directamente. Usaremos db directamente.
    db = get_db()
    docs = db.collection("records").document(record_id).collection("comments").stream()
    comments = [doc.to_dict() for doc in docs]
    comments.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return comments

@router.post("/admin/records/{record_id}/comments", response_model=CommentResponse)
async def create_comment(
    record_id: str,
    body: CommentCreate,
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.revisor.value, UserRole.administrador.value)),
):
    """Crea un comentario para un registro."""
    db = get_db()
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    comment_data = {
        "id": comment_id,
        "record_id": record_id,
        "user_uid": user["uid"],
        "user_email": user.get("email", "unknown"),
        "text": body.text,
        "timestamp": now,
    }
    
    db.collection("records").document(record_id).collection("comments").document(comment_id).set(comment_data)
    return comment_data
