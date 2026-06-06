import os
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize firebase admin
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"
cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

# 1. Update at least 15 records to "publicado"
records_ref = db.collection("records")
docs = list(records_ref.limit(15).stream())
for doc in docs:
    doc.reference.update({"status": "publicado"})
    print(f"Published record {doc.id}")

# 2. Force update launch_rule in config/launch_rule
rule_ref = db.collection("config").document("launch_rule")
rule_ref.set({
    "published_count": 15,
    "threshold": 10,
    "portal_active": True
})
print("Updated launch_rule: threshold=10, published_count=15, portal_active=True")
