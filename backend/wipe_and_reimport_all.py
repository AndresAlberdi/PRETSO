import os
import asyncio

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "backend/service-account.json"
from backend.src.db.firestore import get_db
from backend.src.services.etl_service import run_etl

async def main():
    db = get_db()
    
    print("Deleting records...")
    count_records = 0
    for doc in db.collection("records").stream():
        doc.reference.delete()
        count_records += 1
    print(f"Deleted {count_records} records.")
        
    print("Deleting transactions...")
    count_tx = 0
    for doc in db.collection("transactions").stream():
        doc.reference.delete()
        count_tx += 1
    print(f"Deleted {count_tx} transactions.")
        
    print("Deleting companies...")
    count_comp = 0
    for doc in db.collection("companies").stream():
        doc.reference.delete()
        count_comp += 1
    print(f"Deleted {count_comp} companies.")
        
    print("Re-importing all tables...")
    dir_path = "/home/andres-alberdi/.gemini/antigravity/scratch/Pretso/PlataformaPRETSO"
    csvs = {
        "Hacia PRETSO Indice de companias.csv": "Com", # Do companies first
        "Hacia PRETSO Companias caja.csv": "CM",
        "Hacia PRETSO Companias salarios.csv": "CS",
        "Hacia PRETSO Corpus Christi.csv": "CC",
        "Hacia PRETSO Indicadores.csv": "I",
        "Hacia PRETSO Identificacion de indicadores.csv": "IdI",
        "Hacia PRETSO bibliografia.csv": "B"
    }
    
    for filename, table in csvs.items():
        print(f"Importing {table}...")
        try:
            with open(os.path.join(dir_path, filename), "rb") as f:
                content = f.read()
            res = await run_etl(content, table, "system")
            print(f"  -> imported: {res['imported']}, skipped: {res['skipped']}, errors: {len(res['errors'])}")
        except Exception as e:
            print(f"Error importing {table}: {e}")
        
    print("Publishing all records...")
    publish_count = 0
    for doc in db.collection("records").stream():
        doc.reference.update({"status": "publicado"})
        publish_count += 1
    print(f"Published {publish_count} records.")

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath("."))
    asyncio.run(main())
