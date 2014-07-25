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

### Description of Files

Here is a description of the various files that are in the generator repo, and what their purpose is:

```
Gruntfile.js 
 - The main gruntfile, should never change, imports the generator specific gruntfile. Is blank to allow for easy customization by users

tasks/generatorTasks.js 
 - Where all the of the webhook generator specific tasks are defined.

options/generatorOptions.js 
 - Where all the options for the generator specific tasks are defined.

pages, static, templates folders 
 - Contains some default pages that are used to bootstrap the clients website when first created. Generally should not need changing.

libs folder 
 - The folder that contains all the executing code for the generator, can not be edited by local clients.

libs/generator.js 
 - The main meat of the generator, handles all tasks defined in generatorTasks.js. This handles the static generation, the web socket server, and the live reload server.

libs/swig_filters.js 
 - Defines all additional swig filters that are available in the swig templates.

libs/swig_functions.js 
 - Defines all additional swig functions that are available in the swig templates.

libs/swig_tags.js 
 - Not used, please do not modify.

libs/utils.js 
 - Contains generic utility functions shared between files.

libs/scaffolding_*.html 
 - The templates used to generate scaffolding for new types.

libs/debug404.html 
 - The 404 page shown on the local development server.

libs/widgets/*.html 
 - The template used to generate scaffolding for a specific widget. If the file <widgetname>.html is defined, then its contents are used when generating scaffolding, otherwise scaffolding defaults to {{ item.propertyname }}.
```

### Submitting Pull Requests

Please do the following when submitting a pull request:

1. Please create a corresponding issue for the pull request.
2. Please name the issue as eitehr a feature addition or a bug fix.
3. Please reference an issues in your pull requests.
