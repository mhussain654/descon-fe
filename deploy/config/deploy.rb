# frozen_string_literal: true

# Frontend (admin web app) deployment to the same EC2 instance as the API.
# Run from this directory. See docs/deployment/static-spa.md.
#
#   cd deploy
#   bundle install
#   bundle exec cap production deploy                       # build + test + deploy HEAD
#   ARTIFACT=... ARTIFACT_SHA256=... REVISION=<sha> bundle exec cap production deploy
lock '~> 3.20'

set :application, 'descon-mps-web'
set :deploy_to, '/home/deploy/descon-mps-web'
set :keep_releases, 5
set :pty, false
set :log_level, :info

# The one place a public address is configured. The API base URL baked into the
# build is "#{public_origin}/api/v1" (one origin serves the app and the API).
# Override PUBLIC_ORIGIN if the public address changes. This value is baked
# into the web build; the SSH deploy host still uses the Elastic IP.
set :public_origin, ENV.fetch('PUBLIC_ORIGIN', 'https://descon-mps.com')

# Host-wide lock shared with the backend repository's deploys.
set :deploy_lock_dir, '/home/deploy/.deploy-locks/descon-mps.lock'

# After the new release is linked, the live site must serve the SPA shell; once
# TLS is configured it is also fetched through Nginx on loopback.
set :health_check_script, lambda {
  <<~SH
    set -e
    test -s #{current_path}/index.html
    grep -q __reactRouterContext #{current_path}/index.html
    if [ -e /etc/nginx/tls/current/fullchain.pem ]; then
      curl --fail --silent --show-error --max-time 5 --insecure --output /dev/null https://127.0.0.1/
    fi
  SH
}
set :health_check_attempts, 5
set :health_check_interval_seconds, 1

before 'deploy:starting', 'deploy:acquire_lock'
before 'deploy:starting', 'artifact:prepare'
after 'deploy:new_release_path', 'artifact:install'
before 'deploy:symlink:release', 'deploy:remember_serving_release'
after 'deploy:publishing', 'deploy:activate'
after 'deploy:finished', 'deploy:release_lock'
after 'deploy:failed', 'deploy:release_lock'
