import os, sys, asyncio
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'backend/service-account.json'
sys.path.insert(0, os.path.abspath('.'))
from backend.src.services.search_service import search
async def main():
    res = await search(source_table='CM', page_size=1)
    print("CM:", res['results'][0] if res['results'] else None)
    res = await search(source_table='I', page_size=1)
    print("I:", res['results'][0] if res['results'] else None)
    res = await search(source_table='IdI', page_size=1)
    print("IdI:", res['results'][0] if res['results'] else None)
asyncio.run(main())
