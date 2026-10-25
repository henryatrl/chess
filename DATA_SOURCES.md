# Procedencia de las aperturas

| Material | Fuente | Licencia / procedencia |
| --- | --- | --- |
| Catálogo ECO, nombres y secuencias PGN | [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings/tree/a6189a30dc273ccb21fc2536a9a2fefd5592a67a) | CC0-1.0 |
| Copia local del volumen C | `public/data/lichess-c.tsv` | `c.tsv` de la revisión indicada |
| Dedicación de dominio público | `public/data/LICHESS-CC0.txt` | Copia de `COPYING.txt` del mismo repositorio |
| Identificación de versión | `public/data/source.json` | URL, SHA completo y licencia |
| 15 ejercicios y explicaciones | `src/data/repertoire.ts` | Selección editorial escrita para jane |

La biblioteca filtra las filas cuyo nombre empieza por **Italian Game**, lo que produce **187 entradas** en esta revisión. Se incluyen transposiciones: no todas las líneas llegan a la italiana por el mismo orden de jugadas. El archivo original se conserva entero para mantener intacta la fuente.

Las entradas del catálogo identifican aperturas; no aportan por sí solas comentarios didácticos, recomendaciones de repertorio, estadísticas de partidas ni evaluaciones de motor. Las explicaciones de jane no se atribuyen a Lichess.

Los tests cargan cada PGN con chess.js y comprueban la legalidad de los 15 ejercicios, incluida la respuesta automática de las negras. Esto verifica legalidad, no fuerza ajedrecística. No se ha ejecutado Stockfish para certificar las recomendaciones.

## Variantes practicables

Los tres recorridos originales se combinan con 177 secuencias del catálogo para formar 180 variantes en 18 lotes de 10. El generador de `src/puzzles.ts` conserva identificadores estables derivados de las jugadas, excluye referencias con menos de siete medias jugadas y posiciones que terminan dando jaque a las blancas sin incluir una respuesta. Los ejercicios del catálogo empiezan tras las tres primeras jugadas completas y se validan reproduciendo toda la secuencia. No se inventan explicaciones para estas entradas.

Los lotes se asignan en orden fijo y el lote recomendado se mantiene durante el día. Los cambios futuros del orden o del catálogo requieren revisar las migraciones y pruebas de progreso.

## Actualizaciones

Para actualizar la fuente, elegí explícitamente un nuevo commit del repositorio de Lichess y descargá `c.tsv` y `COPYING.txt` de ese mismo commit mediante HTTPS. Actualizá `source.json`, revisá los cambios y ejecutá las pruebas. El test del número de entradas fija la revisión actual: si cambia, verificá el nuevo catálogo antes de actualizar ese número y los textos de la interfaz.

Las piezas SVG se dibujaron para esta aplicación. Las fuentes DM Sans y Manrope se distribuyen mediante paquetes Fontsource con sus licencias OFL; los iconos proceden de Lucide (ISC). No se descargan imágenes ni fuentes desde terceros durante el uso de la app.
