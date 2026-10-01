# FlowForge

An open-source, browser-based 3D wind tunnel. Add a sphere, box, or cylinder and watch a GPU-computed fluid field move around it.

![FlowForge running around a sphere](8-screenshot.png)

**An interactive CFD experiment, not an engineering-grade solver.** Do not use its output to size equipment, validate safety, or make design decisions.

## Run locally

Node.js 22.12+ and a recent desktop browser with WebGL2 and `EXT_color_buffer_float` support are required.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend, credentials, or paid services are needed.

```sh
npm run build    # production files in dist/
npm run preview # inspect the production build locally
npm test        # Chrome UI and numerical smoke tests
```

Tests use `/usr/bin/google-chrome` by default. Set `CHROME_PATH` to your Chrome executable, or install Playwright Chromium with `npx playwright install chromium` and set `PLAYWRIGHT_CHROMIUM=1`.

## What works

- Orbit and zoom around a true Three.js 3D canvas.
- Add up to 12 sphere, box, or vertical-cylinder obstacles.
- Select, resize, move in all three axes, and remove obstacles.
- Adjust inlet speed and viscosity; pause, resume, and reset.
- Visualize 8,192 GPU-advected particles, colored by local speed.
- Run the fluid solver entirely on the GPU in the browser. Nothing leaves the browser.
- Display a useful error when the required GPU features are unavailable.

Changing geometry resets the flow so stale velocities do not remain inside newly placed solids. Shapes are static during a simulation; overlapping shapes are treated as the union of their solid cells. Large shapes can intersect the tunnel walls.

## Solver

A fixed **64 x 32 x 32** Eulerian velocity grid is stored as an **8 x 4 atlas of 32 depth slices** in floating-point WebGL render targets. Each simulation step performs:

1. Semi-Lagrangian velocity advection with trilinear sampling.
2. An explicit viscosity/diffusion update.
3. Centered-difference divergence computation.
4. 24 Jacobi iterations for pressure, with zero-normal-gradient pressure at solids and a zero-pressure outlet.
5. Pressure-gradient subtraction and boundary enforcement.
6. Midpoint advection of tracer particles through the resulting velocity field.

A prescribed left-face velocity drives the tunnel. The right face uses an approximate open outflow; side walls and obstacles use a voxelized zero-velocity mask. This is a simplified stable-fluids implementation, **not lattice Boltzmann**. Tracers are visualization samples, not a particle-based fluid solver.

Parameters are in grid units, with a fixed simulation step of 0.45. Up to 30 steps are requested per second of wall-clock time; slower devices advance fewer steps. Displayed frames per second are rendering speed, not physical time. This version reports no Reynolds number, lift, drag, or real-world units.

## Validation and limits

Automated smoke tests check that GPU shaders compile without browser errors, the field remains finite, obstacle-center velocity is zero, nearby flow has a transverse component, and add/remove/control actions update state. A screenshot is taken after 30 solver steps. These checks catch implementation regressions; they are **not** a CFD validation study.

Known limits:

- Coarse voxel boundaries, fixed resolution, fixed time step, and approximate outlet conditions.
- Collocated grid, centered derivatives, and a small pressure-iteration budget can leave divergence and grid artifacts. There is no convergence guarantee or adaptive residual check.
- Numerical diffusion from semi-Lagrangian advection; no turbulence model or compressibility.
- No mesh import, surface forces, physical calibration, or moving solids yet.
- Desktop-first. WebGL GPU performance and floating-point support vary. Software rendering is much slower.
- No deployed demo is included. Build and run locally, or host `dist/` as a static site.

## Roadmap

- Analytic benchmark tests, divergence residual monitoring, and grid convergence studies.
- Staggered MAC grid, better wall and outlet treatment, selectable resolutions.
- STL/OBJ import with watertight-mesh voxelization.
- Streamlines, slices, pressure visualization, and field export.
- Calibrated units and force integration only after solver validation.

## Contributing

Small, tested pull requests are welcome. Please include numerical or visual evidence for solver changes and keep scientific limitations explicit. Run `npm ci`, `npm run build`, and `npm test` before submitting.

## License

MIT. See [LICENSE](LICENSE).
