import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import sendEmail from '../utils/sendEmail.js';
import bcrypt from 'bcrypt';

export async function registerUser(req, res) {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);

        const otpVerification = await OtpVerification.findOneAndUpdate(
            { email },
            { email, otp: hashedOtp, payload: { fullName, email, password }, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
            { upsert: true, new: true }
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

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
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