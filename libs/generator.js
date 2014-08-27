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
var md5 = require('MD5');

require('colors');

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

var wrap = function()
{
  var args = Array.prototype.slice.call(arguments);

  var last = args.pop();
  last = 'debugger;' +
         'var global = null;' +
         'var console = null;' +
         'var v8debug = null;' +
         'var setTimeout = null;' +
         'var setInterval = null;' +
         'var setImmediate = null;' +
         'var clearTimeout = null;' +
         'var clearInterval = null;' +
         'var clearImmediate = null;' +
         'var root = null;' +
         'var GLOBAL = null;' +
         'var window = null;' +
         'var process = null;' +
         'var eval = null;' +
         last;

  args.push(last);

  return Function.prototype.constructor.apply(this, args);
};
wrap.prototype = Function.prototype;
Function = wrap;

// Disable console log in various things
//console.log = function () {};

/**
 * Generator that handles various commands
 * @param  {Object}   config     Configuration options from .firebase.conf
 * @param  {Object}   logger     Object to use for logging, defaults to no-ops
 */
module.exports.generator = function (config, logger, fileParser) {

  var self = this;
  var firebaseUrl = config.get('webhook').firebase || 'webhook';
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

  /**
   * Used to get the dns information about a site (used for certain swig functions)
   */
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
      if(error.code === 'PERMISSION_DENIED') {
        console.log('\n========================================================'.red);
        console.log('# Permission denied                                         #'.red);
        console.log('========================================================'.red);
        console.log('#'.red + ' You don\'t have permission to this site or your subscription expired.'.red);
        console.log('# Visit '.red + 'https://billing.webhook.com/site/'.yellow + config.get('webhook').siteName.yellow + '/'.yellow  + ' to manage your subscription.'.red);
        console.log('# ---------------------------------------------------- #'.red)
        process.exit(0);
      } else {
        throw new Error(error);
      }
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

    if(params.item) {
      params.item = params._realGetItem(params.item._type, params.item._id);
    }

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

    // Haha this crazy nonsense is to handle pagination, the swig function "paginate" makes
    // shouldPaginate return true if there are more pages left, so we enter a while loop to
    // generate each page of the pagination (todo one day, abstract this with above code into simple functions)
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

  /**
   * Downloads a zip file from the requested url and extracts it into the main directory
   * @param  {string}   zipUrl     Url to zip file to download
   * @param  {Function}   callback   Callback, first parameter is error (true if error occured);
   */
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


  var resetGenerator = function(callback) {
    logger.ok('Resetting Generator...');
    var zipUrl = 'http://dump.webhook.com/static/generate-repo.zip';

    // Keep track if the request fails to prevent the continuation of the install
    var requestFailed = false;

    // TODO: have this hit different templating repos
    var repoRequest = request(zipUrl);

    repoRequest
    .on('response', function (response) {
      // If we fail, set it as failing and remove zip file
      if (response.statusCode !== 200) {
        requestFailed = true;
        fs.unlinkSync('.reset.zip');
        callback(true);
      }
    })
    .pipe(fs.createWriteStream('.reset.zip'))
    .on('close', function () {
      if (requestFailed) return;

      // Unzip into temporary file
      var zip = new Zip('.reset.zip');

      var entries = zip.getEntries();

      try {
        fs.renameSync('pages', '.pages-old');
      } catch(error) {
        fs.unlinkSync('.reset.zip');
        callback(true);
        return;
      }

      try {
        fs.renameSync('templates', '.templates-old');
      } catch(error) {
        fs.renameSync('.pages-old', 'pages');
        fs.unlinkSync('.reset.zip');
        callback(true);
        return;
      }

      try {
        fs.renameSync('static', '.static-old');
      } catch(error) {
        fs.renameSync('.pages-old', 'pages');
        fs.renameSync('.templates-old', 'templates');
        fs.unlinkSync('.reset.zip');
        callback(true);
        return;
      }

      entries.forEach(function(entry) {
        if(entry.entryName.indexOf('pages/') === 0
           || entry.entryName.indexOf('templates/') === 0
           || entry.entryName.indexOf('static/') === 0) {
          zip.extractEntryTo(entry.entryName, '.', true, true);
        }
      });

      wrench.rmdirSyncRecursive('.pages-old');
      wrench.rmdirSyncRecursive('.templates-old');
      wrench.rmdirSyncRecursive('.static-old');

      fs.unlinkSync('.reset.zip');
      self.init(config.get('webhook').siteName, config.get('webhook').secretKey, true, config.get('webhook').firebase, function() {
        callback();
      });
    });
  };

  /**
  * Extracts a local theme zip into the current generator directory
  * @param zipUrl   The location of the zip file on disk
  * @param callback The callback to call with the data from the theme
  */
  var extractPresetLocal = function(fileData, callback) {

    fs.writeFileSync('.preset.zip', fileData, { encoding: 'base64' });
    // Unzip into temporary file
    var zip = new Zip('.preset.zip');

    var entries = zip.getEntries();

    entries.forEach(function(entry) {
      var newName = entry.entryName.split('/').slice(1).join('/');
      entry.entryName = newName;
    });
    zip.extractAllTo('.', true);

    fs.unlinkSync('.preset.zip');

    if(fs.existsSync('.preset-data.json')) {
      var presetData = fileParser.readJSON('.preset-data.json');

      fs.unlinkSync('.preset-data.json');
      logger.ok('Done extracting.');
      callback(presetData);

    } else {
      logger.ok('Done extracting.');
      callback(null);
    }
  }

  /**
   * Downloads zip file and then sends the preset data for the theme to the CMS for installation
   * @param  {string}   zipUrl     Url to zip file to download
   * @param  {Function}   callback   Callback, first parameter is preset data to send to CMS
   */
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

  var generatedSlugs = {};
  var generateSlug = function(value) {
    if(!generatedSlugs[value._type]) {
      generatedSlugs[value._type] = {};
    }

    if(value.slug) {
      generatedSlugs[value._type][value.slug] = true;
      return value.slug;
    }
    var tmpSlug = slug(value.name).toLowerCase();

    var no = 2;
    while(generatedSlugs[value._type][tmpSlug]) {
      tmpSlug = slug(value.name).toLowerCase() + '_' + no;
      no++;
    }

    generatedSlugs[value._type][tmpSlug] = true;

    return tmpSlug;
  }

  /**
   * Renders all templates in the /templates directory to the build directory
   * @param  {Function}   done     Callback passed either a true value to indicate its done, or an error
   * @param  {Function}   cb       Callback called after finished, passed list of files changed and done function
   */
  this.renderTemplates = function(done, cb) {
    logger.ok('Rendering Templates');
    generatedSlugs = {};

    getData(function(data, typeInfo) {

      glob('templates/**/*.html', function(err, files) {

        files.forEach(function(file) {
          // We ignore partials, special directory to allow making of partial includes
          if(path.extname(file) === '.html' && file.indexOf('templates/partials') !== 0)
          {
            if(path.dirname(file).split('/').length <= 1) {
              return true;
            }
            // Here we try and abstract out the content type name from directory structure
            var baseName = path.basename(file, '.html');
            var newPath = path.dirname(file).replace('templates', './.build').split('/').slice(0,3).join('/');

            var pathParts = path.dirname(file).split('/');
            var objectName = pathParts[1];
            var items = data[objectName];
            var info = typeInfo[objectName];
            var filePath = path.dirname(file);
            var overrideFile = null;

            if(!items) {
              logger.error('Missing data for content type ' + objectName);
            }

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

            var baseNewPath = '';

            // Find if this thing has a template control
            var templateWidgetName = null;

            if(typeInfo[objectName]) {
              typeInfo[objectName].controls.forEach(function(control) {
                if(control.controlType === 'layout') {
                  templateWidgetName = control.name;
                }
              });
            }

            // TODO, DETECT IF FILE ALREADY EXISTS, IF IT DOES APPEND A NUMBER TO IT DUMMY
            if(baseName === 'list')
            {

              if(typeInfo[objectName] && typeInfo[objectName].customUrls && typeInfo[objectName].customUrls.listUrl) {
                var customPathParts = newPath.split('/');

                customPathParts[2] = typeInfo[objectName].customUrls.listUrl;

                newPath = customPathParts.join('/');
              }

              newPath = newPath + '/index.html';
              writeTemplate(file, newPath);

            } else if (baseName === 'individual') {
              // Output should be path + id + '/index.html'
              // Should pass in object as 'item'
              baseNewPath = newPath;
              var previewPath = baseNewPath.replace('./.build', './.build/_wh_previews');

              // TODO: Check to make sure file does not exist yet, and then adjust slug if it does? (how to handle in swig functions)
              for(var key in publishedItems)
              {
                var val = publishedItems[key];

                if(templateWidgetName) {
                  overrideFile = 'templates/' + objectName + '/layouts/' + val[templateWidgetName];
                }

                if(typeInfo[objectName] && typeInfo[objectName].customUrls && typeInfo[objectName].customUrls.individualUrl) {
                  var customPathParts = baseNewPath.split('/');

                  customPathParts[2] = utils.parseCustomUrl(typeInfo[objectName].customUrls.individualUrl, val);

                  baseNewPath = customPathParts.join('/');
                }

                var tmpSlug = generateSlug(val);

                val.slug = tmpSlug;

                newPath = baseNewPath + '/' + tmpSlug + '/index.html';

                if(fs.existsSync(overrideFile)) {
                  writeTemplate(overrideFile, newPath, { item: val });
                } else {
                  writeTemplate(file, newPath, { item: val });
                }
              }

              for(var key in items)
              {
                var val = items[key];

                if(templateWidgetName) {
                  overrideFile = 'templates/' + objectName + '/layouts/' + val[templateWidgetName];
                }

                newPath = previewPath + '/' + val.preview_url + '/index.html';

                if(fs.existsSync(overrideFile)) {
                  writeTemplate(overrideFile, newPath, { item: val });
                } else {
                  writeTemplate(file, newPath, { item: val });
                }
              }
            } else if(filePath.indexOf('templates/' + objectName + '/layouts') !== 0) { // Handle sub pages in here
              baseNewPath = newPath;

              var middlePathName = filePath.replace('templates/' + objectName, '') + '/' + baseName;
              middlePathName = middlePathName.substring(1);

              for(var key in publishedItems)
              {
                var val = publishedItems[key];

                if(typeInfo[objectName] && typeInfo[objectName].customUrls && typeInfo[objectName].customUrls.individualUrl) {
                  var customPathParts = baseNewPath.split('/');

                  customPathParts[2] = utils.parseCustomUrl(typeInfo[objectName].customUrls.individualUrl, val);

                  baseNewPath = customPathParts.join('/');
                }

                var tmpSlug = generateSlug(val);

                val.slug = tmpSlug;

                newPath = baseNewPath + '/' + tmpSlug + '/' + middlePathName + '/index.html';
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

  /**
   * Copies the static directory into .build/static for asset generation
   * @param  {Function}   callback     Callback called after creation of directory is done
   */
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

  this.checkScaffoldingMD5 = function(name, callback) {
    self.cachedData = null;
    getData(function(data, typeInfo) {
      var directory = 'templates/' + name + '/';
      var individual = directory + 'individual.html';
      var list = directory + 'list.html';
      var oneOff = 'pages/' + name + '.html';

      var individualMD5 = null;
      var listMD5 = null;
      var oneOffMD5 = null;

      if(typeInfo[name].oneOff) {
        if(fs.existsSync(oneOff)) {
          var oneOffContent = fs.readFileSync(oneOff);
          oneOffMD5 = md5(oneOffContent);
        }
      } else {
        if(fs.existsSync(individual)) {
          var indContent = fs.readFileSync(individual);
          individualMD5 = md5(indContent);
        }

        if(fs.existsSync(list)) {
          var listContent = fs.readFileSync(list);
          listMD5 = md5(listContent);
        }
      }

      callback(individualMD5, listMD5, oneOffMD5);
    });
  }

  /**
   * Generates scaffolding for content type with name
   * @param  {String}   name     Name of content type to generate scaffolding for
   * @param  {Function}   done     Callback called when scaffolding generation is done
   * @param  {Boolean}   force    If true, forcibly overwrites old scaffolding
   */
  this.makeScaffolding = function(name, done, force) {
    logger.ok('Creating Scaffolding\n');
    var directory = 'templates/' + name + '/';

    var list = directory + 'list.html';
    var individual = directory +  'individual.html';
    var oneOff = 'pages/' + name + '.html';

    var individualTemplate = fs.readFileSync('./libs/scaffolding_individual.html');
    var listTemplate = fs.readFileSync('./libs/scaffolding_list.html');
    var oneOffTemplate = fs.readFileSync('./libs/scaffolding_oneoff.html');

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

      var individualMD5 = null;
      var listMD5 = null;
      var oneOffMD5 = null;

      if(typeInfo[name].oneOff) {
        if(!force && fs.existsSync(oneOff)) {
          if(done) done(null, null, null);
          logger.error('Scaffolding for ' + name + ' already exists, use --force to overwrite');
          return false;
        }

        var oneOffFile = _.template(oneOffTemplate, { widgetFiles: widgetFiles, typeName: name, typeInfo: typeInfo[name] || {}, controls: controlsObj }, { 'imports': { 'renderWidget' : renderWidget}});
        oneOffFile = oneOffFile.replace(/^\s*\n/gm, '');

        oneOffMD5 = md5(oneOffFile);
        fs.writeFileSync(oneOff, oneOffFile);
      } else {

        if(!force && fs.existsSync(directory)) {
          if(done) done(null, null, null);
          logger.error('Scaffolding for ' + name + ' already exists, use --force to overwrite');
          return false;
        }

        mkdirp.sync(directory);

        var template = _.template(individualTemplate, { widgetFiles: widgetFiles, typeName: name, typeInfo: typeInfo[name] || {}, controls: controlsObj }, { 'imports': { 'renderWidget' : renderWidget}});
        template = template.replace(/^\s*\n/gm, '');

        individualMD5 = md5(template);
        fs.writeFileSync(individual, template);

        var lTemplate = _.template(listTemplate, { typeName: name });

        listMD5 = md5(lTemplate);
        fs.writeFileSync(list, lTemplate);
      }

      if(done) done(individualMD5, listMD5, oneOffMD5);
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
   * Starts a live reload server, which will refresh the pages when signaled
   */
  this.startLiveReload = function() {
    tinylr().listen(liveReloadPort);
  };

  /**
   * Sends a message to the CMS through a websocket initiated by the CMS
   * @param  {String}      message    Message to send
   */
  this.sendSockMessage = function(message) {
    if(websocket) {
      websocket.send('message:' + JSON.stringify(message));
    }
  };

  /*
    Runs 'wh push', used by web listener to give push button on CMS
  */
  var pushSite = function(callback) {
    var command = spawn('wh', ['push'], {
      stdio: 'inherit',
      cwd: '.'
    });

    command.on('error', function() {
      callback(true);
    });

    command.on('close', function(exit, signal) {

      if(exit === 0) {
        callback(null);
      } else {
        callback(exit);
      }

    });
  }

  /**
   * Starts a websocket listener on 0.0.0.0 (for people who want to run wh serv over a network)
   * Accepts messages for generating scaffolding and downloading preset themes.
   */
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
          self.makeScaffolding(name, function(individualMD5, listMD5, oneOffMD5) {
            sock.send('done:' + JSON.stringify({ individualMD5: individualMD5, listMD5: listMD5, oneOffMD5: oneOffMD5 }));
          });
        } else if (message.indexOf('scaffolding_force:') === 0) {
          var name = message.replace('scaffolding_force:', '');
          self.makeScaffolding(name, function(individualMD5, listMD5, oneOffMD5) {
            sock.send('done:' + JSON.stringify({ individualMD5: individualMD5, listMD5: listMD5, oneOffMD5: oneOffMD5 }));
          }, true);
        } else if (message.indexOf('check_scaffolding:') === 0) {
          var name = message.replace('check_scaffolding:', '');
          self.checkScaffoldingMD5(name, function(individualMD5, listMD5, oneOffMD5) {
            sock.send('done:' + JSON.stringify({ individualMD5: individualMD5, listMD5: listMD5, oneOffMD5: oneOffMD5 }));
          });
        } else if (message === 'reset_files') {
          resetGenerator(function(error) {
            if(error) {
              sock.send('done:' + JSON.stringify({ err: 'Error while resetting files' }));
            } else {
              sock.send('done');
            }
          });
        } else if (message === 'supported_messages') {
          sock.send('done:' + JSON.stringify([
            'scaffolding', 'scaffolding_force', 'check_scaffolding', 'reset_files', 'supported_messages',
            'push', 'build', 'preset', 'layouts', 'preset_localv2', 'generate_slug'
          ]));
        } else if (message.indexOf('generate_slug:') === 0) {
          var name = JSON.parse(message.replace('generate_slug:', ''));
          sock.send('done:' + JSON.stringify(slug(name).toLowerCase()));
        } else if (message === 'push') {
          pushSite(function(error) {
            if(error) {
              sock.send('done:' + JSON.stringify({ err: 'Error while pushing site.' }));
            } else {
              sock.send('done');
            }
          });
        } else if (message === 'build') {
          buildQueue.push({}, function(err) {});
        } else if (message.indexOf('preset_local:') === 0) {
          var fileData = message.replace('preset_local:', '');

          if(!fileData) {
            sock.send('done');
            return;
          }

          extractPresetLocal(fileData, function(data) {
            var command = spawn('npm', ['install'], {
              stdio: 'inherit',
              cwd: '.'
            });

            command.on('close', function() {
              sock.send('done:' + JSON.stringify(data));
            });
          });
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
        } else {
          sock.send('done');
        }
      });
    });
  };

  /**
   * Inintializes firebase configuration for a new site
   * @param  {String}    sitename  Name of site to generate config for
   * @param  {String}    secretkey Secret key for the site (gotten from firebase)
   * @param  {Boolean}   copyCms   True if the CMS should be overwritten, false otherwise
   * @param  {Function}  done      Callback to call when operation is done
   */
  this.init = function(sitename, secretkey, copyCms, firebase, done) {
    var confFile = fs.readFileSync('./libs/.firebase.conf.jst');

    if(firebase) {
      confFile = fs.readFileSync('./libs/.firebase-custom.conf.jst');
    }

    // TODO: Grab bucket information from server eventually, for now just use the site name
    var templated = _.template(confFile, { secretKey: secretkey, siteName: sitename, firebase: firebase });

    fs.writeFileSync('./.firebase.conf', templated);

    if(copyCms) {
      var cmsFile = fs.readFileSync('./libs/cms.html');

      var cmsTemplated = _.template(cmsFile, { siteName: sitename });

      mkdirp.sync('./pages/');

      fs.writeFileSync('./pages/cms.html', cmsTemplated);
    }

    done(true);
  };

  /**
   * Sets up asset generation (automatic versioning) for pushing to production
   * @param  {Object}    grunt  Grunt object from generatorTasks
   */
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

  /**
   * Run asset versioning software if configs exist for them
   * @param  {Object}    grunt  Grunt object from generatorTasks
   */
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

  /**
   * Finish asset versioning
   * @param  {Object}    grunt  Grunt object from generatorTasks
   */
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

  /**
   * Enables strict mode, exceptions cause full crash, normally for production (so bad generators do not ruin sites)
   */
  this.enableStrictMode = function() {
    strictMode = true;
  }


  return this;
};
