import pandas as pd
df = pd.read_excel("/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods", sheet_name='Corpus Christi', engine='odf')
print([c for c in df.columns if 'Compañía' in str(c)])
