module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    firebase: 'ltsquigs',

    open : {
      dev: {
        path: 'http://localhost:2002'
      }
    },

    clean: {
      build: ["build"]
    },

    connect: {
      server: {
        options: {
          port: 2002,
          base: 'build',
          livereload: true
        }
      }
    },

    watch: {
      files: ['templates/**/*.html'],
      tasks: ['build'],
      options: {
        livereload: true,
      }
    }
  });

  var Firebase = require('firebase');
  var mkdirp = require('mkdirp');
  var path = require('path');
  var swig  = require('swig');
  var fs = require('fs');
  var dir = require('node-dir');

  var renderTemplates = function (done) {
    grunt.log.write('Connecting to firebase \n');
    var root = new Firebase('https://' + grunt.config.get('firebase') +  '.firebaseio.com/');


    grunt.log.write('Loading Data \n');

    root.child("gamesFinder").on('value', function(data) {

      grunt.log.write('Finding Templates \n');

      dir.files('templates', function(err, files) {

        grunt.log.write('Rendering Templates \n');

        // TODO FILTER ONLY HTML FILES
        files.forEach(function(file) {
          var output = swig.renderFile(file, {
            data: data.val()
          });

          var newFile = file.replace('templates', './build/');

          mkdirp.sync(path.dirname(newFile));

          fs.writeFile(newFile, output)
          
        });

        done(true);
      });
    });
  };

  // Build Task.
  grunt.registerTask('build', function() {
    var done = this.async();
    renderTemplates(done);
  });

  grunt.registerTask('default', ['clean', 'build', 'connect', 'open', 'watch'])

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-open');
};