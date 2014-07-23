# Contributing to the Webhook Generator

We always welcome pull requests to the webhook generator, as fixes and extensions to webhook are always welcome. However, since this generator is used by many of our customers we will apply strict scrutiny to any and all pull requests.

## Getting Started

To start contributing you will need to set up your environment. The easiest way to run the generator locally is to run the command `wh init <sitename>` in the webhook-generator directory, where sitename is some site you run or have access to. From there you can then use the normal `wh serve` command to serve the site with your local version of generator.

The only caveat running is that running `wh init` will generate a `cms.html` file in the pages directory, we strongly recommend not commitin this file to any of your changes, and any pull requests with cms.html will be ignored (or if its easy, will be accepted without the cms.html). For various reasons we can not add this file to the .gitignore list, so please do not try and add it there.

## Example Getting Started Commands

```
cd webhook-generate
wh init my-personal-site
[?] Enter your Webhook email: ltsquigs@gmail.com
[?] Enter your Webhook password: *********************
----- Initialization -----

wh serve

```

## Submitting Pull Requests

When submitting a pull request, please create a corresponding issue for the pull requests.

If the pull requests is to fix a bug, please indicate that in the issue name, if it is to add a new feature please indicate that as well.

Finally, mention the issue in the text of the pull request.

## Documentation

Please document any code inline as you think makes sense (try and match the already existing documentation).

When contributing a feature such as a new swig function or filter, please provide some documentation/description for the new function or filter in the pull request.