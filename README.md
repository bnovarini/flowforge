# FlowForge

[Open the live demo](https://bnovarini.github.io/flowforge/) · [Source](https://github.com/bnovarini/flowforge)

An open-source, browser-based 3D wind tunnel. Add a sphere, box, or cylinder and watch a GPU-computed fluid field move around it.


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
- Run the 3D solver on the GPU. The separate 2D benchmark uses a CPU worker. Geometry stays local.
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
- Mesh import and qualitative force proxies are available in v2; no physical calibration or moving solids.
- Desktop-first. WebGL GPU performance and floating-point support vary. Software rendering is much slower.
- A static demo can be published with the included GitHub Pages workflow.

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

## v2: cylinder shedding and new geometry

Select **Cylinder / 2D LBM benchmark** in the solver view. This is a separate 320 x 128 **CPU Web Worker** D2Q9 BGK solver, displayed as a vorticity plane in a Three.js scene. It is not a 3D lattice-Boltzmann solver. Red and blue show opposite signs of curl. The alternating wake develops naturally; no vorticity-confinement force or scripted vortex animation is used.

The Re=100 preset uses inlet speed U=0.06, cylinder diameter D=20, kinematic viscosity nu=0.012, and relaxation time tau=0.536 in lattice units. Cylinder links use bounce-back no-slip. The inlet is prescribed and outlet uses a simple extrapolation; top/bottom are periodic. A tiny initial transverse perturbation and a 0.3-cell cylinder offset break numerical symmetry. Higher-Re presets are experimental, not validated.

Allow about 1-3 minutes on a desktop for the wake to form, or longer on slower devices. The readout reports actual lattice steps, not wall-clock physical time. The benchmark runs independently of the GPU 3D view and can be paused or restarted. Force CSV export contains raw lattice momentum-exchange drag/lift samples every 10 steps. The displayed Cd/Cl divide by 0.5*rho*U^2*D, with rho_ref=1.

### Measured result, not a validation certificate

The exact JavaScript solver at Re=100 was run for 24,000 steps. Over steps 12,000-24,000, five complete lift periods gave a mean period of **1757.08 steps** and **St = D/(U*T) = 0.18971**, about **5.1% below the requested 0.2 target**. Field values remained finite. An independently written C++ scalar implementation produced FFT-bin St=0.19444 over the same window (frequency resolution 1/12000 steps); that bin estimate is coarser than the zero-crossing period measurement. Its mean Cd was about 1.70. These are internally consistent smoke/benchmark results, not proof of engineering accuracy.

Reproduce the JavaScript check with `node benchmarks/check.mjs`. The live St readout waits for at least four upward lift zero crossings after step 12,000, then updates using the available window. It is sensitive to transients, sampling window, finite domain and periodic-boundary interactions. No grid/domain convergence study has been completed. A universal St=0.2 is not a precise reference at all Re or blockage ratios.

Relevant published context: [LB confined-cylinder study](https://link.springer.com/article/10.1007/s40430-020-2176-y) studies steady/unsteady flow and Re-dependent shedding. [Benchpress D2Q9 example](https://benchpress.readthedocs.io/autodoc_benchmarks/lattice_boltzmann_D2Q9.html) describes a cylinder/Re=100 benchmark. This implementation is original code; those sources inform context, not a borrowed validation result.

### Shapes and imports

The GPU 3D mode now accepts STL (binary or ASCII) and OBJ (geometry only), centered and scaled to the size control. Watertight closed meshes are required for reliable ray-parity voxelization. Files are processed locally, with no upload. The limit is 10 MB and 60,000 triangles, but simplify far below that for responsive voxelization. Non-watertight, self-intersecting or very thin geometry can voxelize incorrectly; there is no repair or topology certification.

Built-in stylized **car**, **Formula 1 car**, **cow**, and **golf ball** are single selectable obstacles. The car/F1/cow use original primitive composites, not downloaded vehicle models. Golf dimples are visual only: the fluid sees a smooth sphere at this coarse grid. This version cannot measure the golf-ball drag crisis or automotive aerodynamics accurately.

The selected 3D obstacle gets a **qualitative drag proxy**, split into pressure and shear terms over exposed voxel faces. Pressure is the projection solver's pressure potential; shear uses a one-cell tangential velocity gradient. Values are uncalibrated grid units, not Newtons or credible drag coefficients. Overlapping solids use a voxel union with ownership by the last overlapping obstacle; individual-force attribution at overlaps is therefore approximate.

The original 3D grid remains 64 x 32 x 32. Increasing it or adding vorticity confinement alone would not establish realistic 3D shedding. The next physics work is a staggered grid or validated 3D LBM, grid/time/domain convergence, improved inflow/outflow, and comparison against matched reference drag/lift/Strouhal cases.

A **NACA 0012-style symmetric extruded airfoil** is also built in (12% thickness, closed trailing edge). It is aligned to the flow and has no angle-of-attack control yet. At the default coarse 3D resolution its thickness is only a few cells: do not infer lift or airfoil performance from this view.
