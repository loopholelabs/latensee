## LatenSee

![Logo](./docs/logo-readme.png)

Redis latency visualizer.

[![hydrapp CI](https://github.com/loopholelabs/latensee/actions/workflows/hydrapp.yaml/badge.svg)](https://github.com/loopholelabs/latensee/actions/workflows/hydrapp.yaml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-brightgreen.svg)](https://www.apache.org/licenses/LICENSE-2.0)

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
- [Font Awesome](https://fontawesome.com/) provides the assets used for the icon and logo.
- [go-redis/redis](https://github.com/redis/go-redis) provides the Redis client.

## Contributing

Bug reports and pull requests are welcome on GitHub at [https://github.com/loopholelabs/latensee][gitrepo]. For more contribution information check out [the contribution guide](https://github.com/loopholelabs/latensee/blob/master/CONTRIBUTING.md).

## License

The LatenSee project is available as open source under the terms of the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

## Code of Conduct

Everyone interacting in the LatenSee project's codebases, issue trackers, chat rooms and mailing lists is expected to follow the [CNCF Code of Conduct](https://github.com/cncf/foundation/blob/master/code-of-conduct.md).

## Project Managed By:

[![https://loopholelabs.io][loopholelabs]](https://loopholelabs.io)

[gitrepo]: https://github.com/loopholelabs/latensee
[loopholelabs]: https://cdn.loopholelabs.io/loopholelabs/LoopholeLabsLogo.svg
[loophomepage]: https://loopholelabs.io
