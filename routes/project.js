import { Router } from 'express';
import { createProject, getProjects, getProject, deleteProject } from '../controllers/projects.js';

const router = Router();

router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProject);
router.delete('/:id', deleteProject);

export default router;