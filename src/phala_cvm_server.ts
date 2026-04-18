import * as http from "http";
import phalaEntrypoint from "./application/PhalaEntrypoint";

const PORT = process.env.PORT || 8000;

// Production Micro-Server mapped explicitly for the Phala Network dStack CVM
const server = http.createServer(async (req, res) => {
    // Cross-Origin configuration required for some TEE RPC interfaces
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Aegis-Trace");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    console.log(`[dStack CVM] Incoming Request: ${req.method} ${req.url}`);

    const isAegisRoute = req.url?.includes("/enforce") || req.url?.includes("/evidence");

    if (req.method === "POST" && isAegisRoute) {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", async () => {
            console.log(`[dStack CVM] Request body received (${body.length} bytes). Processing...`);
            try {
                const enclaveResponse = await phalaEntrypoint(body);
                console.log(`[dStack CVM] Enclave Response received: ${enclaveResponse.substring(0, 100)}...`);
                
                let parsed;
                try {
                    parsed = JSON.parse(enclaveResponse);
                } catch (pe) {
                    console.error(`[dStack CVM] CRITICAL: phalaEntrypoint returned non-JSON: ${enclaveResponse}`);
                    throw new Error("Internal Enclave Protocol Error: Malformed JSON response");
                }
                
                // Final Production Verification Stamp
                const response = {
                    ...parsed,
                    version: "v1.0.1-unmocked",
                    hardware: "phala-dstack-cvm",
                    timestamp: new Date().toISOString()
                };

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(response));
                console.log(`[dStack CVM] Response sent successfully.`);
            } catch (err: any) {
                console.error(`[dStack CVM] Processing Error: ${err.message}`);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "error", error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ 
            status: "error", 
            error: "Enclave Invalid Route",
            received_url: req.url,
            suggestion: "Try /enforce or /evidence"
        }));
    }
});

server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[Aegis-12] Secure Enclave Production v1.0.1 online on port ${PORT}`);
});
