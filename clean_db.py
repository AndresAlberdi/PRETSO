import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {'projectId': 'pretso-database'})
db = firestore.client()

collections = ["manejo_de_caja", "salarios", "corpus_christi", "indicadores", "companias", "transacciones", "documentos", "bibliografia"]

for col_name in collections:
    print(f"Deleting collection {col_name}...")
    docs = db.collection(col_name).limit(500).stream()
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1
    while deleted == 500:
        docs = db.collection(col_name).limit(500).stream()
        deleted = 0
        for doc in docs:
            doc.reference.delete()
            deleted += 1
    print(f"Finished deleting {col_name}")
