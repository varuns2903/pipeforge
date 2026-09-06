import mongoose from 'mongoose';
export declare const Execution: mongoose.Model<{
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & mongoose.HydratedDocumentOverrides<{
    id: string;
}>, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & mongoose.HydratedDocumentOverrides<{
    id: string;
}>, unknown, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
    pipelineId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    pipelineSnapshot?: any;
    status: "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";
    startedAt?: NativeDate;
    completedAt?: NativeDate;
    results?: any;
    error?: string;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=Execution.d.ts.map