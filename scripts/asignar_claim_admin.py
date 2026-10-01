"""Asigna o quita el custom claim `admin` a cuentas de Firebase Authentication.

Sin --aplicar solo lee y muestra el cambio previsto; no escribe nada.
Nunca imprime uid, tokens ni credenciales.

Uso:
  python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo a@x.com
  python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo a@x.com --aplicar
  python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo a@x.com --quitar --aplicar
"""
import argparse
import os
import sys

import firebase_admin
from firebase_admin import auth, credentials
from firebase_admin.exceptions import FirebaseError


def calcular_claims(actuales, quitar):
    """Devuelve los claims resultantes conservando los demás.

    set_custom_user_claims reemplaza todos los claims, por eso se parte de
    una copia de los actuales. Es idempotente y no muta la entrada.
    """
    nuevos = dict(actuales or {})
    if quitar:
        nuevos.pop("admin", None)
    else:
        nuevos["admin"] = True
    return nuevos


def _crear_parser():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--proyecto", required=True,
                        choices=["pretso-database", "pretso-prod"])
    parser.add_argument("--correo", required=True, action="append",
                        help="Correo de la cuenta; se puede repetir.")
    parser.add_argument("--aplicar", action="store_true",
                        help="Escribe el cambio; sin esta opción solo lee.")
    parser.add_argument("--quitar", action="store_true",
                        help="Quita el claim admin en lugar de asignarlo.")
    return parser


def _describir_error(e):
    """Describe un error sin exponer su texto (puede traer datos sensibles)."""
    descripcion = type(e).__name__
    if isinstance(e, FirebaseError):
        descripcion += f" (código {e.code})"
    return descripcion


def main(argv=None):
    """Ejecuta el script y devuelve el código de salida.

    Códigos: 0 = todo bien; 1 = error genérico, verificación distinta de lo
    esperado o cuenta rechazada; 2 = alguna cuenta no existe. Con varios
    --correo se procesan todos y prevalece el código más alto (el 2 no se
    pierde frente a un 1).
    """
    args = _crear_parser().parse_args(argv)

    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        print("Aviso: GOOGLE_APPLICATION_CREDENTIALS está definida y se usaría "
              "esa clave. Use las credenciales de usuario: "
              "`gcloud auth application-default login`.")

    try:
        firebase_admin.initialize_app(
            credentials.ApplicationDefault(), {"projectId": args.proyecto})
    except Exception as e:
        print(f"Error al iniciar Firebase Admin: {_describir_error(e)}")
        return 1

    codigo = 0
    for correo in args.correo:
        try:
            usuario = auth.get_user_by_email(correo)
            actuales = usuario.custom_claims or {}
            nuevos = calcular_claims(actuales, args.quitar)
            antes = actuales.get("admin") is True
            despues = not args.quitar
            if args.quitar:
                cambia = "admin" in actuales
            else:
                cambia = not antes
            proveedores = [p.provider_id for p in (usuario.provider_data or [])]
            print(f"{correo}: admin actual={antes} -> nuevo={despues}; "
                  f"proveedores={proveedores} "
                  f"verificado={bool(usuario.email_verified)} "
                  f"deshabilitada={bool(usuario.disabled)}")
            if not args.aplicar:
                print(f"{correo}: (solo lectura, no se escribe)")
                continue
            if usuario.disabled and not args.quitar:
                print(f"{correo}: la cuenta está deshabilitada; "
                      "no se asigna el claim.")
                codigo = max(codigo, 1)
                continue
            if not cambia:
                print(f"{correo}: sin cambios; no se escribe")
                continue
            auth.set_custom_user_claims(usuario.uid, nuevos)
            if args.quitar:
                auth.revoke_refresh_tokens(usuario.uid)
            releido = auth.get_user(usuario.uid).custom_claims or {}
            if releido == nuevos:
                print(f"{correo}: verificado")
            else:
                print(f"{correo}: la verificación no coincide con lo esperado.")
                codigo = max(codigo, 1)
        except auth.UserNotFoundError:
            print(f"No existe la cuenta {correo} en {args.proyecto}; "
                  "créela en la consola de Firebase.")
            codigo = max(codigo, 2)
        except Exception as e:
            print(f"{correo}: {_describir_error(e)}")
            codigo = max(codigo, 1)
    return codigo


if __name__ == "__main__":
    sys.exit(main())
