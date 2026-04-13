import http from "http";
// Attempt to dynamically import the user's compiled phala-entry logic
// If running via npx tsx, this will resolve natively.
import phalaEntrypoint from "../src/phala-entry";

const PORT = 8099;

const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/evidence") {
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", async () => {
            try {
                console.log(`[dstack CVM Proxy] Received execution payload. Bootstrapping Enclave...`);
                
                // Route the payload into the exact Javascript logic deployed to the Phala TEE
                const enclaveResponse = await phalaEntrypoint(body);
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(enclaveResponse);
            } catch (err: any) {
                console.error(`[dstack CVM Proxy] Fatal Enclave Panic: ${err.message}`);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n========================================================`);
    console.log(`🛡️  Phala Network: Local dstack CVM Simulator Online`);
    console.log(`🔗 Listening for Telemetry Trace Events on port ${PORT}`);
    console.log(`🧪 Hackathon Mode: Bypassing decentralized mainnet routing`);
    console.log(`========================================================\n`);
});
