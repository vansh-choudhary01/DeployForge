import { Router } from 'express';
import { deployService, getService, redeployService, deleteService, getServiceLogs, setServiceEnv, deleteServiceEnv } from '../controllers/services.js';

const router = Router();

router.post('/deploy', deployService);
router.get('/:id', getService);
router.post('/:id/redeploy', redeployService);
router.delete('/:id', deleteService);
router.get('/:id/logs', getServiceLogs);

// environment variables
router.post('/:id/env', setServiceEnv);
router.delete('/:id/env/:key', deleteServiceEnv);

export default router;
