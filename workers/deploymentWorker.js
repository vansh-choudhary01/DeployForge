import Deployment from "../models/deployment.js";

setInterval(async () => {
    const deployment = await Deployment.findOneAndUpdate(
        { status: "queued" },
        { status: "building" }
    );

    if (!deployment) return;

    runDeployment(deployment);
}, 2000);

async function runDeployment(deployment) {
    try {
        await cloneRepo()
        await buildDocker()
        await runContainer()

        deployment.status = "running"
    } catch (err) {
        deployment.status = "failed"
    }

    await deployment.save()
}