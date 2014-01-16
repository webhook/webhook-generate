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
        path: 'http://localhost:2002'
      }
    },

    connect: {
      server: {
        options: {
          port: 2002,
          base: '.build',
          livereload: 35729
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
        tasks: ["watch", "watchFirebase"]
      }
    }

  });

  var generator = require('./libs/generator').generator(grunt.config, grunt.log);

  grunt.registerTask('buildTemplates', 'Generate static files from templates directory', function() {
    var done = this.async();
    generator.renderTemplates(done, generator.reloadFiles);
  });

  grunt.registerTask('buildPages', 'Generate static files from pages directory', function() {
    var done = this.async();
    generator.renderPages(done, generator.reloadFiles);
  });

  grunt.registerTask('scaffolding', 'Generate scaffolding for a new object', function(name) {
    generator.makeScaffolding(name);
  });

  grunt.registerTask('watch', 'Watch for changes in templates and regenerate site', function() {
    generator.startLiveReload();
    grunt.task.run('simple-watch');
  })

  grunt.registerTask('watchFirebase', 'Watch for changes in firebase and regenerate site', function() {
    var done = this.async();
    generator.watchFirebase();
  });

  grunt.registerTask('clean', 'Clean build files', function() {
    var done = this.async();
    generator.cleanFiles(done);
  });

  // Build Task.
  grunt.registerTask('build', 'Clean files and then generate static site into build', function() {
    var done = this.async();
    generator.buildBoth(done, generator.reloadFiles);
  });

  // Change this to optionally prompt instead of requiring a sitename
  grunt.registerTask('init', 'Initialize the firebase configuration file (installer should do this as well)', function(sitename) {
    var done = this.async();

    if(!sitename)
    {
      throw new Error('Must define a Site Name');
    }

    generator.init(sitename, done);
  });

  // Check if initialized properly before running all these tasks
  grunt.registerTask('default',  'Clean, Build, Start Local Server, and Watch', function() {

    if(conf === {})
    {
      grunt.task.run('init:site');
    }

    grunt.task.run('build');
    grunt.task.run('connect');
    grunt.task.run('open');
    grunt.task.run('concurrent');
  });

  grunt.loadNpmTasks('grunt-simple-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-concurrent');
};