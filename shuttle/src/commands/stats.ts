/**
 * Stats command - Show coordinator statistics
 */

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import { output, error, formatKeyValue, colorStatus } from '../utils/output.js';
import { getGlobalOptions } from '../cli.js';

export function statsCommand(): Command {
  const cmd = new Command('stats');

  cmd
    .description('Show coordinator statistics')
    .action(async (_options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Fetching statistics...');
        }

        const client = createAPIClient(config);
        const response = await client.getStats();

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const stats = response.data;

        if (!globalOpts.quiet) {
          spinner.succeed('Statistics retrieved');
        }

        // Output results
        if (globalOpts.json) {
          output(stats, globalOpts);
        } else {
          console.log('\nCoordinator Statistics');
          console.log('='.repeat(50));

          // Work Items
          console.log('\nWork Items:');
          console.log(
            formatKeyValue({
              'Pending': colorStatus('pending') + ` (${stats.pending || 0})`,
              'Active': colorStatus('in-progress') + ` (${stats.active || 0})`,
              'Completed': colorStatus('completed') + ` (${stats.completed || 0})`,
              'Failed': colorStatus('failed') + ` (${stats.failed || 0})`,
              'Total': stats.total || 0,
            })
          );

          console.log();
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to fetch statistics');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}
