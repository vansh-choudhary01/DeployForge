import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

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
        username: {
            type: String,
            required: false
        },
        token: {
            type: String,
            required: false
        },
        repositoryUrls: {
            type: [String],
            required: false
        },
        projects: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Project',
            required: false
        }
    }
});

userSchema.methods.generateJWT = function () {
    const token = jwt.sign({ userId: this._id }, process.env.JWT_SECRET);
    return token;
}

userSchema.pre('save', async function (next) {
    const user = this;
    if (!user.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
})

export default mongoose.model('User', userSchema);