import { NextFunction, Request, Response, Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { aiController } from './ai.controller';
import { aiService } from './ai.service';
import { AppError } from '../../middlewares/errorHandler';

const router = Router();

const safeEquals = (left: string, right: string) => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const requireGatewayToken = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const configuredToken = await aiService.gatewayToken();
        if (!configuredToken) {
            next(new AppError('AI gateway token is not configured', 503, 'AI_GATEWAY_LOCKED'));
            return;
        }

        const authorization = req.header('authorization') || '';
        const providedToken = authorization.startsWith('Bearer ')
            ? authorization.slice(7).trim()
            : '';

        if (!providedToken || !safeEquals(providedToken, configuredToken)) {
            next(new AppError('Invalid AI gateway token', 401, 'AI_GATEWAY_UNAUTHORIZED'));
            return;
        }
        next();
    } catch (error) {
        next(error);
    }
};

router.get('/', aiController.info);
router.get('/health', aiController.health);
router.get('/models', requireGatewayToken, aiController.models);
router.post('/chat/completions', requireGatewayToken, aiController.chatCompletions);

export default router;
