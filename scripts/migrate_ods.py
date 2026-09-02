import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import math
import sys

ODS_PATH = '/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods'

try:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'pretso-v2-1784070362'})
except Exception as e:
    print(f"Error initializing Firebase Admin: {e}")
    sys.exit(1)

db = firestore.client()

sheet_collection_map = {
    'Compañías-Manejo de Caja': 'manejo_de_caja',
    'Compañías-Salarios': 'salarios',
    'Corpus Christi': 'corpus_christi',
    'Identificación de indicadores': 'indicadores',
    'Compañías y empleador': 'companias',
    'Bibliografía': 'bibliografia',
    'Transacciones': 'transacciones',
    'Documentos': 'documentos'
}

cols_to_drop = {
    'manejo_de_caja': ['Documento', 'Noticia', 'Autores', 'Compañia', 'Fuentes para la generación del dato'],
    'salarios': ['Documento', 'Noticia', 'Empleadores', 'Compañia', 'Fuentes para la generación del dato'],
    'corpus_christi': ['Documento', 'Noticia ', 'Compañía', 'Compañía2', 'Fuentes para la generación del dato'],
    'indicadores': ['Documento1', 'Noticia', 'Compañía', 'Fuentes para la generación del dato'],
    'transacciones': ['Documento1', 'Documento2', 'Documento3']
}

primary_keys = {
    'manejo_de_caja': 'Transacción',
    'salarios': 'Transacción',
    'corpus_christi': 'Transacción',
    'indicadores': 'Transacción',
    'companias': 'Compañías y empleadores',
    'bibliografia': 'Autores',
    'transacciones': 'Doc1',
    'documentos': 'Documento'
}

def clean_dict(d):
    cleaned = {}
    for k, v in d.items():
        if isinstance(v, float) and math.isnan(v):
            cleaned[k] = None
        else:
            cleaned[k] = v
    return cleaned

for sheet_name, collection_name in sheet_collection_map.items():
    print(f"Processing sheet {sheet_name} into {collection_name}...")
    try:
        df = pd.read_excel(ODS_PATH, sheet_name=sheet_name, engine='odf')
        
        pk = primary_keys.get(collection_name)
        if pk:
            if pk == 'Transacción' or pk == 'Doc1':
                df[pk] = pd.to_numeric(df[pk], errors='coerce')
                df.dropna(subset=[pk], inplace=True)
            else:
                import numpy as np
                df[pk] = df[pk].replace(r'^\s*$', np.nan, regex=True)
                df.dropna(subset=[pk], inplace=True)
        else:
            df.dropna(how='all', inplace=True)
            
        if collection_name == 'companias' and 'Compañías y empleadores' in df.columns:
            df.rename(columns={'Compañías y empleadores': 'Sigla Compañía'}, inplace=True)
        
        # Drop redundant columns
        if collection_name in cols_to_drop:
            drops = [c for c in cols_to_drop[collection_name] if c in df.columns]
            df.drop(columns=drops, inplace=True)

        records = df.to_dict(orient='records')
        
        batch = db.batch()
        count = 0
        
        for record in records:
            clean_rec = clean_dict(record)
            doc_ref = db.collection(collection_name).document()
            batch.set(doc_ref, clean_rec)
            count += 1
            
            if count % 400 == 0:
                batch.commit()
                batch = db.batch()
                
        if count % 400 != 0:
            batch.commit()
            
        print(f"Uploaded {count} records to {collection_name}.")
    except Exception as e:
        print(f"Failed processing {sheet_name}: {e}")

print("Migration complete.")
