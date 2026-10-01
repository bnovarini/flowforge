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

### Orientation and visible wake fix

Flow is in +X, from left to right. Car/F1 noses and the cow's head now point upstream (-X); the same mirrored composite parts define both rendering and fluid voxels. The 3D shapes view includes an orange/blue center-plane overlay of the **computed velocity deficit**, making the low-speed region behind an obstacle visible when dense tracers hide it. This is a velocity-field slice, not a vorticity plot or proof of vortex shedding. The current 64 x 32 x 32 stable-fluids solver is still too diffusive for a validated shedding claim. Default inlet/viscosity remain unchanged.

## 3D D3Q19 wake view

Select **3D wake / GPU D3Q19 LBM**. The default cylinder preset uses Re300, U=0.06 lattice units, D=12 cells, and a 128 x64 x64 grid (span5.33D). This is a true three-dimensional19-distribution lattice-Boltzmann computation with TRT collision, voxel bounce-back, periodic lateral boundaries and an approximate open outlet. Red/blue volume points show opposite signs of spanwise vorticity; green reflects streamwise vorticity. Orbit the view to inspect depth. These are sampled field points, not a plane, scripted vortices or a full-resolution volume raycast.

The cylinder starts from a **computed warm state**: an independently computed13,600-step scalar D3Q19 run with a single random transverse seed of +/-0.5%U. Its velocity/density was sampled32 x16 x8, interpolated and converted to equilibrium GPU distributions. This is not an exact microscopic checkpoint. GPU step count starts at zero. No random or vorticity forcing is applied during evolution. Fresh uniform start and the earlierRe250 warm state remain available. Other shapes start fresh rather than borrowing the cylinder wake.

### Measured result and limits

The seededRe300 GPU continuation stayed finite through4,688 steps. Four complete mean-centered lift periods over steps640-4,688 gave period884.569 lattice steps and **St=0.226099**, about13% above the0.2 ballpark, not an exact hit. Spanwise velocityRMS was0.00315 (5.25%U) and persisted/gained strength across the cycles. A stride-two late-field check found wake streamwise-vorticityRMS0.00232 and span-dependent velocity variationRMS0.00354. The volume evolves with span-dependent structure, not an extruded2D street. No modeA/B classification is claimed.

This is a coarse-grid numerical check, **not engineering validation**. No grid/domain convergence, matched reference-force validation, turbulence model or interpolated curved-wall treatment has been completed. The TRT product0.001 is an empirical stability choice; the usual3/16 on a smaller cylinder became unstable. Raw Cd near2 is not a credible aerodynamic prediction. Warm-field interpolation produces settling transients; the frequency window excludes the first600 GPU steps. Measurement JSON and force samples are in `benchmarks/3d-measurements.json` and `benchmarks/gpu3-seeded-force-history.json`.

The earlierRe250 case at128 x64 x32, U0.08, D12 measured GPU St0.222106 over four periods but its initial sinusoidal spanwise seed decayed. It stayed nearly spanwise-uniform. The independent scalarRe250 frequency0.22275 is a separate measurement. A3D computation alone does not prove a 3D instability.

Car/F1/cow use upstream-facing composite voxel masks. Airfoil uses its analytic NACA0012-style solid sampled directly because the coarse mask could lose its thin section. Sphere/car/F1/cow/airfoil passed120-step startup checks with nonzero solid force; **their developed wakes and shedding frequencies are not verified**. They are labeled experimental. Airfoil is only about1-2 cells thick at base resolution. Composite reference-area force numbers are uncalibrated proxies, not aerodynamic coefficients.

The optional192 x96 x64 grid only passed allocation/initialization, not long-run stability or interactive-performance checks. Software rendering here advances slowly; hardware-GPU performance is unmeasured. Large grids may exhaust memory. Desktop WebGL2 and float render targets are required, with at least three color attachments. Restart when changing shape/Re/grid. The exported CSV is the current run's computed force history.

### Reproducing the 3D checks

`benchmarks/cylinder3d-seeded.cpp` is the original scalar reference. Compile with `g++ -O3 -fopenmp benchmarks/cylinder3d-seeded.cpp -o cylinder3d-seeded`, then run `./cylinder3d-seeded 0.001 13600`. It writes a native-float state file and progress CSV to stdout. It is research code, not a calibrated solver.

For the GPU continuation, install Playwright Chromium with `npx playwright install chromium`, run `npm run dev` in one terminal, and run `STEPS=4688 node benchmarks/gpu3-check.mjs > gpu3-result.json` in another. It uses the bundled sampled warm field and returns finite-field diagnostics, force history and mean-centered crossing frequency. The fixed 32-step force sampling differs from the original checkpointed measurement cadence, so minor frequency differences are expected. Software rendering can take hours. The ordinary CI suite runs short startup/regression checks, not this long continuation.

## Original 3D view: visual smoke preview

The stable-fluids view can display a ray-marched smoke volume. The scalar dye is injected just upstream of the first obstacle, transported through the computed velocity field with trilinear semi-Lagrangian advection, removed from solid voxels and faded slowly. The plume is a visual marker, not a second fluid or a mass-conserving density solve. It resets with geometry and flow. The source follows the first obstacle; multiple obstacles affect the same plume.

"Visual swirl retention" adds vorticity confinement before pressure projection. This artistic force helps retain rotating flow on the coarse grid. It does not establish physically correct turbulence, Reynolds numbers or shedding frequencies. Setting it to zero restores the original velocity update. Tracers and the earlier velocity-deficit slice remain available. Neither the D2Q9 benchmark nor the D3Q19 solver uses this confinement or smoke field.

The 48-sample ray march adds rendering cost and can be slow on software graphics or large high-DPI screens. Volume lighting is approximate, not physically based scattering. Allow the plume to reach the obstacle; it starts empty after reset. The density source is continuous and fixed in grid coordinates relative to the first obstacle, not attached to the downstream wake.

## Obstacle rotation controls

The original 3D view has independent X/Y/Z angle sliders for each selected obstacle. Angles are in degrees, with local XYZ Euler order. The displayed mesh and solid test use the same rotation, and changes reset the flow and dye. Imports, composite shapes and primitives rotate about their own center. A rotated coarse voxel mask is still only an approximation to a curved surface.

The D3Q19 view also has X/Y/Z angle controls. Apply/restart uses them and rotates both the rendered obstacle and collision geometry. A rotated cylinder is a finite cylinder of the current span length, so this is a different, unvalidated flow problem. Nonzero rotations always start fresh: the bundled unrotated cylinder warm state is not valid at another orientation. The measured Re300 shedding result applies only to the unrotated preset. Reference-area force numbers are not corrected for projected area after rotation. Zero rotation restores the original benchmark geometry. Sphere rotation has no visible geometric effect.
