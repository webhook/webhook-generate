module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    firebase: 'ltsquigs-new',

    open : {
      dev: {
        path: 'http://localhost:2002'
      }
    },

    connect: {
      server: {
        options: {
          port: 2002,
          base: '.build',
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

  var generator = require('./libs/generator').generator(grunt.config.get('firebase'), grunt.log);

  grunt.registerTask('buildTemplates', 'Generate static files from templates directory', function() {
    var done = this.async();
    generator.renderTemplates(done, generator.reloadFiles);
  });

  grunt.registerTask('buildPages', 'Generate static files from pages directory', function() {
    var done = this.async();
    generator.renderPages(done, generator.reloadFiles);
  });

  grunt.registerTask('scaffolding', 'Generate scaffolding for a new object', function(name) {
    generator.makeScaffolding(name);
  });

  grunt.registerTask('watch', 'Watch for changes in templates and regenerate site', function() {
    generator.startLiveReload();
    grunt.task.run('simple-watch');
  })

  grunt.registerTask('watchFirebase', 'Watch for changes in firebase and regenerate site', function() {
    var done = this.async();
    generator.watchFirebase();
  });

  grunt.registerTask('clean', 'Clean build files', function() {
    var done = this.async();
    generator.cleanFiles(null, done);
  });

  // Build Task.
  grunt.registerTask('build', 'Clean files and then generate static site into build', function() {
    var done = this.async();
    generator.buildBoth(generator.reloadFiles, done);
  });

  grunt.registerTask('default',  'Clean, Build, Start Local Server, and Watch', ['build', 'connect', 'open', 'concurrent']);

  grunt.loadNpmTasks('grunt-simple-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-concurrent');
};