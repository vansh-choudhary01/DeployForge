import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    gitDeploymentCredentials: {
        provider: {
            type: String,
            default: "github"
        },
        username: {
            type: String
        },
        token: {
            type: String
        },
        connectedAt: {
            type: Date,
            default: Date.now
        }
    },
    projects: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Project',
        required: false
    }
});

userSchema.methods.generateJWT = function () {
    const token = jwt.sign({ userId: this._id }, process.env.JWT_SECRET);
    return token;
}

userSchema.pre('save', async function () {
    const user = this;
    if (!user.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
})

export default mongoose.model('User', userSchema);