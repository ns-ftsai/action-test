"use strict";
// src/main.ts
// This file will be copied to /app/src/main.ts inside the Docker container
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
function extractCustomPrompt(commentBody) {
    /* This regular expression looks for a line starting with "set-prompt:"
     * and captures the text that follows until the end of the line or the end of the string.
     */
    const setPromptMatch = commentBody.match(/set-prompt:\s*(.*)/);
    if (setPromptMatch) {
        // Modify commentBody to remove the trigger, so the actual prompt is clean
        commentBody = commentBody.replace(/@reviewer\s*set-prompt:\s*/i, '').trim();
    }
    core.info(`Extracted comment body after removing set-prompt: ${commentBody}`);
    // Return the captured group, which is the custom prompt text
    return setPromptMatch && setPromptMatch[1] ? setPromptMatch[1].trim() : null;
}
/**
 * Check if the action should run based on the trigger type and comment content
 */
function shouldRunAction() {
    const eventName = github.context.eventName;
    if (eventName === 'pull_request') {
        core.info('Action triggered by pull_request event.');
        return { shouldRun: true, customPrompt: null };
    }
    if (eventName === 'issue_comment') {
        // *** MODIFIED: Get COMMENT_BODY from core.getInput() ***
        const commentBody = core.getInput('comment_body', { required: false }) || '';
        core.info(`Received issue comment body: "${commentBody.trim().substring(0, 50)}..."`);
        // Only run if it's a PR comment and starts with @reviewer
        if (commentBody.trim().toLowerCase().startsWith('@reviewer')) {
            core.info('Issue comment starts with @reviewer. Proceeding.');
            const customPrompt = extractCustomPrompt(commentBody);
            return { shouldRun: true, customPrompt };
        }
        else {
            core.info('Issue comment does not start with @reviewer. Skipping.');
        }
    }
    core.info('Action skipped - not triggered by a relevant event or comment.');
    return { shouldRun: false, customPrompt: null };
}
/**
 * The main function for the action.
 */
async function run() {
    try {
        // --- 0. Check if action should run ---
        const { shouldRun, customPrompt } = shouldRunAction();
        if (!shouldRun) {
            core.info('Action skipped based on trigger conditions.');
            return;
        }
        // --- 1. Get Inputs and Context ---
        // *** MODIFIED: Get all inputs using core.getInput() ***
        const token = core.getInput('github_token', { required: true });
        const apiKey = core.getInput('api_key', { required: true });
        // base_sha and head_sha are mandatory inputs in action.yml
        const baseShaInput = core.getInput('base_sha', { required: true });
        const headShaInput = core.getInput('head_sha', { required: true });
        const context = github.context;
        // Handle both PR events and comment events to determine PR number
        let prNumber;
        let baseSha;
        let headSha;
        if (context.eventName === 'pull_request') {
            prNumber = context.payload.pull_request?.number;
            baseSha = baseShaInput; // Use input value directly
            headSha = headShaInput; // Use input value directly
        }
        else if (context.eventName === 'issue_comment') {
            prNumber = context.payload.issue?.number; // For comments, we need to get PR info from the issue
            if (!prNumber) {
                core.setFailed('Could not determine pull request number from issue comment context.');
                return;
            }
            // Get PR details using the GitHub API for issue_comment events
            // This is needed if baseSha/headSha are not reliably available directly from issue_comment payload
            // Or if the provided inputs don't cover all cases.
            // Given your action.yml inputs, they *should* always be provided from the workflow.
            // However, this fallback ensures robustness if the workflow fails to pass them for comments.
            const octokit = github.getOctokit(token);
            try {
                const prResponse = await octokit.rest.pulls.get({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: prNumber
                });
                baseSha = prResponse.data.base.sha;
                headSha = prResponse.data.head.sha;
                core.info(`Fetched SHAs for PR #${prNumber} via GitHub API: Base=${baseSha}, Head=${headSha}`);
            }
            catch (apiError) {
                core.setFailed(`Failed to fetch PR details for issue comment: ${apiError.message}`);
                return;
            }
        }
        // Final checks for required values
        if (!token) { // This check is technically redundant now with core.getInput({ required: true })
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
        // --- 2. Create Git Diff Patch ---
        try {
            core.info(`Creating diff between ${baseSha} and ${headSha}`);
            // Ensure your git repository is fully checked out and accessible.
            // The `actions/checkout@v4` step in your workflow should ensure this.
            (0, child_process_1.execSync)(`git diff ${baseSha} ${headSha} -- test/ tests/ > changes.patch`);
        }
        catch (error) {
            core.warning(`Standard git diff failed: ${error.message}. Trying fallback.`);
            try {
                // Fallback to diffing last commit with HEAD (less reliable but might work)
                (0, child_process_1.execSync)(`git diff HEAD~1 HEAD -- test/ tests/ > changes.patch`);
                core.info('Used HEAD~1 HEAD as fallback for git diff');
            }
            catch (fallbackError) {
                core.setFailed(`Fallback git diff also failed: ${fallbackError.message}. Ensure repository history is complete (fetch-depth: 0)`);
                return;
            }
        }
        const patchContent = fs.readFileSync('changes.patch', 'utf8');
        if (!patchContent || patchContent.trim() === '') {
            core.info("No content changes detected in 'test/' or 'tests/' directories. Exiting.");
            // *** MODIFIED: Set outputs even if action is skipped ***
            core.setOutput('comment_status', 'skipped');
            core.setOutput('comment_message', 'No relevant changes found to comment on.');
            return;
        }
        // --- 3. Call External API with Patch Content ---
        const apiUrl = 'https://4djfomzutg.execute-api.us-west-2.amazonaws.com/v1/api';
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey || ''
        };
        let promptTemplate;
        // *** MODIFIED: Correct path for prompt.txt inside the container ***
        const promptFilePath = './src/prompt.txt'; // Assuming prompt.txt is now in src/
        try {
            promptTemplate = fs.readFileSync(promptFilePath, 'utf8');
            core.info('Prompt template loaded successfully from file.');
        }
        catch (error) {
            core.warning(`Could not read ${promptFilePath}, using default prompt. Error: ${error.message}`);
            promptTemplate = 'Analyze and summarize the following code changes in this pull request, and response in GitHub Flavored Markdown format:\n\n${patchContent}';
        }
        // If there's a custom prompt from the comment, append it to the template
        if (customPrompt) {
            core.info(`Custom prompt detected: "${customPrompt}"`);
            promptTemplate = `${promptTemplate}\n\nAdditional instructions: ${customPrompt}`;
        }
        const finalPrompt = promptTemplate.replace('${patchContent}', patchContent);
        const requestBody = {
            "user_id": "ftsai",
            "prompts": [finalPrompt],
            "model": "ollama.deepseek-r1:latest"
        };
        core.info(`Calling API: ${apiUrl}`);
        let response;
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
            core.setOutput('comment_status', 'api_error');
            core.setOutput('comment_message', `API call failed: ${response.status}`);
            return;
        }
        const data = await response.json();
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
        core.setOutput('comment_status', 'success');
        core.setOutput('comment_message', 'Comment posted successfully.');
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
            core.setOutput('comment_status', 'failed');
            core.setOutput('comment_message', `Action failed: ${error.message}`);
        }
        else {
            core.setFailed('An unknown error occurred');
            core.setOutput('comment_status', 'failed');
            core.setOutput('comment_message', 'An unknown error occurred.');
        }
    }
}
run();
