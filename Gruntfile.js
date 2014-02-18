var fs = require('fs');

'use strict';
module.exports = function(grunt) {

  var conf = {};

  try {
    conf = grunt.file.readJSON('./.firebase.conf');
  } catch (err) {
    conf = {};
  }

  // Project configuration.
  grunt.initConfig({
    webhook: conf,

    open : {
      dev: {
        path: 'http://localhost:2002/cms/'
      }
    },

    connect: {
      server: {
        options: {
          port: 2002,
          base: '.build',
          livereload: 35730,
          middleware: function(connect, options) {
            // Return array of whatever middlewares you want
            return [
              connect.static(options.base),
              function(req, res, next) {
                if ('GET' != req.method && 'HEAD' != req.method) return next();

                var contents = fs.readFileSync('./libs/debug404.html');
                res.end(contents);
              }
            ];
          }
        }
      }
    },

    watch: {
      options : {
        files: ['pages/**/*.html', 'templates/**/*.html'],
        tasks: ['build'],
        dateFormat: function(time) {
          grunt.log.write('here');
        }
      },
    },

    concurrent: {
      options: {
        logConcurrentOutput: true
      },
      watch: {
        tasks: ["watch", "webListener-open"]
      }
    }

  });

  var generator = require('./libs/generator').generator(grunt.config, grunt.log, grunt.file);

  grunt.registerTask('buildTemplates', 'Generate static files from templates directory', function() {
    var done = this.async();
    generator.renderTemplates(done, generator.reloadFiles);
  });

  grunt.registerTask('buildPages', 'Generate static files from pages directory', function() {
    var done = this.async();
    generator.renderPages(done, generator.reloadFiles);
  });

  grunt.registerTask('scaffolding', 'Generate scaffolding for a new object', function(name) {
    var done = this.async();

    var force = grunt.option('force');


    var result = generator.makeScaffolding(name, done, force);

    if(!result) {
      grunt.log.error('Scaffolding for ' + name + ' already exists, use --force to overwrite');
    }
  });

  grunt.registerTask('watch', 'Watch for changes in templates and regenerate site', function() {
    generator.startLiveReload();
    grunt.task.run('simple-watch');
  });

  grunt.registerTask('webListener', 'Listens for commands from CMS through websocket', function() {
    var done = this.async();
    generator.webListener(done);
  });

  grunt.registerTask('webListener-open', 'Listens for commands from CMS through websocket', function() {
    var done = this.async();
    generator.webListener(done);

    grunt.util.spawn({
      grunt: true,
      args: ['open'].concat(grunt.option.flags()),
      opts: { stdio: 'inherit' }
    }, function (err, result, code) {
      if (err || code > 0) {
        grunt.warn(result.stderr || result.stdout);
      }
      grunt.log.writeln('\n' + result.stdout);
    });
  });

  grunt.registerTask('clean', 'Clean build files', function() {
    var done = this.async();
    generator.cleanFiles(done);
  });

  // Build Task.
  grunt.registerTask('build', 'Clean files and then generate static site into build', function() {
    var done = this.async();

    var versionString = grunt.option('build-version');

    if(versionString)
    {
      generator.setBuildVersion(versionString);
    }

    generator.buildBoth(done, generator.reloadFiles);
  });

  // Change this to optionally prompt instead of requiring a sitename
  grunt.registerTask('init', 'Initialize the firebase configuration file (installer should do this as well)', function() {
    var done = this.async();

    var sitename = grunt.option('sitename');
    var secretkey = grunt.option('secretkey');

    generator.init(sitename, secretkey, done);
  });

  // Check if initialized properly before running all these tasks
  grunt.registerTask('default',  'Clean, Build, Start Local Server, and Watch', function() {

    if(conf === {})
    {
      // Eventually this should prompt instead of hard code site
      grunt.task.run('init');
    }

    grunt.task.run('build');
    grunt.task.run('connect');
   // grunt.task.run('open');
    grunt.task.run('concurrent');
  });

  grunt.loadNpmTasks('grunt-simple-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-concurrent');
};