"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReaderUser = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
exports.createReaderUser = functions.https.onCall(async (data, context) => {
    // Only authenticated users can call this function
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado para crear usuarios lectores.");
    }
    // Ensure only the admin can call this
    if (context.auth.token.email !== "pretsodatabase@gmail.com") {
        throw new functions.https.HttpsError("permission-denied", "Sólo el administrador puede crear usuarios lectores.");
    }
    const email = data.email;
    const password = data.password;
    if (!email || !password) {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere correo y contraseña.");
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
    }
    catch (error) {
        console.error("Error creating new user:", error);
        throw new functions.https.HttpsError("internal", error.message || "No se pudo crear el usuario lector.");
    }
});
//# sourceMappingURL=index.js.map