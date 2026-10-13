# frozen_string_literal: true

# Rehearses config/deploy.rb against a temporary directory on this machine --
# no server, no nginx, no network. REHEARSAL_ROOT must be an empty directory;
# ARTIFACT/ARTIFACT_SHA256/REVISION supply a prebuilt artifact (see
# deploy/rehearsal/run).
root = ENV.fetch('REHEARSAL_ROOT')

server 'localhost', user: ENV.fetch('USER'), roles: %w[web]
set :sshkit_backend, SSHKit::Backend::Local
ENV.replace(Bundler.unbundled_env)

set :deploy_to, "#{root}/var-www/descon-mps-web"
set :deploy_lock_dir, "#{root}/locks/descon-mps.lock"
set :health_check_script, lambda {
  # Same checks as production minus the TLS probe (no nginx here).
  <<~SH
    set -e
    test -s #{current_path}/index.html
    grep -q __reactRouterContext #{current_path}/index.html
  SH
}
