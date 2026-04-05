import { executeSSHCommands } from "./ssh.js";

export async function setupSubdomain(subdomain, port, pushLog, machineIp, proxyOnly = false) {
    let nginxConfig = `
server {
    listen 80;
    server_name ${subdomain}.naaspeeti.xyz;

    location / {
        mirror /wake;
        mirror_request_body off;

        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /wake {
        internal;
        proxy_pass https://naaspeeti.xyz/api/services/wake/${subdomain};
    }
}`;

    if (proxyOnly) {
        nginxConfig = `server {
    listen 80;
    server_name ~^(?<subdomain>.+)\.naaspeeti\.xyz$;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ~^(?<subdomain>.+)\.naaspeeti\.xyz$;

    ssl_certificate /etc/letsencrypt/live/naaspeeti.xyz-0001/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/naaspeeti.xyz-0001/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
      #  proxy_pass https://api.naaspeeti.xyz/api/proxy/$subdomain;
        proxy_pass http://localhost:${port}/api/proxy/$subdomain;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}`;
    }

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

    if (!proxyOnly) {
        // Issue SSL cert for this subdomain
        commands.push(`sudo certbot --nginx -d ${subdomain}.naaspeeti.xyz --non-interactive --agree-tos -m ${certbotEmail}`);
    }

    await executeSSHCommands(commands, [], pushLog, machineIp);

    pushLog(`[${new Date().toISOString()}] Subdomain ready: https://${subdomain}.naaspeeti.xyz`);
}