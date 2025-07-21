import * as fs from 'fs';
import { execSync } from 'child_process';

interface GitHubContext {
  issue: {
    number: number;
  };
  repo: {
    owner: string;
    repo: string;
  };
  payload: {
    pull_request?: {
      base?: {
        sha: string;
      };
      head?: {
        sha: string;
      };
    };
  };
}

interface GitHubAPI {
  rest: {
    issues: {
      createComment: (params: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
      }) => Promise<any>;
    };
  };
}

interface Core {
  // Add any core methods you're using
}

interface APIRequestBody {
  user_id: string;
  prompts: string[];
  model: string;
}

interface APIResponse {
  response: string;
}

interface ModuleParams {
  github: GitHubAPI;
  context: GitHubContext;
  core: Core;
}

export default async ({ github, context }: ModuleParams): Promise<void> => {
  const issue_number: number = context.issue.number;

  // Get the base and head SHA from environment variables or context
  const baseSha: string | undefined = process.env.BASE_SHA || context.payload.pull_request?.base?.sha;
  const headSha: string | undefined = process.env.HEAD_SHA || context.payload.pull_request?.head?.sha;

  // Create a patch file containing only changes under /test and /tests directories
  try {
    execSync(`git diff ${baseSha} ${headSha} -- test/ tests/ > changes.patch`);
  } catch (error) {
    console.log('Error creating git diff:', (error as Error).message);
    // Try alternative method
    try {
      execSync(`git diff HEAD~1 HEAD -- test/ tests/ > changes.patch`);
      console.log('Used HEAD~1 HEAD as fallback for git diff');
    } catch (fallbackError) {
      console.log('Fallback git diff also failed:', (fallbackError as Error).message);
      return;
    }
  }
  
  // Read the patch file content
  let patchContent: string = '';
  try {
    patchContent = fs.readFileSync('changes.patch', 'utf8');
    console.log('Patch content:', patchContent);
  } catch (error) {
    console.log('Error reading patch file:', error);
    patchContent = 'No changes detected or error reading patch file.';
  }

  // Check if the patch file is empty
  if (!patchContent || patchContent.trim() === '') {
    console.log("No content changes detected.");
    return;
  }

  const apiUrl: string = 'https://4djfomzutg.execute-api.us-west-2.amazonaws.com/v1/api';            
  const apiKey: string | undefined = process.env.API_KEY;
  
  if (!apiKey) {
    console.error('API_KEY environment variable is not set');
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  };

  // Read the prompt template from file
  let promptTemplate: string = '';
  try {
    promptTemplate = fs.readFileSync('.github/workflows/prompt.txt', 'utf8');
    console.log('Prompt template loaded successfully');
  } catch (error) {
    console.log('Error reading prompt file:', error);
    // Fallback to default prompt if file doesn't exist
    promptTemplate = 'Analyze and summarize the following code changes in this pull request, and response in GitHub Flavored Markdown format:\n\n${patchContent}';
  }

  // Replace the placeholder with actual patch content
  const finalPrompt: string = promptTemplate.replace('${patchContent}', patchContent);

  const body: APIRequestBody = {
    "user_id": "ftsai", 
    "prompts": [finalPrompt],
    "model": "ollama.deepseek-r1:latest"
  };

  console.log(`Calling API: ${apiUrl}`);
  
  let response: Response = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });
  
  console.log(`HTTP Response Code: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    if (response.status === 429) {
      const retryDelays: number[] = [5, 10, 20, 60];
      for (let i = 0; i < retryDelays.length; i++) {
        const delay: number = retryDelays[i];
        console.log(`API returned 429. Retrying in ${delay} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        
        console.log(`Retrying API call (attempt ${i + 1})`);
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body)
        });

        console.log(`HTTP Response Code: ${response.status} ${response.statusText}`);
        if (response.ok) {
          break; 
        }
      }
    } else {
      console.log(`API call failed with status: ${response.status} ${response.statusText}`);
      const errorText: string = await response.text();
      console.log(`Error response body: ${errorText}`);
      return; // Abort if still not successful
    }
  }      
  
  const data: APIResponse = await response.json();
  console.log(`data received:`, data);
  
  // Use the response directly since it's already in markdown format
  let markdownResponse: string = data.response;

  // Ensure newlines are properly formatted
  markdownResponse = markdownResponse.replace(/\\n/g, '\n'); 
  console.log(`Markdown response:`, markdownResponse);

  // Format the comment with the markdown response
  const formattedComment: string = 
  `
  ${markdownResponse}

  *This comment was automatically generated by NSChat to help evaluate changes in this pull request.*

  <details>
  <summary>📊 Analysis Details</summary>

  - **Model Used**: ${body.model}
  - **Generated**: ${new Date().toISOString()}
  - **Prompt**: Analyze and summarize the following code changes in this pull request (just an example)

  </details>`;

  // Post a comment on the pull request
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issue_number,
    body: formattedComment
  });
};