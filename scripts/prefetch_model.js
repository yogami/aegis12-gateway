const { pipeline, env } = require('@xenova/transformers');

// Prevent loading local files since we are caching from HF
env.allowLocalModels = false;

async function prefetch() {
    console.log("Prefetching Uzyau/deberta-injection-onnx model weights...");
    // This will download and cache the model in the default Hugging Face cache directory
    await pipeline('text-classification', 'Uzyau/deberta-injection-onnx', { quantized: false });
    console.log("Prefetch complete. Weights cached successfully.");
}

prefetch().catch(console.error);
