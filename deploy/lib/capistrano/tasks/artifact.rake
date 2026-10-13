# frozen_string_literal: true

require 'open3'
require 'tmpdir'

# The web app is deployed as a tested artifact -- the exact output of
# `npm ci && typecheck && test && build` for one commit, verified by
# web/scripts/verify-static-build.mjs -- never built on the 2 GiB server.
#
# Two ways to obtain it:
#   * local deploy: this machine runs deploy/bin/build-artifact (all checks);
#   * CD / a CI artifact: ARTIFACT, ARTIFACT_SHA256 and REVISION name a
#     tarball built and tested elsewhere (GitHub Actions); it is still
#     checksum-verified before it is unpacked.
namespace :artifact do
  desc 'Build and test the artifact locally, or take the one named by ARTIFACT'
  task :prepare do
    if ENV['ARTIFACT']
      set :artifact_path, File.expand_path(ENV.fetch('ARTIFACT'))
      set :artifact_sha256, ENV.fetch('ARTIFACT_SHA256')
      set :current_revision, ENV.fetch('REVISION')
      raise "ARTIFACT_SHA256 must be 64 hex characters" unless fetch(:artifact_sha256).match?(/\A\h{64}\z/)
      raise "REVISION must be a full 40-character commit SHA" unless fetch(:current_revision).match?(/\A\h{40}\z/)
    else
      script = File.expand_path('../../../bin/build-artifact', __dir__)
      Dir.mktmpdir('descon-web-artifact') do |dir|
        result_file = File.join(dir, 'result')
        env = { 'PUBLIC_ORIGIN' => fetch(:public_origin), 'ARTIFACT_RESULT_FILE' => result_file }
        raise 'building the artifact failed (see the output above)' unless system(env, script)

        result = File.readlines(result_file, chomp: true).to_h { |line| line.split('=', 2) }
        set :artifact_path, result.fetch('path')
        set :artifact_sha256, result.fetch('sha256')
        set :current_revision, result.fetch('revision')
      end
    end
    puts "artifact #{fetch(:artifact_path)} (sha256 #{fetch(:artifact_sha256)}, revision #{fetch(:current_revision)})"
  end

  desc 'Upload the artifact, verify its checksum on the server, and unpack it into the new release'
  task :install do
    on release_roles(:web) do
      remote = shared_path.join('artifacts', File.basename(fetch(:artifact_path)))
      execute :mkdir, '-p', remote.dirname
      upload! fetch(:artifact_path), remote.to_s

      actual = capture(:openssl, 'dgst', '-sha256', '-r', remote.to_s).split.first
      unless actual == fetch(:artifact_sha256)
        execute :rm, '-f', remote
        raise "artifact checksum mismatch on the server (expected #{fetch(:artifact_sha256)}, got #{actual}); " \
              'nothing was unpacked and the live site is unchanged'
      end

      execute :mkdir, '-p', release_path
      execute :tar, '-xzf', remote, '-C', release_path
      raise 'the artifact has no index.html' unless test(:test, '-s', release_path.join('index.html'))

      execute :rm, '-f', remote
    end
  end
end
