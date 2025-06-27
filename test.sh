const apiUrl = 'https://4djfomzutg.execute-api.us-west-2.amazonaws.com/v1/api';
    console.log(`Calling API: ${apiUrl}`);
            
            const headers = {
              'Content-Type': 'application/json',
              'x-api-key': 'ojR4WdbesL8l3pXNhsBlVau1FwBq5u9i1WL1nA16' 
            };

            const body = {
              "user_id": "ftsai", 
              "prompts": ["what is a good test in unit testing?"],
              "model": "ollama.deepseek-r1:latest"
            };

            console.log(`Calling API: ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(body)
            });
            const data = await response.json();
            
            console.log('data received')
            console.log(data)