import pandas as pd
import numpy as np

ODS_PATH = "/home/andres-alberdi/Descargas/Hacia PRETSO rev AA 1.ods"
sheets = {
    'Compañías-Manejo de Caja': 66,
    'Compañías-Salarios': 44,
    'Corpus Christi': 21,
    'Identificación de indicadores': 56,
    'Compañías y empleador': 19,
    'Bibliografía': 18,
    'Transacciones': 139,
    'Documentos': 75
}

for sheet, expected in sheets.items():
    try:
        df = pd.read_excel(ODS_PATH, sheet_name=sheet, engine='odf')
        # Replace empty strings and whitespace with NaN
        df.replace(r'^\s*$', np.nan, regex=True, inplace=True)
        df_all = df.dropna(how='all')
        
        # Check dropping where the first column is NA
        first_col = df.columns[0]
        df_sub = df.dropna(subset=[first_col])
        
        print(f"Sheet '{sheet}':")
        print(f"  Expected: {expected}")
        print(f"  Raw rows: {len(df)}")
        print(f"  dropna(all): {len(df_all)}")
        print(f"  dropna(subset=[{first_col}]): {len(df_sub)}")
    except Exception as e:
        print(f"Error on {sheet}: {e}")
