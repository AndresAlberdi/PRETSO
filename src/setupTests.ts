import { configure } from '@testing-library/react';

// Con la máquina o el CI cargados, el plazo por defecto de 1 s de findBy/waitFor no alcanza
// y las pruebas fallan de forma intermitente sin que haya un defecto. Un plazo mayor solo afecta
// a las esperas que ya fallarían: una prueba correcta sigue terminando en cuanto se cumple la condición.
configure({ asyncUtilTimeout: 5000 });
