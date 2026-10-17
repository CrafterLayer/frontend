import { FRAGMENT_SHADER, VERTEX_SHADER } from './shader';

/**
 * The WebGL plumbing, kept apart from the React component.
 *
 * Two reasons it is its own module. It is imperative and long-lived where the
 * component is declarative, and mixing the two produces effects that reach
 * into refs to do context management. And it is testable on its own: the
 * component's test can assert that a missing context degrades gracefully
 * without ever standing up a real GL stack, which jsdom does not have.
 */

export interface CloudUniforms {
  /** FBM octaves — "how much detail", not a number of sprites. */
  octaves: number;
  /** Density threshold. Lower means more sky is covered. */
  coverage: number;
  speed: number;
  cloud: readonly [number, number, number];
  skyTop: readonly [number, number, number];
  skyBottom: readonly [number, number, number];
}

export interface CloudSession {
  /** Draw one frame at this elapsed time, in seconds. */
  draw: (seconds: number) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  update: (uniforms: CloudUniforms) => void;
  dispose: () => void;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Stand up a session, or return null.
 *
 * Null rather than a throw, and it is not defensive noise: WebGL is genuinely
 * absent in real places — a hardened browser, a blocklisted driver, a headless
 * renderer, jsdom. A background that throws takes the page with it, so the
 * component treats null as "draw the CSS fallback" and the page stays up.
 */
export function createCloudSession(canvas: HTMLCanvasElement): CloudSession | null {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (gl === null) {
    return null;
  }

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (vertex === null || fragment === null) {
    return null;
  }

  /* `createProgram` is typed non-nullable; a lost context surfaces at link. */
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    /*
      Release what was already allocated before giving up. A failed link is
      rare, but the builder remounts this block on every edit — and a leak per
      failure is a leak per keystroke.
    */
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.useProgram(program);

  /*
    One triangle that covers the viewport, not two that make a quad. A quad has
    a seam down the diagonal where the two triangles meet, and every fragment
    near it is rasterised twice.
  */
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const locations = {
    resolution: uniform('u_resolution'),
    time: uniform('u_time'),
    octaves: uniform('u_octaves'),
    coverage: uniform('u_coverage'),
    cloud: uniform('u_cloud'),
    skyTop: uniform('u_skyTop'),
    skyBottom: uniform('u_skyBottom'),
  };

  let speed = 1;

  return {
    resize(width, height, pixelRatio) {
      /*
        Capped at 2. A cloud field is low-frequency by nature, so a 3x display
        spends triple the fragments on detail the effect does not contain —
        and it is the phones with the highest ratios that can least afford it.
      */
      const scale = Math.min(pixelRatio, 2);
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(locations.resolution, w, h);
    },
    update(uniforms) {
      speed = uniforms.speed;
      gl.uniform1f(locations.octaves, uniforms.octaves);
      gl.uniform1f(locations.coverage, uniforms.coverage);
      gl.uniform3f(locations.cloud, ...uniforms.cloud);
      gl.uniform3f(locations.skyTop, ...uniforms.skyTop);
      gl.uniform3f(locations.skyBottom, ...uniforms.skyBottom);
    },
    draw(seconds) {
      gl.uniform1f(locations.time, seconds * speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      /*
        NOT `loseContext()`.

        Contexts are a scarce browser-wide resource, so releasing one looks
        like the responsible thing — and it is, right up until the same canvas
        is asked for a context again. `getContext('webgl2')` returns the SAME,
        now-lost object, every compile against it fails, and the block falls
        back to its CSS sky forever. React's StrictMode double-mount reproduces
        it on the first render. Deleting the program and buffers releases what
        this component actually allocated; the context itself goes when the
        canvas is collected.
      */
    },
  };
}
