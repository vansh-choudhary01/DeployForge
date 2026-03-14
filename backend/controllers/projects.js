import User from '../models/User.js';
import Project from '../models/Project.js';
import Service from '../models/Service.js';

export async function createProject(req, res) {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const projectId = `PRJ-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const project = await Project.create({ projectId, name, user: req.userId });

        res.status(200).json({ message: 'Project created', project });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

export async function getProjects(req, res) {
    try {
        const projects = await Project.find({ user: req.userId });
        if (!projects || projects.length === 0) {
            return res.status(200).json({ message: 'No projects found', projects: [] });
        }

        const services = await Service.find({ project: { $in: projects.map((p) => p._id) } });
        const servicesByProject = services.reduce((acc, service) => {
            const projectId = service.project.toString();
            acc[projectId] = acc[projectId] || [];
            acc[projectId].push(service);
            return acc;
        }, {});

        const enrichedProjects = projects.map((project) => {
            const projectObj = project.toObject();
            projectObj.services = servicesByProject[project._id.toString()] || [];
            return projectObj;
        });

        res.status(200).json({ message: 'Projects found', projects: enrichedProjects });
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

        const project = await Project.findOne({ user: req.userId, projectId: id });
        if (!project) {
            return res.status(400).json({ message: 'Project does not exist' });
        }

        const services = await Service.find({ project: project._id });
        const projectObj = project.toObject();
        projectObj.services = services;

        res.status(200).json({ message: 'Project found', project: projectObj });
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

        const project = await Project.findOne({ user: req.userId, projectId: id });
        if (!project) {
            return res.status(400).json({ message: 'Project does not exist' });
        }

        const serviceCount = await Service.countDocuments({ project: project._id });
        if (serviceCount > 0) {
            return res.status(400).json({
                message: 'Project has services. Delete all services inside this project before deleting the project.'
            });
        }

        await Project.findByIdAndDelete(project._id);
        res.status(200).json({ message: 'Project deleted' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}