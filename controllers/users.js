import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import sendEmail from '../utils/sendEmail.js';
import bcrypt from 'bcrypt';

export async function registerUser(req, res) {
    try {
        const { firstName, lastName, email, password } = req.body;
        console.log(req.body);
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);

        await OtpVerification.findOneAndUpdate(
            { email },
            { email, otp: hashedOtp, payload: { fullName : firstName + ' ' + lastName, email, password }, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
            { upsert: true }
        );

        await sendEmail(email, 'Your OTP for Render', `Your OTP is ${otp}, it will expire in 5 minutes.`);

        res.status(200).json({ message: 'OTP sent to email' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function loginUser(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        const token = user.generateJWT();

        res.cookie('token', token, {
            maxAge: 60 * 60 * 24 * 7, // 7 days
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        });

        res.status(200).json({ message: 'Logged in successfully' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function verifyUser(req, res) {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const otpVerification = await OtpVerification.findOne({ email });
        if (!otpVerification) {
            return res.status(400).json({ message: 'OTP is incorrect' });
        }
        const isOtpCorrect = await bcrypt.compare(otp, otpVerification.otp);
        if (!isOtpCorrect) {
            return res.status(400).json({ message: 'OTP is incorrect' });
        }

        await OtpVerification.findOneAndDelete({ email });
        user = await User.create({ email, ...otpVerification.payload });

        const token = user.generateJWT();
        res.cookie('token', token, {
            maxAge: 60 * 60 * 24 * 7, // 7 days
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        });

        res.status(200).json({ message: 'Logged in successfully' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function getCurrentUser(req, res) {
    try {
        const user = req.user;
        res.status(200).json({
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.firstName + ' ' + user.lastName
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function logoutUser(req, res) {
    try {
        res.clearCookie('token');
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function connectGitHub(req, res) {
    try {
        const { token } = req.body;
        const userId = req.userId;

        // verify token and get user info
        const response = await axios.get(
            "https://api.github.com/user",
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json"
                }
            }
        );

        const username = response.data.login;

        await User.findByIdAndUpdate(userId, {
            gitDeploymentCredentials: {
                username,
                token,
                connectedAt: new Date()
            }
        })

        return res.json({
            message: 'GitHub connected successfully',
            username,
        })
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function getGithubRepos(req, res) {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        const token = user?.gitDeploymentCredentials?.token;
        if (!token) {
            return res.status(400).json({ message: 'GitHub not connected' });
        }

        const response = await axios.get(
            "https://api.github.com/user/repos?per_page=100&sort=updated",
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json"
                }
            }
        );

    //     commitHash: "",
    //   commitMessage: "",
    //   logs: [],
    //   dockerImage: "",
    //   containerId: "",
    //   port: 3000,
    //   deployedUrl: "",
        console.log(response.data);
        const repos = response.data.map(repo => ({
            name: repo.name,
            owner: repo.owner.login,
            fullName: repo.full_name,
            private: repo.private,
            cloneUrl: repo.clone_url,
            updatedAt: repo.updated_at,
            
        }));

        return res.json({
            message: 'GitHub repos found',
            repos
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}