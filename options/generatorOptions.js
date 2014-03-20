var fs = require('fs');
var proxy = require('proxy-middleware');
var url = require('url');
var header = require('connect-header');

module.exports = function(grunt) {

  var conf = {};

  try {
    conf = grunt.file.readJSON('./.firebase.conf');
  } catch (err) {
    conf = {};
  }

  var oldConfig = grunt.config.data;
  
  var proxyOptions = url.parse('http://' + conf.siteName + '.webhook.org/webhook-uploads');
  proxyOptions.route = '/webhook-uploads';

  var mergeConfig = {
    webhook: conf,

    open : {
      'wh-open': {
        path: 'http://localhost:2002/'
      }
    },

    connect: {
      'wh-server': {
        options: {
          port: 2002,
          hostname: '*',
          base: '.build',
          livereload: 35730,
          middleware: function(connect, options) {
            // Return array of whatever middlewares you want
            return [
              header({ 'X-Webhook-Local' : true }),
              connect.static(options.base),
              proxy(proxyOptions),
              function(req, res, next) {
                if ('GET' != req.method && 'HEAD' != req.method) return next();

                var contents = fs.readFileSync('./libs/debug404.html');
                res.end(contents);
              },
            ];
          }
        }
      }
    },

    watch: {
      'wh-watch': {
        files: ['pages/**/*', 'templates/**/*', 'static/**/*'],
        tasks: ['build']
      }
    },

    concurrent: {
      options: {
        logConcurrentOutput: true
      },
      "wh-concurrent": {
        tasks: ["watch", "webListener-open"]
      }
    },

    // Compile static assets into dist/static
    // Copy pages/html files into dist/pages and dist/html
    // Run rev on dist/static and then run usemin on dist/pages and dist/html
    // Copy unmodified static folder into dist/static

    useminPrepare: {
      src: ['dist/pages/**/*.html', 'dist/templates/**/*.html'],
      options: {
        root: '.',
        dest: 'dist'
      }
    },

    rev: {
      assets: {
        files: [{
          src: [
            'dist/static/**/*.{jpg,jpeg,gif,png,js,css,eot,svg,ttf,woff}',
          ]
        }]
      }
    },

    usemin: {
      html: ['dist/pages/**/*.html', 'dist/templates/**/*.html'],
      options: {
        assetsDirs: ['dist']
      }
    }
  };

  for(var key in mergeConfig) {
    if(oldConfig[key]) {
      var oldData = oldConfig[key];
      grunt.util._.extend(oldData, mergeConfig[key]);
      oldConfig[key] = oldData;
    } else {
      oldConfig[key] = mergeConfig[key];
    }
  }

  grunt.initConfig(oldConfig);
};
