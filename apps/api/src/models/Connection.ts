import mongoose from 'mongoose';
import { connectionSchema } from '@pipeforge/shared';

export const Connection = mongoose.model('Connection', connectionSchema);
