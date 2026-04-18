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

    if (req.method === "POST" && (req.url === "/evidence" || req.url === "/enforce")) {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("error", (err) => {
            console.error(`[dStack CVM] Stream Error: ${err.message}`);
        });

        req.on("end", async () => {
            try {
                // Route strictly to the Aegis Phala Entrypoint logic via the Hardware Context
                const enclaveResponse = await phalaEntrypoint(body);
                
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(enclaveResponse);
            } catch (err: any) {
                console.error(`[dStack CVM] Fatal Hardware Panic: ${err.message}`);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "error", error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ status: "error", error: "Enclave Invalid Route" }));
    }
});

server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[Aegis-12 Phala Enclave] Secure dStack CVM Instance online and bound to ${PORT}`);
});
