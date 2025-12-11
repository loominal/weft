/**
 * Projects command - List active projects across the coordinator
 */

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import { output, error, createTable } from '../utils/output.js';
import { getGlobalOptions } from '../cli.js';

export function projectsCommand(): Command {
  const cmd = new Command('projects');

  cmd
    .description('List active projects across the coordinator')
    .action(async (_options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Fetching projects...');
        }

        const client = createAPIClient(config);
        const response = await client.listProjects();

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const projects = response.data?.projects || [];

        if (!globalOpts.quiet) {
          spinner.succeed(`Found ${projects.length} project(s)`);
        }

        // Output results
        if (globalOpts.json) {
          output({ projects, count: projects.length }, globalOpts);
        } else {
          if (projects.length === 0) {
            console.log('No active projects');
            return;
          }

          const table = createTable(
            ['Project ID'],
            projects.map((projectId: string) => [projectId])
          );

          console.log(table.toString());
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to fetch projects');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}
