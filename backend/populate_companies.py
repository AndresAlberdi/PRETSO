import os
import asyncio
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize firebase admin
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"
cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

async def populate():
    # 1. Fetch all Com records
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
        print(f"Created company {company_doc['siglas']}")

    # 2. Link all transaction_ids from other records to companies
    other_docs = list(records_ref.stream())
    print(f"Found {len(other_docs)} records to check for links.")
    
    for doc in other_docs:
        record_dict = doc.to_dict()
        if record_dict.get("source_table") == "Com":
            continue
        compania_id = record_dict.get("compania_id")
        transaction_id = record_dict.get("transaction_id")
        if compania_id and transaction_id:
            # Find the company by siglas
            comp_ref = db.collection("companies")
            comp_docs = list(comp_ref.where("siglas", "==", compania_id).stream())
            for c_doc in comp_docs:
                c_doc.reference.update({
                    "transaction_ids": firestore.ArrayUnion([transaction_id])
                })
                print(f"Linked transaction {transaction_id} to company {compania_id}")

if __name__ == "__main__":
    asyncio.run(populate())
