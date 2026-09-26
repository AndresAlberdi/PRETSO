import os
import pandas as pd

ODS_PATH = os.environ.get(
    "PRETSO_ODS_PATH",
    os.path.expanduser("~/Documentos/PRETSO/Hacia PRETSO rev AA 1.ods"),
)

df = pd.read_excel(ODS_PATH, sheet_name='Documentos', engine='odf')
print("Documentos cols:", df.columns.tolist())
df2 = pd.read_excel(ODS_PATH, sheet_name='Transacciones', engine='odf')
print("Transacciones cols:", df2.columns.tolist())
