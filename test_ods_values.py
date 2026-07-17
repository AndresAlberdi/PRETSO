import pandas as pd
import numpy as np
ODS_PATH = "/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods"
df = pd.read_excel(ODS_PATH, sheet_name='Compañías-Manejo de Caja', engine='odf')
col = df.columns[0]
print(df[col].unique()[:20])
print(f"NaN count: {df[col].isna().sum()}")
# Check if replacing '' or space helps
df[col] = df[col].replace(r'^\s*$', np.nan, regex=True)
print(f"NaN count after regex replace: {df[col].isna().sum()}")

# What if we drop rows where 'Transacción' is nan?
print(f"Transacción NaN count: {df['Transacción'].isna().sum()}")
df['Transacción'] = pd.to_numeric(df['Transacción'], errors='coerce')
print(f"Transacción NaN count after coerce: {df['Transacción'].isna().sum()}")
print(f"Length if dropna on Transacción: {len(df.dropna(subset=['Transacción']))}")

