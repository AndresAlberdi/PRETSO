import pandas as pd
df = pd.read_excel("/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods", sheet_name='Corpus Christi', engine='odf')
print(df.columns.tolist())
