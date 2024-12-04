# Contributing

To build and start a development version of LatenSee locally, first install [Go](https://go.dev/) and [npm](https://www.npmjs.com/), then run the following:

```shell
$ git clone https://github.com/loopholelabs/latensee.git --single-branch
$ cd latensee
$ go generate ./...
$ go run .
```

To start the backend and open the frontend in a browser instead of an application window during development, run the following:

```shell
# Start the backend in the first terminal
$ HYDRAPP_BACKEND_LADDR=localhost:1337 HYDRAPP_TYPE=dummy go run .
# Start the frontend in a second terminal
$ cd pkg/frontend
$ npm run dev
# Now open http://localhost:1234 in your browser
```

To build the DEB, RPM, Flatpak, MSI, EXE, DMG, APK, and static binaries for all other platforms, run the following:

```shell
$ hydrapp build
# You can find the built packages in the out/ directory
```

If you only want to build certain packages or for certain architectures, for example to only build the APKs, pass `--exclude` like in the following:

```shell
$ hydrapp build --exclude '(binaries|deb|rpm|flatpak|msi|dmg|docs|tests)'
```

For more information, see the [hydrapp documentation](https://github.com/pojntfx/hydrapp).

LatenSee uses GitHub to manage reviews of pull requests.

- If you have a trivial fix or improvement, go ahead and create a pull request,
  addressing (with `@...`) the maintainer of this repository (see
  [MAINTAINERS.md](./MAINTAINERS.md)) in the description of the pull request.

- If you plan to do something more involved, first discuss your ideas
  on our [Discord](https://loopholelabs.io/discord).
  This will avoid unnecessary work and surely give you and us a good deal
  of inspiration.

- Relevant coding style guidelines are the [Go Code Review
  Comments](https://code.google.com/p/go-wiki/wiki/CodeReviewComments)
  and the _Formatting and style_ section of Peter Bourgon's [Go: Best
  Practices for Production
  Environments](http://peter.bourgon.org/go-in-production/#formatting-and-style).

- Be sure to sign off on the [DCO](https://github.com/probot/dco#how-it-works)
