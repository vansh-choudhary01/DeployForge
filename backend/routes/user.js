import { Router } from 'express';
import { registerUser, loginUser, verifyUser, getCurrentUser, logoutUser } from '../controllers/users.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify', verifyUser);
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', logoutUser);

export default router;