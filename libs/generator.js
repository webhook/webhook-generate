// Requires
var firebase = require('firebase');
var request = require('request');
var mkdirp = require('mkdirp');
var path = require('path');
var swig = require('swig');
var fs = require('fs');
var glob = require('glob');
var tinylr = require('tiny-lr');

var swigFunctions = require('./swig_functions').swigFunctions();
var swigFilters = require('./swig_filters');
var swigTags = require('./swig_tags');

// Config requires
swigFilters.init(swig);
swigTags.init(swig);
swig.setDefaults({ cache: false });

// Disable console log in various things
console.log = function () {};

module.exports.generator = function (firebaseUrl, logger) {

  var self = this;
  logger = logger || { ok: function() {}, error: function() {}, write: function() {}, writeln: function() {} };
  firebaseUrl = firebaseUrl || '';

  this.root = new firebase('https://' + firebaseUrl +  '.firebaseio.com/');

  var extend = function(target) {
      var sources = [].slice.call(arguments, 1);
      sources.forEach(function (source) {
          for (var prop in source) {
              target[prop] = source[prop];
          }
      });
      return target;
  };

  var getData = function(callback) {
    self.root.child("gamesFinder").once('value', function(data) {
      var data = data.val();

      swigFunctions.setData(data);
      callback(data);
    }, function(error) {
      logger.error(error);
    });
  };

  var writeTemplate = function(inFile, outFile, params) {
    params = params || {};
    params = extend(params, swigFunctions.getFunctions());
    var output = swig.renderFile(inFile, params);

    mkdirp.sync(path.dirname(outFile));

    fs.writeFileSync(outFile, output);

    return outFile.replace('./.build', '');
  };

  this.renderPages = function (done, cb)  {
    logger.ok('Rendering Pages\n');
    getData(function(data) {

      glob('pages/**/*.html', function(err, files) {
        var fixedFiles = [];
        files.forEach(function(file) {

          if(path.extname(file) === '.html')
          {
            var newFile = file.replace('pages', './.build');
            fixedFiles.push(writeTemplate(file, newFile));
          }

        });

        logger.ok('Finished Rendering Pages\n');

        if(cb) cb(fixedFiles, done);
      });

    });
  };

  this.renderTemplates = function(done, cb) {
    logger.ok('Rendering Templates');

    getData(function(data) {

      glob('templates/**/*.html', function(err, files) {

        var fixedFiles = [];
        files.forEach(function(file) {
          if(path.extname(file) === '.html' && file.indexOf('templates/partials') !== 0)
          {
            var baseName = path.basename(file, '.html');
            var newPath = path.dirname(file).replace('templates', './.build');
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

        logger.ok('Finished Rendering Templates');

        if(cb) cb(fixedFiles, done);

      });
    });
  };

  this.cleanFiles = function(callback, done) {
      logger.ok('Cleaning files');
      glob('.build/**', function(err, files) {
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

        if (callback) callback();
        if (done) done(true);
      });

  };

  this.buildBoth = function(cb, done) {
    // clean files
    self.cleanFiles(function() {
      self.renderTemplates(null, function() {
        self.renderPages(done, cb);
      });
    });

  };

  this.makeScaffolding = function(name) {
    logger.ok('Creating Scaffolding\n');
    var directory = 'templates/' + name + '/';
    mkdirp.sync(directory);

    // TODO make sure name is not plural
    var list = directory + 'list.html';

    // TODO use a real pluralize, not just tak s on
    var individual = directory +  'individual.html';

    var individualTemplate = fs.readFileSync('./libs/scaffolding_individual.html');
    var listTemplate = fs.readFileSync('./libs/scaffolding_list.html');

    fs.writeFileSync(individual, individualTemplate);
    fs.writeFileSync(list, listTemplate);
  };

  this.reloadFiles = function(files, done) {
    request({ url : 'http://localhost:35729/changed?files=' + files.join(','), timeout: 10  }, function(error, response, body) {
      if(done) done(true);
    });
  };

  this.watchFirebase = function() {
    var initial = true;
    self.root.child("gamesFinder").on('value', function(data) {

      if(!initial)
      {
        self.buildBoth(self.reloadFiles);
      } else {
        logger.ok('Watching');
      }

      initial = false;

    }, function(error) {
      logger.error(error);
    });
  };

  this.startLiveReload = function() {
    tinylr().listen(35729);
  }

  return this;
};