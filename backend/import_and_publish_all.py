import os
import asyncio
from google.cloud.firestore_v1 import ArrayUnion

# Set credential env var
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"

from backend.src.db.firestore import get_db
db = get_db()

from backend.src.services.etl_service import run_etl

CSV_MAPPING = {
    "Hacia PRETSO Companias caja.csv": "CM",
    "Hacia PRETSO Companias salarios.csv": "CS",
    "Hacia PRETSO Corpus Christi.csv": "CC",
    "Hacia PRETSO Identificacion de indicadores.csv": "IdI",
    "Hacia PRETSO Indicadores.csv": "I",
    "Hacia PRETSO Indice de companias.csv": "Com",
    "Hacia PRETSO bibliografia.csv": "B",
}

async def main():
    dir_path = "/home/andres-alberdi/.gemini/antigravity/scratch/Pretso/PlataformaPRETSO"
    
    print("Clearing collections: records, companies, transactions...")
    for col_name in ["records", "companies", "transactions"]:
        col_ref = db.collection(col_name)
        docs = col_ref.list_documents()
        deleted = 0
        for doc in docs:
            doc.delete()
            deleted += 1
        print(f"Deleted {deleted} documents from {col_name}")

    print("--- Starting ETL Import ---")
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
                
    print("\n--- Retroactively populating companies and linking transactions ---")
    records_ref = db.collection("records")
    com_docs = list(records_ref.where("source_table", "==", "Com").stream())
    print(f"Found {len(com_docs)} Com records.")
    
    for doc in com_docs:
        record_dict = doc.to_dict()
        record_id = doc.id
        
        temporadas = []
        val_ind = record_dict.get("valor_indicador")
        if val_ind:
            temporadas = [t.strip() for t in val_ind.split(",") if t.strip()]
        
        company_doc = {
            "id": record_id,
            "siglas": record_dict.get("siglas") or "",
            "autor_principal": record_dict.get("autor_principal") or "",
            "ambito": record_dict.get("ambito") or "España",
            "temporadas": temporadas,
            "transaction_ids": [],
        }
        db.collection("companies").document(record_id).set(company_doc)
        print(f"Populated company: {company_doc['siglas']}")

    print("\nLinking transaction IDs to companies...")
    all_records = list(records_ref.stream())
    link_count = 0
    for doc in all_records:
        record_dict = doc.to_dict()
        if record_dict.get("source_table") == "Com":
            continue
        compania_id = record_dict.get("compania_id")
        transaction_id = record_dict.get("transaction_id")
        if compania_id and transaction_id:
            comp_ref = db.collection("companies")
            comp_docs = list(comp_ref.where("siglas", "==", compania_id).stream())
            for c_doc in comp_docs:
                c_doc.reference.update({
                    "transaction_ids": ArrayUnion([transaction_id])
                })
                link_count += 1
    print(f"Successfully established {link_count} links.")

    print("\n--- Generating embeddings and publishing all records ---")
    publish_count = 0
    from backend.src.services.embedding_service import generate_embedding
    
    for doc in all_records:
        rdata = doc.to_dict()
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

    # Force update launch_rule count
    total_records = len(all_records)
    rule_ref = db.collection("config").document("launch_rule")
    rule_ref.set({
        "published_count": total_records,
        "threshold": 10,
        "portal_active": True
    })
    print(f"Launch rule updated: threshold=10, published_count={total_records}, portal_active=True")
    print("--- Done ---")

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath(".."))
    asyncio.run(main())
