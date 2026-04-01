export function wakingUpPage(serviceName) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Starting ${serviceName}...</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, sans-serif; background: #f9f9f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
        .card { background: #fff; border: 0.5px solid #e5e5e3; border-radius: 12px; padding: 2.5rem 2rem; max-width: 420px; width: 100%; text-align: center; }
        .spinner-wrap { width: 52px; height: 52px; border-radius: 50%; background: #f5f5f3; border: 0.5px solid #e5e5e3; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; }
        .spinner { width: 22px; height: 22px; border: 2px solid #e5e5e3; border-top-color: #888; border-radius: 50%; animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .title { font-size: 18px; font-weight: 500; color: #1a1a18; margin-bottom: 8px; }
        .subtitle { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 1.75rem; }
        .svc { font-family: monospace; font-size: 13px; background: #f5f5f3; border: 0.5px solid #e5e5e3; border-radius: 8px; padding: 6px 14px; display: inline-block; margin-bottom: 1.75rem; }
        .steps { text-align: left; border-top: 0.5px solid #e5e5e3; padding-top: 1.25rem; display: flex; flex-direction: column; gap: 10px; }
        .step { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #666; }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot.done { background: #1D9E75; }
        .dot.active { background: #888; animation: pulse 1.2s ease-in-out infinite; }
        .dot.pending { background: #e5e5e3; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .footer { margin-top: 1.5rem; font-size: 12px; color: #aaa; }
    </style>
</head>
<body>
    <div class="card">
        <div class="spinner-wrap"><div class="spinner"></div></div>
        <p class="title">Starting your service</p>
        <p class="subtitle">This service was sleeping due to inactivity.<br>It'll be ready in a few seconds.</p>
        <div class="svc">${serviceName}.naaspeeti.xyz</div>
        <div class="steps">
            <div class="step"><div class="dot done"></div><span>Service found</span></div>
            <div class="step" id="s2"><div class="dot active"></div><span>Starting container</span></div>
            <div class="step" id="s3"><div class="dot pending"></div><span style="color:#bbb" id="s3l">Waiting for app to be ready</span></div>
        </div>
        <p class="footer">Refreshing in <span id="cd">5</span>s</p>
    </div>
    <script>
        let t = 5;
        setInterval(() => {
            t--;
            document.getElementById('cd').textContent = t;
            if (t === 3) {
                document.querySelector('#s2 .dot').className = 'dot done';
                document.querySelector('#s3 .dot').className = 'dot active';
                document.getElementById('s3l').style.color = '#333';
            }
            if (t <= 0) location.reload();
        }, 1000);
    </script>
</body>
</html>`;
}

export function notFoundPage(subdomain) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${subdomain} - Not Found</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, sans-serif; background: #f9f9f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
        .card { background: #fff; border: 0.5px solid #e5e5e3; border-radius: 12px; padding: 2.5rem 2rem; max-width: 420px; width: 100%; text-align: center; }
        .code { font-size: 48px; font-weight: 500; color: #1a1a18; margin-bottom: 8px; }
        .title { font-size: 18px; font-weight: 500; color: #1a1a18; margin-bottom: 8px; }
        .subtitle { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 1.75rem; }
        .svc { font-family: monospace; font-size: 13px; background: #f5f5f3; border: 0.5px solid #e5e5e3; border-radius: 8px; padding: 6px 14px; display: inline-block; }
    </style>
</head>
<body>
    <div class="card">
        <p class="code">404</p>
        <p class="title">Service not found</p>
        <p class="subtitle">There's no service deployed at this address.</p>
        <div class="svc">${subdomain}.naaspeeti.xyz</div>
    </div>
</body>
</html>`;
}