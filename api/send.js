export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, message, count } = req.body;

    // Basic validation
    if (!username || !message) {
        return res.status(400).json({ error: 'Username and message are required' });
    }

    const sendCount = Math.min(count || 1, 10); // Max 10 per request
    const logs = [];
    let sent = 0;

    for (let i = 0; i < sendCount; i++) {
        try {
            // Generate random deviceId (required by NGL)
            const deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now() + '_' + Math.random();
            
            const response = await fetch('https://ngl.link/api/submit', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://ngl.link',
                    'Referer': 'https://ngl.link/'
                },
                body: JSON.stringify({
                    username: username.toLowerCase().trim(),
                    question: message,
                    deviceId: deviceId
                })
            });
            
            const data = await response.json();
            
            // Handle rate limiting
            if (response.status === 429) {
                logs.push(`⚠️ Rate limited! Waiting 5 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                // Retry once after rate limit
                const retryResponse = await fetch('https://ngl.link/api/submit', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Origin': 'https://ngl.link',
                        'Referer': 'https://ngl.link/'
                    },
                    body: JSON.stringify({
                        username: username.toLowerCase().trim(),
                        question: message,
                        deviceId: deviceId + '_retry'
                    })
                });
                const retryData = await retryResponse.json();
                if (retryResponse.ok && retryData.status === 'success') {
                    sent++;
                    logs.push(`✅ Message ${i+1} sent to @${username} (after rate limit)`);
                } else {
                    logs.push(`❌ Message ${i+1} failed: Rate limited and retry failed`);
                }
                continue;
            }
            
            if (response.ok && data.status === 'success') {
                sent++;
                logs.push(`✅ Message ${i+1} sent to @${username}`);
            } else {
                logs.push(`❌ Message ${i+1} failed: ${data.message || 'Unknown error'}`);
            }
            
            // Small delay between messages in same batch
            if (i < sendCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
        } catch (err) {
            logs.push(`❌ Message ${i+1} error: ${err.message}`);
        }
    }

    res.status(200).json({ 
        sent, 
        total: sendCount,
        logs,
        timestamp: new Date().toISOString(),
        success: sent > 0
    });
}
