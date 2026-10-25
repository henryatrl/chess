import { catalogue } from './catalogue';
import { buildStudyPuzzles } from '../puzzles';
import { studyBatches } from '../study';

export const studyPuzzles = buildStudyPuzzles(catalogue);
export const batches = studyBatches(studyPuzzles);
