import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {'projectId': 'pretso-v2-1784070362'})
db = firestore.client()

docs = list(db.collection('transacciones').limit(1).stream())
if docs:
    print("Transacciones cols:", list(docs[0].to_dict().keys()))

docs = list(db.collection('bibliografia').limit(1).stream())
if docs:
    print("Bibliografia cols:", list(docs[0].to_dict().keys()))
