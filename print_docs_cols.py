import pandas as pd
df = pd.read_excel("/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods", sheet_name='Documentos', engine='odf')
print("Documentos cols:", df.columns.tolist())
df2 = pd.read_excel("/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods", sheet_name='Transacciones', engine='odf')
print("Transacciones cols:", df2.columns.tolist())
