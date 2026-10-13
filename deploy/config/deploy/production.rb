# frozen_string_literal: true

# The single EC2 instance (shared with the backend). DEPLOY_HOST is the SSH
# target and stays the Elastic IP when a domain is added.
server ENV.fetch('DEPLOY_HOST', '52.221.51.231'), user: 'deploy', roles: %w[web]

set :ssh_options,
    forward_agent: false,
    auth_methods: %w[publickey],
    verify_host_key: :always

# Continuous delivery runs these same tasks on the instance itself, started by
# AWS SSM Run Command (deploy/bin/descon-deploy-web): no inbound SSH.
if ENV['DEPLOY_LOCAL'] == '1'
  set :sshkit_backend, SSHKit::Backend::Local
  ENV.replace(Bundler.unbundled_env)
end
