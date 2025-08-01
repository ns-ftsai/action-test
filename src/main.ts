import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path'; // <-- 1. Import the 'path' module

const RE_SET_PROMPT = /set-prompt:\s*(.*)/;
const RE_SET_PROMPT_INIT = /@reviewer\s*set-prompt:\s*/i;
const PULL_REQUEST = 'pull_request';
const ISSUE_COMMENT = 'issue_comment';
const PATCH_FILE = 'changes.patch';
const API_URL = 'https://4djfomzutg.execute-api.us-west-2.amazonaws.com/v1/api';
const PROMPT_PATH = path.join(__dirname, '..', 'src', 'prompt.txt');
const FALL_BACK_PROMPT = 'Analyze and summarize the following code changes in this pull request, and response in GitHub Flavored Markdown format:\n\n${patchContent}';
const MODEL = 'ollama.deepseek-r1:latest';
const USER_ID = 'ftsai';

interface ApiResponse {
  response: string;
}

function extractCustomPrompt(commentBody: string): string | null {
  /* This regular expression looks for a line starting with "set-prompt:"
   * and captures the text that follows until the end of the line or the end of the string.
   */
  const setPromptMatch = commentBody.match(RE_SET_PROMPT);
  if (setPromptMatch) {
    // Modify commentBody to remove the trigger, so the actual prompt is clean
    commentBody = commentBody.replace(RE_SET_PROMPT_INIT, '').trim();
  }
  core.info(`Extracted comment body after removing set-prompt: ${commentBody}`);
  // Return the captured group, which is the custom prompt text
  return setPromptMatch && setPromptMatch[1] ? setPromptMatch[1].trim() : null;
}

/**
 * Check if the action should run based on the trigger type and comment content
 */
function shouldRunAction(): { shouldRun: boolean; customPrompt: string | null } {

  
  // here is why the script is not running
  // fix it
  // be noted
  const eventName = github.context.eventName;

  // this line here
  // end

  core.info(`Event name: ${eventName}`);

  if (eventName === PULL_REQUEST) {
    core.info('Action triggered by pull_request event.');
    return { shouldRun: true, customPrompt: null };
  }

  if (eventName === ISSUE_COMMENT) {
    const commentBody = core.getInput('comment_body', { required: false }) || '';
    core.info(`Received issue comment body: "${commentBody.trim().substring(0, 50)}..."`);
    
    // Only run if it's a PR comment and starts with @reviewer
    if (commentBody.trim().toLowerCase().startsWith('@reviewer')) {
      core.info('Issue comment starts with @reviewer. Proceeding.');
      const customPrompt = extractCustomPrompt(commentBody);
      return { shouldRun: true, customPrompt };
    } else {
      core.info('Issue comment does not start with @reviewer. Skipping.');
    }
  }

  core.info('Action skipped - not triggered by a relevant event or comment.');
  return { shouldRun: false, customPrompt: null };
}

function verifyInputs(): void {
  core.startGroup('Verifying Inputs');
        // For secrets, just check if they are present, don't print the actual value.
  core.info(`Input api_key: ${core.getInput('api_key') ? '****' : 'NOT SET'}`);
  core.info(`Input github_token: ${core.getInput('github_token') ? '****' : 'NOT SET'}`);
  core.info(`Input base_sha: ${core.getInput('base_sha')}`);
  core.info(`Input head_sha: ${core.getInput('head_sha')}`);
  core.info(`Input comment_body: '${core.getInput('comment_body')}'`);
  core.endGroup();
}

async function run(): Promise<void> {
  try {
    verifyInputs();
    const { shouldRun, customPrompt } = shouldRunAction();
    if (!shouldRun) {
      core.info('Action skipped based on trigger conditions.');
      return;
    }

    const token = core.getInput('github_token', { required: true });
    const octokit = github.getOctokit(token);
    const apiKey = core.getInput('api_key', { required: true });
    const baseShaInput = core.getInput('base_sha', { required: true });
    const headShaInput = core.getInput('head_sha', { required: true });
    const context = github.context;

    core.info(`api_key: ${apiKey}`);

    // Handle both PR events and comment events to determine PR number
    let prNumber: number | undefined;
    let baseSha: string | undefined;
    let headSha: string | undefined;

    if (context.eventName === PULL_REQUEST) {
      prNumber = context.payload.pull_request?.number;
      baseSha = baseShaInput;
      headSha = headShaInput; 
    } else if (context.eventName === ISSUE_COMMENT) {
      // For issue_comment events, we need to extract the PR number from the issue
      prNumber = context.payload.issue?.number;

      if (!prNumber) {
        core.setFailed('Could not determine pull request number from issue comment context.');
        return;
      }

      try {
        const prResponse = await octokit.rest.pulls.get({
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: prNumber
        });
        baseSha = prResponse.data.base.sha;
        headSha = prResponse.data.head.sha;
        core.info(`Fetched SHAs for PR #${prNumber} via GitHub API: Base=${baseSha}, Head=${headSha}`);
      } catch (apiError: any) {
        core.setFailed(`Failed to fetch PR details for issue comment: ${apiError.message}`);
        return;
      }
    }

    if (!token) {
      core.setFailed('GITHUB_TOKEN is not set. Please add it to the env section of the workflow or pass as input.');
      return;
    }
    if (!prNumber) {
      core.setFailed('Could not determine pull request number for the action.');
      return;
    }
    if (!baseSha || !headSha) {
        core.setFailed('Base and/or Head SHAs are missing.');
        return;
    }

    try {
      core.info(`Creating diff between ${baseSha} and ${headSha}`);
      const response = await octokit.rest.repos.compareCommits({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        base: baseSha,
        head: headSha,
      });

      const files = response.data.files;
      if (!files) {
        core.info(`No files changed between ${baseSha} and ${headSha}. Exiting.`);
        core.setOutput('comment_status', 'skipped');
        core.setOutput('comment_message', 'No relevant changes found to comment on.');
        return;
      }
      const fullDiff = files.map(file => file.patch).join('\n');
      fs.writeFileSync(PATCH_FILE, fullDiff);
      core.info(`Git diff patch created successfully for PR #${prNumber}`);
    } catch (error) {
      core.warning(`Standard git diff failed: ${(error as Error).message}. Trying fallback.`);
      try {
        // Fallback to diffing last commit with HEAD
        const fallbackResponse = await octokit.rest.repos.compareCommits({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          base: `${headSha}~1`,
          head: headSha,
        });

        const files = fallbackResponse.data.files;
        if (!files) {
          core.info(`No files changed between ${baseSha} and ${headSha}. Exiting.`);
          core.setOutput('comment_status', 'skipped');
          core.setOutput('comment_message', 'No relevant changes found to comment on.');
          return;
        }
        const fullDiff = files.map(file => file.patch).join('\n');
        fs.writeFileSync(PATCH_FILE, fullDiff);
        core.info('Used HEAD~1 HEAD as fallback for git diff');
      } catch (fallbackError) {
        core.setFailed(`Fallback git diff also failed: ${(fallbackError as Error).message}. Ensure repository history is complete (fetch-depth: 0)`);
        return;
      }
    }

    const patchContent = fs.readFileSync(PATCH_FILE, 'utf8');
    if (!patchContent || patchContent.trim() === '') {
      core.info("No content changes detected. Exiting.");
      core.setOutput('comment_status', 'skipped');
      core.setOutput('comment_message', 'No relevant changes found to comment on.');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || ''
    };

    let promptTemplate: string;
    try {
      promptTemplate = fs.readFileSync(PROMPT_PATH, 'utf8');
      core.info('Prompt template loaded successfully from file.');
    } catch (error) {
      core.warning(`Could not read ${PROMPT_PATH}, using default prompt. Error: ${(error as Error).message}`);
      promptTemplate = FALL_BACK_PROMPT;
    }

    // If there's a custom prompt from the comment, append it to the template
    if (customPrompt) {
      core.info(`Custom prompt detected: "${customPrompt}"`);
      promptTemplate = `${promptTemplate}\n\nAdditional instructions: ${customPrompt}`;
    }

    const finalPrompt = promptTemplate.replace('${patchContent}', patchContent);
    const requestBody = {
      "user_id": USER_ID,
      "prompts": [finalPrompt],
      "model": MODEL
    };

    core.info(`Calling API: ${API_URL}`);

    let response: Response;
    response = await fetch(API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    // If the initial call fails with a 429, start the retry logic
    if (!response.ok && response.status === 429) {
      const retryDelays = [5, 10, 20, 60]; // seconds
      for (const [index, delay] of retryDelays.entries()) {
        core.info(`API returned 429. Retrying in ${delay} seconds... (Attempt ${index + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));

        response = await fetch(API_URL, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          break;
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      core.warning(`API call failed with status ${response.status}: ${errorText}`);
      core.setOutput('comment_status', 'api_error');
      core.setOutput('comment_message', `API call failed: ${response.status}`);
      return;
    }

    const data = await response.json() as ApiResponse;
    let markdownResponse = data.response.replace(/\\n/g, '\n');

    const triggerInfo = context.eventName === ISSUE_COMMENT ?
      ` (triggered by @reviewer comment${customPrompt ? ' with custom prompt' : ''})` : '';

    const formattedComment = `
${markdownResponse}

*This comment was automatically generated by NSChat to help evaluate changes in this pull request${triggerInfo}.*

<details>
<summary>📊 Analysis Details</summary>

- **Model Used**: \`${requestBody.model}\`
- **Generated**: \`${new Date().toISOString()}\`
- **Trigger**: \`${context.eventName}\`${customPrompt ? `\n- **Custom Prompt**: \`${customPrompt}\`` : ''}

</details>`;

    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: formattedComment
    });

    core.info(`Successfully posted a comment to PR #${prNumber}.`);
    core.setOutput('comment_status', 'success');
    core.setOutput('comment_message', 'Comment posted successfully.');

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
      core.setOutput('comment_status', 'failed');
      core.setOutput('comment_message', `Action failed: ${error.message}`);
    } else {
      core.setFailed('An unknown error occurred');
      core.setOutput('comment_status', 'failed');
      core.setOutput('comment_message', 'An unknown error occurred.');
    }
  }
}

run();