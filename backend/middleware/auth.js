import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function authenticate(req, res, next) {
    try {
            
        const token = req.cookies.token;

        if (!token) return res.status(401).send('Unauthorized');

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) return res.status(401).send('Unauthorized');

            const { userId } = decoded;

            if (!userId) return res.status(401).send('Unauthorized');
            const user = await User.findById(userId);

            if (!user) return res.status(401).send('Unauthorized');

            req.user = user;
            req.userId = userId;
            next();
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}