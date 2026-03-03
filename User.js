import mongoose from 'mongoose';

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

export default mongoose.model('User', userSchema);