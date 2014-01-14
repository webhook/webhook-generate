module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    firebase: 'ltsquigs'
  });

  var Firebase = require('firebase');
  var mkdirp = require('mkdirp');
  var path = require('path');
  var swig  = require('swig');
  var fs = require('fs');
  var dir = require('node-dir')

  // Default task(s).
  grunt.registerTask('default', function() {

    grunt.log.write('Connecting to firebase \n');
    var root = new Firebase('https://' + grunt.config.get('firebase') +  '.firebaseio.com/');

    var done = this.async();

    grunt.log.write('Loading Data \n');
    var data = root.child("gamesFinder").on('value', function(dataSnapshot) {

      grunt.log.write('Finding Templates \n');

      dir.files('templates', function(err, files) {

        grunt.log.write('Rendering Templates \n');

        // TODO FILTER ONLY HTML FILES
        files.forEach(function(file) {
          var output = swig.renderFile(file, {
            data: dataSnapshot.val()
          });

          var newFile = file.replace('templates', './out/');

          mkdirp.sync(path.dirname(newFile));
          
          fs.writeFile(newFile, output)
          
        });

        done(true);
      });
    });
  });

};