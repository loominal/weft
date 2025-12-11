/**
 * Shutdown command - Request agent shutdown
 */

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import { output, success, error, warning } from '../utils/output.js';
import { confirm } from '../utils/prompts.js';
import { getGlobalOptions } from '../cli.js';

export function shutdownCommand(): Command {
  const cmd = new Command('shutdown');

  cmd
    .description('Request agent shutdown')
    .argument('<agent-guid>', 'Agent GUID to shutdown')
    .option('--graceful', 'Wait for current work to complete (default: true)', true)
    .option('--force', 'Force immediate shutdown without waiting')
    .option('--grace-period <ms>', 'Grace period in milliseconds', '30000')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (agentGuid: string, options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        // Confirm shutdown unless --yes flag
        if (!options.yes && !globalOpts.json) {
          const confirmed = await confirm(
            `Are you sure you want to shutdown agent ${agentGuid}?`,
            false
          );
          if (!confirmed) {
            warning('Shutdown cancelled', globalOpts);
            process.exit(0);
          }
        }

        if (!globalOpts.quiet) {
          spinner.start('Sending shutdown request...');
        }

        const client = createAPIClient(config);
        const graceful = options.force ? false : options.graceful !== false;

        const response = await client.shutdownAgent(agentGuid, graceful);

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const result = response.data;

        if (!globalOpts.quiet) {
          spinner.succeed('Shutdown request sent');
        }

        // Output results
        if (globalOpts.json) {
          output(result, globalOpts);
        } else {
          if (result?.success !== false) {
            success('Agent shutdown requested', globalOpts);
            if (graceful) {
              const gracePeriodMs = parseInt(options.gracePeriod, 10);
              warning(
                `Agent will shutdown after completing current work (max ${gracePeriodMs / 1000}s)`,
                globalOpts
              );
            }
          } else {
            error(`Shutdown failed: ${result?.message || 'Unknown error'}`, globalOpts);
            process.exit(1);
          }
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to send shutdown request');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}
