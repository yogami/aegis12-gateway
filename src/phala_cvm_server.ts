import * as http from "http";
import phalaEntrypoint, { AegisEnclave } from "./application/PhalaEntrypoint";

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
    
    if (req.method === "GET" && req.url === "/health") {
        try {
            const enclave = AegisEnclave.getInstance();
            await enclave.initialize();
            const health = {
                status: "alive",
                solanaPayer: enclave.anchor?.getPayerPublicKey(),
                enclaveDid: enclave.signer?.enclaveDid,
                version: "v1.0.1-unmocked",
                hardware: "phala-dstack-cvm",
                timestamp: new Date().toISOString()
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(health));
        } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: "Hardware Init Failed", details: err.message }));
        }
        return;
    }

    // [PHASE 2.2: SUBSTANCE DISCOVERY]
    // Manual URL Routing for GET /evidence/:receiptId
    // Resilient to double-slashes or proxy prefixes
    if (req.method === "GET" && req.url?.includes("/evidence/")) {
        try {
            const receiptId = req.url.split("/evidence/")[1];
            if (!receiptId) throw new Error("Missing Receipt ID in evidence lookup.");
            
            console.log(`[dStack CVM] Evidence Lookup: ${receiptId}`);
            const enclave = AegisEnclave.getInstance();
            const status = await enclave.getEvidenceStatus(receiptId);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(status);
        } catch (err: any) {
            console.error(`[dStack CVM] Lookup Error: ${err.message}`);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: err.message }));
        }
        return;
    }

    const isAegisRoute = req.url?.includes("/enforce") || req.url?.includes("/evidence");

    if (req.method === "POST" && isAegisRoute) {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("error", (err: Error) => {
            console.error(`[dStack CVM] Stream Error: ${err.message}`);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "error", error: `Stream Error: ${err.message}` }));
        });
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
