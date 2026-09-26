import os
import pandas as pd

ODS_PATH = os.environ.get(
    "PRETSO_ODS_PATH",
    os.path.expanduser("~/Documentos/PRETSO/Hacia PRETSO rev AA 1.ods"),
)

df = pd.read_excel(ODS_PATH, sheet_name='Corpus Christi', engine='odf')
print([c for c in df.columns if 'Compañía' in str(c)])
