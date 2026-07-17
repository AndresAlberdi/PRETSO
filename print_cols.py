import pandas as pd
df1 = pd.read_excel("/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods", sheet_name='Compañías-Manejo de Caja', engine='odf')
print("Manejo de Caja:", df1.columns.tolist())
df2 = pd.read_excel("/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods", sheet_name='Compañías-Salarios', engine='odf')
print("Salarios:", df2.columns.tolist())
