var fs = require('fs');

module.exports = function(grunt) {

  var conf = {};

  try {
    conf = grunt.file.readJSON('./.firebase.conf');
  } catch (err) {
    conf = {};
  }

  var oldConfig = grunt.config.data;

  var mergeConfig = {
    webhook: conf,

    open : {
      'wh-open': {
        path: 'http://localhost:2002/cms/'
      }
    },

    connect: {
      'wh-server': {
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
      'wh-watch': {
        files: ['pages/**/*.html', 'templates/**/*.html'],
        tasks: ['build'],
        dateFormat: function(time) {
          grunt.log.write('here');
        }
      }
    },

    concurrent: {
      options: {
        logConcurrentOutput: true
      },
      "wh-concurrent": {
        tasks: ["wh-watch", "webListener-open"]
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