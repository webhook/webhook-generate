### What the generator does

The Webhook generator does not contain the code for the CMS.

The Webhook generator repo contains the blank, default files that get installed with any Webhook site. It is essentially a small grunt project that talks to firebase and builds the site based upon changes to the data there and to the template layer.

Generator also stores all the additional functions and filters we've added to the Swig JS templating system.

### Contributing to this repo

We welcome contributions to this repo, but please be cognisant that this code runs on thousands of websites. Therefor we're pretty strict about what we accept.

Please consider the following before submitting your pull request:

1. Is the code backwards compatible with previous versions of the generator?
2. Is the code documented, properly explained and follow the naming patterns of the current code?
3. Does it add generic abilities that are useful to most projects, not just your own?
4. You are contributing your code under the MIT license this code is provided with.

### Setting up a dev environment

Goes without saying you'll need to have Node, Grunt and Webhook installed to work on this repo.

1. Clone this repo somewhere locally.
2. `cd webhook-generate`
3. Run `wh init your_site_name`. You'll need to use an existing Webhook site you have control over.
4. View your site at http://localhost:2002 as normal.

Running `wh init` will create a pages and templates folder. You do not want to commit any of these files. Most importantly don't commit the `cms.html` file we generate. They are added simply so you can run things locally.


### Submitting Pull Requests

Please do the following when submitting a pull request:

1. Please create a corresponding issue for the pull request.
2. Please name the issue as eitehr a feature addition or a bug fix.
3. Please reference an issues in your pull requests.
