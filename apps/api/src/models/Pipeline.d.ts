import mongoose from 'mongoose';
export declare const Pipeline: mongoose.Model<{
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
}> & Omit<{
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & mongoose.HydratedDocumentOverrides<{
    id: string;
}>, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps"> & {
    timestamps: true;
}> & Omit<{
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & mongoose.HydratedDocumentOverrides<{
    id: string;
}>, unknown, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
    name: string;
    projectId: mongoose.Types.ObjectId;
    nodes: any[];
    edges: any[];
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=Pipeline.d.ts.map