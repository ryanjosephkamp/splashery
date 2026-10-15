// Identity proof for sharing deterministic diagnostic passes. Never infer a
// match from a photograph alone: require uploaded buffers, shader sources,
// uniforms, texture bytes, and the actual source and background pixels.
import crypto from "node:crypto";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

export async function renderInputsR4(page, textures) {
  const state = await page.evaluate(async () => {
    const pl = window.__splashery.player;
    const bytes = async (value) => {
      let view;
      if (value instanceof ArrayBuffer) view = new Uint8Array(value);
      else if (ArrayBuffer.isView(value))
        view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      else throw new Error("An uploaded buffer is unavailable.");
      const digest = await crypto.subtle.digest("SHA-256", view.slice());
      return {
        bytes: view.length,
        sha256: [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join(""),
      };
    };
    try {
      if (pl.scene.toy.id !== "photo-3d" || !window.__psv.state().on)
        throw new Error("Identity sharing requires the static Photo to 3D Sharp view.");
      const instances = pl.stage.app.scene.layers
        .getLayerByName("World")
        .meshInstances.filter((m) => m.material.getParameter("uDepth") && m.visible !== false);
      const meshes = [];
      for (const mi of instances) {
        const material = mi.material,
          parameters = {};
        for (const name of Object.keys(material.parameters).sort()) {
          const value = material.getParameter(name).data;
          if (ArrayBuffer.isView(value)) parameters[name] = await bytes(value);
          else if (
            Array.isArray(value) ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            value === null
          )
            parameters[name] = value;
          else if (value && Number.isInteger(value.width) && Array.isArray(value._levels)) {
            const level = value._levels[0];
            const texture = {
              width: value.width,
              height: value.height,
              format: value.format,
              mipmaps: value.mipmaps,
              flipY: value.flipY,
              premultiplyAlpha: value.premultiplyAlpha,
              type: value.type,
              encoding: value.encoding,
              compareOnRead: value.compareOnRead,
              compareFunc: value.compareFunc,
              cubemap: value.cubemap,
              volume: value.volume,
              arrayLength: value.arrayLength,
              minFilter: value.minFilter,
              magFilter: value.magFilter,
              addressU: value.addressU,
              addressV: value.addressV,
              anisotropy: value.anisotropy,
            };
            if (value.cubemap || value.volume || value.arrayLength || value._levels.length !== 1)
              throw new Error(`Only a single-level 2D texture can share diagnostics: ${name}`);
            if (ArrayBuffer.isView(level) || level instanceof ArrayBuffer)
              texture.data = await bytes(level);
            else if (
              name === "uColor" &&
              level &&
              level.width === value.width &&
              level.height === value.height
            )
              texture.source = "source-pixels-verified-separately";
            else throw new Error(`Texture bytes unavailable: ${name}`);
            parameters[name] = texture;
          } else throw new Error(`Unsupported uniform: ${name}`);
        }
        const vb = mi.mesh.vertexBuffer,
          ib = mi.mesh.indexBuffer[0];
        meshes.push({
          layer: Array.from(material.getParameter("uLayer").data),
          vertices: await bytes(vb.storage),
          indices: await bytes(ib.storage),
          indexFormat: ib.format,
          verticesCount: vb.numVertices,
          format: vb.format.elements.map((e) => ({
            name: e.name,
            numComponents: e.numComponents,
            dataType: e.dataType,
            normalize: e.normalize,
            offset: e.offset,
            stride: e.stride,
          })),
          primitive: mi.mesh.primitive[0],
          world: await bytes(mi.node.getWorldTransform().data),
          shader: {
            vertex: material.shaderDesc.vertexGLSL,
            fragment: material.shaderDesc.fragmentGLSL,
            attributes: material.shaderDesc.attributes,
            language: material.shaderDesc.shaderLanguage,
            defines: material.defines ? [...material.defines] : [],
          },
          render: {
            style: mi.renderStyle,
            mask: mi.mask,
            cull: material.cull,
            blendType: material.blendType,
            depthFunc: material.depthFunc,
            depthTest: material.depthTest,
            depthWrite: material.depthWrite,
            alphaTest: material.alphaTest,
            alphaToCoverage: material.alphaToCoverage,
            depthBias: material.depthBias,
            slopeDepthBias: material.slopeDepthBias,
            drawOrder: mi.drawOrder,
            cullInstance: mi.cull,
            bounds: {
              center: [mi.aabb.center.x, mi.aabb.center.y, mi.aabb.center.z],
              halfExtents: [mi.aabb.halfExtents.x, mi.aabb.halfExtents.y, mi.aabb.halfExtents.z],
            },
          },
          parameters,
        });
      }
      meshes.sort((a, b) => a.layer[2] - b.layer[2]);
      if (!meshes.length) throw new Error("No photo mesh is available.");
      return {
        supported: true,
        device: pl.stage.device.deviceType,
        context: pl.stage.device.gl.getContextAttributes(),
        camera: {
          rect: [
            pl.stage.cameraEntity.camera.rect.x,
            pl.stage.cameraEntity.camera.rect.y,
            pl.stage.cameraEntity.camera.rect.z,
            pl.stage.cameraEntity.camera.rect.w,
          ],
          clearDepth: pl.stage.cameraEntity.camera.clearDepthBuffer,
          clearStencil: pl.stage.cameraEntity.camera.clearStencilBuffer,
          layers: pl.stage.cameraEntity.camera.layers,
        },
        scene: {
          gamma: pl.stage.app.scene.gammaCorrection,
          toneMapping: pl.stage.app.scene.toneMapping,
          exposure: pl.stage.app.scene.exposure,
        },
        buffer: [pl.stage.canvas.width, pl.stage.canvas.height],
        meshes,
      };
    } catch (error) {
      return { supported: false, reason: error.message };
    }
  });
  if (state.supported) {
    state.sourcePixels = hash(textures.surface.data);
    state.backgroundPixels = hash(textures.background.data);
  }
  return { ...state, sha256: hash(JSON.stringify(state)) };
}

export async function projectionR4(page) {
  return page.evaluate(() => {
    const pl = window.__splashery.player,
      mi = pl.stage.app.scene.layers
        .getLayerByName("World")
        .meshInstances.find(
          (m) =>
            m.material.getParameter("uDepth") && m.material.getParameter("uLayer").data[2] === 0,
        );
    return {
      camera: Array.from(pl.stage.cameraEntity.camera.camera._viewProjMat.data),
      recipe: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ].map((p) => pl.fromRecipe(p)),
      grid: Array.from(mi.material.getParameter("uGrid").data),
      lift: Array.from(mi.material.getParameter("uLift").data),
      buffer: [pl.stage.canvas.width, pl.stage.canvas.height],
    };
  });
}
