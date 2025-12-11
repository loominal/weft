/**
 * Submit command - Submit work to the coordinator
 */

import { Command } from 'commander';
import ora from 'ora';
import type { Priority } from '@loom/shared';
import { loadConfig } from '../utils/config-file.js';
import { createAPIClient } from '../api/client.js';
import { output, success, error, info, formatKeyValue } from '../utils/output.js';
import { promptWorkSubmission } from '../utils/prompts.js';
import { getGlobalOptions } from '../cli.js';
import { randomUUID } from 'crypto';

export function submitCommand(): Command {
  const cmd = new Command('submit');

  cmd
    .description('Submit work to the coordinator')
    .argument('[description]', 'Task description')
    .option('--boundary <name>', 'Work boundary (user-defined, e.g., production, staging)')
    .option('--capability <name>', 'Required capability (e.g., typescript, python)')
    .option('--priority <n>', 'Priority level (1-10)', parseInt)
    .option('--agent-type <type>', 'Required agent type (copilot-cli|claude-code)')
    .option('--deadline <iso>', 'Deadline (ISO 8601 timestamp)')
    .option('--interactive', 'Interactive mode with prompts')
    .action(async (description: string | undefined, options, command) => {
      const globalOpts = getGlobalOptions(command);
      const spinner = ora();

      try {
        const config = loadConfig({
          configPath: globalOpts.config,
          projectOverride: globalOpts.project,
        });

        // Interactive mode or missing required fields
        const needsInteractive =
          options.interactive || !description || !options.boundary || !options.capability;

        let workDetails: {
          description: string;
          boundary: string;
          capability: string;
          priority: Priority;
        };

        if (needsInteractive && !globalOpts.json) {
          workDetails = await promptWorkSubmission({
            description,
            boundary: options.boundary,
            capability: options.capability,
            priority: options.priority,
          });
        } else {
          // Validate required fields
          if (!description) {
            error('Description is required (use --interactive for prompts)', globalOpts);
            process.exit(1);
          }

          if (!options.boundary) {
            error('Boundary is required (use --boundary or --interactive)', globalOpts);
            process.exit(1);
          }

          if (!options.capability) {
            error('Capability is required (use --capability or --interactive)', globalOpts);
            process.exit(1);
          }

          workDetails = {
            description,
            boundary: options.boundary,
            capability: options.capability,
            priority: (options.priority || config.defaultPriority || 5) as Priority,
          };
        }

        // Validate boundary (user-defined, just needs to be non-empty)
        if (!workDetails.boundary || workDetails.boundary.trim().length === 0) {
          error('Boundary must be a non-empty string', globalOpts);
          process.exit(1);
        }

        // Validate agent type if provided
        if (options.agentType) {
          const validAgentTypes = ['copilot-cli', 'claude-code'];
          if (!validAgentTypes.includes(options.agentType)) {
            error(`Invalid agent type: ${options.agentType}`, globalOpts);
            error(`Valid values: ${validAgentTypes.join(', ')}`, globalOpts);
            process.exit(1);
          }
        }

        if (!globalOpts.quiet) {
          spinner.start('Submitting work...');
        }

        const client = createAPIClient(config);
        const response = await client.submitWork({
          description: workDetails.description,
          boundary: workDetails.boundary,
          capability: workDetails.capability,
          priority: workDetails.priority,
          taskId: randomUUID(),
          deadline: options.deadline,
        });

        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        const result = response.data;

        if (!globalOpts.quiet) {
          spinner.succeed('Work submitted successfully');
        }

        // Output results
        if (globalOpts.json) {
          output(result, globalOpts);
        } else {
          success('Work submitted!', globalOpts);
          console.log();
          console.log(
            formatKeyValue({
              'Work Item ID': result.workItemId || result.id,
              'Target Agent Type': result.targetAgentType || 'Any',
              'Spin-up Triggered': result.spinUpTriggered ? 'Yes' : 'No',
              'Estimated Wait':
                result.estimatedWaitSeconds !== undefined
                  ? `${result.estimatedWaitSeconds}s`
                  : 'N/A',
            })
          );
          console.log();
          info(`Track progress with: shuttle work show ${result.workItemId || result.id}`, globalOpts);
        }
      } catch (err: any) {
        if (spinner.isSpinning) {
          spinner.fail('Failed to submit work');
        }
        error(`Error: ${err.message}`, {});
        process.exit(1);
      }
    });

  return cmd;
}
