// The D-SSIM backward pass needs nine storage buffers. The WebGPU device default is eight,
// even on adapters that support more. This is build-only; the browser toy keeps its defaults.
export async function requestTrainingDevice() {
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter || adapter.limits.maxStorageBuffersPerShaderStage < 9)
    throw new Error(
      "D-SSIM training requires an adapter with at least nine storage buffers per stage.",
    );
  return adapter.requestDevice({
    requiredFeatures: adapter.features.has("subgroups") ? ["subgroups"] : [],
    requiredLimits: {
      maxStorageBuffersPerShaderStage: 9,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize: adapter.limits.maxBufferSize,
    },
  });
}
