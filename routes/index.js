import { Router } from 'express';
import projectRouter from './project.js';
import serviceRouter from './service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use('/users', authenticate, );
router.use('/projects', authenticate, projectRouter);
router.use('/services', authenticate, serviceRouter);

export default router;