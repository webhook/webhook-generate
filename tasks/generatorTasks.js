
var curVersion = 'v2';

var firebase = require('firebase');

module.exports = function(grunt) {

  var firebaseUrl = grunt.config.get('webhook').firebase || '';
  var root = null;
  if(firebaseUrl) {
    root = new firebase('https://' + firebaseUrl +  '.firebaseio.com/');
  }

  var checkVersion = function(callback) {
    if(root === null) {
      callback();
    } else {
      root.child('generator_version').once('value', function(snap) {
        if(snap.val() !== curVersion) {
          console.log('Your site is using an old version of Webhook. Please run wh update in your site directory.'.red)
         }

         callback();
      });
    }
  };

  var generator = require('../libs/generator').generator(grunt.config, grunt.log, grunt.file);

  grunt.registerTask('buildTemplates', 'Generate static files from templates directory', function() {
    var done = this.async();
    generator.renderTemplates(done, generator.reloadFiles);
  });

  grunt.registerTask('buildPages', 'Generate static files from pages directory', function() {
    var done = this.async();
    generator.renderPages(done, generator.reloadFiles);
  });

  grunt.registerTask('scaffolding', 'Generate scaffolding for a new object', function(name) {
    var done = this.async();

    var force = grunt.option('force');


    var result = generator.makeScaffolding(name, done, force);

    if(!result) {
      grunt.log.error('Scaffolding for ' + name + ' already exists, use --force to overwrite');
    }
  });

  grunt.registerTask('watch', 'Watch for changes in templates and regenerate site', function() {
    generator.startLiveReload();
    grunt.task.run('simple-watch');
  });

  grunt.registerTask('webListener', 'Listens for commands from CMS through websocket', function() {
    var done = this.async();
    generator.webListener(done);
  });

  grunt.registerTask('webListener-open', 'Listens for commands from CMS through websocket', function() {
    var done = this.async();
    generator.webListener(done);

    grunt.util.spawn({
      grunt: true,
      args: ['open:wh-open'].concat(grunt.option.flags()),
      opts: { stdio: 'inherit' }
    }, function (err, result, code) {
      if (err || code > 0) {
        grunt.warn(result.stderr || result.stdout);
      }
      grunt.log.writeln('\n' + result.stdout);
    });
  });

  grunt.registerTask('clean', 'Clean build files', function() {
    var done = this.async();
    generator.cleanFiles(done);
  });

  // Build Task.
  grunt.registerTask('build', 'Clean files and then generate static site into build', function() {
    var done = this.async();

    var versionString = grunt.option('build-version');

    if(versionString)
    {
      generator.setBuildVersion(versionString);
    }

    checkVersion(function() {
      generator.buildBoth(done, generator.reloadFiles);
    })
  });

  // Change this to optionally prompt instead of requiring a sitename
  grunt.registerTask('assets', 'Initialize the firebase configuration file (installer should do this as well)', function() {
    generator.assets(grunt);
  });

  grunt.registerTask('assetsAfter', 'Initialize the firebase configuration file (installer should do this as well)', function() {
    generator.assetsAfter(grunt);
  });

  // Change this to optionally prompt instead of requiring a sitename
  grunt.registerTask('init', 'Initialize the firebase configuration file (installer should do this as well)', function() {
    var done = this.async();

    var sitename = grunt.option('sitename');
    var secretkey = grunt.option('secretkey');

    generator.init(sitename, secretkey, done);
  });

  // Check if initialized properly before running all these tasks
  grunt.registerTask('default',  'Clean, Build, Start Local Server, and Watch', function() {
    grunt.task.run('connect:wh-server');
    grunt.task.run('build');
    grunt.task.run('concurrent:wh-concurrent');
  });

};
