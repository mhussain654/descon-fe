# frozen_string_literal: true

# The static site has no process to restart: Nginx serves `current` directly.
# "Activating" a release is therefore: link it, prove the live site serves the
# SPA shell, and restore the previously serving release if it does not.
namespace :deploy do
  # Records the release `current` points at BEFORE the new one replaces it:
  # that, not "the newest other directory", is what a failed deploy restores.
  desc 'Remember which release is serving before the new release is linked'
  task :remember_serving_release do
    on primary(:web) do
      serving = capture(:readlink, current_path, raise_on_non_zero_exit: false).to_s.strip
      set :serving_release, serving.empty? ? nil : File.basename(serving)
    end
  end

  desc 'Verify the live site serves the new release; restore the previous release if it does not'
  task :activate do
    rolling_back = Rake.application.top_level_tasks.include?('deploy:rollback')

    on primary(:web) do
      script = fetch(:health_check_script)
      script = script.call if script.respond_to?(:call)
      healthy = lambda do
        fetch(:health_check_attempts).times do
          return true if test(:bash, '-c', script.shellescape)

          sleep fetch(:health_check_interval_seconds)
        end
        false
      end
      next if healthy.call

      reason = 'the new release failed its health check'
      error "deploy:activate -- #{reason}"
      raise reason if rolling_back

      failed_release = release_path.basename.to_s
      previous = fetch(:serving_release)
      raise "#{reason}; there was no previous release to restore" if previous.nil?

      begin
        staged_link = releases_path.join(current_path.basename)
        execute :ln, '-sfn', releases_path.join(previous), staged_link
        execute :mv, '-f', staged_link, current_path.parent
      rescue SSHKit::Command::Failed => e
        raise "#{reason}; RESTORING #{previous} FAILED (#{e.message.to_s.lines.first.to_s.strip}) -- " \
              "`current` still points at #{failed_release}. Fix it by hand now."
      end

      restored = healthy.call
      execute :rm, '-rf', release_path if restored
      outcome = restored ? 'and is healthy' : 'but is NOT healthy -- investigate immediately'
      raise "#{reason}; previous release #{previous} was restored #{outcome}"
    end
  end
end
