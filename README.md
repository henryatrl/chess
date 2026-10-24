# Cavallo

Una app local, en español, para aprender la apertura italiana con un tablero interactivo y repetición espaciada.

## Abrir como página web con GitHub Pages

La app es estática y puede servirse con GitHub Pages. El enlace previsto es **https://henryatrl.github.io/chess/** una vez activada la publicación.

En el repositorio `henryatrl/chess`, entrá a **Settings → Pages** y elegí:

- **Source:** Deploy from a branch.
- **Branch:** `gh-pages`.
- **Folder:** `/ (root)`.

Guardá con **Save**. GitHub construye el sitio después de habilitarlo; el enlace aparece en esa misma pantalla cuando termina. Esta configuración requiere permisos de administración del repositorio y que tu cuenta permita Pages para su visibilidad actual. No hace falta cambiar la visibilidad del repositorio para preparar los archivos.

Para actualizar la versión publicada después de cambiar el código, ejecutá `npm run publish:pages` desde un checkout con acceso de escritura a GitHub. El comando compila el HTML portátil y actualiza únicamente la rama `gh-pages`, sin cambiar la rama de código ni usar force-push. No activa Pages por API: esa opción se configura una vez en GitHub. Guardá y subí los cambios del código fuente por separado.

El progreso se guarda en el navegador bajo el dominio del sitio; si venís de la versión descargable, exportalo allí e importalo en la página publicada.

## Abrir sin instalar nada

La versión portátil es un **solo archivo HTML** con la aplicación, el catálogo, las piezas y las fuentes incorporados. Abrí `Cavallo.html` (o `dist-offline/index.html`) con Chrome, Chromium o Edge haciendo doble clic. No requiere Internet, Node ni servidor. El contenido se verificó en Chromium con la conexión desactivada, entregando únicamente el HTML mediante una respuesta simulada. La política del navegador de este entorno bloquea las direcciones `file:`, por lo que aquí no se pudo comprobar la apertura por doble clic.

Conservá el archivo en la misma ubicación: el almacenamiento de archivos locales depende del navegador y de su ruta. Exportá tu progreso desde «Mi progreso» antes de moverlo o reemplazarlo. Si tu navegador impide guardarlo, la app muestra una advertencia y permite exportar una copia.

Para generar una copia desde el código: `npm ci` y después `npm run build:standalone`. El resultado está en `dist-offline/index.html`.

## Ejecutar

Requiere Node.js **22.12 o superior** (probado con Node 24) y npm.

```bash
cd /ruta/al/repositorio/chess
npm ci
npm run dev
```

Vite muestra la dirección local y el puerto en la terminal; el puerto predeterminado es **5173**. En una máquina compartida se puede limitar a la interfaz local con `npm run dev -- --host 127.0.0.1`. Para detenerlo, presioná Ctrl+C.

Si la máquina no permite escribir en la caché de npm, usá `npm ci --cache /tmp/cavallo-npm-cache`.

## Qué incluye

- **Modo Puzzles como pantalla inicial**: tablero grande, tema oscuro, respuestas automáticas del rival, confirmación visual por jugada y secuencias completas. Hay tres recorridos: Giuoco Piano (6 jugadas de blancas), Pianissimo (5) y Dos Caballos (5). La línea del Piano incluye la recuperación final en d2 para resolver el jaque.
- Pistas en dos pasos (pieza y flecha al destino), reintento de jugadas fuera de la línea, solución revelable y botón «Siguiente puzzle». Ver la solución se registra como ayuda, no como acierto.
- Al completar un puzzle, sus cinco posiciones guiadas se programan automáticamente para repasar: 3 días si se recordaron sin ayuda y 1 día para las que costaron. Una solución revelada vuelve en 5 minutos. «Mis repasos» muestra variantes con posiciones vencidas. Las tarjetas conservan la elección manual de intervalos.
- 15 posiciones guiadas: cinco de Giuoco Piano, cinco de Giuoco Pianissimo y cinco de Dos Caballos con d3. Jugás con blancas, haciendo clic o arrastrando las piezas; las negras responden automáticamente.
- Movimientos legales, enroque, destinos disponibles, pistas y explicaciones de las ideas. Una jugada legal fuera del repertorio se distingue de una jugada ilegal.
- Repasos programados: «Otra vez» vuelve en 5 minutos; los intervalos iniciales de «Difícil», «Bien» y «Fácil» son de 1, 3 y 7 días. Los aciertos posteriores amplían el intervalo. Es un planificador simple, no FSRS.
- Biblioteca de **187 entradas de italiana** de Lichess, con búsqueda, navegación de posiciones y descarga de líneas en PGN. Es un catálogo de referencia; no son 187 lecciones guiadas.
- Avance, racha y porcentaje de respuestas sin ayuda. Se considera sin ayuda cuando no hubo pistas, respuesta revelada ni intentos fallidos en esa posición.
- Progreso en `localStorage`, exportación e importación en JSON. La importación reemplaza el progreso actual tras confirmarlo. No hay cuenta ni sincronización entre dispositivos.
- Interfaz adaptable a teléfono y computadora, piezas SVG y fuentes incluidas localmente.

La aplicación no requiere claves, base de datos remota, motor de ajedrez ni servicios externos al usarse. Necesitás Internet para instalar dependencias si trabajás con el código fuente. La versión de desarrollo requiere su servidor; la versión portátil funciona directamente como archivo. No es una PWA.

## Fuentes y límites

Los datos de aperturas proceden de [`lichess-org/chess-openings`](https://github.com/lichess-org/chess-openings), licencia **CC0-1.0**, revisión fijada `a6189a30dc273ccb21fc2536a9a2fefd5592a67a`. La copia de `c.tsv`, su licencia y su procedencia están en `public/data/`. Ver [DATA_SOURCES.md](DATA_SOURCES.md).

Las 15 tarjetas y sus explicaciones son una selección editorial de Cavallo. Las líneas se comprueban como jugadas legales con **chess.js**. No se han evaluado con Stockfish y no se presentan como las únicas jugadas buenas o como un curso oficial de Lichess. Las transposiciones pueden aparecer en más de una rama porque se estudian en contextos distintos.

No incluye todavía importación de repertorios PGN, análisis con motor, juego libre contra una computadora ni un repertorio completo de todas las respuestas posibles.

## Validación

```bash
npm test                 # Datos, legalidad de las 187 líneas y 15 ejercicios, planificación y persistencia
npm run build            # TypeScript y compilación de producción
npm run test:e2e         # Genera el HTML portátil y prueba navegador + archivo sin conexión
```

Las pruebas del navegador usan `/usr/bin/chromium` en este entorno. En otra computadora, configurá `CHROMIUM_PATH` con la ruta de Chromium o Chrome, o instalá Chromium de Playwright y apuntá a su ejecutable. No hace falta un navegador para las pruebas de datos ni para compilar.

Para servir la compilación de producción después de `npm run build`, ejecutá `npm run preview` (puerto predeterminado 4173). Los cambios de código requieren compilar de nuevo.

## Desarrollo

- `src/data/repertoire.ts`: posiciones guiadas, objetivos, respuestas y explicaciones.
- `src/puzzles.ts`: recorridos completos y transiciones de jugada, respuesta del rival, pistas y solución.
- `src/PuzzleTrainer.tsx`: modo puzzles, selección de variante, reintentos y guardado automático.
- `src/progress.ts`: formato de almacenamiento y planificador de repasos.
- `src/Board.tsx`: tablero accesible por teclado, clic y arrastre.
- `src/App.tsx`: sesiones, biblioteca, progreso y copias de seguridad.
- `tests/`: pruebas de legalidad, planificación y recorridos en navegador.

Cada tarea de Codex ya tiene un entorno aislado: usá el checkout existente; no hace falta crear un worktree.
