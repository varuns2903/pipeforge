import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare class PipelineController {
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    get(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    validate(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    run(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
}
export declare const pipelineController: PipelineController;
//# sourceMappingURL=pipeline.controller.d.ts.map