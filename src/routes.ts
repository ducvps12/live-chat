import { Router } from 'express';
import authRoutes, { googleCallback } from './modules/auth/auth.routes';
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
import { campaignController } from './modules/campaign/campaign.controller';
import publicAIManagementRoutes from './modules/ai/public-api.routes';
import automationRoutes from './modules/automation/automation.routes';
import radarRoutes from './modules/radar/radar.routes';

const rootRouter = Router();

// Google OAuth callback — mounted at /api/google-auth AND /api/auth/google/callback
rootRouter.get('/google-auth', googleCallback);
rootRouter.get('/auth/google/callback', googleCallback);

rootRouter.get('/campaigns/unsubscribe', campaignController.unsubscribePage);
rootRouter.post('/campaigns/unsubscribe', campaignController.unsubscribe);

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
rootRouter.use('/tax', taxRoutes); // Tax config
rootRouter.use('/email', emailRoutes); // Email integration (SMTP/IMAP)
// Existing tenant screens use this path; keep it as an alias while the API is
// standardized on /email.
rootRouter.use('/email-accounts', emailRoutes);
rootRouter.use('/admin', adminRoutes); // Super admin panel
rootRouter.use('/bank', bankRoutes); // Bank payment integration (ACB)
rootRouter.use('/ai-api', publicAIManagementRoutes); // Workspace API project/key management
rootRouter.use('/automation', automationRoutes); // Declarative, approval-gated AI workflows
rootRouter.use('/radar', radarRoutes); // Workspace website-change monitoring and alerts

export default rootRouter;
