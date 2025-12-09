/**
 * Projects command - List active projects across the coordinator
 */

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config-file.js';
import { getNATSConnection, closeNATSConnection } from '../nats/client.js';
import { output, error, createTable, formatTimestamp } from '../utils/output.js';
import { getGlobalOptions } from '../cli.js';

interface GlobalStats {
  totalProjects: number;
  totals: {
    agents: number;
    pendingWork: number;
    activeWork: number;
    completedWork: number;
    failedWork: number;
    targets: number;
  };
  byProject: Record<string, {
    agents: number;
    pendingWork: number;
    activeWork: number;
    targets: number;
    lastActivity: string;
  }>;
}

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

        const nc = await getNATSConnection(config);

        // Query global stats which includes per-project breakdown
        const response = await nc.request(
          'coord.global.stats',
          JSON.stringify({}),
          { timeout: 5000 }
        );

        const stats: GlobalStats = JSON.parse(
          new TextDecoder().decode(response.data)
        );

        await closeNATSConnection();

        if (!globalOpts.quiet) {
          spinner.succeed(`Found ${stats.totalProjects} project(s)`);
        }

        // Output results
        if (globalOpts.json) {
          output(stats, globalOpts);
        } else {
          if (stats.totalProjects === 0) {
            console.log('No active projects');
            return;
          }

          const table = createTable(
            ['Project ID', 'Agents', 'Pending', 'Active', 'Targets', 'Last Activity'],
            Object.entries(stats.byProject).map(([projectId, projectStats]) => [
              projectId,
              String(projectStats.agents),
              String(projectStats.pendingWork),
              String(projectStats.activeWork),
              String(projectStats.targets),
              formatTimestamp(projectStats.lastActivity),
            ])
          );

          console.log(table.toString());

          // Show totals
          console.log('\nTotals:');
          console.log(`  Agents: ${stats.totals.agents}`);
          console.log(`  Pending Work: ${stats.totals.pendingWork}`);
          console.log(`  Active Work: ${stats.totals.activeWork}`);
          console.log(`  Completed: ${stats.totals.completedWork}`);
          console.log(`  Failed: ${stats.totals.failedWork}`);
          console.log(`  Targets: ${stats.totals.targets}`);
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
