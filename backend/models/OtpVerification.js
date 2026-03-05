import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    payload: {
        type: Object,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: '0' }
    },
});

otpSchema.index({ email: 1 });

export default mongoose.model('OtpVerification', otpSchema);