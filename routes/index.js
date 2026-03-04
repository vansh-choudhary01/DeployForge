import { Router } from 'express';
import userRouter from './user.js';
import projectRouter from './project.js';
import serviceRouter from './service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use('/users', userRouter);
router.use('/projects', authenticate, projectRouter);
router.use('/services', authenticate, serviceRouter);

export default router;