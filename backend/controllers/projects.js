import User from '../models/User.js';
import Project from '../models/Project.js';

export async function createProject(req, res) {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        const projectId = `PRJ-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const project = await Project.create({ projectId, name, user: user._id });

        res.status(200).json({ message: 'Project created', project });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function getProjects(req, res) {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        const projects = await Project.find({ user: user._id });
        if (!projects) {
            return res.status(400).json({ message: 'No projects found' });
        }

        res.status(200).json({ message: 'Projects found', projects });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function getProject(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        const project = await Project.findOne({ user: user._id, projectId: id });
        if (!project) {
            return res.status(400).json({ message: 'Project does not exist' });
        }

        res.status(200).json({ message: 'Project found', project });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function deleteProject(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        const project = await Project.findOneAndDelete({ user: user._id, projectId: id });
        if (!project) {
            return res.status(400).json({ message: 'Project does not exist' });
        }
        
        res.status(200).json({ message: 'Project deleted' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}