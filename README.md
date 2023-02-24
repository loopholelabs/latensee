## LatenSee

![Logo](./docs/logo-readme.png)

Redis latency visualizer.

[![hydrapp CI](https://github.com/loopholelabs/latensee/actions/workflows/hydrapp.yaml/badge.svg)](https://github.com/loopholelabs/latensee/actions/workflows/hydrapp.yaml)

## Overview

A Redis latency visualization tool.

## Installation

See [INSTALLATION.html](https://loopholelabs.github.io/latensee/docs/main/INSTALLATION.html).

## Reference

### Command Line Arguments

All arguments passed to the binary will be forwarded to the browser used to display the frontend.

### Environment Variables

| Name                     | Description                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `HYDRAPP_BACKEND_LADDR`  | Listen address for the backend (`localhost:0` by default)                                                   |
| `HYDRAPP_FRONTEND_LADDR` | Listen address for the frontend (`localhost:0` by default)                                                  |
| `HYDRAPP_BROWSER`        | Binary of browser to display the frontend with                                                              |
| `HYDRAPP_TYPE`           | Type of browser to display the frontend with (one of `chromium`, `firefox`, `epiphany`, `lynx` and `dummy`) |
| `HYDRAPP_SELFUPDATE`     | Whether to check for updates on launch (disabled if OS provides an app update mechanism)                    |

## Acknowledgements

- [pojntfx/hydrapp](https://github.com/pojntfx/hydrapp) provides the application framework.
- [Font Awesome](https://fontawesome.com/) provides the assets used for the icon

## Contributing

To contribute, please use the [GitHub flow](https://guides.github.com/introduction/flow/) and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

To build and start a development version of LatenSee locally, run the following:

```shell
$ git clone https://github.com/loopholelabs/latensee.git
$ cd latensee
$ go generate ./...
$ go run .
```

Note that you can also set `HYDRAPP_BACKEND_LADDR` to a fixed value, `HYDRAPP_TYPE` to `dummy` and serve the frontend yourself to develop in your browser of choice directly.

## License

LatenSee (c) 2023 Felicitas Pojtinger and contributors

SPDX-License-Identifier: Apache-2.0
