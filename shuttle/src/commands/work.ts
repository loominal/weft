/**
 * Work command - List and view work items
 */

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import {
  output,
  error,
  success,
  createTable,
  colorStatus,
  colorBoundary,
  formatTimestamp,
  formatKeyValue,
  truncate,
} from '../utils/output.js';
import { getGlobalOptions } from '../cli.js';

export function workCommand(): Command {
  const cmd = new Command('work');

  cmd
    .description('List and view work items')
    .option('--status <status>', 'Filter by status (pending|assigned|in-progress|completed|failed|cancelled)')
    .option('--boundary <name>', 'Filter by boundary')
    .action(workListAction);

  cmd
    .command('list')
    .description('List work items')
    .option('--status <status>', 'Filter by status')
    .option('--boundary <name>', 'Filter by boundary')
    .action(workListAction);

  cmd
    .command('show')
    .description('Show details of a specific work item')
    .argument('<work-id>', 'Work item ID')
    .action(workShowAction);

  cmd
    .command('cancel')
    .description('Cancel a work item')
    .argument('<work-id>', 'Work item ID')
    .action(workCancelAction);

  return cmd;
}

async function workListAction(options: any, command: Command) {
  const globalOpts = getGlobalOptions(command);
  const spinner = ora();

  try {
    const config = loadConfig({
      configPath: globalOpts.config,
      projectOverride: globalOpts.project,
    });

    if (!globalOpts.quiet) {
      spinner.start('Fetching work items...');
    }

    const client = createAPIClient(config);
    const response = await client.listWork({
      status: options.status,
      classification: options.boundary,
    });

    if (!response.ok) {
      throw new Error(response.error || `HTTP ${response.status}`);
    }

    const workItems = response.data?.workItems || [];

    if (!globalOpts.quiet) {
      spinner.succeed(`Found ${workItems.length} work item(s)`);
    }

    // Output results
    if (globalOpts.json) {
      output({ workItems }, globalOpts);
    } else {
      if (workItems.length === 0) {
        console.log('No work items found');
        return;
      }

      const table = createTable(
        ['ID', 'Status', 'Boundary', 'Capability', 'Description', 'Priority', 'Offered'],
        workItems.map((item: any) => [
          truncate(item.id, 12),
          colorStatus(item.status),
          colorBoundary(item.boundary),
          item.capability,
          truncate(item.description, 40),
          String(item.priority || 5),
          formatTimestamp(item.offeredAt),
        ])
      );

      console.log(table.toString());
    }
  } catch (err: any) {
    if (spinner.isSpinning) {
      spinner.fail('Failed to fetch work items');
    }
    error(`Error: ${err.message}`, {});
    process.exit(1);
  }
}

async function workShowAction(workId: string, _options: any, command: Command) {
  const globalOpts = getGlobalOptions(command);
  const spinner = ora();

  try {
    const config = loadConfig({
      configPath: globalOpts.config,
      projectOverride: globalOpts.project,
    });

    if (!globalOpts.quiet) {
      spinner.start('Fetching work item...');
    }

    const client = createAPIClient(config);
    const response = await client.getWork(workId);

    if (!response.ok) {
      throw new Error(response.error || `HTTP ${response.status}`);
    }

    const workItem = response.data;

    if (!globalOpts.quiet) {
      spinner.succeed('Work item found');
    }

    // Output results
    if (globalOpts.json) {
      output(workItem, globalOpts);
    } else {
      console.log('\nWork Item Details:');
      console.log(
        formatKeyValue({
          'ID': workItem.id,
          'Task ID': workItem.taskId,
          'Status': colorStatus(workItem.status),
          'Boundary': colorBoundary(workItem.boundary),
          'Capability': workItem.capability,
          'Description': workItem.description,
          'Priority': workItem.priority,
          'Attempts': workItem.attempts,
          'Offered By': workItem.offeredBy,
          'Offered At': formatTimestamp(workItem.offeredAt),
          'Assigned To': workItem.assignedTo || 'N/A',
          'Assigned At': formatTimestamp(workItem.assignedAt),
          'Deadline': workItem.deadline || 'N/A',
          'Progress': workItem.progress !== undefined ? `${workItem.progress}%` : 'N/A',
        })
      );

      if (workItem.result) {
        console.log('\nResult:');
        console.log(
          formatKeyValue({
            'Summary': workItem.result.summary || 'N/A',
            'Completed At': formatTimestamp(workItem.result.completedAt),
            'Artifacts': workItem.result.artifacts?.join(', ') || 'None',
          })
        );
      }

      if (workItem.error) {
        console.log('\nError:');
        console.log(
          formatKeyValue({
            'Message': workItem.error.message,
            'Code': workItem.error.code || 'N/A',
            'Recoverable': workItem.error.recoverable ? 'Yes' : 'No',
            'Occurred At': formatTimestamp(workItem.error.occurredAt),
          })
        );
      }

      console.log();
    }
  } catch (err: any) {
    if (spinner.isSpinning) {
      spinner.fail('Failed to fetch work item');
    }
    error(`Error: ${err.message}`, {});
    process.exit(1);
  }
}

async function workCancelAction(workId: string, _options: any, command: Command) {
  const globalOpts = getGlobalOptions(command);
  const spinner = ora();

  try {
    const config = loadConfig({
      configPath: globalOpts.config,
      projectOverride: globalOpts.project,
    });

    if (!globalOpts.quiet) {
      spinner.start('Cancelling work item...');
    }

    const client = createAPIClient(config);
    const response = await client.cancelWork(workId);

    if (!response.ok) {
      throw new Error(response.error || `HTTP ${response.status}`);
    }

    if (!globalOpts.quiet) {
      spinner.succeed('Work item cancelled');
    }

    // Output results
    if (globalOpts.json) {
      output(response.data, globalOpts);
    } else {
      success(`Work item ${workId} cancelled`, globalOpts);
    }
  } catch (err: any) {
    if (spinner.isSpinning) {
      spinner.fail('Failed to cancel work item');
    }
    error(`Error: ${err.message}`, {});
    process.exit(1);
  }
}
