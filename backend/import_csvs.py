import os
import asyncio

# Set credential env var so firestore.py initializes correctly
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"

from backend.src.services.etl_service import run_etl

async def import_all():
    # 1. Import Com
    com_path = "/home/andres-alberdi/.gemini/antigravity/scratch/Pretso/PlataformaPRETSO/Hacia PRETSO Indice de companias.csv"
    with open(com_path, "rb") as f:
        com_bytes = f.read()
    res1 = await run_etl(com_bytes, "Com", "test_admin_uid")
    print("Com upload result:", res1)

    # 2. Import CM
    cm_path = "/home/andres-alberdi/.gemini/antigravity/scratch/Pretso/PlataformaPRETSO/Hacia PRETSO Corpus Christi.csv"
    with open(cm_path, "rb") as f:
        cm_bytes = f.read()
    res2 = await run_etl(cm_bytes, "CM", "test_admin_uid")
    print("CM upload result:", res2)

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath(".."))
    asyncio.run(import_all())
