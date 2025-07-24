const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const { execSync } = require('child_process');

interface ApiResponse {
  response: string;
}

function extractCustomPrompt(commentBody: string): string | null {
/* This regular expression looks for a line starting with "set-prompt:"
 * and captures the text that follows until the end of the line or the end of the string.
 */
  const setPromptMatch = commentBody.match(/set-prompt\s*:\s*(.+?)(?:\n|$)/s);
  return setPromptMatch && setPromptMatch[1] ? setPromptMatch[1].trim() : null;
}

/**
 * Check if the action should run based on the trigger type and comment content
 */
function shouldRunAction(): { shouldRun: boolean; customPrompt: string | null } {
  const eventName = github.context.eventName;
  
  if (eventName === 'pull_request') {
    return { shouldRun: true, customPrompt: null };
  }
  
  if (eventName === 'issue_comment') {
    const commentBody = (process.env.COMMENT_BODY || '').toLowerCase();
    // Only run if it's a PR comment and starts with @reviewer
    if (commentBody.trim().startsWith('@reviewer')) {
      const customPrompt = extractCustomPrompt(commentBody);
      return { shouldRun: true, customPrompt };
    }
  }
  
  return { shouldRun: false, customPrompt: null };
}

/**
 * The main function for the action.
 */
async function run(): Promise<void> {
  try {
    // --- 0. Check if action should run ---
    const { shouldRun, customPrompt } = shouldRunAction();
    if (!shouldRun) {
      core.info('Action skipped - not triggered by @reviewer comment or PR event');
      return;
    }

    // --- 1. Get Inputs and Context ---
    const token = process.env.GITHUB_TOKEN;
    const apiKey = process.env.API_KEY;
    const context = github.context;
    
    // Handle both PR events and comment events
    let prNumber: number | undefined;
    let baseSha: string | undefined;
    let headSha: string | undefined;
    
    if (context.eventName === 'pull_request') {
      prNumber = context.payload.pull_request?.number;
      baseSha = process.env.BASE_SHA || context.payload.pull_request?.base?.sha;
      headSha = process.env.HEAD_SHA || context.payload.pull_request?.head?.sha;
    } else if (context.eventName === 'issue_comment') {
      // For comments, we need to get PR info from the issue
      prNumber = context.payload.issue?.number;
      
      // Get PR details using the GitHub API
      const octokit = github.getOctokit(token);
      const prResponse = await octokit.rest.pulls.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber
      });
      
      baseSha = prResponse.data.base.sha;
      headSha = prResponse.data.head.sha;
    }

    if (!token) {
      core.setFailed('GITHUB_TOKEN is not set. Please add it to the env section of the workflow.');
      return;
    }
    if (!prNumber) {
      core.setFailed('Could not get pull request number from context.');
      return;
    }

    // --- 2. Create Git Diff Patch ---
    try {
      core.info(`Creating diff between ${baseSha} and ${headSha}`);
      execSync(`git diff ${baseSha} ${headSha} -- test/ tests/ > changes.patch`);
    } catch (error) {
      core.warning(`Standard git diff failed: ${(error as Error).message}. Trying fallback.`);
      try {
        execSync(`git diff HEAD~1 HEAD -- test/ tests/ > changes.patch`);
        core.info('Used HEAD~1 HEAD as fallback for git diff');
      } catch (fallbackError) {
        core.setFailed(`Fallback git diff also failed: ${(fallbackError as Error).message}`);
        return;
      }
    }

    const patchContent = fs.readFileSync('changes.patch', 'utf8');
    if (!patchContent || patchContent.trim() === '') {
      core.info("No content changes detected in 'test/' or 'tests/' directories. Exiting.");
      return;
    }

    // --- 3. Call External API with Patch Content ---
    const apiUrl = 'https://4djfomzutg.execute-api.us-west-2.amazonaws.com/v1/api';
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || ''
    };

    let promptTemplate: string;
    try {
      promptTemplate = fs.readFileSync('.github/scripts/prompt.txt', 'utf8');
      core.info('Prompt template loaded successfully from file.');
    } catch (error) {
      core.warning('Could not read prompt.txt, using default prompt.');
      promptTemplate = 'Analyze and summarize the following code changes in this pull request, and response in GitHub Flavored Markdown format:\n\n${patchContent}';
    }

    // If there's a custom prompt from the comment, append it to the template
    if (customPrompt) {
      core.info(`Custom prompt detected: ${customPrompt}`);
      promptTemplate = `${promptTemplate}\n\nAdditional instructions: ${customPrompt}`;
    }

    const finalPrompt = promptTemplate.replace('${patchContent}', patchContent);
    const requestBody = {
      "user_id": "ftsai",
      "prompts": [finalPrompt],
      "model": "ollama.deepseek-r1:latest"
    };

    core.info(`Calling API: ${apiUrl}`);
    let response: Response;
    
    // Initial API call
    response = await fetch(apiUrl, {
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
            
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                break; // Success, exit retry loop
            }
        }
    }
    
    if (!response.ok) {
        const errorText = await response.text();
        core.setFailed(`API call failed with status ${response.status}: ${errorText}`);
        return;
    }
    
    const data = await response.json() as ApiResponse;
    let markdownResponse = data.response.replace(/\\n/g, '\n');

    // --- 4. Format and Post Comment ---
    const triggerInfo = context.eventName === 'issue_comment' ? 
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

    const octokit = github.getOctokit(token);
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: formattedComment
    });

    core.info(`Successfully posted a comment to PR #${prNumber}.`);

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();
