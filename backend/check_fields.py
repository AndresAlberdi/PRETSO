import asyncio
import os
import sys

from collections import defaultdict

# Agrega la raíz al sys.path para importar correctamente
sys.path.insert(0, os.path.abspath("."))
from backend.src.db.firestore import get_db

async def check_fields():
    db = get_db()
    
    tables = ["CM", "CS", "CC"]
    for table in tables:
        docs = db.collection("records").where("source_table", "==", table).stream()
        
        counts = defaultdict(int)
        total = 0
        for doc in docs:
            total += 1
            data = doc.to_dict()
            for k, v in data.items():
                if v is not None and v != "":
                    counts[k] += 1
                    
        print(f"--- Table {table} (Total: {total}) ---")
        for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {k}: {v}")

if __name__ == "__main__":
    asyncio.run(check_fields())
