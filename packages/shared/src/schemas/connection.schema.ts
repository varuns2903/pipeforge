import mongoose from 'mongoose';

// A saved, reusable data-source connection (Postgres, S3, or a generic API).
// Node config in a pipeline stores only `connectionId` — never raw
// credentials — and the worker resolves + decrypts this at execution time
// (see apps/worker's connection.resolver). Both apps/api (CRUD) and
// apps/worker (resolving at run time) need this schema.
export const connectionSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['postgres', 's3', 'api'], required: true },
  // Non-secret fields, safe to return from the API as-is:
  //   postgres: { host, port, database, user, ssl }
  //   s3:       { bucket, region }
  //   api:      { baseUrl, authType: 'none' | 'bearer' | 'header', headerName? }
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  // AES-256-GCM ciphertext (see packages/shared/src/crypto.ts) of a JSON blob
  // holding whatever's secret for this type:
  //   postgres: { password }
  //   s3:       { accessKeyId, secretAccessKey }
  //   api:      { token }
  encryptedSecret: { type: String, required: true },
}, { timestamps: true });

connectionSchema.index({ ownerId: 1 });
