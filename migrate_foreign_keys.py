import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {'projectId': 'pretso-database'})
db = firestore.client()

def migrate():
    print("Fetching companias...")
    companias_ref = db.collection('companias')
    companias = companias_ref.get()
    
    # map Sigla to Indicador de registro
    sigla_to_index = {}
    for doc in companias:
        data = doc.to_dict()
        sigla = data.get("Sigla Compañía")
        indicador = data.get("Indicador de registro")
        if sigla and indicador is not None:
            sigla_to_index[str(sigla).strip()] = indicador
    
    print(f"Found {len(sigla_to_index)} companias.")

    collections_to_migrate = ['manejo_de_caja', 'salarios', 'indicadores']
    
    for coll in collections_to_migrate:
        print(f"Migrating {coll}...")
        docs = db.collection(coll).get()
        batch = db.batch()
        updates = 0
        for doc in docs:
            data = doc.to_dict()
            sigla = data.get("Sigla Compañía")
            # Only update if it matches a sigla. If it is already a number, it will be ignored since sigla is a string
            # wait, if the sigla is already updated to a number, `str(sigla).strip()` will just be the number.
            # But sigla_to_index's keys are original string acronyms. So it is idempotent!
            if sigla and str(sigla).strip() in sigla_to_index:
                batch.update(doc.reference, {"Sigla Compañía": sigla_to_index[str(sigla).strip()]})
                updates += 1
                if updates > 0 and updates % 400 == 0:
                    batch.commit()
                    batch = db.batch()
        batch.commit()
        print(f"Updated {updates} records in {coll}")

    # Corpus Christi has multiple columns (Compañía, Compañía1, Compañía2...)
    print("Migrating corpus_christi...")
    docs = db.collection('corpus_christi').get()
    batch = db.batch()
    updates = 0
    for doc in docs:
        data = doc.to_dict()
        needs_update = False
        update_data = {}
        for k, v in data.items():
            if k.startswith("Compañía") or k.startswith("Cmp"):
                if v and str(v).strip() in sigla_to_index:
                    update_data[k] = sigla_to_index[str(v).strip()]
                    needs_update = True
        
        if needs_update:
            batch.update(doc.reference, update_data)
            updates += 1
            if updates > 0 and updates % 400 == 0:
                batch.commit()
                batch = db.batch()
    batch.commit()
    print(f"Updated {updates} records in corpus_christi")

if __name__ == "__main__":
    migrate()
