# jane

Práctica de la apertura italiana con tablero interactivo y repetición espaciada.

## Usar

La página publicada está en **https://henryatrl.github.io/chess/**.

- **Entrenar** abre el lote recomendado para hoy.
- **Lotes** permite abrir cualquiera de los **18 grupos de 10 variantes**. Cada tarjeta muestra su avance. Podés practicar otros lotes por elección y repetir los completados.
- **Ver solución** muestra solo la jugada actual, con notación, origen, destino y una flecha. No mueve las piezas ni revela el resto de la línea. Después de hacerla, la ayuda desaparece para la siguiente jugada.
- **← / →** recorre las posiciones ya conocidas, incluida la posición inicial de la variante y las respuestas que ya jugó el rival. También hay botones bajo el tablero. El avance se detiene en la última jugada realizada; no revela movimientos pendientes. Mientras mirás el historial no se pueden mover piezas. **Volver a la actual** retoma la resolución sin cambiar el progreso. Los atajos no interfieren con campos de texto, selectores ni la ayuda.
- Una variante se considera aprendida cuando se completa sin ayuda ni intentos legales fuera de la línea. Si costó, sigue pendiente en el lote y se programa un repaso en 5 minutos.
- Al completar un lote, se muestra su resumen. No se introduce automáticamente una variante número once.
- **Repasos** es una cola separada con las variantes vencidas. Un repaso limpio comienza con 3 días y amplía el intervalo en repasos posteriores. Una variante ya aprendida conserva su historial aunque después requiera ayuda.
- **Biblioteca** permite explorar las 187 entradas originales, recorrer sus jugadas y descargar PGN.
- **Mi progreso** muestra repasos y permite exportar/importar una copia. El progreso se guarda en el navegador, sin cuentas ni sincronización entre dispositivos.

El lote de hoy se mantiene al recargar y durante el día. Al día siguiente se recomienda el primer lote pendiente: si quedó incompleto se retoma ese mismo grupo. Los lotes se pueden abrir manualmente sin esperar al día siguiente.

Se conserva y migra el progreso de versiones anteriores. La clave de almacenamiento `cavallo.progress.v1` permanece para no perder datos al cambiar el nombre de la app. La importación de JSON reemplaza los datos actuales tras confirmación.

## Desarrollo local

Requiere Node.js **22.12+** y npm (validado con Node 24).

```bash
npm ci
npm run dev
```

El puerto predeterminado es 5173. Para limitar el acceso a la computadora local, usá `npm run dev -- --host 127.0.0.1`. Si npm no puede escribir en su caché, usá `npm ci --cache /tmp/jane-npm-cache`.

```bash
npm test                 # Legalidad, lotes, calendario, repasos y migración
npm run build            # TypeScript y compilación de producción
npm run test:e2e         # Pruebas reales en Chromium y HTML sin recursos de red
npm run build:standalone # HTML portátil en dist-offline/index.html
```

Las pruebas del navegador usan `/usr/bin/chromium`; `CHROMIUM_PATH` permite elegir otro ejecutable. La versión portátil incorpora fuentes, piezas, catálogo y licencias. El entorno bloquea `file:`, por lo que se prueba entregando únicamente el HTML en memoria, con la red desactivada; aquí no se verificó la apertura por doble clic. El almacenamiento de archivos locales depende del navegador y la ruta: exportá tu progreso antes de moverlos.

## Datos y límites

La biblioteca usa `lichess-org/chess-openings`, **CC0-1.0**, revisión `a6189a30dc273ccb21fc2536a9a2fefd5592a67a`. Ver [DATA_SOURCES.md](DATA_SOURCES.md).

Los 180 ejercicios de variantes combinan los tres recorridos comentados originales con 177 secuencias del catálogo aptas para jugar con blancas. Se excluyen referencias sin una siguiente jugada de blancas y líneas que dejarían al alumno en jaque sin una respuesta proporcionada. Los nombres pueden repetirse: las secuencias y sus identificadores son distintos. Las posiciones de entrenamiento son legales, pero no están evaluadas con Stockfish ni pretenden cubrir todas las respuestas del rival. Las entradas del catálogo no incluyen explicaciones editoriales; las tres líneas originales sí.

El modo opcional **Tarjetas** conserva las 15 posiciones comentadas y la selección manual del intervalo de repaso. El planificador es simple, no FSRS. No incluye importación de repertorios PGN, motor ni partidas libres.

## Publicar en GitHub Pages

```bash
npm run publish:pages
```

Compila el HTML y actualiza únicamente `gh-pages`, sin force-push ni cambiar la rama del código. El repositorio sirve esa rama desde `/ (root)` mediante Pages. Los cambios de código se guardan y suben por separado. Para servir una compilación local: `npm run preview` después de `npm run build`.

## Archivos principales

- `src/puzzles.ts`: secuencias y transiciones de jugadas; generación de ejercicios del catálogo.
- `src/study.ts`: lotes, recomendación diaria, finalización y migración.
- `src/progress.ts`: persistencia y planificación de repasos.
- `src/PuzzleTrainer.tsx`: práctica de lotes y solución de una sola jugada.
- `src/Piece.tsx`: dibujos SVG originales de las piezas.
- `src/App.tsx`: navegación, lotes, biblioteca y progreso.

Cada tarea de Codex ya tiene un entorno aislado: usá el checkout existente; no hace falta crear un worktree.
