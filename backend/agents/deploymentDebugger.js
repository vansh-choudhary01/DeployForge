import { GoogleGenAI, Type } from "@google/genai";

const SSH_REFUSED_PATTERN = /econnrefused.*:22|connect.*refused.*(?:port\s*)?22|ssh.*connection refused/i;
const PLATFORM_FAILURE_PATTERN = /etimedout.*:22|ssh.*(?:handshake|not ready|unavailable)|ssh never became|cannot connect to (?:the )?docker daemon|error response from daemon|docker daemon|port is already allocated|no space left on device|disk quota exceeded|cannot allocate memory|oomkilled|enospc|enetunreach|ehostunreach|eai_again|(?:ec2|ecr|s3|aws|rabbitmq|redis|mongodb).*(?:unavailable|connection refused|timeout|timed out|throttl|accessdenied|failed)|(?:connection refused|timeout).*(?:rabbitmq|redis|mongodb)/i;

const RULES = [
    [/repository not found|authentication failed|permission denied \(publickey\)/i, "The repository could not be accessed.", "The URL is wrong, the repository is private, or access was not granted.", ["Confirm the repository URL and branch.", "Grant repository access, then redeploy."], false],
    [/remote branch .* not found|couldn't find remote ref|pathspec .* did not match/i, "The configured Git branch was not found.", "The branch in service settings does not exist.", ["Check the branch name and letter case.", "Update the branch and redeploy."], false],
    [/npm (err!|error)|npm: not found|missing script/i, "The Node.js build command failed.", "The build script, dependencies, lockfile, or Node.js version may be incompatible.", ["Run the same build command locally and fix its first error.", "Confirm package.json contains the configured scripts."], false],
    [/no space left on device|disk quota exceeded/i, "The deployment host ran out of disk space.", "Docker images, build files, or logs filled the disk.", ["Remove unused Docker data and build files.", "Increase the host disk size if this repeats."], false],
    [/heap out of memory|cannot allocate memory|out of memory|oomkilled/i, "The build or application ran out of memory.", "The host or container lacks enough memory for this build.", ["Reduce build memory use or upgrade the instance.", "Check for unusually large builds."], false],
    [/address already in use|port is already allocated|bind.*failed/i, "The application port is already in use.", "Another process or container is using the selected port.", ["Stop the conflicting process or container.", "Redeploy to allocate a free port."], true],
    [/unable to detect listening port|container .* is not running|exited with code|health check/i, "The application did not stay available after startup.", "The start command crashed, or the app did not listen on process.env.PORT and 0.0.0.0.", ["Check the startup error immediately above this message.", "Listen on process.env.PORT and host 0.0.0.0."], false],
    [SSH_REFUSED_PATTERN, "The Claude machine is currently down, so the deployment cannot proceed.", "The deployment infrastructure is temporarily unavailable. This is not caused by your application.", ["Wait a few minutes and retry the deployment.", "If it continues to fail, contact support."], true],
    [/timed out|econnreset|connection reset|eai_again|temporary failure|ssh never became available/i, "A temporary connection failure interrupted deployment.", "The host, registry, or Git provider was temporarily unreachable.", ["Wait briefly and redeploy.", "If it repeats, check host networking and provider status."], true],
];

function redact(value = "") {
    return String(value)
        .replace(/(authorization:\s*(?:bearer|basic)\s+)[^\s]+/gi, "$1[REDACTED]")
        .replace(/((?:api[_-]?key|token|password|secret|private[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]")
        .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@");
}

function localDiagnosis(errorMessage, logText) {
    const match = RULES.find(([pattern]) => pattern.test(`${errorMessage}\n${logText}`));
    if (match) {
        return { summary: match[1], likelyCause: match[2], suggestedSteps: match[3], retryable: match[4], source: "local" };
    }
    return {
        summary: "The deployment failed and the debugging agent could not identify a reliable automatic fix.",
        likelyCause: errorMessage || "The deployment command returned no specific error.",
        suggestedSteps: ["Review the first error in the build output.", "Run the configured build and start commands locally."],
        retryable: false,
        source: "local",
    };
}

function simplifyPlatformFailure(diagnosis, evidence) {
    if (!diagnosis.platformRelated && !SSH_REFUSED_PATTERN.test(evidence) && !PLATFORM_FAILURE_PATTERN.test(evidence)) return diagnosis;

    return {
        summary: "Claude's deployment backend is currently unavailable, so the deployment cannot proceed.",
        likelyCause: "A Claude machine or internal deployment service is temporarily down. This is not caused by your application.",
        suggestedSteps: ["Wait a few minutes and retry the deployment.", "If it continues to fail, contact support."],
        retryable: true,
        source: diagnosis.source,
    };
}

export async function debugDeploymentFailure({ error, logs = [], service }) {
    const errorMessage = redact(error?.message || String(error || "Unknown deployment error"));
    const logText = redact(logs
        .map(log => typeof log === "string" ? log : log?.message)
        .filter(Boolean)
        .join("\n")
        .slice(-12000));
    const evidence = `${errorMessage}\n${logText}`;
    const fallback = simplifyPlatformFailure(localDiagnosis(errorMessage, logText), evidence);
    if (!process.env.GEMINI_API_KEY) return fallback;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: process.env.GEMINI_DEBUG_MODEL || "gemini-3.5-flash",
            contents: `Diagnose this deployment failure using only the supplied data. Do not invent evidence or claim a fix was applied. Write concise, non-technical messages for an application owner. Set platformRelated true when the cause belongs to Claude's backend, deployment machines, AWS infrastructure, Docker daemon, SSH connectivity, internal queues or databases, platform networking, port allocation, disk, or memory. Set it false for the user's repository, branch, dependencies, build command, start command, or application code. Never ask the user to inspect platform infrastructure; that is support's responsibility. Mark retryable true only for transient failures.\n\nService (environment values omitted):\n${JSON.stringify({
                deploymentType: service?.deploymentType,
                branch: service?.gitBranch,
                rootDirectory: service?.rootDirectory,
                buildCommand: service?.buildCommand,
                preDeployCommand: service?.preDeployCommand,
                startCommand: service?.startCommand,
                environmentVariableNames: service?.environmentVariables?.map(item => item.key),
            })}\n\nFinal error:\n${errorMessage}\n\nRecent redacted logs:\n${logText || "No logs captured."}`,
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    required: ["summary", "likelyCause", "suggestedSteps", "retryable", "platformRelated"],
                    properties: {
                        summary: { type: Type.STRING },
                        likelyCause: { type: Type.STRING },
                        suggestedSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        retryable: { type: Type.BOOLEAN },
                        platformRelated: { type: Type.BOOLEAN },
                    },
                },
            },
        });
        const result = JSON.parse(response.text);
        if (!result?.summary || !result?.likelyCause || !Array.isArray(result?.suggestedSteps) || typeof result?.retryable !== "boolean" || typeof result?.platformRelated !== "boolean") {
            return fallback;
        }
        const diagnosis = { ...result, suggestedSteps: result.suggestedSteps.slice(0, 4), source: "gemini" };
        return simplifyPlatformFailure(diagnosis, evidence);
    } catch (debuggerError) {
        console.error("Gemini deployment debugger failed:", debuggerError.message);
        return fallback;
    }
}

export function formatDeploymentDiagnosis(diagnosis) {
    const steps = diagnosis.suggestedSteps.map((step, index) => `${index + 1}. ${step}`).join(" ");
    return `${diagnosis.summary} Likely cause: ${diagnosis.likelyCause} Next steps: ${steps}`;
}
