import mongoose from 'mongoose';
import { executionSchema } from '@pipeforge/shared';

export const Execution = mongoose.model('Execution', executionSchema);
