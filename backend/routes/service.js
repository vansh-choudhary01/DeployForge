import { Router } from 'express';
import { validateRepo, getServices, deployService, getService, redeployService, deleteService, getServiceLogs, setServiceEnv, deleteServiceEnv, updateServiceConfig } from '../controllers/services.js';

const router = Router();

// Validation endpoint
router.post('/validate-repo', validateRepo);

router.get('/', getServices);
router.post('/deploy', deployService);
router.get('/:id', getService);
router.post('/:id/redeploy', redeployService);
router.patch('/:id', updateServiceConfig);
router.delete('/:id', deleteService);
router.get('/:id/logs', getServiceLogs);

// environment variables
router.post('/:id/env', setServiceEnv);
router.delete('/:id/env/:key', deleteServiceEnv);

export default router;
