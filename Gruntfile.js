module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
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
      files: ['pages/**/*.html', 'templates/**/*.html'],
      tasks: ['build'],
      options: {
        livereload: true,
      }
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

  var Firebase = require('firebase');
  var mkdirp = require('mkdirp');
  var path = require('path');
  var swig  = require('swig');
  var fs = require('fs');
  var dir = require('node-dir');

  var root = new Firebase('https://' + grunt.config.get('firebase') +  '.firebaseio.com/');

  var getData = function(callback) {
    root.child("gamesFinder").once('value', function(data) {
      callback(data);
    });
  }


  var renderPages = function (done)  {
    grunt.log.write('Rendering Pages\n');
    getData(function(data) {

      dir.files('pages', function(err, files) {

        // TODO FILTER ONLY HTML FILES
        files.forEach(function(file) {
          var output = swig.renderFile(file, {
            data: data.val()
          });

          var newFile = file.replace('pages', './build/');

          mkdirp.sync(path.dirname(newFile));

          fs.writeFile(newFile, output)
          
        });

        if(done) done(true);
      });
    });
  };

  var renderTemplates = function(done) {
    grunt.log.write('Rendering Templates\n');
    getData(function(data) {

      dir.files('templates', function(err, files) {

        // TODO FILTER ONLY HTML FILES
        files.forEach(function(file) {
          var output = swig.renderFile(file, {
            data: data.val()
          });

          // Special Handling goes here
          var newFile = file.replace('templates', './build/');

          mkdirp.sync(path.dirname(newFile));

          fs.writeFile(newFile, output)
          
        });

        if(done) done(true);
      });
    });
  }

  var cleanFiles = function(callback) {
      dir.paths('build', function(err, paths) {
        grunt.log.write('Cleaning Files \n');

        paths.files.forEach(function(file) {
          fs.unlinkSync(file)
        });
        paths.dirs.forEach(function(file) {
          fs.rmdir(file)
        });

        callback();
      });
  };

  var buildBoth = function(done) {
    // clean files
    cleanFiles(function() {
      renderTemplates();
      renderPages();
    });

  };

  var makeScaffolding = function(name) {
    var directory = 'templates/' + name + '/';
    mkdirp.sync(directory);

    // TODO make sure name is not plural
    var individual = directory + name + '.html';

    // TODO use a real pluralize, not just tak s on
    var list = directory + name + 's.html';

    fs.writeFile(individual, '');
    fs.writeFile(list, '');
  };


  grunt.registerTask('buildTemplates', function() {
    var done = this.async();
    renderTemplates(done);
  });

  grunt.registerTask('buildPages', function() {
    var done = this.async();
    renderPages(done);
  });

  grunt.registerTask('scaffolding', function(name) {
    makeScaffolding(name);
  });

  grunt.registerTask('watchFirebase', function(name) {
    var done = this.async();

    var initial = true;
    root.child("gamesFinder").on('value', function(data) {

      if(!initial)
      {
        buildBoth();
        grunt.log.write('\n');
      } else {
        grunt.log.write('Watching \n');
      }

      initial = false;
    });

  });


  // Build Task.
  grunt.registerTask('build', ['clean', 'buildTemplates', 'buildPages']);

  grunt.registerTask('default', ['build', 'connect', 'open', 'concurrent'])

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-concurrent');
};