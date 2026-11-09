# happy-engine
A WebGL engine and a creature system that run in the browser with **no build step and no C++ toolchain**. The engine's C++ (geometry, physics, IK, creature rig, terrain) is shipped precompiled as two WebAssembly modules; everything else is plain JavaScript that a small dev server bundles on the fly.
