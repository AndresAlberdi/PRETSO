import os
import firebase_admin
from firebase_admin import credentials, auth
import sys

# Using Application Default Credentials.
try:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'pretso-v2-1784070362'})
except Exception as e:
    print(f"Error initializing Firebase Admin: {e}")
    sys.exit(1)

# Credenciales por variable de entorno: nunca en el código.
# Uso:  PRETSO_ADMIN_EMAIL=... PRETSO_ADMIN_PASSWORD=... python3 create_user.py
email = os.environ.get("PRETSO_ADMIN_EMAIL")
password = os.environ.get("PRETSO_ADMIN_PASSWORD")

if not email or not password:
    print("Faltan PRETSO_ADMIN_EMAIL y/o PRETSO_ADMIN_PASSWORD en el entorno.")
    sys.exit(1)

try:
    user = auth.get_user_by_email(email)
    print(f"User {email} already exists. Updating password...")
    auth.update_user(user.uid, password=password)
except firebase_admin.auth.UserNotFoundError:
    print(f"Creating user {email}...")
    user = auth.create_user(email=email, password=password)
    
print("Success!")
