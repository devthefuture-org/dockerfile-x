# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.5.3](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.5.2...v1.5.3) (2025-08-30)


### Bug Fixes

* known vulnerabilities (reup / reported in [#29](https://codeberg.org/devthefuture/dockerfile-x/issues/29))  ([a5e5c80](https://codeberg.org/devthefuture/dockerfile-x/commit/a5e5c80fd45e51596f0443eb7401d1353e34f5a0))
* put back vendor, .yarn/cache and .gitignore ([7a36941](https://codeberg.org/devthefuture/dockerfile-x/commit/7a36941267f0445597b25b0d31af8bf492b81909))
* upgrade go packages ([5961b5b](https://codeberg.org/devthefuture/dockerfile-x/commit/5961b5b182c5d1e783d8b578ed12c19a3e98e52b))
* upgrade node packages ([827a8b1](https://codeberg.org/devthefuture/dockerfile-x/commit/827a8b1339efcd3b56bcf12e2d9ff14c82a0cd08))

### [1.5.2](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.5.1...v1.5.2) (2025-08-30)

### [1.5.1](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.5.0...v1.5.1) (2025-08-30)

## [1.5.0](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.4.5...v1.5.0) (2025-08-29)


### Features

* include args envs labels from file ([4923e5c](https://codeberg.org/devthefuture/dockerfile-x/commit/4923e5ce4941e9a677c96b8f3f7ed56230d158b4))
* include external .env  file into `ARG`, `ENV`, `LABEL` instructions (requested in [#3](https://codeberg.org/devthefuture/dockerfile-x/issues/3)) ([9ab4d47](https://codeberg.org/devthefuture/dockerfile-x/commit/9ab4d47628b52e5976a9353740901a6a089f0a23))


### Bug Fixes

* missing dots in LABELs ([7cd9931](https://codeberg.org/devthefuture/dockerfile-x/commit/7cd99317da1e8aa4fa4f754d81fad1828f65a050))
* missing hyphens in LABELs ([49924d6](https://codeberg.org/devthefuture/dockerfile-x/commit/49924d6b33b21517c2192143adc44616aeb6d85f))

### [1.4.5](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.4.4...v1.4.5) (2025-08-28)


### Bug Fixes

* preserve dockerfile instructions (in [#27](https://codeberg.org/devthefuture/dockerfile-x/issues/27), [#28](https://codeberg.org/devthefuture/dockerfile-x/issues/28)) ([2d14dd9](https://codeberg.org/devthefuture/dockerfile-x/commit/2d14dd92e73def443f8d6f5dc69b779f837a9925))

### [1.4.4](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.4.3...v1.4.4) (2025-08-27)


### Bug Fixes

* case warning ([dea80d7](https://codeberg.org/devthefuture/dockerfile-x/commit/dea80d7877ceb050cddaee5c784540d1856a4f9b))
* improve solidity avoiding regex that could break ([42f28f2](https://codeberg.org/devthefuture/dockerfile-x/commit/42f28f2e48f6a02682163c8362428793af7dbc7e))
* regex for heredoc ([74fab2f](https://codeberg.org/devthefuture/dockerfile-x/commit/74fab2f8e98ad5734879af0190d6147c154d6df2))

### [1.4.3](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.4.2...v1.4.3) (2025-08-27)


### Bug Fixes

* preserve dockerfile indentation and multiline ([ff669e5](https://codeberg.org/devthefuture/dockerfile-x/commit/ff669e5b419c74cf5950562fa723f0d607ef972a))

### [1.4.2](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.4.1...v1.4.2) (2024-08-05)


### Bug Fixes

* top arg only on from include before stage ([ab5dac9](https://codeberg.org/devthefuture/dockerfile-x/commit/ab5dac9f09d2722d9c3c60eca9b5208ade82cc1c))

### [1.4.1](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.4.0...v1.4.1) (2024-05-24)


### Bug Fixes

* frontend caps build-context ([e3ed802](https://codeberg.org/devthefuture/dockerfile-x/commit/e3ed802e8010c2beccb4b536ce623bb9c507fbbe))

## [1.4.0](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.3.4...v1.4.0) (2024-05-24)


### Features

* build-context + up buildkit version + refactor frontend ([9cc5446](https://codeberg.org/devthefuture/dockerfile-x/commit/9cc544658bb1f39d592df1d4b4ef5583392b159c))


### Bug Fixes

* top arg handling ([1989087](https://codeberg.org/devthefuture/dockerfile-x/commit/19890870967b384b9b30e5638718c1d5dc764dab))

### [1.3.4](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.3.3...v1.3.4) (2024-03-30)


### Bug Fixes

* redeclareArgTop ([c47865e](https://codeberg.org/devthefuture/dockerfile-x/commit/c47865e64d0c008373776edd7a757569e1a55403))
* redeclareArgTop [#12](https://codeberg.org/devthefuture/dockerfile-x/issues/12) ([964438c](https://codeberg.org/devthefuture/dockerfile-x/commit/964438c0781ade1278a9fccbca7106ba91722d55))

### [1.3.3](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.3.2...v1.3.3) (2024-01-06)


### Bug Fixes

* mount from scope stage ([24c9694](https://codeberg.org/devthefuture/dockerfile-x/commit/24c96945abb71076ea2c400491946c0f417a7cfb))
* npm version ([cad654e](https://codeberg.org/devthefuture/dockerfile-x/commit/cad654e2ed319a7471788ac75d70320e88d6328c))

### [1.2.3](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.2.2...v1.2.3) (2023-09-03)


### Bug Fixes

* syntax comment cleaning ([3794fea](https://codeberg.org/devthefuture/dockerfile-x/commit/3794fea0beebf2df0c9a2d7a123bb0942ef0c4f1))

### [1.2.2](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.2.1...v1.2.2) (2023-09-03)


### Bug Fixes

* cli resolution ([f358a01](https://codeberg.org/devthefuture/dockerfile-x/commit/f358a0198d4628302d32628edb23baa65bce5458))

### [1.2.1](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.2.0...v1.2.1) (2023-09-03)


### Bug Fixes

* cli ([b8ac4db](https://codeberg.org/devthefuture/dockerfile-x/commit/b8ac4dbd239fe8935b7df8db1b2f54787b23e380))

## [1.2.0](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.1.3...v1.2.0) (2023-09-03)


### Features

* default .dockerfile extension ([77ca8a6](https://codeberg.org/devthefuture/dockerfile-x/commit/77ca8a6e60d601aa03e59186e186082f3d9a90c9))

### [1.1.3](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.1.2...v1.1.3) (2023-09-03)


### Bug Fixes

* dockerfile name collision ([a086711](https://codeberg.org/devthefuture/dockerfile-x/commit/a0867112896fcdc2135f11c02c15ac7959667947))

### [1.1.2](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.1.1...v1.1.2) (2023-09-02)


### Bug Fixes

* context resolution ([e27cba2](https://codeberg.org/devthefuture/dockerfile-x/commit/e27cba255f9ee917e2d9122c6573a77d4d96aec3))

### [1.1.1](https://codeberg.org/devthefuture/dockerfile-x/compare/v1.1.0...v1.1.1) (2023-09-02)

## 1.1.0 (2023-09-02)


### Features

* frontend integration ([4426e26](https://codeberg.org/devthefuture/dockerfile-x/commit/4426e2640d5e6e942ddc8ca40a0edb79ef79ac4a))


### Bug Fixes

* npm pack ([61c3961](https://codeberg.org/devthefuture/dockerfile-x/commit/61c3961bac1c7218ae7517872ce74a9d716f4416))
