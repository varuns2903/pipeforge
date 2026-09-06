export declare class PipelineService {
    create(name: string, projectId: string, ownerId: string): Promise<import("mongoose").Document<unknown, {}, {
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps, {
        id: string;
    }, {
        timestamps: true;
    }> & Omit<{
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>>;
    list(projectId: string, ownerId: string): Promise<(import("mongoose").Document<unknown, {}, {
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps, {
        id: string;
    }, {
        timestamps: true;
    }> & Omit<{
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>)[]>;
    getById(pipelineId: string, projectId: string, ownerId: string): Promise<import("mongoose").Document<unknown, {}, {
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps, {
        id: string;
    }, {
        timestamps: true;
    }> & Omit<{
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>>;
    update(pipelineId: string, projectId: string, ownerId: string, data: {
        name?: string;
        nodes?: any[];
        edges?: any[];
    }): Promise<import("mongoose").Document<unknown, {}, {
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps, {
        id: string;
    }, {
        timestamps: true;
    }> & Omit<{
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>>;
    delete(pipelineId: string, projectId: string, ownerId: string): Promise<import("mongoose").Document<unknown, {}, {
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps, {
        id: string;
    }, {
        timestamps: true;
    }> & Omit<{
        name: string;
        projectId: import("mongoose").Types.ObjectId;
        nodes: any[];
        edges: any[];
    } & import("mongoose").DefaultTimestampProps & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>>;
}
export declare const pipelineService: PipelineService;
//# sourceMappingURL=pipeline.service.d.ts.map