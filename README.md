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
- Run the 3D solver on the GPU. Geometry stays local.
- Display a useful error when the required GPU features are unavailable.

Changing geometry resets the flow so stale velocities do not remain inside newly placed solids. Shapes are static during a simulation; overlapping shapes are treated as the union of their solid cells. Large shapes can intersect the tunnel walls.

## Solver

A **128 x 64 x 64** Eulerian velocity grid (default "High" grid quality; a **64 x 32 x 32** "Standard" option is in the UI, or use `?grid=standard`) is stored as an atlas of depth slices (8 x 8 at 128 x 64 x 64 high, 8 x 4 at standard) in floating-point WebGL render targets. Each simulation step performs:

1. Semi-Lagrangian velocity advection with trilinear sampling, followed by a clamped MacCormack correction at reduced strength (0.15) to cut numerical diffusion. At full strength the correction produced speckle noise in the rendered smoke.
2. An explicit viscosity/diffusion update.
3. Centered-difference divergence computation.
4. 24 Jacobi iterations for pressure, with zero-normal-gradient pressure at solids and a zero-pressure outlet.
5. Pressure-gradient subtraction and boundary enforcement.
6. Midpoint advection of tracer particles through the resulting velocity field.

A prescribed left-face velocity drives the tunnel. The right face uses an approximate open outflow; side walls and obstacles use a voxelized zero-velocity mask. This is a simplified stable-fluids implementation. Tracers are visualization samples, not a particle-based fluid solver.

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

## Geometry and shapes

The GPU 3D mode now accepts STL (binary or ASCII) and OBJ (geometry only), centered and scaled to the size control. Watertight closed meshes are required for reliable ray-parity voxelization. Files are processed locally, with no upload. The limit is 10 MB and 60,000 triangles, but simplify far below that for responsive voxelization. Non-watertight, self-intersecting or very thin geometry can voxelize incorrectly; there is no repair or topology certification.

Built-in stylized **car**, **Formula 1 car**, **cow**, and **golf ball** are single selectable obstacles. The car/F1/cow use original primitive composites, not downloaded vehicle models. Golf dimples are visual only: the fluid sees a smooth sphere at this coarse grid. This version cannot measure the golf-ball drag crisis or automotive aerodynamics accurately.

The selected 3D obstacle gets a **qualitative drag proxy**, split into pressure and shear terms over exposed voxel faces. Pressure is the projection solver's pressure potential; shear uses a one-cell tangential velocity gradient. Values are uncalibrated grid units, not Newtons or credible drag coefficients. Overlapping solids use a voxel union with ownership by the last overlapping obstacle; individual-force attribution at overlaps is therefore approximate.

The 3D grid defaults to 128 x 64 x 64 (obstacles, inlet, viscosity and confinement are rescaled so slider meanings stay the same; force readouts are an uncalibrated proxy, rescaled to match). Imports voxelize about 8x slower at the high grid and switching grid quality reloads the page. Doubling the grid alone does not establish realistic 3D shedding. Increasing it or adding vorticity confinement alone would not establish realistic 3D shedding. Effective Reynolds number is well below the nominal ratio of speed times size over the viscosity slider, because semi-Lagrangian advection adds its own numerical viscosity. Measured wakes at default settings settle to a steady state rather than shed. The next physics work would be a staggered grid, grid/time/domain convergence, improved inflow/outflow, and comparison against matched reference cases.

A **NACA 0012-style symmetric extruded airfoil** is also built in (12% thickness, closed trailing edge). It is aligned to the flow and has no angle-of-attack control yet. At the default coarse 3D resolution its thickness is only a few cells: do not infer lift or airfoil performance from this view.

### Orientation and visible wake fix

Flow is in +X, from left to right. Car/F1 noses and the cow's head now point upstream (-X); the same mirrored composite parts define both rendering and fluid voxels. The 3D shapes view includes an orange/blue center-plane overlay of the **computed velocity deficit**, making the low-speed region behind an obstacle visible when dense tracers hide it. This is a velocity-field slice, not a vorticity plot or proof of vortex shedding. The stable-fluids solver is still too diffusive for a validated shedding claim. Default inlet/viscosity remain unchanged.

## Visual smoke

The stable-fluids view can display a ray-marched smoke volume. The scalar dye is injected at the start of the grid (near the inlet, centered), independent of where obstacles are placed, transported through the computed velocity field with trilinear semi-Lagrangian advection, removed from solid voxels and faded slowly. The plume is a visual marker, not a second fluid or a mass-conserving density solve. It resets with geometry and flow. The source follows the first obstacle; multiple obstacles affect the same plume.

"Visual swirl retention" adds vorticity confinement before pressure projection. This artistic force helps retain rotating flow on the coarse grid. It does not establish physically correct turbulence, Reynolds numbers or shedding frequencies. Setting it to zero restores the original velocity update. Tracers and the earlier velocity-deficit slice remain available.

The 48-sample ray march adds rendering cost and can be slow on software graphics or large high-DPI screens. Volume lighting is approximate, not physically based scattering. Allow the plume to reach the obstacle; it starts empty after reset. The density source is continuous and fixed in grid coordinates relative to the first obstacle, not attached to the downstream wake.

## Obstacle rotation controls

Each selected obstacle has independent X/Y/Z angle sliders for each selected obstacle. Angles are in degrees, with local XYZ Euler order. The displayed mesh and solid test use the same rotation, and changes reset the flow and dye. Imports, composite shapes and primitives rotate about their own center. A rotated coarse voxel mask is still only an approximation to a curved surface.

Force proxies are not corrected for projected area after rotation. Sphere rotation has no visible geometric effect.

### Vorticity-colored smoke

"Smoke / vorticity colors" uses the computed curl of the stable-fluids velocity field. Red and blue encode the sign of whichever XYZ curl component has the largest absolute value at the sample; saturation grows with total curl magnitude. Weak rotation remains neutral smoke. The color-contrast slider changes only the display, not the solver. "Smoke / neutral density" keeps the earlier plain look.

There is no universal clockwise direction in 3D. Dominant-component coloring can switch hue when a vortex tilts between axes, even without a reversal of its circulation. Treat it as a visual aid, not vortex identification or validated shedding. The original coarse solver and artistic confinement limits still apply. The curl display is refreshed after pressure projection even with confinement set to zero.
