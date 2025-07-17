// run_api.js
// A minimal script to call a specific API 100 times sequentially.
// To run: `node run_api.js`

// --- 1. API Configuration ---
const API_URL = 'https://4djfomzutg.execute-api.us-west-2.amazonaws.com/v1/api';
const CALL_COUNT = 100;

// Request details provided by you
const requestOptions = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        // IMPORTANT: In a real application, load secrets from environment variables, not hardcoded.
        'x-api-key': 'ojR4WdbesL8l3pXNhsBlVau1FwBq5u9i1WL1nA16' 
    },
    body: JSON.stringify({
        "user_id": "ftsai",
        "prompts": ['what should a good unit test review include?'],
        "model": "ollama.deepseek-r1:latest"
    })
};


/**
 * --- 2. Function to Perform a Single API Call ---
 * This function makes one POST request and handles the response.
 * @param {number} index - The current call number for logging.
 */
async function callApi(index) {
    console.log(`--- Starting Call #${index + 1} ---`);
    try {
        let response = await fetch(API_URL, requestOptions); // Changed from const to let

        if (!response.ok) {
              if (response.status === 429) {
                const retryDelays = [5, 10, 20, 40];
                for (let i = 0; i < retryDelays.length; i++) {
                  const delay = retryDelays[i];
                  console.log(`API returned 429. Retrying in ${delay} seconds...`);
                  await new Promise(resolve => setTimeout(resolve, delay * 1000));
                  
                  console.log(`Retrying API call (attempt ${i + 2})`);
                  response = await fetch(API_URL, requestOptions); // Now this works

                  console.log(`HTTP Response Code: ${response.status} ${response.statusText}`);
                  if (response.ok) {
                    break; 
                  }
                }
              } else {
                console.log(`API call failed with status: ${response.status} ${response.statusText}`);
                const errorText = await response.text();
                console.log(`Error response body: ${errorText}`);
                return; // Abort if still not successful
              }
            }    

        // Get the JSON response from the API
        const data = await response.json();

        console.log(`Response #${index + 1}:`, JSON.stringify(data, null, 2));
        return { success: true, data };

    } catch (error) {
        console.error(`Error on call #${index + 1}:`, error.message);
        return { success: false, error };
    }
}


/**
 * --- 3. Main Execution Logic ---
 * This function runs a simple loop to call the API 100 times.
 */
async function main() {
    console.log(`Preparing to call API ${CALL_COUNT} times...`);
    const startTime = Date.now();

    // Loop from 0 to 99 (for 100 calls)
    for (let i = 0; i < CALL_COUNT; i++) {
        await callApi(i);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n--- All ${CALL_COUNT} calls completed in ${duration.toFixed(2)} seconds. ---`);
}

// Start the process
main();
