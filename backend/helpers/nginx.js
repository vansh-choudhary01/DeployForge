import { executeSSHCommands } from "./ssh.js";

export async function setupSubdomain(subdomain, port, pushLog) {
    const nginxConfig = `
server {
    listen 80;
    server_name ${subdomain}.naaspeeti.xyz;

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}`;

    const commands = [
        // Remove old config if redeploying
        `sudo rm -f /etc/nginx/sites-enabled/${subdomain}`,
        `sudo rm -f /etc/nginx/sites-available/${subdomain}`,

        // Write new nginx config
        `cat << 'NGINXEOF' | sudo tee /etc/nginx/sites-available/${subdomain}
${nginxConfig}
NGINXEOF`,

        // Enable it
        `sudo ln -sf /etc/nginx/sites-available/${subdomain} /etc/nginx/sites-enabled/${subdomain}`,

        // Test and reload nginx
        `sudo nginx -t && sudo nginx -s reload`
    ];

    const certbotEmail = process.env.CERTBOT_EMAIL;
    if (!certbotEmail) throw new Error('CERTBOT_EMAIL environment variable is not set');

    // Issue SSL cert for this subdomain
    commands.push(`sudo certbot --nginx -d ${subdomain}.naaspeeti.xyz --non-interactive --agree-tos -m ${certbotEmail}`);

    await executeSSHCommands(commands, [], pushLog);

    pushLog(`[${new Date().toISOString()}] Subdomain ready: https://${subdomain}.naaspeeti.xyz`);
}