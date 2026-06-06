import os
import firebase_admin
from firebase_admin import credentials, auth

# Initialize firebase admin
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"
cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

# Get the user by email
email = "testadmin@example.com"
try:
    user = auth.get_user_by_email(email)
    auth.set_custom_user_claims(user.uid, {"role": "administrador"})
    
    # Also write to USERS collection in Firestore
    from firebase_admin import firestore
    db = firestore.client()
    db.collection("users").document(user.uid).set({
        "uid": user.uid,
        "email": email,
        "role": "administrador",
        "panel_access": True,
        "nombre": "Test Admin",
        "institucion": "PRETSO University",
    })
    print(f"Successfully set administrador role for {email}")
except Exception as e:
    print(f"Error: {e}")
