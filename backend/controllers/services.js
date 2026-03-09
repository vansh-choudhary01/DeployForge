import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import Project from "../models/Project.js";

export async function validateRepo(req, res) {
  try {
    const { repo } = req.body;

    if (!repo) {
      return res.status(400).json({ message: 'Repository URL is required' });
    }

    // Validate GitHub URL format
    const githubUrlRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\.git)?\/?$/;
    if (!githubUrlRegex.test(repo)) {
      return res.status(400).json({ message: 'Invalid GitHub URL format' });
    }

    try {
      const match = repo.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        return res.status(400).json({ message: 'Invalid GitHub URL format' });
      }

      const [, owner, repoName] = match;
      const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;

      const response = await fetch(apiUrl);
      
      if (response.status === 404) {
        return res.status(404).json({ message: 'Repository not found. Please verify the URL is correct and the repository is public.' });
      }
      
      if (!response.ok) {
        return res.status(500).json({ message: 'Failed to verify repository. Please try again.' });
      }

      const repoData = await response.json();

      if (repoData.private) {
        return res.status(403).json({ message: 'Repository is private. Only public repositories are supported.' });
      }

      return res.json({
        message: 'Repository verified successfully',
        repo: {
          name: repoData.name,
          url: repoData.html_url,
          isPublic: !repoData.private,
          description: repoData.description,
        }
      });
    } catch (err) {
      console.error('GitHub API error:', err);
      return res.status(500).json({ message: 'Failed to verify repository with GitHub' });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function getServices(req, res) {
  try {
    const userId = req.userId;

    const projects = await Project.find({ user: userId });
    if (!projects) {
      return res.status(200).json({ message: 'No services found', services: [] });
    }

    const services = await Service.find({ project: { $in: projects.map(p => p._id) } });

    return res.json({
      message: 'Services found',
      services
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function deployService(req, res) {
  try {
    const {
      repo,
      branch,
      rootDirectory,
      buildCommand,
      publishDirectory,
      preDeployCommand,
      startCommand,
      healthCheckPath,
      commitHash,
      commitMessage,
      projectId,
    } = req.body;
    if (
      !repo ||
      !branch ||
      !buildCommand ||
      !publishDirectory ||
      !preDeployCommand ||
      !startCommand ||
      !healthCheckPath
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userId = req.userId;

    const user = req.user;

    const service = await Service.create({
      project: projectId,
      name: repo.split('/').pop().split('.git').shift(),
      gitRepositoryUrl: repo,
      gitBranch: branch,
      rootDirectory,
      buildCommand,
      publishDirectory,
      preDeployCommand,
      startCommand,
      healthCheckPath,
      status: "pending",
      environmentVariables: [],
      port: 3000,
      logs: [],
    });

    const deployment = await Deployment.create({
      service: service._id,
      status: "queued",
      commitHash,
      commitMessage,
      logs: [],
      dockerImage: "",
      containerId: "",
      port: 3000,
      deployedUrl: "",
    });

    return res.json({
      message: "Deployment queued",
      service,
      deployment,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

export async function getService(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deployments = await Deployment.find({ service: id }).sort({ createdAt: -1 });

    return res.json({
      message: 'Service found',
      service,
      deployments
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function redeployService(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deployment = await Deployment.create({
      service: service._id,
      status: 'queued',
      logs: [],
      dockerImage: '',
      containerId: '',
      port: service.port || 3000,
      deployedUrl: '',
    });

    service.status = 'pending';
    await service.save();

    return res.json({
      message: 'Redeployment queued',
      deployment
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function deleteService(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await Deployment.deleteMany({ service: id });

    await Service.findByIdAndDelete(id);

    return res.json({
      message: 'Service deleted successfully'
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function getServiceLogs(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deployment = await Deployment.findOne({ service: id }).sort({ createdAt: -1 });

    if (!deployment) {
      return res.json({
        message: 'No deployment logs found',
        logs: [],
        status: 'No deployments'
      });
    }

    return res.json({
      message: 'Service logs retrieved',
      logs: deployment.logs,
      status: deployment.status,
      deploymentId: deployment._id
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function setServiceEnv(req, res) {
  try {
    const { id } = req.params;
    const { key, value } = req.body;
    const userId = req.userId;

    if (!key || value === undefined) {
      return res.status(400).json({ message: 'Key and value are required' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const envIndex = service.environmentVariables.findIndex(ev => ev.key === key);
    if (envIndex >= 0) {
      service.environmentVariables[envIndex].value = value;
    } else {
      service.environmentVariables.push({ key, value });
    }

    await service.save();

    return res.json({
      message: 'Environment variable set successfully',
      service
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function deleteServiceEnv(req, res) {
  try {
    const { id, key } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    service.environmentVariables = service.environmentVariables.filter(ev => ev.key !== key);
    await service.save();

    return res.json({
      message: 'Environment variable deleted successfully',
      service
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}
