import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {'projectId': 'pretso-database'})
db = firestore.client()
doc = next(db.collection('companias').limit(1).stream())
print(doc.to_dict().keys())
