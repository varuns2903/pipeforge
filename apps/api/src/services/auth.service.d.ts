export declare class AuthService {
    register(email: string, password: string, name: string): Promise<{
        user: {
            id: any;
            email: any;
            name: any;
            createdAt: any;
            updatedAt: any;
        };
        token: string;
    }>;
    login(email: string, password: string): Promise<{
        user: {
            id: any;
            email: any;
            name: any;
            createdAt: any;
            updatedAt: any;
        };
        token: string;
    }>;
    private generateAuthResponse;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map