import os
import pandas as pd

ODS_PATH = os.environ.get(
    "PRETSO_ODS_PATH",
    os.path.expanduser("~/Documentos/PRETSO/Hacia PRETSO rev AA 1.ods"),
)

df1 = pd.read_excel(ODS_PATH, sheet_name='Compañías-Manejo de Caja', engine='odf')
print("Manejo de Caja:", df1.columns.tolist())
df2 = pd.read_excel(ODS_PATH, sheet_name='Compañías-Salarios', engine='odf')
print("Salarios:", df2.columns.tolist())
