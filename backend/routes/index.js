import { Router } from 'express';
import userRouter from './user.js';
import projectRouter from './project.js';
import serviceRouter from './service.js';
import deploymentRouter from './deployment.js';
import { authenticate } from '../middleware/auth.js';
import { subdomainProxy } from '../controllers/proxy.js';

const router = Router();

router.use('/users', userRouter);
router.use('/projects', authenticate, projectRouter);
router.use('/services', authenticate, serviceRouter);
router.use('/deployments', authenticate, deploymentRouter);
router.use('/proxy', subdomainProxy);

export default router;