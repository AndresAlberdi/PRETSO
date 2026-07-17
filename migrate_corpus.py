import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import math
import numpy as np

ODS_PATH = "/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods"

cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {'projectId': 'pretso-v2-1784070362'})
db = firestore.client()

def clean_dict(d):
    cleaned = {}
    for k, v in d.items():
        if isinstance(v, float) and math.isnan(v):
            cleaned[k] = None
        else:
            cleaned[k] = v
    return cleaned

print("Deleting corpus_christi...")
docs = db.collection('corpus_christi').stream()
batch = db.batch()
for doc in docs:
    batch.delete(doc.reference)
batch.commit()

print("Processing corpus_christi...")
df = pd.read_excel(ODS_PATH, sheet_name='Corpus Christi', engine='odf')
pk = 'Transacción'
df[pk] = pd.to_numeric(df[pk], errors='coerce')
df.dropna(subset=[pk], inplace=True)

# Drop redundant columns, BUT KEEP COMPAÑIA
cols_to_drop = ['Documento', 'Noticia ', 'Fuentes para la generación del dato']
df.drop(columns=[c for c in cols_to_drop if c in df.columns], inplace=True)

records = df.to_dict(orient='records')
batch = db.batch()
count = 0
for record in records:
    clean_rec = clean_dict(record)
    doc_ref = db.collection('corpus_christi').document()
    batch.set(doc_ref, clean_rec)
    count += 1
batch.commit()
print(f"Uploaded {count} records to corpus_christi.")
