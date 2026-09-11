import mongoose from 'mongoose';

// A saved, reusable data-source connection (Postgres, S3, or a generic API),
// scoped to a project — every member of that project (any role) can use it
// in a connector node, matching how Pipeline is project-scoped rather than
// user-scoped. `createdBy` is informational only (who set it up) and is
// never consulted for authorization; access is entirely derived from the
// project's membership (see apps/api's projectService.getById(projectId,
// userId, minRole)). Node config in a pipeline stores only `connectionId` —
// never raw credentials — and the worker resolves + decrypts this at
// execution time (see apps/worker/src/resolveConnections.ts), additionally
// checking connection.projectId matches the executing pipeline's projectId
// as defense in depth against a hand-crafted node config referencing a
// connection from a different project. Both apps/api (CRUD) and apps/worker
// (resolving at run time) need this schema.
export const connectionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['postgres', 'mysql', 's3', 'api'], required: true },
  // Non-secret fields, safe to return from the API as-is:
  //   postgres: { host, port, database, user, ssl }
  //   mysql:    { host, port, database, user, ssl }
  //   s3:       { bucket, region }
  //   api:      { baseUrl, authType: 'none' | 'bearer' | 'header', headerName? }
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  // AES-256-GCM ciphertext (see packages/shared/src/crypto.ts) of a JSON blob
  // holding whatever's secret for this type:
  //   postgres: { password }
  //   mysql:    { password }
  //   s3:       { accessKeyId, secretAccessKey }
  //   api:      { token }
  encryptedSecret: { type: String, required: true },
}, { timestamps: true });

connectionSchema.index({ projectId: 1 });
