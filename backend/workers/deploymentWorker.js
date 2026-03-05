import Deployment from "../models/Deployment";

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

class DeployTool extends Tool {
    constructor() {
        super('deploy_repo', 'Deploy a GitHub repository to preconfigured EC2 instance');
    }

    async call(input, context = {}) {
        const { repoUrl, port = getNextPort() } = input;
        const { env } = context;
        console.log(input);

        if (!repoUrl) {
            return { ok: false, error: 'repoUrl required' };
        }

        if (!repoUrl.startsWith('https://github.com/')) {
            return { ok: false, error: 'Only GitHub repos allowed' };
        }

        const appName = `app-${Date.now()}`;

        console.log(`Deploying ${repoUrl} as ${appName} on port ${port}`);

        try {
            // Step 1: Clone repo and inspect structure
            const inspectCommands = [
                'mkdir -p ~/apps',
                'cd ~/apps',
                `git clone ${repoUrl} ${appName}`,
                `cd ${appName}`,
                'echo "FILES_START"',
                'ls',
                'echo "FILES_END"',
                'echo "PACKAGE_START"',
                '[ -f package.json ] && cat package.json || echo "NO_PACKAGE_JSON"',
                'echo "PACKAGE_END"'
            ];

            const inspectResult = await runWithQueue(() => runSSHCommands(inspectCommands));

            console.log('Inspect result:');
            console.log(inspectResult);

            // Step 2: Ask AI how to start
            const prompt = `
You are a deployment assistant.

Repository structure:
${inspectResult.output}

Determine how to start this Node.js project.

Rules:
- If package.json has "start" script → use "npm start"
- If package.json has main → use "node <main>"
- If index.js exists → use "node index.js"
- If nothing found → return null

Return JSON only:
{ "startCommand": "npm start" }
`;

            const llmResult = await Planner.callLLM(prompt);

            console.log('LLM result:');
            console.log(llmResult);

            if (!llmResult || !llmResult.startCommand) {
                return { ok: false, error: 'Could not determine start command' };
            }

            const startCommand = llmResult.startCommand;

            // Step 3: Create Dockerfile dynamically
            const dockerCommands = [
                `cd ~/apps/${appName}`
            ];

            // Create .env file if env provided
            if (env && Object.keys(env).length > 0) {
                const envLines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\\n');
                dockerCommands.push(`echo -e '${envLines}' > .env`);
            }

            dockerCommands.push(
                `echo 'FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ${JSON.stringify(startCommand.split(' '))}
' > Dockerfile`,
                `docker build -t ${appName} .`
            );

            // Add env-file flag if env provided
            const dockerRunCmd = env && Object.keys(env).length > 0 
                ? `docker run -d --name ${appName} -p ${port}:4000 --env-file .env ${appName}`
                : `docker run -d --name ${appName} -p ${port}:4000 ${appName}`;
            
            dockerCommands.push(dockerRunCmd);

            const deployResult = await runSSHCommands(dockerCommands);

            console.log('Deploy result:');
            console.log(deployResult);

            return {
                ok: true,
                result: {
                    appName,
                    startCommand,
                    url: `http://${process.env.EC2_HOST}:${port}`,
                    logs: deployResult.output
                }
            };

        } catch (err) {
            console.error('Deployment error:', err);
            return { ok: false, error: err.message };
        }
    }
}


function runSSHCommands(commands) {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
            conn.exec(commands.join(' && '), (err, stream) => {
                if (err) return reject(err);

                let output = '';
                let error = '';

                stream.on('data', data => {
                    output += data.toString();
                });

                stream.stderr.on('data', data => {
                    error += data.toString();
                });

                // change: check exit code
                stream.on('close', (code) => {
                    conn.end();

                    if (code === 0) {
                        resolve({ output, error });
                    } else {
                        reject(new Error(error || `Command failed with code ${code}`));
                    }
                });
            });
        });

        // small safe wrapper
        conn.on('error', (err) => reject(err));
        conn.connect({
            host: process.env.EC2_HOST,
            username: process.env.EC2_USER,
            privateKey: fs.readFileSync(process.env.EC2_SSH_KEY_PATH)
        });
    });
}