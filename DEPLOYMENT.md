# Deployment Guide

This guide covers deploying the forex review websites to GitHub Pages and Cloudflare Pages.

## GitHub Pages Deployment

### Option 1: Deploy Each Site Separately

1. **Create separate repositories** for each site (recommended for independent deployments)
2. **Push code** to GitHub
3. **Go to Settings > Pages**
4. **Select source branch** (usually `main` or `master`)
5. **Select root directory** or specific folder
6. **Save** and wait for deployment

### Option 2: Deploy All Sites from One Repository

1. **Push all sites** to a single repository
2. **Use GitHub Actions** to deploy each site:

```yaml
# .github/workflows/deploy.yml
name: Deploy Sites
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./site1-dark-gradient
```

3. **Configure multiple pages** using subdirectories:
   - `https://username.github.io/repo/site1-dark-gradient/`
   - `https://username.github.io/repo/site2-minimal-light/`
   - etc.

## Cloudflare Pages Deployment

### Single Repository Deployment

1. **Connect GitHub repository** to Cloudflare Pages
2. **Configure build settings**:
   - Build command: (leave empty - static sites)
   - Build output directory: `site1-dark-gradient` (or specific site)
   - Root directory: `/`
3. **Deploy** and repeat for each site

### Multiple Sites from One Repository

1. **Create separate projects** in Cloudflare Pages for each site
2. **For each project**, set:
   - Root directory: `siteX-name`
   - Build output: `siteX-name`
3. **Deploy** each project independently

### Custom Domain Setup

1. **Add custom domain** in Cloudflare Pages settings
2. **Update DNS records**:
   - Add CNAME record pointing to your Pages domain
   - Or use Cloudflare's automatic DNS setup
3. **Configure SSL** (automatic with Cloudflare)

## Environment Variables

Set these in your deployment platform:

```bash
# API Configuration
BROKER_API_ENDPOINT=https://your-api.com/brokers
BROKER_UPDATE_ENDPOINT=https://your-api.com/update
BROKER_WS_ENDPOINT=wss://your-api.com/ws/brokers

# Optional: API Key for authentication
API_KEY=your-secret-api-key
```

### GitHub Pages
- Go to Settings > Secrets > Actions
- Add repository secrets

### Cloudflare Pages
- Go to Project Settings > Environment Variables
- Add variables for Production, Preview, and Development

## Backend API Setup

### Option 1: Cloudflare Workers

1. **Create Worker** in Cloudflare Dashboard
2. **Deploy API code** (see `api-example.js`)
3. **Set up KV storage** or D1 database
4. **Configure routes**:
   - `/api/brokers` - GET endpoint
   - `/api/update` - POST endpoint
   - `/ws/brokers` - WebSocket endpoint

### Option 2: Serverless Functions

**Vercel:**
```javascript
// api/brokers.js
export default async function handler(req, res) {
    if (req.method === 'POST') {
        // Handle POST request
        return res.json({ success: true });
    }
    // Handle GET request
    return res.json({ brokers: [] });
}
```

**Netlify:**
```javascript
// netlify/functions/brokers.js
exports.handler = async (event, context) => {
    if (event.httpMethod === 'POST') {
        // Handle POST
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    // Handle GET
    return { statusCode: 200, body: JSON.stringify({ brokers: [] }) };
};
```

### Option 3: Traditional Server

Deploy Node.js/Express server (see `api-example.js`) to:
- Heroku
- DigitalOcean
- AWS EC2
- Google Cloud Run
- Azure App Service

## Post-Deployment Checklist

- [ ] Test all websites load correctly
- [ ] Verify translation switching works
- [ ] Test API endpoints (if backend is set up)
- [ ] Check mobile responsiveness
- [ ] Verify SEO meta tags
- [ ] Test WebSocket connection (if implemented)
- [ ] Set up monitoring/analytics
- [ ] Configure custom domains
- [ ] Set up SSL certificates
- [ ] Test data ingestion from robot/bot

## Troubleshooting

### CORS Issues
If API calls fail due to CORS:
- Add CORS headers to your backend API
- Or use Cloudflare Workers with CORS handling

### WebSocket Connection Fails
- Ensure WebSocket endpoint is properly configured
- Check firewall/security settings
- Verify SSL certificate for WSS connections

### Translation Not Working
- Check browser localStorage is enabled
- Verify `translations.js` is loaded
- Check console for JavaScript errors

### Data Not Updating
- Verify API endpoints are correct
- Check network tab for failed requests
- Ensure backend is receiving POST requests
- Check browser console for errors

## Performance Optimization

1. **Enable caching**:
   - Static assets: Cache-Control: max-age=31536000
   - HTML: Cache-Control: max-age=3600

2. **Minify assets**:
   - Use build tools to minify CSS/JS
   - Compress images

3. **CDN**:
   - Use Cloudflare CDN (automatic with Pages)
   - Or configure custom CDN

4. **Lazy loading**:
   - Implement lazy loading for images
   - Load non-critical scripts asynchronously


