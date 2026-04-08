from enum import Enum


class PublicationStatus(str, Enum):
    borrador = "borrador"
    en_revision = "en_revision"
    publicado = "publicado"


class SourceTable(str, Enum):
    CM = "CM"
    CS = "CS"
    CC = "CC"
    IdI = "IdI"
    I = "I"
    Com = "Com"
    B = "B"


class UserRole(str, Enum):
    editor = "editor"
    revisor = "revisor"
    administrador = "administrador"


class AnnouncementCategory(str, Enum):
    articulo = "articulo"
    noticia_proyecto = "noticia_proyecto"
    convocatoria = "convocatoria"


class AuditAction(str, Enum):
    creacion = "creacion"
    modificacion = "modificacion"
    cambio_estado = "cambio_estado"
    eliminacion = "eliminacion"
