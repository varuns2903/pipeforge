"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
    async register(req, res, next) {
        try {
            const { email, password, name } = req.body;
            const result = await auth_service_1.authService.register(email, password, name);
            res.status(201).json(result);
        }
        catch (error) {
            if (error.message === 'Email already in use') {
                res.status(400).json({ error: error.message });
                return;
            }
            next(error);
        }
    }
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.authService.login(email, password);
            res.json(result);
        }
        catch (error) {
            if (error.message === 'Invalid credentials') {
                res.status(401).json({ error: error.message });
                return;
            }
            next(error);
        }
    }
    async me(req, res) {
        // Requires auth middleware to populate req.user
        res.json({ user: req.user });
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map