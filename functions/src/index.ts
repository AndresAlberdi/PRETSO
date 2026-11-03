import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  listAccounts as listAccountsCore,
  AccountsAccessError,
  PAGE_SIZE,
  errorCodeOf,
} from "./accounts";

admin.initializeApp();

export const createReaderUser = functions.https.onCall(async (data, context) => {
  // Only authenticated users can call this function
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debe estar autenticado para crear usuarios lectores."
    );
  }

  // Solo quien tenga el custom claim `admin` puede llamar a esta función
  if (context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Sólo un administrador puede crear usuarios lectores."
    );
  }

  const email = data.email;
  const password = data.password;

  if (!email || !password) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Se requiere correo y contraseña."
    );
  }

  try {
    // 1. Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    // 2. Set custom claims (optional, but good for security rules)
    await admin.auth().setCustomUserClaims(userRecord.uid, { reader: true });

    // 3. Save reader metadata in Firestore
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email,
      role: "reader",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: "Usuario lector creado exitosamente.", uid: userRecord.uid };
  } catch (error: any) {
    console.error("Error creating new user:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "No se pudo crear el usuario lector."
    );
  }
});

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
        admin.auth().listUsers(PAGE_SIZE, t)
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
