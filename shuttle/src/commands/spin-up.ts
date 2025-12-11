/**
 * Spin-up command - Trigger agent spin-up
 */

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import { output, success, error, info, formatKeyValue } from '../utils/output.js';
import { getGlobalOptions } from '../cli.js';

export function spinUpCommand(): Command {
  const cmd = new Command('spin-up');

  cmd
    .description('Trigger agent spin-up')
    .option('--target <name>', 'Target name to spin up')
    .option('--type <type>', 'Agent type filter (copilot-cli|claude-code)')
    .option('--capability <name>', 'Required capability')
    .option('--boundary <name>', 'Required boundary support')
    .action(async (options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        // Must provide either --target or filters
        if (!options.target && !options.type && !options.capability && !options.boundary) {
          error('Must provide either --target or at least one filter (--type, --capability, --boundary)', globalOpts);
          process.exit(1);
        }

        if (!globalOpts.quiet) {
          spinner.start('Triggering agent spin-up...');
        }

        const client = createAPIClient(config);
        let targetId: string;

        if (options.target) {
          // Spin up specific target
          targetId = options.target;
        } else {
          // Query for target based on filters
          const listResponse = await client.listTargets({
            type: options.type,
            capability: options.capability,
          });

          if (!listResponse.ok) {
            throw new Error(listResponse.error || `HTTP ${listResponse.status}`);
          }

          const targets = listResponse.data?.targets || [];

          if (targets.length === 0) {
            if (!globalOpts.quiet && spinner.isSpinning) {
              spinner.fail('No matching targets found');
            }
            error('No matching targets found', globalOpts);
            process.exit(1);
          }

          // Use first available target
          targetId = targets[0].id || targets[0].name;
          info(`Selected target: ${targets[0].name}`, globalOpts);
        }

        // Trigger spin-up
        const response = await client.spinUpTarget(targetId);

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const result = response.data;

        // Handle both old format (success boolean) and new format (status string)
        const isSuccess = result.success === true ||
          result.status === 'in-progress' ||
          result.status === 'completed';

        if (!globalOpts.quiet) {
          if (isSuccess) {
            spinner.succeed('Agent spin-up initiated');
          } else {
            spinner.fail('Spin-up failed');
          }
        }

        // Output results
        if (globalOpts.json) {
          output(result, globalOpts);
        } else {
          if (isSuccess) {
            success('Agent spin-up triggered successfully!', globalOpts);
            console.log();
            console.log(
              formatKeyValue({
                'Operation ID': result.operationId || result.targetId,
                'Target Name': result.targetName,
                'Status': result.status || 'initiated',
                'Timestamp': result.timestamp ? new Date(result.timestamp).toLocaleString() : new Date().toLocaleString(),
              })
            );

            if (result.mechanismResult) {
              console.log('\nMechanism Details:');
              console.log(formatKeyValue(result.mechanismResult));
            }
          } else {
            error(`Spin-up failed: ${result.error || result.message || 'Unknown error'}`, globalOpts);
            process.exit(1);
          }
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to trigger spin-up');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}
