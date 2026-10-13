# frozen_string_literal: true

require 'capistrano/scm/plugin'

# Declares that releases come from a prebuilt artifact (artifact.rake), not a
# source checkout. Capistrano needs *an* SCM plugin installed; without one it
# loads the Git plugin and demands a repository URL. This plugin contributes no
# tasks or hooks of its own.
class Capistrano::SCM::Artifact < Capistrano::SCM::Plugin
  def set_defaults; end

  def define_tasks; end

  def register_hooks; end
end
