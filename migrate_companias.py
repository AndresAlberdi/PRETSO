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

print("Processing companias...")
df = pd.read_excel(ODS_PATH, sheet_name='Compañías y empleador', engine='odf')
pk = 'Compañías y empleadores'
df[pk] = df[pk].replace(r'^\s*$', np.nan, regex=True)
df.dropna(subset=[pk], inplace=True)

# Rename to match frontend consistency
df.rename(columns={'Compañías y empleadores': 'Sigla Compañía'}, inplace=True)

records = df.to_dict(orient='records')
batch = db.batch()
count = 0
for record in records:
    clean_rec = clean_dict(record)
    doc_ref = db.collection('companias').document()
    batch.set(doc_ref, clean_rec)
    count += 1
batch.commit()
print(f"Uploaded {count} records to companias.")
