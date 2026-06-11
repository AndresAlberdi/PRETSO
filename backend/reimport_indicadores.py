import os
import asyncio

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "backend/service-account.json"
from backend.src.db.firestore import get_db
from backend.src.services.etl_service import run_etl

async def main():
    db = get_db()
    print("Deleting existing I and IdI records...")
    deleted = 0
    # First query all I and IdI records and delete them
    for doc in db.collection("records").where("source_table", "in", ["I", "IdI"]).stream():
        doc.reference.delete()
        deleted += 1
    print(f"Deleted {deleted} records.")

    print("Re-importing I and IdI records...")
    dir_path = "/home/andres-alberdi/.gemini/antigravity/scratch/Pretso/PlataformaPRETSO"
    csvs = {
        "Hacia PRETSO Indicadores.csv": "I",
        "Hacia PRETSO Identificacion de indicadores.csv": "IdI",
    }
    
    for filename, table in csvs.items():
        with open(os.path.join(dir_path, filename), "rb") as f:
            content = f.read()
        res = await run_etl(content, table, "system")
        print(f"{filename} -> imported: {res['imported']}, skipped: {res['skipped']}, errors: {len(res['errors'])}")
        
    print("Setting status to publicado...")
    publish_count = 0
    for doc in db.collection("records").where("source_table", "in", ["I", "IdI"]).stream():
        doc.reference.update({"status": "publicado"})
        publish_count += 1
    print(f"Published {publish_count} records.")

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath("."))
    asyncio.run(main())
