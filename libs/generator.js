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
var ws = require('ws').Server;
var Zip   = require('adm-zip');
var slug = require('uslug');
var async = require('async');
var spawn = require('win-spawn');

// Template requires
// TODO: Abstract these later to make it simpler to change
var swig = require('swig');
swig.setDefaults({ loader: swig.loaders.fs(__dirname + '/..') });

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
module.exports.generator = function (config, logger, fileParser) {

  var self = this;
  var firebaseUrl = config.get('webhook').firebase || '';
  var liveReloadPort = config.get('connect')['wh-server'].options.livereload;
  var websocket = null;
  var strictMode = false;
  
  this.versionString = null;
  this.cachedData = null;

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
    return self.root.child('buckets/' + config.get('webhook').siteName + '/' + config.get('webhook').secretKey + '/dev');
  };

  var getDnsChild = function() {
    return self.root.child('management/sites/' + config.get('webhook').siteName + '/dns');
  };

  /**
   * Retrieves snapshot of data from Firebase
   * @param  {Function}   callback   Callback function to run after data is retrieved, is sent the snapshot
   */
  var getData = function(callback) {

    if(self.cachedData)
    {
      swigFunctions.setData(self.cachedData.data);
      swigFunctions.setTypeInfo(self.cachedData.typeInfo);
      swigFunctions.setSettings(self.cachedData.settings);
      swigFilters.setSiteDns(self.cachedData.siteDns);

      callback(self.cachedData.data, self.cachedData.typeInfo);
      return;
    }

    if(!self.root)
    {
      throw new Error('Missing firebase reference, may need to run init');
    }

    getBucket().once('value', function(data) {
      data = data.val();
      var typeInfo = {};
      var settings = {};

      if(!data || !data['contentType'])
      {
        typeInfo = {};
      } else {
        typeInfo = data['contentType'];
      }

      if(!data || !data.settings) {
        settings = {};
      } else {
        settings = data.settings;
      }

      // Get the data portion of bucket, other things are not needed for templates
      if(!data || !data.data) {
        data = {};
      } else {
        data = data.data;
      }

      self.cachedData = {
        data: data,
        typeInfo: typeInfo,
        settings: settings
      };

      // Sets the context for swig functions
      swigFunctions.setData(data);
      swigFunctions.setTypeInfo(typeInfo);
      swigFunctions.setSettings(settings);

      getDnsChild().once('value', function(snap) {
        var siteDns = snap.val() || config.get('webhook').siteName + '.webhook.org';
        self.cachedData.siteDns = siteDns;
        swigFilters.setSiteDns(siteDns);

        callback(data, typeInfo);
      });
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
    var originalOutFile = outFile;

    // Merge functions in
    params = utils.extend(params, swigFunctions.getFunctions());

    swigFunctions.init();

    var outputUrl = outFile.replace('index.html', '').replace('./.build', '');
    swigFunctions.setParams({ CURRENT_URL: outputUrl });

    try { 
      var output = swig.renderFile(inFile, params);
    } catch (e) {
      self.sendSockMessage(e.toString());

      if(strictMode) {
        throw e;
      } else {
        console.log('Build Failed'.red);
        console.log(e.toString().red);
      }
      
      return '';
    }

    mkdirp.sync(path.dirname(outFile));
    fs.writeFileSync(outFile, output);

    swigFunctions.increasePage();
    while(swigFunctions.shouldPaginate())
    {
      outFile = originalOutFile.replace('/index.html', '/' + swigFunctions.pageUrl + swigFunctions.curPage + '/index.html');
      outputUrl = outFile.replace('index.html', '').replace('./.build', '');

      swigFunctions.setParams({ CURRENT_URL: outputUrl });

      try { 
        var output = swig.renderFile(inFile, params);
      } catch (e) {
        self.sendSockMessage(e.toString());

        if(strictMode) {
          throw e;
        } else {
          console.log('Build Failed'.red);
          console.log(e.toString().red);
        }

        return '';
      }

      mkdirp.sync(path.dirname(outFile));
      fs.writeFileSync(outFile, output);
      
      swigFunctions.increasePage();
    }

    return outFile.replace('./.build', '');
  };


  var downloadRepo = function(zipUrl, callback) {
    logger.ok('Downloading preset...');

    // Keep track if the request fails to prevent the continuation of the install
    var requestFailed = false;

    // TODO: have this hit different templating repos
    var repoRequest = request(zipUrl);

    repoRequest
    .on('response', function (response) {
      // If we fail, set it as failing and remove zip file
      if (response.statusCode !== 200) {
        requestFailed = true;
        fs.unlinkSync('.preset.zip');
        callback(true);
      }
    })
    .pipe(fs.createWriteStream('.preset.zip'))
    .on('close', function () {
      if (requestFailed) return;

      // Unzip into temporary file
      var zip = new Zip('.preset.zip');

      var entries = zip.getEntries();

      entries.forEach(function(entry) {
        var newName = entry.entryName.split('/').slice(1).join('/');
        entry.entryName = newName;
      });
      zip.extractAllTo('.', true);
      fs.unlinkSync('.preset.zip');
      callback();
    });
  };

  var downloadPreset = function(zipUrl, callback) {
    downloadRepo(zipUrl, function() {
      if(fs.existsSync('.preset-data.json')) {
        var presetData = fileParser.readJSON('.preset-data.json');

        fs.unlinkSync('.preset-data.json');
        logger.ok('Done downloading.');
        callback(presetData);

      } else {
        logger.ok('Done downloading.');
        callback(null);
      }
    });
  };

  /**
   * Renders all templates in the /pages directory to the build directory
   * @param  {Function}   done     Callback passed either a true value to indicate its done, or an error
   * @param  {Function}   cb       Callback called after finished, passed list of files changed and done function
   */
  this.renderPages = function (done, cb)  {
    logger.ok('Rendering Pages\n');

    getData(function(data) {

      glob('pages/**/*.{html,xml,rss,xhtml,atom}', function(err, files) {
        files.forEach(function(file) {

          var newFile = file.replace('pages', './.build');

          var dir = path.dirname(newFile);
          var filename = path.basename(newFile, path.extname(file));

          if(path.extname(file) === '.html' && filename !== 'index' && path.basename(newFile) !== '404.html') {
            dir = dir + '/' + filename;
            filename = 'index';
          }

          newFile = dir + '/' + filename + path.extname(file);

          var destFile = writeTemplate(file, newFile);
        });

        if(fs.existsSync('pages/robots.txt'))
        {
          fs.writeFileSync('./.build/robots.txt', fs.readFileSync('pages/robots.txt'));
        }

        logger.ok('Finished Rendering Pages\n');

        if(cb) cb(done);
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

        files.forEach(function(file) {
          // We ignore partials, special directory to allow making of partial includes
          if(path.extname(file) === '.html' && file.indexOf('templates/partials') !== 0)
          {
            // Here we try and abstract out the content type name from directory structure
            var baseName = path.basename(file, '.html');
            var newPath = path.dirname(file).replace('templates', './.build');
            var pathParts = path.dirname(file).split('/');
            var objectName = pathParts[pathParts.length - 1];
            var items = data[objectName];
            var info = typeInfo[objectName];

            if(!items) {
              logger.error('Missing data for content type ' + objectName);
            }

            // TODO, DETECT IF FILE ALREADY EXISTS, IF IT DOES APPEND A NUMBER TO IT DUMMY
            if(baseName === 'list')
            {

              newPath = newPath + '/index.html';
              writeTemplate(file, newPath);

            } else if (baseName === 'individual') {
              // Output should be path + id + '/index.html'
              // Should pass in object as 'item'
              var baseNewPath = newPath;

              items = _.map(items, function(value, key) { value._id = key; value._type = objectName; return value });
              var publishedItems = _.filter(items, function(item) { 
                if(!item.publish_date) {
                  return false;
                }

                var now = Date.now();
                var pdate = Date.parse(item.publish_date);

                if(pdate > now + (1 * 60 * 1000)) {
                  return false;
                }

                return true;
              });


              for(var key in publishedItems)
              {
                var val = publishedItems[key];

                newPath = baseNewPath + '/' + slug(val.name).toLowerCase() + '/index.html';
                writeTemplate(file, newPath, { item: val });
              }

              var previewPath = baseNewPath.replace('./.build', './.build/_wh_previews');
              for(var key in items)
              {
                var val = items[key];

                newPath = previewPath + '/' + val.preview_url + '/index.html';
                writeTemplate(file, newPath, { item: val });
              }
            }
          }
        });

        logger.ok('Finished Rendering Templates');

        if(cb) cb(done);

      });
    });
  };

  this.copyStatic = function(callback) {
    logger.ok('Copying static');
    if(fs.existsSync('static')) {
      mkdirp.sync('.build/static');
      wrench.copyDirSyncRecursive('static', '.build/static', { forceDelete: true });
    }
    callback();
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

  this.setBuildVersion = function(versionString) {
    self.versionString = versionString;
  };

  /**
   * Builds templates from both /pages and /templates to the build directory
   * @param  {Function}   done     Callback passed either a true value to indicate its done, or an error
   * @param  {Function}   cb       Callback called after finished, passed list of files changed and done function
   */
  this.buildBoth = function(done, cb) {
    // clean files
    self.cachedData = null;
    self.cleanFiles(null, function() {
      self.renderTemplates(null, function() {
        self.copyStatic(function() {
          self.renderPages(done, cb);
        });
      });
    });

  };

  /**
   * Generates scaffolding for content type with name
   * @param  {String}   name     Name of content type to generate scaffolding for
   */
  this.makeScaffolding = function(name, done, force) {
    logger.ok('Creating Scaffolding\n');
    var directory = 'templates/' + name + '/';

    if(!force && fs.existsSync(directory)) {
      if(done) done();
      return false;
    }

    mkdirp.sync(directory);

    var list = directory + 'list.html';
    var individual = directory +  'individual.html';

    var individualTemplate = fs.readFileSync('./libs/scaffolding_individual.html');
    var listTemplate = fs.readFileSync('./libs/scaffolding_list.html');

    var widgetFilesRaw = [];

    if(fs.existsSync('./libs/widgets')) {
      widgetFilesRaw = wrench.readdirSyncRecursive('./libs/widgets');
    }

    var widgetFiles = [];

    widgetFilesRaw.forEach(function(item) {
      widgetFiles[(path.dirname(item) + '/' + path.basename(item, '.html')).replace('./', '')] = true;
    });

    var renderWidget = function(controlType, fieldName, controlInfo) {
      var widgetString = _.template(fs.readFileSync('./libs/widgets/' + controlType + '.html'), { value: 'item.' + fieldName, controlInfo: controlInfo });

      var lines = widgetString.split('\n');
      var newLines = [];
      var first = true;

      lines.forEach(function(line) {
        if(first) {
          first = false;
          newLines.push(line);
        } else {
          var newLine = '        ' + line;
          newLines.push(newLine);
        }
      });

      return newLines.join('\n');
    };

    self.cachedData = null;
    getData(function(data, typeInfo) {
      var controls = typeInfo[name] ? typeInfo[name].controls : [];
      var controlsObj = {};

      _.each(controls, function(item) {
        controlsObj[item.name] = item;
      });

      var template = _.template(individualTemplate, { widgetFiles: widgetFiles, typeName: name, typeInfo: typeInfo[name] || {}, controls: controlsObj }, { 'imports': { 'renderWidget' : renderWidget}});
      template = template.replace(/^\s*\n/gm, '');
      fs.writeFileSync(individual, template);
      fs.writeFileSync(list, _.template(listTemplate, { typeName: name }));

      if(done) done();
    });

    return true;
  };

  /**
   * Send signal to local livereload server to reload files
   * @param  {Array}      files     List of files to reload
   * @param  {Function}   done      Callback passed either a true value to indicate its done, or an error 
   */
  this.reloadFiles = function(done) {
    request({ url : 'http://localhost:' + liveReloadPort + '/changed?files=true', timeout: 10  }, function(error, response, body) {
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

  this.sendSockMessage = function(message) {
    if(websocket) {
      websocket.send('message:' + JSON.stringify(message));
    }
  };

  this.webListener = function() {
    var server = new ws({ host: '0.0.0.0', port: 6557 });

    server.on('connection', function(sock) {
      websocket = sock;

      var buildQueue = async.queue(function (task, callback) {
          self.buildBoth(function() {
            sock.send('done');
            callback();
          }, self.reloadFiles);
      }, 1);

      sock.on('message', function(message) {
        if(message.indexOf('scaffolding:') === 0)
        {
          var name = message.replace('scaffolding:', '');
          self.makeScaffolding(name, function() { 
            sock.send('done');
          });
        } else if (message.indexOf('scaffolding_force:') === 0) {
          var name = message.replace('scaffolding_force:', '');
          self.makeScaffolding(name, function() { 
            sock.send('done');
          }, true);
        } else if (message === 'build') {
          buildQueue.push({}, function(err) {});
        } else if (message.indexOf('preset:') === 0) {
          var url = message.replace('preset:', '');
          if(!url) {
            sock.send('done');
            return;
          }
          downloadPreset(url, function(data) {

            var command = spawn('npm', ['install'], {
              stdio: 'inherit',
              cwd: '.'
            });

            command.on('close', function() {
              sock.send('done:' + JSON.stringify(data));
            });
          });
        }
      });
    });
  };

  /** 
   * Inintializes firebase configuration for a new site
   * @param  {String}    sitename  Name of site to generate config for
   * @param  {Function}  done      Callback to call when operation is done
   */
  this.init = function(sitename, secretkey, copyCms, done) {
    var confFile = fs.readFileSync('./libs/.firebase.conf.jst');
    
    // TODO: Grab bucket information from server eventually, for now just use the site name
    var templated = _.template(confFile, { secretKey: secretkey, siteName: sitename });

    fs.writeFileSync('./.firebase.conf', templated);

    if(copyCms) {
      var cmsFile = fs.readFileSync('./libs/cms.html');

      var cmsTemplated = _.template(cmsFile, { siteName: sitename });

      fs.writeFileSync('./pages/cms.html', cmsTemplated); 
    }

    done(true);
  };

  this.assets = function(grunt) {

    if(fs.existsSync('.whdist')) {
      wrench.rmdirSyncRecursive('.whdist');
    }

    mkdirp.sync('.whdist');

    var files = wrench.readdirSyncRecursive('pages');

    files.forEach(function(file) {
      var originalFile = 'pages/' + file;
      var destFile = '.whdist/pages/' + file;

      if(!fs.lstatSync(originalFile).isDirectory())
      {
        var content = fs.readFileSync(originalFile);

        if(path.extname(originalFile) === '.html') {
          content = content.toString();
          content = content.replace('\r\n', '\n').replace('\r', '\n');
        }

        mkdirp.sync(path.dirname(destFile));
        fs.writeFileSync(destFile, content);
      }
    });

    files = wrench.readdirSyncRecursive('templates');

    files.forEach(function(file) {
      var originalFile = 'templates/' + file;
      var destFile = '.whdist/templates/' + file;

      if(!fs.lstatSync(originalFile).isDirectory())
      {
        var content = fs.readFileSync(originalFile);

        if(path.extname(originalFile) === '.html') {
          content = content.toString();
          content = content.replace('\r\n', '\n').replace('\r', '\n');
        }

        mkdirp.sync(path.dirname(destFile));
        fs.writeFileSync(destFile, content);
      }
    });

    files = wrench.readdirSyncRecursive('static');
    
    files.forEach(function(file) {
      var originalFile = 'static/' + file;
      var destFile = '.whdist/static/' + file;

      if(!fs.lstatSync(originalFile).isDirectory())
      {
        var content = fs.readFileSync(originalFile);

        if(path.extname(originalFile) === '.html') {
          content = content.toString();
          content = content.replace('\r\n', '\n').replace('\r', '\n');
        }

        mkdirp.sync(path.dirname(destFile));
        fs.writeFileSync(destFile, content);
      }
    });

    grunt.task.run('useminPrepare');
    grunt.task.run('assetsMiddle');

  }

  this.assetsMiddle = function(grunt) {

    grunt.option('force', true);

    if(!_.isEmpty(grunt.config.get('concat')))
    {
      grunt.task.run('concat');
    }

    if(!_.isEmpty(grunt.config.get('uglify')))
    {
      grunt.task.run('uglify');
    }

    if(!_.isEmpty(grunt.config.get('cssmin')))
    {
      grunt.task.run('cssmin');
    }
    
    grunt.task.run('rev');
    grunt.task.run('usemin');
    grunt.task.run('assetsAfter');

  }

  this.assetsAfter = function(grunt) {
    if(fs.existsSync('.tmp')) {
      wrench.rmdirSyncRecursive('.tmp');
    }

    var files = wrench.readdirSyncRecursive('static');

    files.forEach(function(file) {
      var filePath = 'static/' + file;
      var distPath = '.whdist/static/' + file;
      if(!fs.lstatSync(filePath).isDirectory() && !fs.existsSync(distPath)) {
        var fileData = fs.readFileSync(filePath);
        fs.writeFileSync(distPath, fileData);
      }
    });
  }

  this.enableStrictMode = function() {
    strictMode = true;
  }


  return this;
};