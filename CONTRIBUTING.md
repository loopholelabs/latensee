# Contributing

To build and start a development version of LatenSee locally, run the following:

```shell
$ git clone https://github.com/loopholelabs/latensee.git
$ cd latensee
$ go generate ./...
$ go run .
```

Note that you can also set `HYDRAPP_BACKEND_LADDR` to a fixed value, `HYDRAPP_TYPE` to `dummy` and serve the frontend yourself to develop in your browser of choice directly.

LatenSee uses GitHub to manage reviews of pull requests.

- If you have a trivial fix or improvement, go ahead and create a pull request,
  addressing (with `@...`) the maintainer of this repository (see
  [MAINTAINERS.md](MAINTAINERS.md)) in the description of the pull request.

- If you plan to do something more involved, first discuss your ideas
  on our [discord](https://loopholelabs.io/discord).
  This will avoid unnecessary work and surely give you and us a good deal
  of inspiration.

- Relevant coding style guidelines are the [Go Code Review
  Comments](https://code.google.com/p/go-wiki/wiki/CodeReviewComments)
  and the _Formatting and style_ section of Peter Bourgon's [Go: Best
  Practices for Production
  Environments](http://peter.bourgon.org/go-in-production/#formatting-and-style).

- Be sure to sign off on the [DCO](https://github.com/probot/dco#how-it-works)
