# GitHub Actions Workflows Documentation

## Overview
This repository uses GitHub Actions for CI/CD automation. Below are the workflows configured:

## Workflows

### 1. CI/CD Pipeline (`ci-cd.yml`)
**Trigger:** Push to `main`/`develop` branches, Pull Requests

**Jobs:**
- **Lint:** Code quality checks for client and server
- **Build Client:** React app build with artifact upload
- **Test Server:** Run tests with MongoDB and Redis
- **Build Docker:** Create Docker images for deployment
- **Security Scan:** Trivy vulnerability scanning
- **Deploy:** Production deployment (configure as needed)
- **Notify:** Build status notifications

**Environment Variables:**
- `NODE_VERSION`: Node.js version (default: 18.x)

### 2. Pull Request Checks (`pr-checks.yml`)
**Trigger:** Pull Request events (opened, synchronize, reopened)

**Jobs:**
- **PR Info:** Display PR details and validate format
- **Code Quality:** Check formatting and code patterns
- **Dependency Check:** Verify dependencies and audit
- **Build Check:** Verify builds succeed
- **Changes Analysis:** Analyze file changes and statistics
- **Auto Labeler:** Add labels based on changed files
- **PR Comment:** Post summary comment on PR

**Checks:**
- PR title follows conventional commits
- Large files detection
- Code formatting validation
- TODO/FIXME comment counting
- Build verification

### 3. Code Review Assistant (`code-review.yml`)
**Trigger:** Pull Request events (opened, synchronize)

**Jobs:**
- **Review:** Automated code pattern analysis
- **Security Check:** Scan for exposed secrets
- **Complexity Check:** Analyze code complexity

**Detects:**
- Console.log statements
- TODO without issue references
- Hardcoded localhost/IPs
- Missing error handling
- Large code additions
- Exposed secrets
- Sensitive files

### 4. Dependency Updates (`dependency-update.yml`)
**Trigger:** Weekly on Mondays at 9:00 AM UTC, Manual dispatch

**Jobs:**
- **Check Updates:** Scan for outdated dependencies
- Security vulnerability audits
- Automatic issue creation for critical vulnerabilities

## Setup Instructions

### 1. Configure Secrets
Add these secrets in GitHub Settings → Secrets and variables → Actions:

```
DOCKER_USERNAME       # Docker Hub username (optional)
DOCKER_PASSWORD       # Docker Hub password/token (optional)
VPS_HOST             # VPS host for deployment (optional)
VPS_USERNAME         # VPS SSH username (optional)
VPS_SSH_KEY          # VPS SSH private key (optional)
DISCORD_WEBHOOK      # Discord webhook for notifications (optional)
```

### 2. Enable GitHub Actions
1. Go to repository Settings → Actions → General
2. Set "Workflow permissions" to "Read and write permissions"
3. Enable "Allow GitHub Actions to create and approve pull requests"

### 3. Configure Branch Protection (Recommended)
1. Go to Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select checks: `lint`, `build-client`, `test-server`

### 4. Auto-Labeling Setup
Create these labels in your repository (Settings → Labels):
- `client` - Changes in client code
- `server` - Changes in server code
- `docker` - Docker-related changes
- `documentation` - Documentation updates
- `tests` - Test-related changes
- `ci/cd` - CI/CD workflow changes
- `security` - Security-related changes
- `dependencies` - Dependency updates

## Usage Examples

### Running CI/CD Manually
```bash
# Trigger workflow manually from GitHub UI
# Go to Actions → CI/CD Pipeline → Run workflow
```

### Checking PR Status
When you open a PR:
1. Automated checks run automatically
2. PR comment shows check results
3. Labels are auto-applied
4. Review suggestions posted if issues found

### Updating Dependencies
```bash
# Automatic weekly check (Mondays)
# Or trigger manually:
# Go to Actions → Dependency Updates → Run workflow
```

## Troubleshooting

### Build Fails on CI
```bash
# Check logs in Actions tab
# Common issues:
- Missing environment variables
- Dependency installation failures
- Syntax errors

# Solutions:
- Review error logs
- Test locally: npm ci && npm run build
- Check Node.js version compatibility
```

### Docker Build Issues
```bash
# Verify Docker configuration locally:
docker-compose config
docker-compose build

# Common fixes:
- Update Dockerfile
- Check context paths
- Verify .dockerignore
```

### Test Failures
```bash
# Run tests locally:
cd server && npm test

# Check:
- MongoDB/Redis connections
- Environment variables
- Test database configuration
```

## Best Practices

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(scope): add new feature
fix(scope): fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: maintenance tasks
perf: performance improvements
```

### PR Guidelines
1. Keep PRs focused and small
2. Add descriptive title and description
3. Reference related issues (#123)
4. Ensure all checks pass
5. Request review from team members

### Security
- Never commit secrets or credentials
- Use environment variables
- Review security scan results
- Keep dependencies updated
- Address high/critical vulnerabilities promptly

## Monitoring

### View Workflow Runs
1. Go to repository → Actions tab
2. Select workflow to view
3. Click on specific run for details
4. Review logs for each job

### Notifications
Configure notifications in GitHub settings:
- Settings → Notifications
- Enable for: "Actions" events
- Choose email or web notifications

## Maintenance

### Regular Tasks
- [ ] Weekly: Review dependency update issues
- [ ] Monthly: Update workflow Node.js version
- [ ] Quarterly: Review and optimize workflows
- [ ] As needed: Update secrets and configurations

### Updating Workflows
```bash
# Edit workflows
vim .github/workflows/ci-cd.yml

# Test locally with act (optional)
act -l  # List jobs
act     # Run workflows locally

# Commit and push
git add .github/workflows/
git commit -m "chore: update CI/CD workflows"
git push
```

## Performance Tips

1. **Cache Dependencies:**
   - Workflows use npm cache automatically
   - Docker layer caching enabled

2. **Parallel Jobs:**
   - Independent jobs run in parallel
   - Reduces total workflow time

3. **Conditional Execution:**
   - Some jobs only run on `main` branch
   - Saves GitHub Actions minutes

4. **Artifact Management:**
   - Build artifacts retained for 7 days
   - Adjust retention as needed

## Cost Management

GitHub Actions minutes (free tier):
- Public repos: Unlimited
- Private repos: 2,000 minutes/month

Tips to save minutes:
- Use caching effectively
- Skip unnecessary jobs
- Optimize build times
- Use self-hosted runners (advanced)

## Support

For issues or questions:
1. Check workflow logs in Actions tab
2. Review this documentation
3. Check [GitHub Actions docs](https://docs.github.com/actions)
4. Open an issue in repository

## Advanced Configuration

### Custom Deployment
Edit [ci-cd.yml](.github/workflows/ci-cd.yml) deploy job:
```yaml
- name: Deploy to Production
  run: |
    # Add your deployment commands
    # Examples: AWS, Heroku, DigitalOcean, etc.
```

### Custom Notifications
Add notification integrations:
```yaml
- name: Slack Notification
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Matrix Testing
Test multiple Node versions:
```yaml
strategy:
  matrix:
    node-version: [16.x, 18.x, 20.x]
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Workflow Syntax](https://docs.github.com/actions/reference/workflow-syntax-for-github-actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
