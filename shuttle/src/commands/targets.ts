/**
 * Targets command - Manage spin-up targets
 */

import { Command } from 'commander';
import ora from 'ora';
import type { SpinUpMechanism, AgentType, Boundary } from '@loom/shared';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import {
  output,
  success,
  error,
  createTable,
  colorStatus,
  colorAgentType,
  truncate,
  formatKeyValue,
} from '../utils/output.js';
import { getGlobalOptions } from '../cli.js';
import { confirm } from '../utils/prompts.js';

export function targetsCommand(): Command {
  const cmd = new Command('targets');

  cmd
    .description('Manage spin-up targets')
    .addCommand(targetsListCommand())
    .addCommand(targetsAddCommand())
    .addCommand(targetsShowCommand())
    .addCommand(targetsUpdateCommand())
    .addCommand(targetsRemoveCommand())
    .addCommand(targetsTestCommand())
    .addCommand(targetsEnableCommand())
    .addCommand(targetsDisableCommand());

  return cmd;
}

function targetsListCommand(): Command {
  const cmd = new Command('list');

  cmd
    .description('List spin-up targets')
    .alias('ls')
    .option('--type <type>', 'Filter by agent type')
    .option('--status <status>', 'Filter by status')
    .option('--capability <cap>', 'Filter by capability')
    .option('--include-disabled', 'Include disabled targets')
    .action(async (options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Fetching targets...');
        }

        const client = createAPIClient(config);
        const response = await client.listTargets({
          type: options.type,
          status: options.status,
          capability: options.capability,
        });

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const targets = response.data?.targets || [];

        if (!globalOpts.quiet) {
          spinner.succeed(`Found ${targets.length} target(s)`);
        }

        if (globalOpts.json) {
          output({ targets }, globalOpts);
        } else {
          if (targets.length === 0) {
            console.log('No targets found');
            return;
          }

          const table = createTable(
            ['Name', 'Type', 'Mechanism', 'Status', 'Health', 'Capabilities', 'Uses'],
            targets.map((t: any) => [
              t.name,
              colorAgentType(t.agentType),
              t.mechanism,
              colorStatus(t.status),
              colorStatus(t.healthStatus || 'unknown'),
              truncate(t.capabilities?.join(', ') || '', 25),
              t.useCount || 0,
            ])
          );

          console.log(table.toString());
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to fetch targets');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}

function targetsAddCommand(): Command {
  const cmd = new Command('add');

  cmd
    .description('Add a new spin-up target')
    .requiredOption('--name <name>', 'Target name (unique identifier)')
    .requiredOption('--type <type>', 'Agent type (claude-code|copilot-cli)')
    .requiredOption('--mechanism <mech>', 'Spin-up mechanism (ssh|github-actions|local|webhook|kubernetes)')
    .option('--host <host>', 'SSH host (for ssh mechanism)')
    .option('--user <user>', 'SSH user (for ssh mechanism)')
    .option('--command <cmd>', 'Command to run (for ssh/local mechanisms)')
    .option('--repo <repo>', 'GitHub repo (for github-actions mechanism)')
    .option('--workflow <workflow>', 'Workflow file (for github-actions mechanism)')
    .option('--url <url>', 'Webhook URL (for webhook mechanism)')
    .option('--capabilities <caps>', 'Comma-separated capabilities')
    .option('--boundaries <names>', 'Comma-separated allowed boundaries')
    .option('--description <desc>', 'Target description')
    .action(async (options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        // Build mechanism config based on type
        let mechanismConfig: Record<string, any> = {
          mechanism: options.mechanism, // Required to match top-level mechanism
        };
        switch (options.mechanism as SpinUpMechanism) {
          case 'ssh':
            if (!options.host) {
              error('--host is required for ssh mechanism', globalOpts);
              process.exit(1);
            }
            mechanismConfig = {
              ...mechanismConfig,
              host: options.host,
              user: options.user || 'root',
              command: options.command,
            };
            break;
          case 'github-actions':
            if (!options.repo || !options.workflow) {
              error('--repo and --workflow are required for github-actions mechanism', globalOpts);
              process.exit(1);
            }
            mechanismConfig = {
              ...mechanismConfig,
              repo: options.repo,
              workflowFile: options.workflow,
            };
            break;
          case 'local':
            if (!options.command) {
              error('--command is required for local mechanism', globalOpts);
              process.exit(1);
            }
            mechanismConfig = {
              ...mechanismConfig,
              command: options.command,
            };
            break;
          case 'webhook':
            if (!options.url) {
              error('--url is required for webhook mechanism', globalOpts);
              process.exit(1);
            }
            mechanismConfig = {
              ...mechanismConfig,
              url: options.url,
            };
            break;
        }

        if (!globalOpts.quiet) {
          spinner.start('Creating target...');
        }

        const client = createAPIClient(config);
        const response = await client.createTarget({
          name: options.name,
          agentType: options.type as AgentType,
          capabilities: options.capabilities?.split(',').map((s: string) => s.trim()) || [],
          mechanism: options.mechanism as SpinUpMechanism,
          config: mechanismConfig,
          boundaries: options.boundaries?.split(',').map((s: string) => s.trim()) as Boundary[] || undefined,
          description: options.description,
        });

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const target = response.data;

        if (!globalOpts.quiet) {
          spinner.succeed('Target created');
        }

        if (globalOpts.json) {
          output(target, globalOpts);
        } else {
          success(`Target "${target.name}" created successfully`, globalOpts);
          console.log(
            formatKeyValue({
              'ID': target.id,
              'Name': target.name,
              'Type': target.agentType,
              'Mechanism': target.mechanism,
              'Status': target.status,
            })
          );
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to create target');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}

function targetsShowCommand(): Command {
  const cmd = new Command('show');

  cmd
    .description('Show target details')
    .argument('<target>', 'Target name or ID')
    .action(async (target: string, _options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Fetching target...');
        }

        const client = createAPIClient(config);
        const response = await client.getTarget(target);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Target not found: ${target}`);
          }
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const result = response.data;

        if (!globalOpts.quiet) {
          spinner.succeed('Target found');
        }

        if (globalOpts.json) {
          output(result, globalOpts);
        } else {
          console.log('\nTarget Details:');
          console.log(
            formatKeyValue({
              'ID': result.id,
              'Name': result.name,
              'Description': result.description || 'N/A',
              'Type': colorAgentType(result.agentType),
              'Mechanism': result.mechanism,
              'Status': colorStatus(result.status),
              'Health': colorStatus(result.healthStatus || 'unknown'),
              'Capabilities': result.capabilities?.join(', ') || 'None',
              'Boundaries': result.boundaries?.join(', ') || 'All',
              'Use Count': result.useCount || 0,
              'Last Used': result.lastUsedAt || 'Never',
              'Created': result.createdAt,
            })
          );

          if (result.config) {
            console.log('\nConfiguration:');
            console.log(formatKeyValue(result.config));
          }
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to fetch target');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}

function targetsUpdateCommand(): Command {
  const cmd = new Command('update');

  cmd
    .description('Update a target')
    .argument('<target>', 'Target name or ID')
    .option('--capabilities <caps>', 'New comma-separated capabilities')
    .option('--boundaries <names>', 'New comma-separated boundaries')
    .option('--description <desc>', 'New description')
    .action(async (target: string, options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        const updates: Record<string, any> = {};
        if (options.capabilities) {
          updates.capabilities = options.capabilities.split(',').map((s: string) => s.trim());
        }
        if (options.boundaries) {
          updates.boundaries = options.boundaries.split(',').map((s: string) => s.trim());
        }
        if (options.description !== undefined) {
          updates.description = options.description;
        }

        if (Object.keys(updates).length === 0) {
          error('No updates specified', globalOpts);
          process.exit(1);
        }

        if (!globalOpts.quiet) {
          spinner.start('Updating target...');
        }

        const client = createAPIClient(config);
        const response = await client.updateTarget(target, updates);

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        if (!globalOpts.quiet) {
          spinner.succeed('Target updated');
        }

        if (globalOpts.json) {
          output(response.data, globalOpts);
        } else {
          success(`Target "${target}" updated`, globalOpts);
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to update target');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}

function targetsRemoveCommand(): Command {
  const cmd = new Command('remove');

  cmd
    .description('Remove a target')
    .alias('rm')
    .argument('<target>', 'Target name or ID')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (target: string, options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!options.yes && !globalOpts.json) {
          const confirmed = await confirm(`Remove target "${target}"?`);
          if (!confirmed) {
            console.log('Cancelled.');
            return;
          }
        }

        if (!globalOpts.quiet) {
          spinner.start('Removing target...');
        }

        const client = createAPIClient(config);
        const response = await client.deleteTarget(target);

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        if (!globalOpts.quiet) {
          spinner.succeed('Target removed');
        }

        success(`Target "${target}" removed`, globalOpts);
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to remove target');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}

function targetsTestCommand(): Command {
  const cmd = new Command('test');

  cmd
    .description('Test target health/connectivity')
    .argument('<target>', 'Target name or ID')
    .action(async (target: string, _options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Testing target...');
        }

        const client = createAPIClient(config);
        const response = await client.testTarget(target);

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const result = response.data;

        if (!globalOpts.quiet) {
          if (result.healthy) {
            spinner.succeed('Target is healthy');
          } else {
            spinner.fail('Target health check failed');
          }
        }

        if (globalOpts.json) {
          output(result, globalOpts);
        } else {
          console.log(
            formatKeyValue({
              'Target': target,
              'Healthy': result.healthy ? 'Yes' : 'No',
              'Latency': result.latencyMs ? `${result.latencyMs}ms` : 'N/A',
              'Error': result.error || '(none)',
            })
          );
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to test target');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}

function targetsEnableCommand(): Command {
  const cmd = new Command('enable');

  cmd
    .description('Enable a disabled target')
    .argument('<target>', 'Target name or ID')
    .action(async (target: string, _options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Enabling target...');
        }

        const client = createAPIClient(config);
        const response = await client.enableTarget(target);

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        if (!globalOpts.quiet) {
          spinner.succeed('Target enabled');
        }

        success(`Target "${target}" enabled`, globalOpts);
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to enable target');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}

function targetsDisableCommand(): Command {
  const cmd = new Command('disable');

  cmd
    .description('Disable a target (prevent spin-up)')
    .argument('<target>', 'Target name or ID')
    .action(async (target: string, _options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Disabling target...');
        }

        const client = createAPIClient(config);
        const response = await client.disableTarget(target);

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        if (!globalOpts.quiet) {
          spinner.succeed('Target disabled');
        }

        success(`Target "${target}" disabled`, globalOpts);
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to disable target');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}
