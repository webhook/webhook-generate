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
      options : {
        livereload: true,
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

  var Firebase = require('firebase');
  var request = require('request');
  var mkdirp = require('mkdirp');
  var path = require('path');
  var swig  = require('swig');

  swig.setDefaults({ cache: false });

  var fs = require('fs');
  var glob = require('glob');
  var tinylr = require('tiny-lr');

  var root = new Firebase('https://' + grunt.config.get('firebase') +  '.firebaseio.com/');

  var getData = function(callback) {
    root.child("gamesFinder").once('value', function(data) {
      callback(data.val());
    }, function(error) {
      grunt.log.error(error);
    });
  }

  var writeTemplate = function(inFile, outFile, params) {
    var output = swig.renderFile(inFile, params);

    mkdirp.sync(path.dirname(outFile));

    fs.writeFileSync(outFile, output);

    return outFile.replace('./build', '');
  }

  var renderPages = function (done, cb)  {
    grunt.log.ok('Rendering Pages\n');
    getData(function(data) {

      glob('pages/**/*.html', function(err, files) {
        var fixedFiles = [];
        files.forEach(function(file) {

          if(path.extname(file) === '.html')
          {
            var newFile = file.replace('pages', './build');
            fixedFiles.push(writeTemplate(file, newFile, { data: data }));
          }
        });

        grunt.log.ok('Finished Rendering Pages\n');

        if(cb) cb(fixedFiles, done);
      });

    });
  };

  var renderTemplates = function(done, cb) {
    grunt.log.ok('Rendering Templates');

    getData(function(data) {

      glob('templates/**/*.html', function(err, files) {

        var fixedFiles = [];
        files.forEach(function(file) {
          if(path.extname(file) === '.html')
          {
            var baseName = path.basename(file, '.html');
            var newPath = path.dirname(file).replace('templates', './build');
            var pathParths = path.dirname(file).split(path.sep);
            var objectName = pathParths[pathParths.length - 1];
            var items = data[objectName];

            if(baseName === 'list')
            {
              // Output should be path + '/index.html'
              // Should pass in object as 'items'
              newPath = newPath + '/index.html';
              fixedFiles.push(writeTemplate(file, newPath, { items: items }));

            } else if (baseName === 'individual') {
              // Output should be path + id + '/index.html'
              // Should pass in object as 'item'

              var baseNewPath = newPath;
              for(var key in items)
              {
                var val = items[key];
                var id = val.id || val.name;

                newPath = baseNewPath + '/' + id + '/index.html';
                fixedFiles.push(writeTemplate(file, newPath, { item: val }));
              }
            }
          }
        });

        grunt.log.ok('Finished Rendering Templates');

        if(cb) cb(fixedFiles, done);

      });
    });
  }

  var cleanFiles = function(callback) {

      glob('build/**', function(err, files) {
        var directories = [];
        var realFiles = [];

        files.forEach(function(file) {
          if(path.extname(file))
          {
            fs.unlinkSync(file);
          } else if (file) {
            directories.push(file);
          }
        });

        directories.sort().reverse().forEach(function(file) {
          fs.rmdirSync(file);
        });

        callback();
      });

  };

  var buildBoth = function(cb, done) {
    // clean files
    cleanFiles(function() {
      renderTemplates(null, function() {
        renderPages(done, cb);
      });
    });

  };

  var makeScaffolding = function(name) {
    grunt.log.ok('Creating Scaffolding\n');
    var directory = 'templates/' + name + '/';
    mkdirp.sync(directory);

    // TODO make sure name is not plural
    var individual = directory + 'list.html';

    // TODO use a real pluralize, not just tak s on
    var list = directory +  'individual.html';

    fs.writeFile(individual, '');
    fs.writeFile(list, '');
  };

  var reloadFiles = function(files, done) {
    request({ url : 'http://localhost:35729/changed?files=' + files.join(','), timeout: 10  }, function(error, response, body) {
      if(done) done(true);
    });
  };

  var watchFirebase = function() {
    var initial = true;
    root.child("gamesFinder").on('value', function(data) {

      if(!initial)
      {
        buildBoth(reloadFiles);
      } else {
        grunt.log.ok('Watching');
      }

      initial = false;
    }, function(error) {
      grunt.log.error(error);
    });
  }

  grunt.registerTask('buildTemplates', function() {
    var done = this.async();
    renderTemplates(done, reloadFiles);
  });

  grunt.registerTask('buildPages', function() {
    var done = this.async();
    renderPages(done, reloadFiles);
  });

  grunt.registerTask('scaffolding', function(name) {
    makeScaffolding(name);
  });

  grunt.registerTask('watch', function() {
    tinylr().listen(35729);
    grunt.task.run('simple-watch');
  })

  grunt.registerTask('watchFirebase', function() {
    var done = this.async();
    watchFirebase();
  });

  // Build Task.
  grunt.registerTask('build', function() {
    var done = this.async();

    buildBoth(reloadFiles, done);
  });

  grunt.registerTask('default', ['build', 'connect', 'open', 'concurrent']);

  grunt.loadNpmTasks('grunt-simple-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-concurrent');
};