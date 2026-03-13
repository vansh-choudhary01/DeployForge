import { Router } from 'express';
import { getDeployment, getDeploymentLogs } from '../controllers/deployments.js';

const router = Router();

router.get('/:id', getDeployment);
router.get('/:id/logs', getDeploymentLogs);

export default router;
