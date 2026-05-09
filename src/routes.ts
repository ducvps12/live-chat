import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import { googleCallback } from './modules/auth/auth.routes';
import workspaceRoutes from './modules/workspace/workspace.routes';
import conversationRoutes from './modules/conversation/conversation.routes';
import macroRoutes from './modules/macro/macro.routes';
import externalSessionRoutes from './modules/external-session/externalSession.routes';
import uploadRoutes from './modules/upload/upload.routes';
import { facebookPublicRoutes } from './modules/facebook/facebook.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import distributionRoutes from './modules/distribution/distribution.routes';
import businessHoursRoutes from './modules/business-hours/businessHours.routes';
import productRoutes from './modules/product/product.routes';
import orderRoutes from './modules/order/order.routes';
import taxRoutes from './modules/tax/tax.routes';
import emailRoutes from './modules/email/email.routes';
import adminRoutes from './modules/admin/admin.routes';
import bankRoutes from './modules/bank/bank.routes';

const rootRouter = Router();

// Google OAuth callback — mounted at /api/google-auth (matches Google Cloud Console callback URL)
rootRouter.get('/google-auth', googleCallback);

// Mount modules
rootRouter.use('/auth', authRoutes);
rootRouter.use('/workspaces', workspaceRoutes);
rootRouter.use('/conversations', conversationRoutes);
rootRouter.use('/macros', macroRoutes);
rootRouter.use('/external-sessions', externalSessionRoutes);
rootRouter.use('/upload', uploadRoutes);
rootRouter.use('/facebook', facebookPublicRoutes); // Facebook webhook & OAuth callback (public — no auth)
rootRouter.use('/chatbots', chatbotRoutes); // AI Chatbot management + auto-reply
rootRouter.use('/distribution-rules', distributionRoutes); // Auto-routing rules
rootRouter.use('/business-hours', businessHoursRoutes); // Working hours config
rootRouter.use('/products', productRoutes); // Product management + Google Sheet sync
rootRouter.use('/orders', orderRoutes); // Order management
rootRouter.use('/taxes', taxRoutes); // Tax management
rootRouter.use('/email-accounts', emailRoutes); // Email channel integration
rootRouter.use('/admin', adminRoutes); // Super Admin panel
rootRouter.use('/bank', bankRoutes); // ATM Auto Bank — MB Bank transaction history

// Health check
rootRouter.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

export default rootRouter;
