import mongoose from 'mongoose';
import { pipelineSchema } from '@pipeforge/shared';

export const Pipeline = mongoose.model('Pipeline', pipelineSchema);
