import { Router } from 'express';
import { registerUser, loginUser, verifyUser, connectGitHub, getGithubRepos, getCurrentUser, logoutUser } from '../controllers/users.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyUser);
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', logoutUser);
router.post('/github/connect', authenticate, connectGitHub);
router.post('/github/repos', authenticate, getGithubRepos);

export default router;