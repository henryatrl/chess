import openingsTsv from '../../public/data/lichess-c.tsv?raw';
import { parseCatalogue } from '../puzzles';

export const catalogue = parseCatalogue(openingsTsv);
