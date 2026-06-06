import os
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize firebase admin
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"
cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

records_ref = db.collection("records")
docs = list(records_ref.stream())
print(f"Publishing all {len(docs)} records...")

for doc in docs:
    if doc.to_dict().get("status") != "publicado":
        doc.reference.update({"status": "publicado"})
        print(f"Published {doc.id}")

# Force update launch_rule count
rule_ref = db.collection("config").document("launch_rule")
rule_ref.set({
    "published_count": len(docs),
    "threshold": 10,
    "portal_active": True
})
print("Completed publishing all records.")
