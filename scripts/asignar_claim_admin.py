"""Asigna o quita el custom claim `admin` a cuentas de Firebase Authentication.

Sin --aplicar solo lee y muestra el cambio previsto; no escribe nada.
Nunca imprime uid, tokens ni credenciales.

Uso:
  python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo a@x.com
  python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo a@x.com --aplicar
  python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo a@x.com --quitar --aplicar
"""
import argparse
import sys


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


def main(argv=None):
    args = _crear_parser().parse_args(argv)

    import firebase_admin
    from firebase_admin import auth, credentials

    try:
        firebase_admin.initialize_app(
            credentials.ApplicationDefault(), {"projectId": args.proyecto})
    except Exception as e:
        print(f"Error al iniciar Firebase Admin: {type(e).__name__}: {e}")
        return 1

    codigo = 0
    for correo in args.correo:
        try:
            usuario = auth.get_user_by_email(correo)
            actuales = usuario.custom_claims or {}
            nuevos = calcular_claims(actuales, args.quitar)
            antes = bool(actuales.get("admin"))
            despues = bool(nuevos.get("admin"))
            print(f"{correo}: admin actual={antes} → nuevo={despues}")
            if not args.aplicar or nuevos == actuales:
                continue
            auth.set_custom_user_claims(usuario.uid, nuevos)
            releido = auth.get_user(usuario.uid).custom_claims or {}
            if bool(releido.get("admin")) == despues:
                print(f"{correo}: verificado")
            else:
                print(f"{correo}: la verificación no coincide con lo esperado.")
                codigo = codigo or 1
        except auth.UserNotFoundError:
            print(f"No existe la cuenta {correo} en {args.proyecto}; "
                  "créela en la consola de Firebase.")
            codigo = 2
        except Exception as e:
            print(f"{correo}: {type(e).__name__}: {e}")
            codigo = codigo or 1
    return codigo


if __name__ == "__main__":
    sys.exit(main())
