/**
 * Agents command - List and manage agents
 */

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import {
  output,
  error,
  createTable,
  colorStatus,
  colorAgentType,
  truncate,
} from '../utils/output.js';
import { getGlobalOptions } from '../cli.js';

export function agentsCommand(): Command {
  const cmd = new Command('agents');

  cmd
    .description('List registered agents')
    .option('--type <type>', 'Filter by agent type (copilot-cli|claude-code)')
    .option('--status <status>', 'Filter by status (online|busy|offline)')
    .option('--capability <name>', 'Filter by capability')
    .action(async (options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        if (!globalOpts.quiet) {
          spinner.start('Fetching agents...');
        }

        const client = createAPIClient(config);
        const response = await client.listAgents({
          type: options.type,
          status: options.status,
          capability: options.capability,
        });

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const agents = response.data?.agents || [];

        if (!globalOpts.quiet) {
          spinner.succeed(`Found ${agents.length} agent(s)`);
        }

        // Output results
        if (globalOpts.json) {
          output({ agents }, globalOpts);
        } else {
          if (agents.length === 0) {
            console.log('No agents found');
            return;
          }

          const table = createTable(
            ['GUID', 'Handle', 'Type', 'Status', 'Capabilities', 'Tasks'],
            agents.map((agent: any) => [
              truncate(agent.guid, 12),
              agent.handle || '-',
              colorAgentType(agent.agentType),
              colorStatus(agent.status),
              truncate((agent.capabilities || []).join(', '), 30),
              `${agent.currentTaskCount || 0}`,
            ])
          );

          console.log(table.toString());
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to fetch agents');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}
