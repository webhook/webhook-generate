'use strict';

// Requires
var firebase = require('firebase');
var request = require('request');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var glob = require('glob');
var tinylr = require('tiny-lr');
var _ = require('lodash');
var wrench = require('wrench');
var utils = require('./utils.js');

// Template requires
// TODO: Abstract these later to make it simpler to change
var swig = require('swig');
var swigFunctions = require('./swig_functions').swigFunctions();
var swigFilters = require('./swig_filters');
var swigTags = require('./swig_tags');
swigFilters.init(swig);
swigTags.init(swig);
swig.setDefaults({ cache: false });

// Disable console log in various things
//console.log = function () {};

/**
 * Generator that handles various commands
 * @param  {Object}   config     Configuration options from .firebase.conf
 * @param  {Object}   logger     Object to use for logging, defaults to no-ops
 */
module.exports.generator = function (config, logger) {

  var self = this;
  var firebaseUrl = config.get('webhook').firebase || '';
  var liveReloadPort = config.get('connect').server.options.livereload;

  if(liveReloadPort === true)
  {
    liveReloadPort = 35729;
  }

  logger = logger || { ok: function() {}, error: function() {}, write: function() {}, writeln: function() {} };

  // We dont error out here so init can still be run
  if (firebaseUrl)
  {
    this.root = new firebase('https://' + firebaseUrl +  '.firebaseio.com/');
  } else {
    this.root = null;
  }

  /**
   * Used to get the bucket were using (combinaton of config and environment)
   */
  var getBucket = function() {
    return self.root.child(config.get('webhook').bucket).child('dev');
  };

  /**
   * Retrieves snapshot of data from Firebase
   * @param  {Function}   callback   Callback function to run after data is retrieved, is sent the snapshot
   */
  var getData = function(callback) {
    if(!self.root)
    {
      throw new Error('Missing firebase reference, may need to run init');
    }

    getBucket().once('value', function(data) {
      data = data.val();
      var typeInfo = {};

      if(!data.content_types)
      {
        typeInfo = {};
      } else {
        typeInfo = data.content_types;
      }

      // Get the data portion of bucket, other things are not needed for templates
      if(!data.data) {
        data = {};
      } else {
        data = data.data;
      }

      // Sets the context for swig functions
      swigFunctions.setData(data);
      callback(data, typeInfo);
    }, function(error) {
      throw new Error(error);
    });
  };

  /**
   * Writes an instance of a template to the build directory
   * @param  {string}   inFile     Template to read
   * @param  {string}   outFile    Destination in build directory
   * @param  {Object}   params     The parameters to pass to the template
   */
  var writeTemplate = function(inFile, outFile, params) {
    params = params || {};

    // Merge functions in
    params = utils.extend(params, swigFunctions.getFunctions());
    var output = swig.renderFile(inFile, params);

    mkdirp.sync(path.dirname(outFile));
    fs.writeFileSync(outFile, output);

    return outFile.replace('./.build', '');
  };

  /**
   * Renders all templates in the /pages directory to the build directory
   * @param  {Function}   done     Callback passed either a true value to indicate its done, or an error
   * @param  {Function}   cb       Callback called after finished, passed list of files changed and done function
   */
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

  /**
   * Renders all templates in the /templates directory to the build directory
   * @param  {Function}   done     Callback passed either a true value to indicate its done, or an error
   * @param  {Function}   cb       Callback called after finished, passed list of files changed and done function
   */
  this.renderTemplates = function(done, cb) {
    logger.ok('Rendering Templates');

    getData(function(data, typeInfo) {

      glob('templates/**/*.html', function(err, files) {

        var fixedFiles = [];
        files.forEach(function(file) {
          // We ignore partials, special directory to allow making of partial includes
          if(path.extname(file) === '.html' && file.indexOf('templates/partials') !== 0)
          {
            // Here we try and abstract out the content type name from directory structure
            var baseName = path.basename(file, '.html');
            var newPath = path.dirname(file).replace('templates', './.build');
            var pathParts = path.dirname(file).split(path.sep);
            var objectName = pathParts[pathParts.length - 1];
            var items = data[objectName];
            var info = typeInfo[objectName];

            var perPage = 1; // Read from info later

            if(!items) {
              logger.error('Missing content type for ' + objectName);
            }

            if(baseName === 'list')
            {
              // Output should be path + '/index.html'
              // Should pass in object as 'items'
              var remaining = items;

              if(remaining._type)
              {
                delete remaining['_type'];
              }

              var baseNewPath = newPath;
              var page = 0;

              while(_(remaining).size() !== 0)
              {
                var sliceOfItems = utils.sliceDictionary(remaining, perPage);
                remaining = utils.sliceDictionary(remaining, null, perPage);

                if(page === 0)
                {
                  newPath = baseNewPath + '/index.html';
                } else {
                  newPath = baseNewPath + '/page-' + page + '/index.html';
                }

                fixedFiles.push(writeTemplate(file, newPath, { items: sliceOfItems }));

                page = page + 1;
              }

            } else if (baseName === 'individual') {
              // Output should be path + id + '/index.html'
              // Should pass in object as 'item'
              var baseNewPath = newPath;
              for(var key in items)
              {
                if(key.indexOf('_') === 0)
                {
                  continue;
                }
                var val = items[key];

                newPath = baseNewPath + '/' + key + '/index.html';
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

  /**
   * Cleans the build directory
   * @param  {Function}   done     Callback passed either a true value to indicate its done, or an error
   * @param  {Function}   cb       Callback called after finished, passed list of files changed and done function
   */
  this.cleanFiles = function(done, cb) {
      logger.ok('Cleaning files');

      if(fs.existsSync('.build'))
      {
        wrench.rmdirSyncRecursive('.build');
      }

      if (cb) cb();
      if (done) done(true);
  };

  /**
   * Builds templates from both /pages and /templates to the build directory
   * @param  {Function}   done     Callback passed either a true value to indicate its done, or an error
   * @param  {Function}   cb       Callback called after finished, passed list of files changed and done function
   */
  this.buildBoth = function(done, cb) {
    // clean files
    self.cleanFiles(null, function() {
      self.renderTemplates(null, function() {
        self.renderPages(done, cb);
      });
    });

  };

  /**
   * Generates scaffolding for content type with name
   * @param  {String}   name     Name of content type to generate scaffolding for
   */
  this.makeScaffolding = function(name) {
    logger.ok('Creating Scaffolding\n');
    var directory = 'templates/' + name + '/';
    mkdirp.sync(directory);

    var list = directory + 'list.html';
    var individual = directory +  'individual.html';

    var individualTemplate = fs.readFileSync('./libs/scaffolding_individual.html');
    var listTemplate = fs.readFileSync('./libs/scaffolding_list.html');

    fs.writeFileSync(individual, individualTemplate);
    fs.writeFileSync(list, listTemplate);
  };

  /**
   * Send signal to local livereload server to reload files
   * @param  {Array}      files     List of files to reload
   * @param  {Function}   done      Callback passed either a true value to indicate its done, or an error 
   */
  this.reloadFiles = function(files, done) {
    request({ url : 'http://localhost:' + liveReloadPort + '/changed?files=' + files.join(','), timeout: 10  }, function(error, response, body) {
      if(done) done(true);
    });
  };

  /**
   * Runs forever, rebuilding the whole project when data is changed in firebase
   */
  this.watchFirebase = function() {

    if(!self.root)
    {
      throw new Error('Missing firebase reference, may need to run init');
    }

    var initial = true;
    getBucket().on('value', function(data) {

      // We ignore the initial run (in the default path its already built)
      if(!initial)
      {
        self.buildBoth(null, self.reloadFiles);
      } else {
        logger.ok('Watching');
      }

      initial = false;

    }, function(error) {
      throw new Error(error);
    });
  };

  /**
   * Starts a live reload server to detect changes
   */
  this.startLiveReload = function() {
    tinylr().listen(liveReloadPort);
  };

  /** 
   * Inintializes firebase configuration for a new site
   * @param  {String}    sitename  Name of site to generate config for
   * @param  {Function}  done      Callback to call when operation is done
   */
  this.init = function(sitename, done) {
    var confFile = fs.readFileSync('./libs/.firebase.conf.jst');
    
    // TODO: Grab bucket information from server eventually, for now just use the site name
    var templated = _.template(confFile, { bucket: sitename });

    fs.writeFileSync('./.firebase.conf', templated);

    done(true);
  };

  return this;
};