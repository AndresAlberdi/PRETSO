import pandas as pd
import numpy as np
ODS_PATH = "/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods"
sheets = {
    'Compañías-Manejo de Caja': 'Transacción',
    'Compañías-Salarios': 'Transacción',
    'Corpus Christi': 'Transacción',
    'Identificación de indicadores': 'Transacción',
    'Compañías y empleador': 'Sigla',
    'Bibliografía': 'Autores',
    'Transacciones': 'Doc1',
    'Documentos': 'Documento'
}

for sheet, key in sheets.items():
    try:
        df = pd.read_excel(ODS_PATH, sheet_name=sheet, engine='odf')
        if key == 'Transacción':
            df[key] = pd.to_numeric(df[key], errors='coerce')
            df.dropna(subset=[key], inplace=True)
        elif key == 'Sigla':
            df['Sigla'] = df['Sigla'].replace(r'^\s*$', np.nan, regex=True)
            df.dropna(subset=['Sigla'], inplace=True)
        else:
            df[key] = df[key].replace(r'^\s*$', np.nan, regex=True)
            df.dropna(subset=[key], inplace=True)
            
        print(f"{sheet}: {len(df)}")
    except Exception as e:
        print(f"Error on {sheet}: {e}")
