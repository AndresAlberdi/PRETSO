import os
import asyncio
from google.cloud.firestore_v1 import ArrayUnion

# Set credential env var
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "backend/service-account.json"

from backend.src.db.firestore import get_db
db = get_db()

from backend.src.services.etl_service import run_etl

CSV_MAPPING = {
    "Hacia PRETSO Indicadores.csv": "I",
    "Hacia PRETSO bibliografia.csv": "B",
}

async def main():
    dir_path = "/home/andres-alberdi/.gemini/antigravity/scratch/Pretso/PlataformaPRETSO"
    
    print("--- Starting ETL Import for Missing Files ---")
    for filename, table_name in CSV_MAPPING.items():
        file_path = os.path.join(dir_path, filename)
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            continue
            
        print(f"\nProcessing {filename} -> Table: {table_name}")
        with open(file_path, "rb") as f:
            content = f.read()
            
        res = await run_etl(content, table_name, "system_import")
        print(f"Result: imported={res['imported']}, rejected={res['rejected']}, skipped={res['skipped']}")
        if res["errors"]:
            print(f"Errors found: {len(res['errors'])}")
            for err in res["errors"][:5]:
                print(f"  Row {err['row']} field {err['field']}: {err['reason']}")

    print("\n--- Generating embeddings and publishing new records ---")
    publish_count = 0
    from backend.src.services.embedding_service import generate_embedding
    
    records_ref = db.collection("records")
    all_records = list(records_ref.stream())
    
    for doc in all_records:
        rdata = doc.to_dict()
        source_table = rdata.get("source_table")
        if source_table not in ("B", "I"):
            continue
            
        updates = {}
        if rdata.get("status") != "publicado":
            updates["status"] = "publicado"
            
        if not rdata.get("embedding"):
            noticia_text = rdata.get("noticia") or ""
            if noticia_text:
                try:
                    embedding = await generate_embedding(noticia_text)
                    updates["embedding"] = embedding
                except Exception as e:
                    print(f"Error generating embedding for {doc.id}: {e}")
                    
        if updates:
            doc.reference.update(updates)
            if "status" in updates:
                publish_count += 1
                
    print(f"Published/updated {publish_count} records.")
    
    total_records = len(all_records)
    rule_ref = db.collection("config").document("launch_rule")
    rule_ref.set({
        "published_count": total_records,
        "threshold": 10,
        "portal_active": True
    })
    
    print("--- Done ---")

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath("."))
    asyncio.run(main())
