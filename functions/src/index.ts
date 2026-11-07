import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  listAccounts as listAccountsCore,
  AccountsAccessError,
  PAGE_SIZE,
  errorCodeOf,
} from "./accounts";

initializeApp();

// Lista de cuentas para la pantalla «Gestión de usuarios». Solo administradores; sin parámetros de
// entrada (no se puede consultar por correo) y sin uid, hashes ni claims crudos en la respuesta.
// Corre con una cuenta de servicio dedicada que solo lee Authentication (roles/firebaseauth.viewer).
export const listAccounts = onCall(
  {
    region: "us-central1",
    serviceAccount: "fn-usuarios@",
    enforceAppCheck: false,
    maxInstances: 2,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      const result = await listAccountsCore(request.auth?.token as Record<string, unknown> | undefined, (t) =>
        getAuth().listUsers(PAGE_SIZE, t)
      );
      console.info("listAccounts", { total: result.accounts.length, truncated: result.truncated, appCheck: Boolean(request.app) });
      return result;
    } catch (err) {
      if (err instanceof AccountsAccessError) throw new HttpsError(err.code, err.message);
      console.error("listAccounts: no se pudo listar", errorCodeOf(err));
      throw new HttpsError("internal", "No se pudo obtener la lista de usuarios.");
    }
  }
);
